import os
import traceback
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI")
DB_NAME    = os.getenv("DB_NAME")
COLLECTION = os.getenv("COLLECTION")

OLLAMA_URL      = os.getenv("OLLAMA_URL")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL")
LLM_MAX_TOKENS  = int(os.getenv("LLM_MAX_TOKENS"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE"))

PERSON_LABELS = {"person", "pedestrian", "item"}

def _col():
    return MongoClient(MONGO_URI)[DB_NAME][COLLECTION]

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

def get_user_context(job_id: str) -> dict:
    doc = _col().find_one({"job_id": job_id}, {"user_context": 1})
    return (doc or {}).get("user_context", {})

def save_user_context(job_id: str, context: dict) -> None:
    _col().update_one(
        {"job_id": job_id},
        {"$set": {"user_context": context}},
    )

def save_conversation(job_id: str, history: list[dict]) -> None:
    _col().update_one(
        {"job_id": job_id},
        {"$set": {
            "chat_history":    history,
            "chat_saved_at":   datetime.now(timezone.utc).isoformat(),
            "chat_turn_count": len([h for h in history if h.get("role") == "user"]),
        }},
    )

def load_conversation(job_id: str) -> list[dict]:
    doc = _col().find_one({"job_id": job_id}, {"chat_history": 1})
    return (doc or {}).get("chat_history", [])

def _extract_context_from_message(question: str, answer: str) -> dict | None:
    context_keywords = [
        "location", "place", "site", "area", "scene", "event", "date",
        "time", "weather", "purpose", "mission", "crowd", "protest",
        "festival", "accident", "emergency", "airport", "stadium",
        "market", "street", "building", "park", "beach",
    ]
    q_lower = question.lower()
    if any(kw in q_lower for kw in context_keywords):
        return {
            "inferred_from": question[:200],
            "added_at":      datetime.now(timezone.utc).isoformat(),
        }
    return None

def _build_user_context_block(user_context: dict) -> str:
    if not user_context:
        return ""
    lines = ["=== USER-PROVIDED CONTEXT ==="]
    if user_context.get("location"):
        lines.append(f"Location      : {user_context['location']}")
    if user_context.get("event"):
        lines.append(f"Event/Context : {user_context['event']}")
    if user_context.get("date"):
        lines.append(f"Date/Time     : {user_context['date']}")
    if user_context.get("notes"):
        lines.append(f"Notes         : {user_context['notes']}")
    if user_context.get("inferred_from"):
        lines.append(f"(Auto-inferred from conversation)")
    lines.append("")
    return "\n".join(lines)

def _build_system_prompt(doc: dict, user_context: dict) -> str:
    rich              = doc.get("rich_stats", {})
    video_meta        = rich.get("video_meta", {})
    performance       = rich.get("performance", {})
    detection_summary = rich.get("detection_summary", {})
    class_stats       = rich.get("class_stats", [])
    pose_summary      = rich.get("pose_summary", {})

    track_details = rich.get("track_details") or doc.get("track_details") or []

    captions       = doc.get("captions", {})
    scene_captions = captions.get("scene_captions", [])
    global_caption = captions.get("global_caption", "")

    persons      = [t for t in track_details if _is_person(t.get("class", ""))]
    non_persons  = [t for t in track_details if not _is_person(t.get("class", ""))]
    person_stats = next((c for c in class_stats if _is_person(c.get("class", ""))), None)
    high_movers  = sorted(persons, key=lambda t: t.get("travel_px", 0), reverse=True)[:5]
    most_seen    = sorted(persons, key=lambda t: t.get("frame_count", 0), reverse=True)[:5]

    pose_distribution: dict = {}
    for t in persons:
        for label, count in _pose_breakdown(t.get("pose_history", [])).items():
            pose_distribution[label] = pose_distribution.get(label, 0) + count

    lines = [
        "You are an expert aerial drone surveillance analyst specialising in person detection, tracking, and behaviour.",
        "You have full access to structured YOLO + ByteTrack + pose classification analysis from drone footage.",
        "Focus on person-level insights: counts, density, movement, poses, trajectories, and behavioural patterns.",
        "Reference non-person objects only when contextually relevant.",
        "If user-provided context is available (location, event, etc.), use it to enrich your analysis.",
        "Be concise, data-driven, and precise. If data is absent, say so clearly.",
        "",
    ]

    context_block = _build_user_context_block(user_context)
    if context_block:
        lines.append(context_block)

    lines += [
        "=== VIDEO INFO ===",
        f"Filename   : {doc.get('filename', '?')}",
        f"Duration   : {video_meta.get('duration_s', '?')}s",
        f"Resolution : {video_meta.get('width', '?')}x{video_meta.get('height', '?')}",
        f"Source FPS : {video_meta.get('source_fps', '?')}",
        f"Sampled at : {video_meta.get('processed_fps', '?')} fps (every {video_meta.get('frame_step', '?')} frames)",
        f"Total frames processed : {performance.get('processed_frames', '?')}",
        "",
        "=== PERSON DETECTION SUMMARY ===",
        f"Total unique persons tracked : {len(persons)}",
    ]

    if person_stats:
        lines += [
            f"Total person detections      : {person_stats.get('total_detections', '?')}",
            f"Avg confidence               : {round(person_stats.get('avg_conf', 0) * 100)}%",
            f"Avg movement (travel)        : {person_stats.get('avg_travel_px', 0):.1f}px",
            f"Avg bounding box area        : {person_stats.get('avg_box_area_px2', 0):.0f}px²",
        ]

    lines += [
        "",
        "=== OVERALL DETECTION SUMMARY ===",
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

    if pose_summary:
        lines.append("=== POSE SUMMARY (dominant pose per track) ===")
        for pose, count in sorted(pose_summary.items(), key=lambda x: -x[1]):
            lines.append(f"  {pose}: {count} person(s)")
        lines.append("")

    if pose_distribution:
        lines.append("=== POSE DISTRIBUTION (all frame-level observations) ===")
        total_obs = sum(pose_distribution.values())
        for label, count in sorted(pose_distribution.items(), key=lambda x: -x[1]):
            pct = round(count / total_obs * 100) if total_obs else 0
            lines.append(f"  {label}: {count} observations ({pct}%)")
        lines.append("")

    if persons:
        lines.append(f"=== ALL TRACKED PERSONS ({len(persons)} total) ===")
        for t in persons:
            breakdown = _pose_breakdown(t.get("pose_history", []))
            pose_str  = ", ".join(f"{k}:{v}" for k, v in sorted(breakdown.items(), key=lambda x: -x[1])) or "n/a"
            cx = t.get("last_centroid", {}).get("x", "?")
            cy = t.get("last_centroid", {}).get("y", "?")
            lines.append(
                f"  #{t['track_id']} — "
                f"frames {t['first_frame']}→{t['last_frame']}, "
                f"seen {t['frame_count']}x, "
                f"conf {round(t['conf_avg'] * 100)}%, "
                f"travel {t.get('travel_px', 0):.1f}px, "
                f"area {t.get('avg_box_area_px2', 0):.0f}px², "
                f"last_pos ({cx},{cy}), "
                f"dominant_pose: {t.get('dominant_pose', 'unknown')}, "
                f"poses: [{pose_str}]"
            )
        lines.append("")

    if high_movers:
        lines.append("=== TOP 5 MOST MOBILE PERSONS ===")
        for t in high_movers:
            lines.append(f"  #{t['track_id']} travel={t.get('travel_px', 0):.1f}px dominant_pose={t.get('dominant_pose', '?')}")
        lines.append("")

    if most_seen:
        lines.append("=== TOP 5 MOST FREQUENTLY DETECTED PERSONS ===")
        for t in most_seen:
            lines.append(f"  #{t['track_id']} seen={t['frame_count']}x dominant_pose={t.get('dominant_pose', '?')} conf={round(t['conf_avg']*100)}%")
        lines.append("")

    if non_persons:
        non_person_classes: dict = {}
        for t in non_persons:
            cls = t.get("class", "unknown")
            non_person_classes[cls] = non_person_classes.get(cls, 0) + 1
        lines.append("=== OTHER DETECTED OBJECTS ===")
        for cls, count in sorted(non_person_classes.items(), key=lambda x: -x[1]):
            lines.append(f"  {cls}: {count} unique tracks")
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
        role    = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages

async def chat(job_id: str, question: str, history: list[dict]) -> dict:
    try:
        col = _col()
        doc = col.find_one({"job_id": job_id})
        if not doc:
            raise ValueError(f"Job '{job_id}' not found.")
        if doc.get("status") != "completed":
            raise ValueError("Analysis is not completed yet.")

        user_context = get_user_context(job_id)

        hint = _extract_context_from_message(question, "")
        if hint:
            user_context = {**user_context, **hint}
            save_user_context(job_id, user_context)

        system_prompt = _build_system_prompt(doc, user_context)
        messages      = _build_messages(system_prompt, history, question)
        answer        = await _call_llm(messages)

        updated_history = [
            *history,
            {"role": "user",      "content": question},
            {"role": "assistant", "content": answer,
             "timestamp": datetime.now(timezone.utc).isoformat()},
        ]
        save_conversation(job_id, updated_history)

        return {"answer": answer, "user_context": user_context}

    except Exception as exc:
        traceback.print_exc()
        raise RuntimeError(str(exc))