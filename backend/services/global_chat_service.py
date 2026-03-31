import os
import traceback
from dotenv import load_dotenv

from services.history_service import get_history_details
from services.vlm_service import call_vlm

load_dotenv()


def _build_video_block(doc: dict) -> str:
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
        f"── VIDEO: {doc.get('filename', doc.get('job_id', '?'))} ──",
        f"Analysed    : {doc.get('analysed_at', '?')}",
        f"Duration    : {video_meta.get('duration_s', '?')}s",
        f"Resolution  : {video_meta.get('width', '?')}×{video_meta.get('height', '?')}",
        f"Source FPS  : {video_meta.get('source_fps', '?')}",
        "",
        "Detection Summary:",
        f"  Total detections     : {detection_summary.get('total_detections', '?')}",
        f"  Unique objects       : {detection_summary.get('total_unique_objects', '?')}",
        f"  Classes found        : {detection_summary.get('num_classes', '?')}",
        f"  Avg detections/frame : {detection_summary.get('avg_detections_per_frame', '?')}",
        f"  Peak detections      : {detection_summary.get('max_detections_in_frame', '?')}",
        "",
        "Performance:",
        f"  Processing time : {performance.get('elapsed_s', '?')}s",
        f"  Throughput      : {performance.get('throughput_fps', '?')} fps",
        f"  Avg inference   : {performance.get('avg_inference_ms', '?')}ms",
        "",
    ]

    if class_stats:
        lines.append("Class Breakdown:")
        for c in class_stats:
            lines.append(
                f"  {c['class']}: {c['unique_tracks']} unique, "
                f"{c['total_detections']} detections, "
                f"conf {round(c['avg_conf'] * 100)}%, "
                f"travel {c.get('avg_travel_px', 0):.1f}px"
            )
        lines.append("")

    if track_details:
        lines.append("Top Tracked Objects (up to 10):")
        for t in track_details[:10]:
            lines.append(
                f"  #{t['track_id']} [{t['class']}] "
                f"frames {t['first_frame']}→{t['last_frame']}, "
                f"seen {t['frame_count']}x, "
                f"conf {round(t['conf_avg'] * 100)}%, "
                f"travel {t.get('travel_px', 0):.1f}px"
            )
        lines.append("")

    if global_caption:
        lines.append("AI Global Description:")
        lines.append(f"  {global_caption}")
        lines.append("")

    if scene_captions:
        lines.append("Scene Captions:")
        for s in scene_captions:
            lines.append(f"  {s['start_s']}s → {s['end_s']}s : {s['caption']}")
        lines.append("")

    return "\n".join(lines)


def _build_system_prompt(docs: list[dict]) -> str:
    header = [
        "You are an expert video analysis assistant with access to structured analysis data.",
        f"You have been given data for {len(docs)} video(s).",
        "Answer questions accurately using only the data provided.",
        "If asked to compare videos, compare them directly using the data.",
        "If something is not in the data, say so clearly.",
        "Be concise and specific.",
        "",
        "=" * 60,
        "",
    ]

    video_blocks = []
    for doc in docs:
        video_blocks.append(_build_video_block(doc))

    return "\n".join(header) + "\n\n".join(video_blocks)


def _build_messages(system_prompt: str, history: list[dict], question: str) -> str:
    parts = [f"[SYSTEM]\n{system_prompt}"]
    for turn in history:
        role    = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            parts.append(f"[{role.upper()}]\n{content}")
    parts.append(f"[USER]\n{question}")
    return "\n\n".join(parts)


async def global_chat(job_ids: list[str], question: str, history: list[dict]) -> dict:
    try:
        if not job_ids:
            raise ValueError("No videos selected. Please select at least one video.")

        docs = []
        missing = []
        for jid in job_ids:
            doc = get_history_details(jid)
            if doc:
                docs.append(doc)
            else:
                missing.append(jid)

        if not docs:
            raise ValueError("None of the selected videos were found in history.")

        system_prompt = _build_system_prompt(docs)
        prompt        = _build_messages(system_prompt, history, question)
        answer        = await call_vlm(prompt=prompt, images=[])

        return {
            "answer":        answer,
            "videos_used":   [d.get("filename", d.get("job_id")) for d in docs],
            "videos_missing": missing,
        }

    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(str(exc))