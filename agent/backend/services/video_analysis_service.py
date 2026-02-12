import json
import os
import time
import logging
from typing import Dict, List, Any, Optional

import cv2
import numpy as np

from vision.detector import PersonDetector
from monitoring.resource_monitor import ResourceMonitor
from monitoring.energy_estimator import estimate_energy
from monitoring.performance_logger import save_performance_log
from services.job_manager import create_job, update_progress, complete_job, fail_job
from services.llama_analyzer import LlamaAnalyzer

# ------------------ Logger ------------------
logger = logging.getLogger("video_analysis")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
ch.setFormatter(formatter)
logger.addHandler(ch)

# ------------------ Helpers ------------------
def _annotate_frame(frame: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    for det in detections:
        x1, y1, x2, y2 = map(int, det.get("bbox", [0, 0, 0, 0]))
        cls_name = det.get("class_name", str(det.get("class_id", "")))
        conf = float(det.get("confidence", 0.0))
        track_id = det.get("track_id")
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"{cls_name}:{conf:.2f}" if track_id is None else f"{cls_name}#{track_id}:{conf:.2f}"
        cv2.putText(frame, label, (x1, max(y1-10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    return frame


def _synthetic_track_id(det: Dict[str, Any]) -> str:
    """
    Create a best-effort stable-ish ID when tracker does not emit an ID.
    This is NOT a true tracker; it just reduces churn for the LLM prompt.
    """
    cls = det.get("class_id", "x")
    x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
    # Quantize to reduce jitter
    q = lambda v: int(round(float(v) / 10.0) * 10)
    return f"syn_{cls}_{q(x1)}_{q(y1)}_{q(x2)}_{q(y2)}"


def _dedupe_detections_by_track_id(dets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep the highest-confidence detection per track_id (per frame)."""
    best: Dict[Any, Dict[str, Any]] = {}
    for det in dets:
        tid = det.get("track_id")
        if tid is None:
            tid = _synthetic_track_id(det)
            det["track_id"] = tid
        conf = float(det.get("confidence", 0.0))
        prev = best.get(tid)
        if prev is None or conf > float(prev.get("confidence", 0.0)):
            best[tid] = det
    return list(best.values())

# ------------------ Main Analysis Job ------------------
def analyze_video_job(
    job_id: str,
    video_path: str,
    output_dir: str,
    fps: float = 1.0,
    model_size: str = "s",
    conf_threshold: float = 0.25,
    imgsz: int = 640,
) -> Optional[Dict[str, Any]]:

    start_time = time.time()
    os.makedirs(output_dir, exist_ok=True)
    monitor = ResourceMonitor(interval=1)
    monitor.start()
    logger.info(f"[Job {job_id}] Started analysis: {video_path}")

    try:
        detector = PersonDetector(model_size=model_size, conf_threshold=conf_threshold, imgsz=imgsz)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        create_job(job_id, total_frames=total_frames or None)
        input_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        target_fps = max(float(fps), 0.1)
        frame_interval = max(int(round(input_fps / target_fps)), 1)

        ret, first_frame = cap.read()
        if not ret:
            raise RuntimeError("Failed reading first frame.")
        height, width = first_frame.shape[:2]
        annotated_video_path = os.path.join(output_dir, "annotated.mp4")
        out = cv2.VideoWriter(annotated_video_path, cv2.VideoWriter_fourcc(*"mp4v"), target_fps, (width, height))
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        frame_idx = 0
        processed_frame_idx = 0
        detections_all: List[Dict[str, Any]] = []
        # Track objects across frames for narrative summary
        active_tracks: Dict[Any, Dict[str, Any]] = {}

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if frame_idx % frame_interval != 0:
                continue

            processed_frame_idx += 1
            detections = detector.detect(frame)
            new_detections = _dedupe_detections_by_track_id(detections)

            # Update track registry
            timestamp_sec = frame_idx / input_fps
            for det in new_detections:
                tid = det.get("track_id")
                cls_name = det.get("class_name", str(det.get("class_id", "")))
                x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
                cx = (float(x1) + float(x2)) / 2.0
                cy = (float(y1) + float(y2)) / 2.0
                tr = active_tracks.get(tid)
                if tr is None:
                    active_tracks[tid] = {
                        "track_id": tid,
                        "class_name": cls_name,
                        "first_seen_frame": processed_frame_idx,
                        "first_seen_timestamp": timestamp_sec,
                        "last_seen_frame": processed_frame_idx,
                        "last_seen_timestamp": timestamp_sec,
                        "frames_seen": 1,
                        "path": [(timestamp_sec, cx, cy)],
                    }
                else:
                    tr["last_seen_frame"] = processed_frame_idx
                    tr["last_seen_timestamp"] = timestamp_sec
                    tr["frames_seen"] = int(tr.get("frames_seen", 0)) + 1
                    tr.setdefault("path", []).append((timestamp_sec, cx, cy))

            annotated = _annotate_frame(frame, new_detections)
            out.write(annotated)

            detections_all.append({
                "frame": processed_frame_idx,
                "source_frame_index": frame_idx,
                "timestamp": timestamp_sec,
                "detections": new_detections
            })

            update_progress(job_id, current_frame=frame_idx, total_frames=total_frames, performance_log=monitor.get_all_data())
            logger.info(f"[Job {job_id}] Frame {frame_idx}/{total_frames}, Detections: {len(new_detections)}")

        cap.release()
        out.release()
        monitor.stop()

        performance_log = monitor.get_all_data()
        energy_used = estimate_energy(performance_log)
        elapsed_time = time.time() - start_time

        # ------------------ Save detections and performance ------------------
        detections_file = os.path.join(output_dir, "detections.json")
        with open(detections_file, "w") as f:
            json.dump(detections_all, f, indent=4)

        performance_file = os.path.join(output_dir, "performance.json")
        save_performance_log({"energy_wh": energy_used, "resource_log": performance_log}, performance_file)

        # ------------------ LLM Summary ------------------
        try:
            llm_analyzer = LlamaAnalyzer()
            summary = llm_analyzer.analyze_story(
                detections_all=detections_all,
                tracks=list(active_tracks.values()),
                energy_wh=energy_used,
                max_frames=60,
            )

            logger.info(f"[Job {job_id}] LLM summary generated successfully")
        except Exception as e:
            logger.warning(f"[Job {job_id}] LLM summary failed, using fallback: {e}")
            summary = "No significant activity detected or LLM failed."

        summary_file = os.path.join(output_dir, "summary.txt")
        try:
            with open(summary_file, "w", encoding="utf-8") as f:
                f.write(summary.strip() + "\n")
        except Exception as e:
            logger.warning(f"[Job {job_id}] Failed writing summary file: {e}")

        # Basic stats for frontend
        total_detections = sum(len(x.get("detections", [])) for x in detections_all)
        class_counts: Dict[str, int] = {}
        for frame_data in detections_all:
            for det in frame_data.get("detections", []):
                name = det.get("class_name", "unknown")
                class_counts[name] = class_counts.get(name, 0) + 1
        top_classes = sorted(class_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]

        # ------------------ Build final result ------------------
        result = {
            "detections_file": detections_file,
            "performance_file": performance_file,
            "performance_log": performance_log,
            "energy_wh": energy_used,
            "video_file": annotated_video_path,
            "elapsed_time": elapsed_time,
            "summary": summary,
            "summary_file": summary_file,
            "total_frames": len(detections_all),
            "total_detections": total_detections,
            "top_classes": [{"class_name": k, "count": v} for k, v in top_classes],
        }

        complete_job(job_id, result=result)
        logger.info(f"[Job {job_id}] Completed successfully in {elapsed_time:.2f}s")
        return result

    except Exception as exc:
        monitor.stop()
        fail_job(job_id, error_message=str(exc))
        logger.error(f"[Job {job_id}] Failed: {exc}")
        return None
