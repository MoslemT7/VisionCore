import os
import traceback
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from services.history_service import get_history_details

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI")
DB_NAME    = os.getenv("DB_NAME")
COLLECTION = os.getenv("COLLECTION")

OLLAMA_URL      = os.getenv("OLLAMA_URL")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL")
LLM_MAX_TOKENS  = int(os.getenv("LLM_MAX_TOKENS"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE"))

PERSON_LABELS = {"person", "pedestrian", "item"}

GLOBAL_CHAT_COLLECTION = "GlobalChatSessions"

def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]

def _sessions_col():
    return MongoClient(MONGO_URI)[DB_NAME][GLOBAL_CHAT_COLLECTION]

async def _call_llm(messages: list[dict]) -> str:
    payload = {
        "model":    OLLAMA_MODEL,
        "messages": messages,
        "stream":   False,
        "options": {
            "num_predict": LLM_MAX_TOKENS,
            "temperature": LLM_TEMPERATURE,
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
    if response.status_code != 200:
        raise RuntimeError(f"Ollama error {response.status_code}: {response.text}")
    return response.json()["message"]["content"].strip()

def _is_person(label: str) -> bool:
    return label.lower() in PERSON_LABELS

def _pose_breakdown(pose_history: list[dict]) -> dict:
    counts: dict = {}
    for p in pose_history:
        label = p.get("pose", "unknown")
        counts[label] = counts.get(label, 0) + 1
    return counts

def _session_key(job_ids: list[str]) -> str:
    return "_".join(sorted(job_ids))

def get_session(job_ids: list[str]) -> dict:
    key = _session_key(job_ids)
    doc = _sessions_col().find_one({"session_key": key})
    return doc or {}

def save_session(job_ids: list[str], history: list[dict], user_context: dict) -> None:
    key = _session_key(job_ids)
    _sessions_col().update_one(
        {"session_key": key},
        {"$set": {
            "session_key":     key,
            "job_ids":         sorted(job_ids),
            "history":         history,
            "user_context":    user_context,
            "turn_count":      len([h for h in history if h.get("role") == "user"]),
            "last_active":     datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

def _build_video_block(doc: dict) -> str:
    rich              = doc.get("rich_stats", {})
    video_meta        = rich.get("video_meta", {})
    performance       = rich.get("performance", {})
    detection_summary = rich.get("detection_summary", {})
    class_stats       = rich.get("class_stats", [])
    track_details     = rich.get("track_details") or doc.get("track_details") or []
    captions          = doc.get("captions", {})
    scene_captions    = captions.get("scene_captions", [])
    global_caption    = captions.get("global_caption", "")
    user_context      = doc.get("user_context", {})

    persons     = [t for t in track_details if _is_person(t.get("class", ""))]
    high_movers = sorted(persons, key=lambda t: t.get("travel_px", 0), reverse=True)[:3]

    pose_distribution: dict = {}
    for t in persons:
        for label, count in _pose_breakdown(t.get("pose_history", [])).items():
            pose_distribution[label] = pose_distribution.get(label, 0) + count

    lines = [f"── VIDEO: {doc.get('filename', doc.get('job_id', '?'))} ──"]

    if user_context:
        if user_context.get("location"): lines.append(f"Location      : {user_context['location']}")
        if user_context.get("event"):    lines.append(f"Event/Context : {user_context['event']}")
        if user_context.get("date"):     lines.append(f"Date/Time     : {user_context['date']}")
        if user_context.get("notes"):    lines.append(f"Notes         : {user_context['notes']}")

    lines += [
        f"Analysed    : {doc.get('analysed_at', '?')}",
        f"Duration    : {video_meta.get('duration_s', '?')}s",
        f"Resolution  : {video_meta.get('width', '?')}×{video_meta.get('height', '?')}",
        f"Source FPS  : {video_meta.get('source_fps', '?')}",
        "",
        "Detection Summary:",
        f"  Total detections     : {detection_summary.get('total_detections', '?')}",
        f"  Unique persons       : {len(persons)}",
        f"  Unique objects total : {detection_summary.get('total_unique_objects', '?')}",
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

    if pose_distribution:
        total_obs = sum(pose_distribution.values())
        lines.append("Pose Distribution:")
        for label, count in sorted(pose_distribution.items(), key=lambda x: -x[1]):
            pct = round(count / total_obs * 100) if total_obs else 0
            lines.append(f"  {label}: {count} ({pct}%)")
        lines.append("")

    if high_movers:
        lines.append("Most Mobile Persons:")
        for t in high_movers:
            lines.append(
                f"  #{t['track_id']} travel={t.get('travel_px', 0):.1f}px "
                f"dominant_pose={t.get('dominant_pose', '?')} "
                f"seen={t['frame_count']}x"
            )
        lines.append("")

    if global_caption:
        lines.append(f"AI Description: {global_caption}")
        lines.append("")

    if scene_captions:
        lines.append("Scene Captions:")
        for s in scene_captions:
            lines.append(f"  {s['start_s']}s → {s['end_s']}s : {s['caption']}")
        lines.append("")

    return "\n".join(lines)

def _build_system_prompt(docs: list[dict], user_context: dict) -> str:
    header = [
        "You are an expert aerial drone surveillance analyst.",
        f"You have access to analysis data for {len(docs)} video(s).",
        "Answer accurately using only the data provided.",
        "If asked to compare videos, compare them directly using the data.",
        "If user-provided session context is available (location, event, notes), use it to enrich your analysis.",
        "If something is not in the data, say so clearly.",
        "Be concise and specific.",
        "",
    ]

    if user_context:
        header.append("=== SESSION CONTEXT (user-provided) ===")
        if user_context.get("location"): header.append(f"Location : {user_context['location']}")
        if user_context.get("event"):    header.append(f"Event    : {user_context['event']}")
        if user_context.get("date"):     header.append(f"Date     : {user_context['date']}")
        if user_context.get("notes"):    header.append(f"Notes    : {user_context['notes']}")
        header.append("")

    header += ["=" * 60, ""]
    video_blocks = [_build_video_block(doc) for doc in docs]
    return "\n".join(header) + "\n\n".join(video_blocks)

def _build_messages(system_prompt: str, history: list[dict], question: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history:
        role    = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages

async def global_chat(job_ids: list[str], question: str, history: list[dict], user_context: dict | None = None) -> dict:
    try:
        if not job_ids:
            raise ValueError("No videos selected.")

        session      = get_session(job_ids)
        user_context = user_context or session.get("user_context", {})

        docs, missing = [], []
        for jid in job_ids:
            doc = get_history_details(jid)
            if doc:
                docs.append(doc)
            else:
                missing.append(jid)

        if not docs:
            raise ValueError("None of the selected videos were found in history.")

        system_prompt = _build_system_prompt(docs, user_context)
        messages      = _build_messages(system_prompt, history, question)
        answer        = await _call_llm(messages)

        updated_history = [
            *history,
            {"role": "user",      "content": question},
            {"role": "assistant", "content": answer,
             "timestamp": datetime.now(timezone.utc).isoformat()},
        ]
        save_session(job_ids, updated_history, user_context)

        return {
            "answer":         answer,
            "videos_used":    [d.get("filename", d.get("job_id")) for d in docs],
            "videos_missing": missing,
            "user_context":   user_context,
        }

    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(str(exc))

async def get_global_session(job_ids: list[str]) -> dict:
    return get_session(job_ids)

async def update_global_context(job_ids: list[str], context: dict) -> None:
    session = get_session(job_ids)
    save_session(job_ids, session.get("history", []), context)