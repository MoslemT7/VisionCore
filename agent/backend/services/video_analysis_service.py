import json
import os
import time
from typing import Dict, List, Any, Optional
import logging

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
def _build_model_path(model_size: str) -> str:
    mapping = {"n": "yolov8n.pt", "s": "yolov8s.pt", "m": "yolov8m.pt"}
    return mapping.get((model_size or "s").lower(), "yolov8s.pt")

def _annotate_frame(frame: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    for det in detections:
        x1, y1, x2, y2 = map(int, det.get("bbox", [0, 0, 0, 0]))
        cls_name = det.get("class_name", str(det.get("class_id", "")))
        conf = float(det.get("confidence", 0.0))
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, f"{cls_name}:{conf:.2f}", (x1, max(y1-10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    return frame

def _compute_statistics(detections_all: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute statistics from detections for JSON output."""
    total_frames = len(detections_all)
    total_detections = 0
    class_counts: Dict[str, int] = {}
    
    for frame_entry in detections_all:
        for det in frame_entry.get("detections", []):
            total_detections += 1
            name = det.get("class_name", str(det.get("class_id", "unknown")))
            class_counts[name] = class_counts.get(name, 0) + 1
    
    # Get top classes (most frequent)
    top_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_classes_list = [{"class": name, "count": count} for name, count in top_classes]
    
    return {
        "total_frames": total_frames,
        "total_detections": total_detections,
        "top_classes": top_classes_list
    }

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
        model_path = _build_model_path(model_size)
        detector = PersonDetector(model_path=model_path, conf_threshold=conf_threshold, imgsz=imgsz)

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

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if frame_idx % frame_interval != 0:
                continue

            processed_frame_idx += 1
            detections = detector.detect(frame)
            annotated = _annotate_frame(frame, detections)
            out.write(annotated)

            timestamp_sec = frame_idx / input_fps
            detections_all.append({
                "frame": processed_frame_idx,
                "source_frame_index": frame_idx,
                "timestamp": timestamp_sec,
                "detections": detections
            })

            # ------------------ Logging and progress ------------------
            update_progress(job_id, current_frame=frame_idx, total_frames=total_frames, performance_log=monitor.get_all_data())
            logger.info(f"[Job {job_id}] Frame {frame_idx}/{total_frames}, Detections: {len(detections)}")

        cap.release()
        out.release()
        monitor.stop()

        performance_log = monitor.get_all_data()
        energy_used = estimate_energy(performance_log)
        elapsed_time = time.time() - start_time

        # ------------------ Save outputs ------------------
        detections_file = os.path.join(output_dir, "detections.json")
        with open(detections_file, "w") as f:
            json.dump(detections_all, f, indent=4)

        performance_file = os.path.join(output_dir, "performance.json")
        save_performance_log({"energy_wh": energy_used, "resource_log": performance_log}, performance_file)

        # ------------------ Compute statistics ------------------
        stats = _compute_statistics(detections_all)
        
        # ------------------ LLM summary using local LLaMA ------------------
        try:
            llm_analyzer = LlamaAnalyzer()
            summary = llm_analyzer.analyze_detections(
                detections_all=detections_all,
                energy_wh=energy_used,
                max_frames=50  # Limit for token efficiency
            )
            logger.info(f"[Job {job_id}] LLM summary generated successfully")
        except Exception as e:
            logger.warning(f"[Job {job_id}] LLM summary failed, using fallback: {e}")
            # Fallback summary
            if stats["total_detections"] == 0:
                summary = f"Processed {stats['total_frames']} frames. No objects detected."
            else:
                top_str = ", ".join(f"{c['class']} ({c['count']})" for c in stats["top_classes"][:5])
                summary = f"Processed {stats['total_frames']} frames with {stats['total_detections']} detections. Top objects: {top_str}."

        # ------------------ Build structured result ------------------
        result = {
            "detections_file": detections_file,
            "performance_file": performance_file,
            "performance_log": performance_log,
            "energy_wh": energy_used,
            "video_file": annotated_video_path,
            "elapsed_time": elapsed_time,
            "summary": summary,
            "total_frames": stats["total_frames"],
            "total_detections": stats["total_detections"],
            "top_classes": stats["top_classes"],
        }

        complete_job(job_id, result=result)
        logger.info(f"[Job {job_id}] Completed successfully in {elapsed_time:.2f}s")
        return result

    except Exception as exc:
        monitor.stop()
        fail_job(job_id, error_message=str(exc))
        logger.error(f"[Job {job_id}] Failed: {exc}")
        return None
