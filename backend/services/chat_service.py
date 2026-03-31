import os
import traceback
from typing import Optional

from dotenv import load_dotenv
from pymongo import MongoClient

from services.vlm_service import call_vlm

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME    = "VisionCore"
COLLECTION = "AnalysisHistory"


def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]


def _build_system_prompt(doc: dict) -> str:
    rich              = doc.get("rich_stats", {})
    video_meta        = rich.get("video_meta", {})
    performance       = rich.get("performance", {})
    detection_summary = rich.get("detection_summary", {})
    class_stats       = rich.get("class_stats", [])
    track_details     = rich.get("track_details", [])
    captions          = doc.get("captions", {})
    scene_captions    = captions.get("scene_captions", [])
    global_caption    = captions.get("global_caption", "")

    lines = [
        "You are an expert video analysis assistant.",
        "You have full access to the structured analysis of a video.",
        "Answer questions accurately using the data below.",
        "Be concise. If something is not in the data, say so.",
        "",
        "=== VIDEO INFO ===",
        f"Filename   : {doc.get('filename', '?')}",
        f"Duration   : {video_meta.get('duration_s', '?')}s",
        f"Resolution : {video_meta.get('width', '?')}x{video_meta.get('height', '?')}",
        f"Source FPS : {video_meta.get('source_fps', '?')}",
        f"Sampled at : {video_meta.get('processed_fps', '?')} fps (every {video_meta.get('frame_step', '?')} frames)",
        "",
        "=== DETECTION SUMMARY ===",
        f"Total detections     : {detection_summary.get('total_detections', '?')}",
        f"Unique objects       : {detection_summary.get('total_unique_objects', '?')}",
        f"Classes found        : {detection_summary.get('num_classes', '?')}",
        f"Avg detections/frame : {detection_summary.get('avg_detections_per_frame', '?')}",
        f"Peak detections      : {detection_summary.get('max_detections_in_frame', '?')} in a single frame",
        "",
        "=== PERFORMANCE ===",
        f"Processing time : {performance.get('elapsed_s', '?')}s",
        f"Throughput      : {performance.get('throughput_fps', '?')} fps",
        f"Avg inference   : {performance.get('avg_inference_ms', '?')}ms",
        f"Min/Max infer   : {performance.get('min_inference_ms', '?')}ms / {performance.get('max_inference_ms', '?')}ms",
        "",
    ]

    if class_stats:
        lines.append("=== CLASS BREAKDOWN ===")
        for c in class_stats:
            lines.append(
                f"  {c['class']}: {c['unique_tracks']} unique, "
                f"{c['total_detections']} detections, "
                f"avg conf {round(c['avg_conf'] * 100)}%, "
                f"avg travel {c.get('avg_travel_px', 0):.1f}px, "
                f"avg area {c.get('avg_box_area_px2', 0):.0f}px²"
            )
        lines.append("")

    if track_details:
        lines.append("=== TOP TRACKED OBJECTS (up to 20) ===")
        for t in track_details[:20]:
            lines.append(
                f"  Track #{t['track_id']} [{t['class']}] — "
                f"frames {t['first_frame']}→{t['last_frame']}, "
                f"seen {t['frame_count']}x, "
                f"conf avg {round(t['conf_avg'] * 100)}%, "
                f"travel {t.get('travel_px', 0):.1f}px"
            )
        lines.append("")

    if global_caption:
        lines.append("=== AI GLOBAL DESCRIPTION ===")
        lines.append(global_caption)
        lines.append("")

    if scene_captions:
        lines.append("=== SCENE CAPTIONS ===")
        for s in scene_captions:
            lines.append(f"  {s['start_s']}s → {s['end_s']}s : {s['caption']}")
        lines.append("")

    return "\n".join(lines)


def _build_messages(system_prompt: str, history: list[dict], question: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages


async def chat(job_id: str, question: str, history: list[dict]) -> str:
    try:
        col = _col()
        doc = col.find_one({"job_id": job_id})

        if not doc:
            raise ValueError(f"Job '{job_id}' not found.")
        if doc.get("status") != "completed":
            raise ValueError("Analysis is not completed yet.")

        system_prompt = _build_system_prompt(doc)
        messages      = _build_messages(system_prompt, history, question)

        full_prompt = "\n\n".join(
            f"[{m['role'].upper()}]\n{m['content']}" for m in messages
        )

        return await call_vlm(prompt=full_prompt, images=[])

    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(str(exc))