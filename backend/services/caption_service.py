import json
import math
import os
import traceback
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from pymongo import MongoClient
from services.vlm_service import call_vlm
from .caption_prompts import scene_prompt, global_summary_prompt

load_dotenv()

MONGO_URI   = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME     = "VisionCore"
COLLECTION  = "AnalysisHistory"
OUTPUTS_DIR = "outputs"

MIN_SCENES       = int(os.getenv("CAPTION_MIN_SCENES", "2"))
MAX_SCENES       = int(os.getenv("CAPTION_MAX_SCENES", "12"))
SECS_PER_SCENE   = float(os.getenv("CAPTION_SECS_PER_SCENE", "30"))
FRAMES_PER_SCENE = int(os.getenv("CAPTION_FRAMES_PER_SCENE", "900"))

PERSON_LABELS = {"person", "pedestrian", "item"}


def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]


def _captions_path(job_id: str) -> str:
    return os.path.join(OUTPUTS_DIR, job_id, "captions.json")


def _is_person(label: str) -> bool:
    return label.lower() in PERSON_LABELS


def compute_n_scenes(video_meta: dict) -> int:
    duration_s   = float(video_meta.get("duration_s") or 0)
    total_frames = int(video_meta.get("total_frames") or 0)
    fps          = float(video_meta.get("fps") or 0)

    if duration_s > 0:
        raw = duration_s / SECS_PER_SCENE
    elif total_frames > 0 and fps > 0:
        raw = (total_frames / fps) / SECS_PER_SCENE
    elif total_frames > 0:
        raw = total_frames / FRAMES_PER_SCENE
    else:
        return MIN_SCENES

    return max(MIN_SCENES, min(MAX_SCENES, math.ceil(raw)))


def _aggregate_pose_distribution(track_details: list[dict]) -> dict:
    counts: dict = {}
    for t in track_details:
        if not _is_person(t.get("class", "")):
            continue
        for p in t.get("pose_history", []):
            label = p.get("pose", "unknown")
            counts[label] = counts.get(label, 0) + 1
    return counts


def _aggregate_dominant_poses(track_details: list[dict]) -> dict:
    counts: dict = {}
    for t in track_details:
        if not _is_person(t.get("class", "")):
            continue
        dp = t.get("dominant_pose", "unknown")
        counts[dp] = counts.get(dp, 0) + 1
    return counts


def _group_scenes(
    class_stats: list[dict],
    track_details: list[dict],
    duration_s: float,
    n_scenes: int,
    source_fps: float = 25.0,
) -> list[dict]:
    if duration_s <= 0 or not class_stats:
        return []
    window = duration_s / n_scenes

    person_tracks = [t for t in track_details if _is_person(t.get("class", ""))]

    scenes = []
    for i in range(n_scenes):
        start_s = round(i * window, 1)
        end_s   = round(min((i + 1) * window, duration_s), 1)

        start_frame = start_s * source_fps
        end_frame   = end_s   * source_fps

        active_persons  = 0
        pose_counts:  dict = {}
        mobility_high = 0

        for t in person_tracks:
            t_first = t.get("first_frame", 0)
            t_last  = t.get("last_frame",  0)
            if t_first <= end_frame and t_last >= start_frame:
                active_persons += 1
                if t.get("travel_px", 0) > 50:
                    mobility_high += 1
                for p in t.get("pose_history", []):
                    label = p.get("pose", "unknown")
                    pose_counts[label] = pose_counts.get(label, 0) + 1

        scenes.append({
            "start_s":          start_s,
            "end_s":            end_s,
            "objects":          sorted(class_stats, key=lambda c: c.get("unique_tracks", 0), reverse=True)[:6],
            "active_persons":   active_persons,
            "mobile_persons":   mobility_high,
            "pose_distribution": pose_counts,
        })

    return scenes


async def generate_captions(job_id: str, status_cb=None) -> dict:
    try:
        col = _col()
        doc = col.find_one({"job_id": job_id})

        if not doc:
            raise ValueError(f"Job '{job_id}' not found in history.")
        if doc.get("status") != "completed":
            raise ValueError(f"Job '{job_id}' is not completed (status: {doc.get('status')}).")

        if doc.get("captions") and doc["captions"].get("scene_captions"):
            return doc["captions"]

        captions_file = _captions_path(job_id)
        if os.path.exists(captions_file):
            with open(captions_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            col.update_one(
                {"job_id": job_id},
                {"$set": {"captions": cached, "captions_file": captions_file}},
            )
            return cached

        rich              = doc.get("rich_stats", {})
        class_stats       = rich.get("class_stats", []) or doc.get("class_stats", [])
        detection_summary = rich.get("detection_summary", {}) or doc.get("detection_summary", {})
        video_meta        = rich.get("video_meta", {}) or doc.get("video_meta", {}) or rich.get("images_meta", {})
        track_details     = rich.get("track_details", []) or doc.get("track_details", [])
        pose_summary      = rich.get("pose_summary", {})
        duration_s        = float(video_meta.get("duration_s") or 0)
        source_fps        = float(video_meta.get("source_fps") or 25.0)

        if not class_stats:
            raise ValueError("No detection stats available.")

        n_scenes         = compute_n_scenes(video_meta)
        scenes           = _group_scenes(class_stats, track_details, duration_s, n_scenes, source_fps)
        global_pose_dist = _aggregate_pose_distribution(track_details)
        dominant_poses   = _aggregate_dominant_poses(track_details)

        if status_cb:
            status_cb({"stage": "scenes", "scene": 0, "total": n_scenes})

        scene_captions: list[str] = []
        for i, scene in enumerate(scenes):
            if status_cb:
                status_cb({"stage": "scenes", "scene": i + 1, "total": n_scenes})
            caption = await call_vlm(prompt=scene_prompt(scene, i), images=[])
            scene_captions.append(caption)

        if status_cb:
            status_cb({"stage": "global", "scene": n_scenes, "total": n_scenes})

        scene_captions: list[str] = []
        for i, scene in enumerate(scenes):
            caption = await call_vlm(prompt=scene_prompt(scene, i), images=[])
            scene_captions.append(caption)

        global_caption = await call_vlm(
            prompt=global_summary_prompt(
                class_stats, detection_summary, video_meta,
                scene_captions, global_pose_dist, dominant_poses, pose_summary,
            ),
            images=[],
        )

        result = {
            "job_id":         job_id,
            "n_scenes":       n_scenes,
            "scene_captions": [
                {
                    "start_s":           scene["start_s"],
                    "end_s":             scene["end_s"],
                    "caption":           scene_captions[i],
                    "active_persons":    scene["active_persons"],
                    "mobile_persons":    scene["mobile_persons"],
                    "pose_distribution": scene["pose_distribution"],
                }
                for i, scene in enumerate(scenes)
            ],
            "global_caption":            global_caption,
            "global_pose_distribution":  global_pose_dist,
            "dominant_pose_summary":     dominant_poses,
            "generated_at":              datetime.now(timezone.utc).isoformat(),
        }

        with open(captions_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        col.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "captions":      result,
                    "captions_file": captions_file,
                    "captions_json": result,
                }
            },
        )

        return result

    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(str(exc))


async def get_captions(job_id: str) -> Optional[dict]:
    col = _col()
    doc = col.find_one({"job_id": job_id}, {"captions": 1})
    if not doc:
        raise ValueError(f"Job '{job_id}' not found.")

    if doc.get("captions") and doc["captions"].get("scene_captions"):
        return doc["captions"]

    captions_file = _captions_path(job_id)
    if os.path.exists(captions_file):
        with open(captions_file, "r", encoding="utf-8") as f:
            return json.load(f)

    return None