import json
import os
import subprocess
import time
import traceback
import re
from collections import defaultdict, Counter
from datetime import datetime, timezone

import cv2
import joblib
import numpy as np
from dotenv import load_dotenv
from pymongo import MongoClient
from ultralytics import YOLO
import supervision as sv
import torch

from services.job_manager import update_job, fail_job, complete_job
from services.settings_service import get_settings

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME    = "VisionCore"
COLLECTION = "AnalysisHistory"

MODEL_PATH       = os.getenv("YOLO_MODEL_PATH",  r"M:\Projects\PFE\backend\models\yolo\models_output\bestv2.pt")
POSE_MODEL_PATH  = os.getenv("YOLO_POSE_PATH",   r"M:\Projects\PFE\backend\models\yolo\yolo26s-pose.pt")
POSE_CLF_PATH    = r"M:\Projects\PFE\backend\models\pose_classifier\pose_classifier.pkl"
POSE_SCALER_PATH = r"M:\Projects\PFE\backend\models\pose_classifier\scaler.pkl"
POSE_META_PATH   = r"M:\Projects\PFE\backend\models\pose_classifier\meta.json"

SCALE_UP = 4

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

_POSE_SKELETON = [
    (0, 1), (0, 2), (1, 3), (2, 4),
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
    (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16),
]

_PALETTE = [
    (255,  56,  56), (255, 157,  51), (255, 112,  31), (255, 178,  29),
    ( 27, 197, 189), ( 43, 153, 245), ( 48, 119, 245), ( 55,  38, 251),
    (183, 228, 255), (212, 190, 255), (169, 255, 189), (255, 250, 107),
]

_model:      YOLO | None = None
_pose_model: YOLO | None = None
_classifier        = None
_scaler            = None
_pose_meta         = None


def _get_model() -> YOLO:
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"YOLO model not found: {MODEL_PATH}")
        _model = YOLO(MODEL_PATH)
        if torch.cuda.is_available():
            _model.to("cuda")
    return _model


def _get_pose_model() -> YOLO:
    global _pose_model
    if _pose_model is None:
        if not os.path.exists(POSE_MODEL_PATH):
            raise FileNotFoundError(f"Pose model not found: {POSE_MODEL_PATH}")
        _pose_model = YOLO(POSE_MODEL_PATH)
        if torch.cuda.is_available():
            _pose_model.to("cuda")
    return _pose_model


def _get_classifier():
    global _classifier, _scaler, _pose_meta
    if _classifier is None:
        _classifier = joblib.load(POSE_CLF_PATH)
        _scaler     = joblib.load(POSE_SCALER_PATH)
        with open(POSE_META_PATH) as f:
            _pose_meta = json.load(f)
    return _classifier, _scaler, _pose_meta


def _sanitize(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[^a-z0-9-_]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_")


def _write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _get_collection():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]


def _color_for(class_id: int):
    return _PALETTE[class_id % len(_PALETTE)]


def _centroid(x1, y1, x2, y2):
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _mean(values: list) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0


def _run_pose(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int):
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
        feats = scaler.transform(feats)
        probs = clf.predict_proba(feats)[0]
        idx   = int(np.argmax(probs))
        names = meta["label_names"]
        return {
            "pose":       names[idx],
            "pose_conf":  round(float(probs[idx]), 3),
            "pose_probs": {names[i]: round(float(p), 3) for i, p in enumerate(probs)},
        }
    except Exception as e:
        print(f"[POSE ERROR] {e}")
        return {"pose": "unknown", "pose_conf": 0.0, "pose_probs": {}}


def _draw_pose(frame: np.ndarray, keypoints: list) -> None:
    for kp in keypoints:
        x, y, c = kp["x_abs"], kp["y_abs"], kp["conf"]
        if c > 0.3:
            cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 128), -1, cv2.LINE_AA)
    for a, b in _POSE_SKELETON:
        if a < len(keypoints) and b < len(keypoints):
            if keypoints[a]["conf"] > 0.3 and keypoints[b]["conf"] > 0.3:
                pt1 = (int(keypoints[a]["x_abs"]), int(keypoints[a]["y_abs"]))
                pt2 = (int(keypoints[b]["x_abs"]), int(keypoints[b]["y_abs"]))
                cv2.line(frame, pt1, pt2, (0, 200, 100), 1, cv2.LINE_AA)


class TrackRecord:
    def __init__(self, track_id, class_label, class_id, first_frame):
        self.track_id    = track_id
        self.class_label = class_label
        self.class_id    = class_id
        self.first_frame = first_frame
        self.last_frame  = first_frame
        self.confs:     list = []
        self.centroids: list = []
        self.boxes:     list = []
        self.poses:     list = []

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
            "dominant_pose":    self.dominant_pose,
            "pose_history":     self.poses[-10:],
        }


def analyze_video_job(job_id: str, video_path: str, output_dir: str) -> None:
    start_time = time.time()
    filename   = os.path.basename(video_path)

    cfg = get_settings()
    b   = cfg["basic"]
    a   = cfg["advanced"]

    fps            = float(b["default_fps"])
    conf_threshold = float(b["conf_threshold"])
    imgsz          = int(b["imgsz"])
    save_frames    = bool(b["save_frames"])
    extract_pose   = bool(b.get("extract_pose", True))

    trk = a["tracker"]
    det = a["detection"]
    out = a["output"]

    log_size      = int(out["performance_log_size"])
    jpeg_quality  = int(out["jpeg_quality"])
    ffmpeg_preset = str(out["ffmpeg_preset"])
    ffmpeg_crf    = int(out["ffmpeg_crf"])
    box_thickness = int(out["box_thickness"])
    font_scale    = float(out["label_font_scale"])
    show_box      = bool(out["annotate_boxes"])
    show_label    = bool(out["annotate_labels"])
    show_conf     = bool(out["annotate_conf"])
    show_pose     = bool(out.get("annotate_pose", True))

    annotated_dir = os.path.join(output_dir, "annotated_frames")
    frames_dir    = os.path.join(output_dir, "frames")
    os.makedirs(annotated_dir, exist_ok=True)
    if save_frames:
        os.makedirs(frames_dir, exist_ok=True)

    try:
        update_job(job_id, status="running", progress=0)
        model = _get_model()
        if extract_pose:
            _get_pose_model()
            _get_classifier()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        src_fps      = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_s   = round(total_frames / src_fps, 2) if src_fps else 0.0
        cap.release()

        update_job(job_id, total_frames=total_frames)

        frame_step   = max(1, int(round(src_fps / fps)))
        raw_filename = os.path.join(output_dir, "annotated_raw.mp4")
        out_filename = os.path.join(output_dir, "annotated.mp4")

        writer = cv2.VideoWriter(
            raw_filename, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )

        tracker = sv.ByteTrack(
            track_activation_threshold = float(trk["track_activation_threshold"]),
            lost_track_buffer          = int(trk["lost_track_buffer"]),
            minimum_matching_threshold = float(trk["minimum_matching_threshold"]),
            frame_rate                 = int(fps),
            minimum_consecutive_frames = int(trk["min_consecutive_frames"]),
        )

        track_registry       = {}
        class_tracks         = defaultdict(set)
        detections_per_frame = []
        inference_times      = []
        performance_log      = []

        frame_idx        = 0
        processed_frames = 0
        last_progress    = -1
        use_half         = torch.cuda.is_available()

        cap = cv2.VideoCapture(video_path)
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % frame_step != 0:
                    frame_idx += 1
                    continue

                t0 = time.perf_counter()

                results = model(
                    frame,
                    conf    = conf_threshold,
                    imgsz   = imgsz,
                    iou     = float(det["iou_threshold"]),
                    max_det = int(det["max_detections"]),
                    verbose = False,
                    half    = use_half,
                    augment = False,
                )

                inference_ms = (time.perf_counter() - t0) * 1000
                inference_times.append(inference_ms)

                raw_boxes, raw_confs, raw_cls_ids = [], [], []
                for result in results:
                    if result.boxes is not None and len(result.boxes):
                        raw_boxes.extend(result.boxes.xyxy.cpu().numpy().astype(np.float32).tolist())
                        raw_confs.extend(result.boxes.conf.cpu().numpy().astype(np.float32).tolist())
                        raw_cls_ids.extend(result.boxes.cls.cpu().numpy().astype(int).tolist())

                if raw_boxes:
                    sv_dets = sv.Detections(
                        xyxy       = np.array(raw_boxes,   dtype=np.float32),
                        confidence = np.array(raw_confs,   dtype=np.float32),
                        class_id   = np.array(raw_cls_ids, dtype=int),
                    )
                else:
                    sv_dets = sv.Detections(
                        xyxy       = np.empty((0, 4), dtype=np.float32),
                        confidence = np.empty(0,      dtype=np.float32),
                        class_id   = np.empty(0,      dtype=int),
                    )

                tracked_dets    = tracker.update_with_detections(sv_dets)
                print(f"[TRACK] raw_boxes={len(raw_boxes)} sv_dets={len(sv_dets)} tracked={len(tracked_dets)}")

                annotated       = frame.copy()
                frame_det_count = len(tracked_dets)

                if frame_det_count > 0:
                    xyxy_all    = tracked_dets.xyxy.astype(int)
                    cls_ids_all = tracked_dets.class_id.tolist()
                    confs_all   = tracked_dets.confidence.tolist()
                    tids_all    = tracked_dets.tracker_id.tolist()
                    names       = model.names

                    for i in range(frame_det_count):
                        print(f"[DEBUG] cls_id={cls_ids_all[i]} track_id={tids_all[i]} conf={confs_all[i]:.2f} label={names.get(cls_ids_all[i], '?')} is_person={names.get(cls_ids_all[i], '').lower() in ('person', 'pedestrian')}")
                        x1, y1, x2, y2 = int(xyxy_all[i][0]), int(xyxy_all[i][1]), int(xyxy_all[i][2]), int(xyxy_all[i][3])
                        cls_id   = cls_ids_all[i]
                        conf     = confs_all[i]
                        track_id = tids_all[i]
                        label    = names.get(cls_id, str(cls_id))
                        is_person = label.lower() in ("person", "pedestrian", "item")

                        keypoints   = None
                        pose_result = {"pose": "unknown", "pose_conf": 0.0, "pose_probs": {}}

                        if extract_pose and is_person:
                            keypoints = _run_pose(frame, x1, y1, x2, y2)
                            if keypoints:
                                pose_result = _classify_pose(keypoints)

                        if track_id not in track_registry:
                            track_registry[track_id] = TrackRecord(track_id, label, cls_id, frame_idx)
                        track_registry[track_id].update(
                            frame_idx, conf, x1, y1, x2, y2,
                            pose=pose_result if is_person else None,
                        )
                        class_tracks[label].add(track_id)
                        print(f"[DRAW] track_id={track_id} label={label} is_person={is_person} pose={pose_result['pose']} show_box={show_box} show_label={show_label} show_pose={show_pose} extract_pose={extract_pose}")
                        color = POSE_COLORS.get(pose_result["pose"], _color_for(cls_id)) if is_person else _color_for(cls_id)

                        if show_box:
                            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, box_thickness)

                        if show_label or show_conf:
                            parts = []
                            if show_label:
                                parts.append(f"#{track_id} {label}")
                            if is_person and extract_pose:
                                parts.append(f"{pose_result['pose']} {pose_result['pose_conf']:.2f}")
                            if show_conf:
                                parts.append(f"{conf:.2f}")
                            label_txt = " ".join(parts)
                            (tw, th), _ = cv2.getTextSize(label_txt, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
                            cv2.rectangle(annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
                            cv2.putText(annotated, label_txt, (x1 + 2, y1 - 4),
                                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

                        if extract_pose and show_pose and keypoints and is_person:
                            _draw_pose(annotated, keypoints)

                ann_path = os.path.join(annotated_dir, f"frame_{frame_idx:06d}_annotated.jpg")
                cv2.imwrite(ann_path, annotated, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])

                if save_frames:
                    cv2.imwrite(
                        os.path.join(frames_dir, f"frame_{str(frame_idx).zfill(6)}.jpg"),
                        annotated,
                        [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality],
                    )

                writer.write(annotated)
                detections_per_frame.append(frame_det_count)
                processed_frames += 1

                progress = int((processed_frames / max(total_frames // frame_step, 1)) * 100)

                performance_log.append({
                    "frame":         frame_idx,
                    "inference_ms":  round(inference_ms, 1),
                    "detections":    frame_det_count,
                    "unique_so_far": len(track_registry),
                })

                if progress != last_progress:
                    last_progress = progress
                    update_job(
                        job_id,
                        progress         = progress,
                        total_detections = sum(detections_per_frame),
                        unique_objects   = len(track_registry),
                        performance_log  = performance_log[-log_size:],
                    )

                frame_idx += 1

        finally:
            cap.release()
            writer.release()

        ffmpeg_path = os.getenv("FFMPEG_PATH", r"C:\Program Files\ffmpeg8.1\bin\ffmpeg.exe")
        try:
            subprocess.run(
                f'"{ffmpeg_path}" -y -i "{raw_filename}" '
                f'-vcodec libx264 -preset {ffmpeg_preset} -crf {ffmpeg_crf} '
                f'-pix_fmt yuv420p -movflags +faststart "{out_filename}"',
                check=True, shell=True, capture_output=True,
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
        max_det_frame    = max(detections_per_frame)    if detections_per_frame else 0

        class_stats_map = {}
        for r in track_registry.values():
            cls = r.class_label
            if cls not in class_stats_map:
                class_stats_map[cls] = {
                    "class": cls, "unique_tracks": 0, "total_detections": 0,
                    "avg_conf": [], "avg_travel_px": [], "avg_box_area_px2": [],
                }
            cs = class_stats_map[cls]
            cs["unique_tracks"]    += 1
            cs["total_detections"] += r.frame_count
            cs["avg_conf"].append(r.conf_avg)
            cs["avg_travel_px"].append(r.travel_px)
            cs["avg_box_area_px2"].append(r.avg_box_area)

        class_stats_list = []
        for cs in class_stats_map.values():
            cs["avg_conf"]         = _mean(cs["avg_conf"])
            cs["avg_travel_px"]    = _mean(cs["avg_travel_px"])
            cs["avg_box_area_px2"] = _mean(cs["avg_box_area_px2"])
            class_stats_list.append(cs)

        top_classes = sorted(
            [{"class": cls, "unique_tracks": len(ids)} for cls, ids in class_tracks.items()],
            key=lambda d: d["unique_tracks"], reverse=True,
        )[:10]

        detection_summary = {
            "total_detections":         total_detections,
            "total_unique_objects":     total_unique,
            "num_classes":              len(class_tracks),
            "avg_detections_per_frame": avg_det_density,
            "max_detections_in_frame":  max_det_frame,
        }

        pose_summary = {}
        for r in track_registry.values():
            if r.class_label.lower() in ("person", "pedestrian"):
                p = r.dominant_pose
                pose_summary[p] = pose_summary.get(p, 0) + 1

        analysed_at      = datetime.now(timezone.utc).isoformat()
        original_base    = _sanitize(os.path.splitext(filename)[0])
        final_video_path = os.path.join(output_dir, f"{original_base}_annotated.mp4")
        try:
            if os.path.exists(out_filename):
                os.rename(out_filename, final_video_path)
        except Exception:
            final_video_path = out_filename

        summary_path       = os.path.join(output_dir, "summary.json")
        rich_stats_path    = os.path.join(output_dir, "rich_stats.json")
        track_details_path = os.path.join(output_dir, "track_details.json")

        rich_stats = {
            "job_id":      job_id,
            "video_meta": {
                "width":         width,
                "height":        height,
                "total_frames":  total_frames,
                "source_fps":    round(src_fps, 2),
                "processed_fps": fps,
                "frame_step":    frame_step,
                "duration_s":    duration_s,
            },
            "performance": {
                "elapsed_s":        elapsed,
                "throughput_fps":   throughput_fps,
                "processed_frames": processed_frames,
                "avg_inference_ms": avg_inf,
                "min_inference_ms": min_inf,
                "max_inference_ms": max_inf,
            },
            "detection_summary": detection_summary,
            "class_stats":       class_stats_list,
            "pose_summary":      pose_summary,
            "pose_extraction":   extract_pose,
            "performance_log":   performance_log,
            "track_details":     [r.to_dict() for r in track_registry.values()],
        }
        _write_json(rich_stats_path, rich_stats)

        track_details_data = {
            "job_id":       job_id,
            "total_unique": total_unique,
            "tracks":       [r.to_dict() for r in track_registry.values()],
        }
        _write_json(track_details_path, track_details_data)

        summary_data = {
            "job_id":              job_id,
            "filename":            filename,
            "status":              "completed",
            "analysed_at":         analysed_at,
            "elapsed_time":        elapsed,
            "total_frames":        processed_frames,
            "total_detections":    total_detections,
            "total_unique":        total_unique,
            "top_classes":         top_classes,
            "video_file":          final_video_path,
            "frames_dir":          frames_dir if save_frames else None,
            "summary_file":        summary_path,
            "rich_stats_file":     rich_stats_path,
            "track_details_file":  track_details_path,
            "captions":            {},
            "captions_file":       None,
        }
        _write_json(summary_path, summary_data)

        mongo_doc = {
            **summary_data,
            "rich_stats":    rich_stats,
            "track_details": track_details_data["tracks"],
        }

        complete_job(
            job_id,
            video_file         = final_video_path,
            summary_file       = summary_path,
            rich_stats_file    = rich_stats_path,
            track_details_file = track_details_path,
            total_frames       = processed_frames,
            total_detections   = total_detections,
            total_unique       = total_unique,
            top_classes        = top_classes,
            elapsed_time       = elapsed,
            performance_log    = performance_log,
            summary            = (
                f"Processed {processed_frames} frames. "
                f"{total_unique} unique objects across {len(class_tracks)} class(es). "
                f"Poses: {pose_summary}"
            ),
            rich_stats         = rich_stats,
            track_details      = track_details_data["tracks"],
        )

        _get_collection().insert_one(mongo_doc)

    except Exception as exc:
        traceback.print_exc()
        fail_job(job_id, error=str(exc))
        try:
            _get_collection().insert_one({
                "job_id":      job_id,
                "filename":    filename,
                "status":      "failed",
                "analysed_at": datetime.now(timezone.utc),
                "error":       str(exc),
            })
        except Exception:
            traceback.print_exc()