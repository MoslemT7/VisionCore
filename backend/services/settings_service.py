import copy
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME    = os.getenv("DB_NAME")
COLLECTION_SETTINGS = os.getenv("COLLECTION_SETTINGS")


DEFAULT_SETTINGS = {
    "profile_id": "default",
    "theme": {
        "mode":   "dark",
        "accent": "blue",
    },
    "basic": {
        "default_fps":    1.0,
        "conf_threshold": 0.25,
        "imgsz":          960,
        "save_frames":    True,
        "auto_caption":   False,
        "extract_pose":   False,
    },
    "advanced": {
        "tracker": {
            "track_activation_threshold": 0.25,
            "lost_track_buffer":          30,
            "minimum_matching_threshold": 0.8,
            "min_consecutive_frames":     1,
        },
        "detection": {
            "iou_threshold":  0.45,
            "max_detections": 300,
        },
        "output": {
            "jpeg_quality":        85,
            "annotate_boxes":      True,
            "annotate_labels":     True,
            "annotate_conf":       True,
            "annotate_pose":       True,
            "box_thickness":       2,
            "label_font_scale":    0.5,
            "performance_log_size": 50,
            "ffmpeg_preset":       "veryfast",
            "ffmpeg_crf":          23,
        },
        "llm": {
            "temperature":         0.5,
            "caption_temperature": 0.7,
        },
        "system": {
            "max_concurrent_jobs":  2,
            "job_timeout_seconds":  3600,
        },
    },
    "created_at": None,
    "updated_at": None,
}


def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION_SETTINGS]


def _ensure_default(profile_id: str = "default") -> dict:
    col = _col()
    doc = col.find_one({"profile_id": profile_id})
    if not doc:
        now   = datetime.now(timezone.utc).isoformat()
        fresh = copy.deepcopy(DEFAULT_SETTINGS)
        fresh["profile_id"] = profile_id
        fresh["created_at"] = now
        fresh["updated_at"] = now
        col.insert_one(fresh)
        doc = col.find_one({"profile_id": profile_id})
    doc.pop("_id", None)
    return doc


def get_settings(profile_id: str = "default") -> dict:
    return _ensure_default(profile_id)


def save_settings(data: dict, profile_id: str = "default") -> dict:
    col = _col()
    now = datetime.now(timezone.utc).isoformat()

    base = _ensure_default(profile_id)
    base.pop("_id", None)

    merged = _deep_merge(copy.deepcopy(base), data)
    merged["profile_id"] = profile_id
    merged["updated_at"] = now
    merged.pop("_id", None)

    doc = col.find_one_and_replace(
        {"profile_id": profile_id},
        merged,
        return_document=ReturnDocument.AFTER,
        upsert=True,
    )
    doc.pop("_id", None)
    return doc


def reset_settings(profile_id: str = "default") -> dict:
    col = _col()
    now   = datetime.now(timezone.utc).isoformat()
    fresh = copy.deepcopy(DEFAULT_SETTINGS)
    fresh["profile_id"] = profile_id
    fresh["created_at"] = now
    fresh["updated_at"] = now
    col.replace_one({"profile_id": profile_id}, fresh, upsert=True)
    return fresh


def _deep_merge(base: dict, override: dict) -> dict:
    for k, v in override.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v
    return base