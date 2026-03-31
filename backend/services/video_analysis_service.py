import json
import os
import subprocess
import time
import traceback
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import cv2
import httpx
import numpy as np
from dotenv import load_dotenv
from pymongo import MongoClient
from ultralytics import YOLO
import supervision as sv

from services.job_manager import update_job, fail_job, complete_job

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME    = "VisionCore"
COLLECTION = "AnalysisHistory"

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "yolo")
MODEL_MAP = {
    "n": "yolo26n.pt",
    "s": "yolo26s.pt",
    "m": "yolov8s.pt",
}

_PALETTE = [
    (255,  56,  56), (255, 157,  51), (255, 112,  31), (255, 178,  29),
    ( 27, 197, 189), ( 43, 153, 245), ( 48, 119, 245), ( 55,  38, 251),
    (183, 228, 255), (212, 190, 255), (169, 255, 189), (255, 250, 107),
]

_models: dict[str, YOLO] = {}

def _sanitize(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[^a-z0-9-_]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_")

def _generate_title_sync(class_stats: list, detection_summary: dict, filename: str) -> str:
    top = ", ".join(c["class"] for c in class_stats[:4]) if class_stats else "unknown"
    prompt = (
        f"Generate a short 3-6 word filename for a video. "
        f"Filename: {filename}. "
        f"Top detected objects: {top}. "
        f"Total detections: {detection_summary.get('total_detections', 0)}, "
        f"unique objects: {detection_summary.get('total_unique_objects', 0)}. "
        f"Return ONLY the filename."
    )

    key   = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv("OPENROUTER_MODEL", "google/gemini-1.5-pro")

    try:
        res = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type":  "application/json",
                "HTTP-Referer":  os.getenv("APP_URL", "http://localhost:8000"),
                "X-Title":       os.getenv("APP_NAME", "VisionCore"),
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 20,
                "temperature": 0.4,
            },
            timeout=15,
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"].strip()
        return _sanitize(content) if content else _sanitize(os.path.splitext(filename)[0])
    except Exception:
        return _sanitize(os.path.splitext(filename)[0])

def _get_collection():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]

def _get_model(model_size: str) -> YOLO:
    if model_size not in _models:
        filename = MODEL_MAP.get(model_size, MODEL_MAP["s"])
        path     = os.path.join(MODEL_DIR, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"YOLO model not found: {path}")
        _models[model_size] = YOLO(path)
    return _models[model_size]

def _color_for(class_id: int):
    return _PALETTE[class_id % len(_PALETTE)]

def _centroid(x1: int, y1: int, x2: int, y2: int):
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0

class TrackRecord:
    def __init__(self, track_id: int, class_label: str, class_id: int, first_frame: int):
        self.track_id    = track_id
        self.class_label = class_label
        self.class_id    = class_id
        self.first_frame = first_frame
        self.last_frame  = first_frame
        self.confs:      list[float]                     = []
        self.centroids:  list[tuple[float, float]]       = []
        self.boxes:      list[tuple[int, int, int, int]] = []

    def update(self, frame_idx: int, conf: float, x1: int, y1: int, x2: int, y2: int):
        self.last_frame = frame_idx
        self.confs.append(conf)
        self.centroids.append(_centroid(x1, y1, x2, y2))
        self.boxes.append((x1, y1, x2, y2))

    @property
    def frame_count(self):
        return len(self.confs)

    @property
    def conf_min(self):
        return round(min(self.confs), 3) if self.confs else 0.0

    @property
    def conf_max(self):
        return round(max(self.confs), 3) if self.confs else 0.0

    @property
    def conf_avg(self):
        return _mean(self.confs)

    @property
    def travel_px(self):
        if len(self.centroids) < 2:
            return 0.0
        return round(sum(
            ((self.centroids[i][0] - self.centroids[i - 1][0]) ** 2 +
             (self.centroids[i][1] - self.centroids[i - 1][1]) ** 2) ** 0.5
            for i in range(1, len(self.centroids))
        ), 2)

    @property
    def avg_box_area(self):
        if not self.boxes:
            return 0.0
        return round(sum((x2 - x1) * (y2 - y1) for x1, y1, x2, y2 in self.boxes) / len(self.boxes), 1)

    def to_dict(self):
        cx, cy = self.centroids[-1] if self.centroids else (0, 0)
        return {
            "track_id":         self.track_id,
            "class":            self.class_label,
            "first_frame":      self.first_frame,
            "last_frame":       self.last_frame,
            "frame_count":      self.frame_count,
            "conf_min":         self.conf_min,
            "conf_max":         self.conf_max,
            "conf_avg":         self.conf_avg,
            "travel_px":        self.travel_px,
            "avg_box_area_px2": self.avg_box_area,
            "last_centroid":    {"x": round(cx, 1), "y": round(cy, 1)},
        }

def analyze_video_job(
    job_id:         str,
    video_path:     str,
    output_dir:     str,
    fps:            float = 1.0,
    model_size:     str   = "s",
    conf_threshold: float = 0.25,
    imgsz:          int   = 640,
) -> None:
    start_time = time.time()
    filename   = os.path.basename(video_path)

    try:
        update_job(job_id, status="running", progress=0)
        model = _get_model(model_size)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        try:
            src_fps      = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration_s   = round(total_frames / src_fps, 2) if src_fps else 0.0

            update_job(job_id, total_frames=total_frames)

            frame_step   = max(1, int(round(src_fps / fps)))
            raw_filename = os.path.join(output_dir, "annotated_raw.mp4")
            out_filename = os.path.join(output_dir, "annotated.mp4")
            summary_path = os.path.join(output_dir, "summary.json")

            writer = cv2.VideoWriter(
                raw_filename, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
            )

            tracker = sv.ByteTrack(
                track_activation_threshold=conf_threshold,
                lost_track_buffer=30,
                minimum_matching_threshold=0.8,
                frame_rate=int(fps),
            )

            track_registry       = {}
            class_tracks         = defaultdict(set)
            detections_per_frame = []
            inference_times      = []
            performance_log      = []

            frame_idx        = 0
            processed_frames = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % frame_step != 0:
                    frame_idx += 1
                    continue

                t0           = time.perf_counter()
                results      = model(frame, conf=conf_threshold, imgsz=imgsz, verbose=False)
                inference_ms = (time.perf_counter() - t0) * 1000
                inference_times.append(inference_ms)

                raw_boxes, raw_confs, raw_cls_ids = [], [], []
                for result in results:
                    if result.boxes:
                        for box in result.boxes:
                            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                            raw_boxes.append([x1, y1, x2, y2])
                            raw_confs.append(float(box.conf.item()))
                            raw_cls_ids.append(int(box.cls.item()))

                sv_dets = sv.Detections(
                    xyxy=np.array(raw_boxes, dtype=np.float32) if raw_boxes else np.empty((0, 4), dtype=np.float32),
                    confidence=np.array(raw_confs, dtype=np.float32) if raw_confs else np.empty(0, dtype=np.float32),
                    class_id=np.array(raw_cls_ids, dtype=int) if raw_cls_ids else np.empty(0, dtype=int),
                )

                tracked_dets    = tracker.update_with_detections(sv_dets)
                annotated       = frame.copy()
                frame_det_count = len(tracked_dets)

                for i in range(frame_det_count):
                    x1, y1, x2, y2 = [int(v) for v in tracked_dets.xyxy[i]]
                    cls_id   = int(tracked_dets.class_id[i])
                    conf     = float(tracked_dets.confidence[i])
                    track_id = int(tracked_dets.tracker_id[i])
                    label    = model.names.get(cls_id, str(cls_id))
                    color    = _color_for(cls_id)

                    if track_id not in track_registry:
                        track_registry[track_id] = TrackRecord(track_id, label, cls_id, frame_idx)
                    track_registry[track_id].update(frame_idx, conf, x1, y1, x2, y2)
                    class_tracks[label].add(track_id)

                    label_txt = f"#{track_id} {label} {conf:.2f}"
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                    (tw, th), _ = cv2.getTextSize(label_txt, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    cv2.rectangle(annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
                    cv2.putText(annotated, label_txt, (x1 + 2, y1 - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

                writer.write(annotated)
                detections_per_frame.append(frame_det_count)
                processed_frames += 1

                progress = int((frame_idx / max(total_frames, 1)) * 100)
                performance_log.append({
                    "frame": frame_idx,
                    "inference_ms": round(inference_ms, 1),
                    "detections": frame_det_count,
                    "unique_so_far": len(track_registry),
                })

                update_job(
                    job_id,
                    progress=progress,
                    total_detections=sum(detections_per_frame),
                    unique_objects=len(track_registry),
                    performance_log=performance_log[-50:],
                )

                frame_idx += 1

        finally:
            cap.release()
            writer.release()

        ffmpeg_path = r"C:\Program Files\ffmpeg8.1\bin\ffmpeg.exe"
        try:
            subprocess.run(
                f'"{ffmpeg_path}" -y -i "{raw_filename}" -vcodec libx264 -pix_fmt yuv420p -movflags +faststart "{out_filename}"',
                check=True, shell=True
            )
            os.remove(raw_filename)
        except Exception:
            os.rename(raw_filename, out_filename)

        elapsed          = round(time.time() - start_time, 2)
        total_detections = sum(detections_per_frame)
        total_unique     = len(track_registry)
        throughput_fps   = round(processed_frames / elapsed, 2) if elapsed else 0.0
        avg_inf          = _mean(inference_times)
        max_inf          = round(max(inference_times), 1) if inference_times else 0.0
        min_inf          = round(min(inference_times), 1) if inference_times else 0.0
        avg_det_density  = _mean(detections_per_frame) if detections_per_frame else 0.0
        max_det_frame    = max(detections_per_frame) if detections_per_frame else 0

        class_stats_list = []
        class_stats_map = {}
        for r in track_registry.values():
            cls = r.class_label
            if cls not in class_stats_map:
                class_stats_map[cls] = {
                    "class": cls,
                    "unique_tracks": 0,
                    "total_detections": 0,
                    "avg_conf": [],
                    "avg_travel_px": [],
                    "avg_box_area_px2": [],
                }
            cs = class_stats_map[cls]
            cs["unique_tracks"] += 1
            cs["total_detections"] += r.frame_count
            cs["avg_conf"].append(r.conf_avg)
            cs["avg_travel_px"].append(r.travel_px)
            cs["avg_box_area_px2"].append(r.avg_box_area)

        for cs in class_stats_map.values():
            cs["avg_conf"] = _mean(cs["avg_conf"])
            cs["avg_travel_px"] = _mean(cs["avg_travel_px"])
            cs["avg_box_area_px2"] = _mean(cs["avg_box_area_px2"])
            class_stats_list.append(cs)

        top_classes = sorted(
            [{"class": cls, "unique_tracks": len(ids)} for cls, ids in class_tracks.items()],
            key=lambda d: d["unique_tracks"], reverse=True,
        )[:10]

        detection_summary = {
            "total_detections": total_detections,
            "total_unique_objects": total_unique,
            "num_classes": len(class_tracks),
            "avg_detections_per_frame": avg_det_density,
            "max_detections_in_frame": max_det_frame,
        }

        rich_stats = {
            "video_meta": {
                "width": width,
                "height": height,
                "total_frames": total_frames,
                "source_fps": round(src_fps, 2),
                "processed_fps": fps,
                "frame_step": frame_step,
                "duration_s": duration_s,
            },
            "performance": {
                "elapsed_s": elapsed,
                "throughput_fps": throughput_fps,
                "processed_frames": processed_frames,
                "avg_inference_ms": avg_inf,
                "min_inference_ms": min_inf,
                "max_inference_ms": max_inf,
            },
            "detection_summary": detection_summary,
            "class_stats": class_stats_list,
            "track_details": [r.to_dict() for r in track_registry.values()],
        }

        ai_title = _generate_title_sync(class_stats_list, detection_summary, filename)
        original_base = _sanitize(os.path.splitext(filename)[0])

        if not ai_title or len(ai_title) < 3:
            final_base = original_base
        else:
            final_base = ai_title

        semantic_title = f"{final_base}_annotated"
        final_video_path = os.path.join(output_dir, f"{semantic_title}.mp4")

        try:
            if os.path.exists(out_filename):
                os.rename(out_filename, final_video_path)
        except Exception:
            final_video_path = out_filename

        summary_data = {
            "job_id": job_id,
            "filename": filename,
            "title": ai_title,
            "status": "completed",
            "analysed_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_time": elapsed,
            "total_frames": processed_frames,
            "total_detections": total_detections,
            "total_unique": total_unique,
            "top_classes": top_classes,
            "video_file": final_video_path,
            "summary_file": summary_path,
            "performance_log": performance_log[-50:],
            "rich_stats": rich_stats,
            "summary_json": rich_stats,
            "captions": {},
            "captions_file": None,
        }

        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, indent=2, ensure_ascii=False)

        complete_job(
            job_id,
            video_file=final_video_path,
            summary_file=summary_path,
            total_frames=processed_frames,
            total_detections=total_detections,
            total_unique=total_unique,
            top_classes=top_classes,
            elapsed_time=elapsed,
            performance_log=performance_log[-50:],
            summary=f"Processed {processed_frames} frames. {total_unique} unique objects across {len(class_tracks)} class(es).",
            rich_stats=rich_stats,
        )

        _get_collection().insert_one(summary_data)

    except Exception as exc:
        traceback.print_exc()
        fail_job(job_id, error=str(exc))
        try:
            _get_collection().insert_one({
                "job_id": job_id,
                "filename": filename,
                "status": "failed",
                "analysed_at": datetime.now(timezone.utc),
                "error": str(exc),
            })
        except Exception:
            traceback.print_exc()