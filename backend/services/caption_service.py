import json
import os
import traceback
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from pymongo import MongoClient

from services.vlm_service import call_vlm

load_dotenv()

MONGO_URI   = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME     = "VisionCore"
COLLECTION  = "AnalysisHistory"
OUTPUTS_DIR = "outputs"


def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]


def _captions_path(job_id: str) -> str:
    return os.path.join(OUTPUTS_DIR, job_id, "captions.json")


def _build_scene_prompt(scene: dict, index: int) -> str:
    obj_lines = "\n".join(
        f"  - {o['class']}: {o['unique_tracks']} unique objects, "
        f"avg confidence {round(o['avg_conf'] * 100)}%, "
        f"avg travel {round(o.get('avg_travel_px', 0))} px"
        for o in scene["objects"]
    )
    return f"""You are a video scene analyst. Write ONE sentence describing scene {index + 1}.

TIME WINDOW : {scene['start_s']}s → {scene['end_s']}s
OBJECTS DETECTED:
{obj_lines}

Rules:
- Exactly one sentence.
- Name the objects explicitly — never say "various objects".
- Do not start with "In this scene".
- Be specific about activity or movement if travel data suggests it.
""".strip()


def _build_global_prompt(
    class_stats:       list[dict],
    detection_summary: dict,
    video_meta:        dict,
    scene_captions:    list[str],
) -> str:
    caption_block = "\n".join(
        f"  Scene {i + 1}: {cap}" for i, cap in enumerate(scene_captions)
    )
    top_classes = ", ".join(
        f"{c['class']} ({c['unique_tracks']} unique)"
        for c in class_stats[:5]
    )
    return f"""You are a video intelligence system. Write a concise natural-language summary of this video analysis.

VIDEO DURATION   : {video_meta.get('duration_s', '?')}s
RESOLUTION       : {video_meta.get('width', '?')}×{video_meta.get('height', '?')}
TOTAL DETECTIONS : {detection_summary.get('total_detections', '?')}
UNIQUE OBJECTS   : {detection_summary.get('total_unique_objects', '?')}
CLASSES FOUND    : {detection_summary.get('num_classes', '?')}
TOP CLASSES      : {top_classes}
AVG DET/FRAME    : {detection_summary.get('avg_detections_per_frame', '?')}

SCENE-BY-SCENE CAPTIONS:
{caption_block}

Rules:
- 3–5 sentences maximum.
- Cover: what is in the video, main activity, any notable patterns.
- Do not repeat the raw numbers verbatim — interpret them.
- Write in past tense.
""".strip()


def _group_scenes(class_stats: list[dict], duration_s: float, n_scenes: int = 4) -> list[dict]:
    if duration_s <= 0 or not class_stats:
        return []
    window = duration_s / n_scenes
    scenes = []
    for i in range(n_scenes):
        start = round(i * window, 1)
        end   = round(min((i + 1) * window, duration_s), 1)
        top_objects = sorted(
            class_stats,
            key=lambda c: c.get("unique_tracks", 0),
            reverse=True,
        )[:6]
        scenes.append({"start_s": start, "end_s": end, "objects": top_objects})
    return scenes


async def generate_captions(job_id: str) -> dict:
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
        class_stats       = rich.get("class_stats", [])
        detection_summary = rich.get("detection_summary", {})
        video_meta        = rich.get("video_meta", {})
        duration_s        = float(video_meta.get("duration_s") or 0)

        if not class_stats:
            raise ValueError("No detection stats available.")

        n_scenes = int(os.getenv("CAPTION_N_SCENES", "4"))
        scenes   = _group_scenes(class_stats, duration_s, n_scenes=n_scenes)

        scene_captions: list[str] = []
        for i, scene in enumerate(scenes):
            caption = await call_vlm(prompt=_build_scene_prompt(scene, i), images=[])
            scene_captions.append(caption)

        global_caption = await call_vlm(
            prompt=_build_global_prompt(class_stats, detection_summary, video_meta, scene_captions),
            images=[],
        )

        result = {
            "job_id": job_id,
            "scene_captions": [
                {
                    "start_s": scene["start_s"],
                    "end_s":   scene["end_s"],
                    "caption": scene_captions[i],
                }
                for i, scene in enumerate(scenes)
            ],
            "global_caption": global_caption,
            "generated_at":   datetime.now(timezone.utc).isoformat(),
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