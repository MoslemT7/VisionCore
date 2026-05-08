import json
import os
import re
import time
import traceback
from collections import Counter
from datetime import datetime, timezone

import cv2
import joblib
import numpy as np
from dotenv import load_dotenv
from pymongo import MongoClient
from scipy.spatial.distance import cdist
from ultralytics import YOLO

from services.job_manager import update_job, fail_job, complete_job
from services.settings_service import get_settings

load_dotenv()

MONGO_URI        = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME          = "VisionCore"
COLLECTION       = "AnalysisHistory"
MODEL_PATH       = os.getenv("YOLO_MODEL_PATH", r"M:\Projects\PFE\backend\models\yolo\models_output\bestv2.pt")
POSE_YOLO_PATH   = os.getenv("YOLO_POSE_PATH",  r"M:\Projects\PFE\backend\models\yolo\yolo26x-pose.pt")
POSE_CLF_PATH    = r"M:\Projects\PFE\backend\models\pose_classifier\pose_classifier.pkl"
POSE_SCALER_PATH = r"M:\Projects\PFE\backend\models\pose_classifier\scaler.pkl"
POSE_META_PATH   = r"M:\Projects\PFE\backend\models\pose_classifier\meta.json"

IMGSZ        = 640
SCALE_UP     = 4
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

POSE_COLORS = {
    "standing": (0,   220, 120),
    "lying":    (0,   100, 255),
    "walking":  (255, 180,   0),
    "sitting":  (180,   0, 255),
    "running":  (0,   220, 255),
    "unknown":  (120, 120, 120),
}

_det_model:  YOLO | None = None
_pose_model: YOLO | None = None
_classifier        = None
_scaler            = None
_pose_meta         = None


def _get_det_model() -> YOLO:
    global _det_model
    if _det_model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Detection model not found: {MODEL_PATH}")
        _det_model = YOLO(MODEL_PATH)
    return _det_model


def _get_pose_model() -> YOLO:
    global _pose_model
    if _pose_model is None:
        _pose_model = YOLO(POSE_YOLO_PATH)
    return _pose_model


def _get_classifier():
    global _classifier, _scaler, _pose_meta
    if _classifier is None:
        _classifier = joblib.load(POSE_CLF_PATH)
        _scaler     = joblib.load(POSE_SCALER_PATH)
        with open(POSE_META_PATH) as f:
            _pose_meta = json.load(f)
    return _classifier, _scaler, _pose_meta


def _natural_key(path):
    base = os.path.basename(path).lower()
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", base)]


def _mean(values):
    return round(sum(values) / len(values), 3) if values else 0.0


def _centroid(x1, y1, x2, y2):
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _run_pose(frame, bbox):
    x1, y1, x2, y2 = bbox
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    h, w     = crop.shape[:2]
    upscaled = cv2.resize(crop, (w * SCALE_UP, h * SCALE_UP), interpolation=cv2.INTER_LANCZOS4)
    results  = _get_pose_model()(upscaled, verbose=False)
    if not results or results[0].keypoints is None:
        return None
    kps_data = results[0].keypoints.data
    if len(kps_data) == 0:
        return None
    kps = kps_data[0].cpu().numpy()
    bw  = max(x2 - x1, 1)
    bh  = max(y2 - y1, 1)
    keypoints = []
    for idx, kp in enumerate(kps):
        ax = float(kp[0]) / SCALE_UP + x1
        ay = float(kp[1]) / SCALE_UP + y1
        keypoints.append({
            "name":   KEYPOINT_NAMES[idx] if idx < len(KEYPOINT_NAMES) else f"kp_{idx}",
            "x_abs":  round(ax, 2),
            "y_abs":  round(ay, 2),
            "x_norm": round((ax - x1) / bw, 4),
            "y_norm": round((ay - y1) / bh, 4),
            "conf":   round(float(kp[2]), 3),
        })
    return keypoints


def _extract_features(keypoints):
    feats = []
    for kp in keypoints:
        feats += [kp["x_norm"], kp["y_norm"], kp["conf"]]

    def get(name):
        for kp in keypoints:
            if kp["name"] == name:
                return kp["x_norm"], kp["y_norm"], kp["conf"]
        return 0.0, 0.0, 0.0

    ls_x, ls_y, _ = get("left_shoulder")
    rs_x, rs_y, _ = get("right_shoulder")
    lh_x, lh_y, _ = get("left_hip")
    rh_x, rh_y, _ = get("right_hip")
    lk_x, lk_y, _ = get("left_knee")
    rk_x, rk_y, _ = get("right_knee")
    la_x, la_y, _ = get("left_ankle")
    ra_x, ra_y, _ = get("right_ankle")

    torso_h       = abs(((ls_y + rs_y) / 2) - ((lh_y + rh_y) / 2))
    ankle_spread  = abs(la_x - ra_x) + abs(la_y - ra_y)
    knee_hip_diff = abs(((lk_y + rk_y) / 2) - ((lh_y + rh_y) / 2))
    shoulder_w    = abs(ls_x - rs_x)

    conf_kps = [kp for kp in keypoints if kp["conf"] > 0.3]
    all_x    = [kp["x_norm"] for kp in conf_kps]
    all_y    = [kp["y_norm"] for kp in conf_kps]
    aspect   = (max(all_x) - min(all_x)) / max(max(all_y) - min(all_y), 0.01) if all_x else 1.0

    body_conf = float(np.mean([kp["conf"] for kp in keypoints if kp["name"] in (
        "left_hip", "right_hip", "left_knee", "right_knee",
        "left_shoulder", "right_shoulder"
    )]))

    feats += [torso_h, ankle_spread, knee_hip_diff, aspect, shoulder_w, body_conf]
    return feats


def _classify_pose(keypoints):
    try:
        clf, scaler, meta = _get_classifier()
        feats = np.array(_extract_features(keypoints)).reshape(1, -1)
        
        # debug
        avg_conf = np.mean([kp["conf"] for kp in keypoints])
        print(f"[POSE] avg_conf={avg_conf:.3f} feats_len={len(feats[0])} feats_sample={feats[0][:6].tolist()}")
        
        feats = scaler.transform(feats)
        probs = clf.predict_proba(feats)[0]
        idx   = int(np.argmax(probs))
        names = meta["label_names"]
        
        print(f"[POSE] pred={names[idx]} conf={probs[idx]:.3f} all={dict(zip(names, [round(float(p),3) for p in probs]))}")
        
        return {
            "pose":       names[idx],
            "pose_conf":  round(float(probs[idx]), 3),
            "pose_probs": {names[i]: round(float(p), 3) for i, p in enumerate(probs)},
        }
    except Exception as e:
        print(f"[POSE ERROR] {e}")
        return {"pose": "unknown", "pose_conf": 0.0, "pose_probs": {}}


def _draw_label(img, x1, y1, text, color):
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
    (tw, th), _ = cv2.getTextSize(text, font, scale, thick)
    pad = 3
    cv2.rectangle(img, (x1, max(0, y1 - th - pad * 2)), (x1 + tw + pad * 2, y1), color, -1)
    cv2.putText(img, text, (x1 + pad, y1 - pad), font, scale, (255, 255, 255), thick, cv2.LINE_AA)


class SimpleTracker:
    def __init__(self, max_distance=150):
        self.next_id      = 1
        self.tracks       = {}
        self.max_distance = max_distance

    def update(self, centroids):
        if not centroids:
            return []
        if not self.tracks:
            ids = []
            for c in centroids:
                self.tracks[self.next_id] = c
                ids.append(self.next_id)
                self.next_id += 1
            return ids
        track_ids   = list(self.tracks.keys())
        track_cents = list(self.tracks.values())
        dists       = cdist(centroids, track_cents)
        ids         = []
        assigned    = set()
        for i, cent in enumerate(centroids):
            j = dists[i].argmin()
            if dists[i][j] < self.max_distance and j not in assigned:
                tid = track_ids[j]
                assigned.add(j)
            else:
                tid = self.next_id
                self.next_id += 1
            self.tracks[tid] = cent
            ids.append(tid)
        return ids


class TrackRecord:
    def __init__(self, track_id, first_frame):
        self.track_id    = track_id
        self.first_frame = first_frame
        self.last_frame  = first_frame
        self.confs       = []
        self.centroids   = []
        self.boxes       = []
        self.poses       = []

    def update(self, frame_idx, conf, x1, y1, x2, y2, pose=None):
        self.last_frame = frame_idx
        self.confs.append(conf)
        self.centroids.append(_centroid(x1, y1, x2, y2))
        self.boxes.append((x1, y1, x2, y2))
        if pose:
            self.poses.append(pose)

    @property
    def frame_count(self): return len(self.confs)
    @property
    def conf_min(self): return round(min(self.confs), 3) if self.confs else 0.0
    @property
    def conf_max(self): return round(max(self.confs), 3) if self.confs else 0.0
    @property
    def conf_avg(self): return _mean(self.confs)

    @property
    def dominant_pose(self):
        if not self.poses:
            return "unknown"
        return Counter(p["pose"] for p in self.poses).most_common(1)[0][0]

    @property
    def travel_px(self):
        if len(self.centroids) < 2:
            return 0.0
        return round(sum(
            ((self.centroids[i][0] - self.centroids[i-1][0])**2 +
             (self.centroids[i][1] - self.centroids[i-1][1])**2) ** 0.5
            for i in range(1, len(self.centroids))
        ), 2)

    @property
    def avg_box_area(self):
        if not self.boxes:
            return 0.0
        return round(sum((x2-x1)*(y2-y1) for x1,y1,x2,y2 in self.boxes) / len(self.boxes), 1)

    def to_dict(self):
        cx, cy = self.centroids[-1] if self.centroids else (0, 0)
        return {
            "track_id":         self.track_id,
            "class":            "person",
            "first_frame":      self.first_frame,
            "last_frame":       self.last_frame,
            "frame_count":      self.frame_count,
            "conf_min":         self.conf_min,
            "conf_max":         self.conf_max,
            "conf_avg":         self.conf_avg,
            "travel_px":        self.travel_px,
            "avg_box_area_px2": self.avg_box_area,
            "last_centroid":    {"x": round(cx, 1), "y": round(cy, 1)},
            "dominant_pose":    self.dominant_pose,
            "pose_history":     self.poses[-10:],
        }


def analyze_images_job(job_id, images_dir, output_dir, **_):
    start_time  = time.time()
    folder_name = os.path.basename(images_dir.rstrip("/\\"))
    os.makedirs(output_dir, exist_ok=True)

    cfg            = get_settings()
    conf_threshold = float(cfg["basic"]["conf_threshold"])
    out            = cfg["advanced"]["output"]

    log_size      = int(out["performance_log_size"])
    jpeg_quality  = int(out["jpeg_quality"])
    box_thickness = int(out["box_thickness"])

    annotated_dir        = os.path.join(output_dir, "annotated_frames")
    summary_path         = os.path.join(output_dir, "summary.json")
    frame_details_path   = os.path.join(output_dir, "frame_details.json")
    track_details_path   = os.path.join(output_dir, "track_details.json")
    performance_log_path = os.path.join(output_dir, "performance_log.json")
    debug_log_path       = os.path.join(output_dir, "analysis_debug.log")
    os.makedirs(annotated_dir, exist_ok=True)

    debug_lines = []

    def log(msg):
        line = f"[{datetime.now(timezone.utc).isoformat()}] [JOB {job_id}] {msg}"
        print(line, flush=True)
        debug_lines.append(line)

    try:
        log("Job started.")
        update_job(job_id, status="running", progress=0)

        model = _get_det_model()
        _get_pose_model()
        _get_classifier()
        log("All models loaded.")

        image_paths = sorted(
            [os.path.join(images_dir, f) for f in os.listdir(images_dir)
             if os.path.splitext(f)[1].lower() in ALLOWED_EXTS],
            key=_natural_key
        )
        log(f"Found {len(image_paths)} image(s).")

        if not image_paths:
            raise RuntimeError(f"No images in: {images_dir}")

        first = cv2.imread(image_paths[0])
        if first is None:
            raise RuntimeError(f"Cannot read: {image_paths[0]}")
        base_h, base_w   = first.shape[:2]
        total_frames     = len(image_paths)
        update_job(job_id, total_frames=total_frames)

        tracker                  = SimpleTracker(max_distance=150)
        track_registry           = {}
        detections_per_frame     = []
        inference_times          = []
        performance_log          = []
        frame_details            = []
        processed_frames         = 0
        total_detections_running = 0

        for frame_idx, img_path in enumerate(image_paths):
            frame_name = os.path.basename(img_path)
            frame      = cv2.imread(img_path)
            if frame is None:
                log(f"Skip unreadable: {img_path}")
                continue

            t0           = time.perf_counter()
            results      = model(frame, conf=conf_threshold, imgsz=IMGSZ, verbose=False)[0]
            inference_ms = (time.perf_counter() - t0) * 1000
            inference_times.append(inference_ms)

            boxes, confs = [], []
            if results.boxes is not None:
                for box in results.boxes:
                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                    boxes.append([x1, y1, x2, y2])
                    confs.append(float(box.conf.item()))

            centroids = [_centroid(*b) for b in boxes]
            track_ids = tracker.update(centroids)

            annotated       = frame.copy()
            frame_det_count = len(boxes)
            frame_objects   = []

            for i, (box, conf, track_id) in enumerate(zip(boxes, confs, track_ids)):
                x1, y1, x2, y2 = [int(v) for v in box]
                cx, cy          = centroids[i]

                keypoints   = _run_pose(frame, (x1, y1, x2, y2))
                pose_result = _classify_pose(keypoints) if keypoints else {
                    "pose": "unknown", "pose_conf": 0.0, "pose_probs": {}
                }

                if track_id not in track_registry:
                    track_registry[track_id] = TrackRecord(track_id, frame_idx)
                track_registry[track_id].update(frame_idx, conf, x1, y1, x2, y2, pose_result)

                frame_objects.append({
                    "track_id":   track_id,
                    "class":      "person",
                    "confidence": round(conf, 3),
                    "bbox":       {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    "centroid":   {"x": round(cx, 1), "y": round(cy, 1)},
                    "pose":       pose_result["pose"],
                    "pose_conf":  pose_result["pose_conf"],
                    "pose_probs": pose_result["pose_probs"],
                    "keypoints":  keypoints or [],
                })

                pose_color = POSE_COLORS.get(pose_result["pose"], POSE_COLORS["unknown"])
                cv2.rectangle(annotated, (x1, y1), (x2, y2), pose_color, box_thickness)
                _draw_label(annotated, x1, y1,
                            f"#{track_id} {pose_result['pose']} {pose_result['pose_conf']:.2f}",
                            pose_color)

            cv2.imwrite(
                os.path.join(annotated_dir, f"frame_{frame_idx:06d}_annotated.jpg"),
                annotated,
                [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality],
            )

            detections_per_frame.append(frame_det_count)
            total_detections_running += frame_det_count
            processed_frames += 1

            frame_details.append({
                "frame":         frame_idx,
                "image":         frame_name,
                "image_path":    img_path,
                "input_size":    {"width": base_w, "height": base_h},
                "output_size":   {"width": base_w, "height": base_h},
                "inference_ms":  round(inference_ms, 1),
                "detections":    frame_det_count,
                "unique_so_far": len(track_registry),
                "objects":       frame_objects,
            })

            performance_log.append({
                "frame":            frame_idx,
                "image":            frame_name,
                "inference_ms":     round(inference_ms, 1),
                "detections":       frame_det_count,
                "unique_so_far":    len(track_registry),
                "processed_frames": processed_frames,
                "progress":         int((processed_frames / total_frames) * 100),
            })

            log(f"Frame {frame_idx+1}/{total_frames}: {frame_name} | {frame_det_count} det | {inference_ms:.1f}ms")
            update_job(
                job_id,
                status           = "processing",
                progress         = int((processed_frames / total_frames) * 100),
                total_detections = total_detections_running,
                unique_objects   = len(track_registry),
                performance_log  = performance_log[-log_size:],
            )

        with open(frame_details_path,   "w") as f: json.dump(frame_details, f, indent=2)
        with open(track_details_path,   "w") as f: json.dump([r.to_dict() for r in track_registry.values()], f, indent=2)
        with open(performance_log_path, "w") as f: json.dump(performance_log, f, indent=2)

        total_detections = sum(detections_per_frame)
        total_unique     = len(track_registry)
        elapsed          = round(time.time() - start_time, 2)

        pose_summary = {}
        for r in track_registry.values():
            p = r.dominant_pose
            pose_summary[p] = pose_summary.get(p, 0) + 1

        rich_stats = {
            "images_meta": {
                "width":            base_w,
                "height":           base_h,
                "total_images":     total_frames,
                "processed_images": processed_frames,
                "jpeg_quality":     jpeg_quality,
            },
            "inference_config": {
                "imgsz":          IMGSZ,
                "conf_threshold": conf_threshold,
            },
            "performance": {
                "elapsed_s":        elapsed,
                "throughput_fps":   round(processed_frames / elapsed, 2) if elapsed else 0.0,
                "processed_frames": processed_frames,
                "avg_inference_ms": _mean(inference_times),
                "min_inference_ms": round(min(inference_times), 1) if inference_times else 0.0,
                "max_inference_ms": round(max(inference_times), 1) if inference_times else 0.0,
            },
            "detection_summary": {
                "total_detections":         total_detections,
                "total_unique_objects":     total_unique,
                "avg_detections_per_frame": _mean(detections_per_frame),
                "max_detections_in_frame":  max(detections_per_frame) if detections_per_frame else 0,
            },
            "person_stats": {
                "class":            "person",
                "unique_tracks":    total_unique,
                "total_detections": total_detections,
                "avg_conf":         _mean([r.conf_avg     for r in track_registry.values()]),
                "avg_travel_px":    _mean([r.travel_px    for r in track_registry.values()]),
                "avg_box_area_px2": _mean([r.avg_box_area for r in track_registry.values()]),
            },
            "pose_summary":  pose_summary,
            "track_details": [r.to_dict() for r in track_registry.values()],
        }

        summary_data = {
            "job_id":               job_id,
            "filename":             folder_name,
            "status":               "completed",
            "analysed_at":          datetime.now(timezone.utc).isoformat(),
            "elapsed_time":         elapsed,
            "total_frames":         processed_frames,
            "total_detections":     total_detections,
            "total_unique_objects": total_unique,
            "video_file":           None,
            "raw_video_file":       None,
            "annotated_zip":        None,
            "annotated_frames_dir": annotated_dir,
            "summary_file":         summary_path,
            "debug_log_file":       debug_log_path,
            "frame_details_file":   frame_details_path,
            "track_details_file":   track_details_path,
            "performance_log_file": performance_log_path,
            "performance_log":      performance_log[-log_size:],
            "rich_stats":           rich_stats,
            "summary_json":         rich_stats,
            "captions":             {},
            "captions_file":        None,
        }

        with open(summary_path, "w") as f:
            json.dump(summary_data, f, indent=2)

        complete_job(
            job_id,
            video_file       = None,
            annotated_zip    = None,
            summary_file     = summary_path,
            total_frames     = processed_frames,
            total_detections = total_detections,
            total_unique     = total_unique,
            elapsed_time     = elapsed,
            performance_log  = performance_log[-log_size:],
            summary          = (
                f"Processed {processed_frames} images. "
                f"{total_unique} unique persons. "
                f"Poses: {pose_summary}"
            ),
            rich_stats       = rich_stats,
        )

        with open(debug_log_path, "w") as f:
            f.write("\n".join(debug_lines) + "\n")

        MongoClient(MONGO_URI)[DB_NAME][COLLECTION].insert_one(summary_data)

    except Exception as exc:
        traceback.print_exc()
        fail_job(job_id, error=str(exc))
        raise