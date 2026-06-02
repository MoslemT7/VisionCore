def scene_prompt(scene: dict, index: int) -> str:
    obj_lines = "\n".join(
        f"  - {o['class']}: {o['unique_tracks']} unique, "
        f"conf {round(o['avg_conf'] * 100)}%, "
        f"avg travel {round(o.get('avg_travel_px', 0))}px, "
        f"avg area {round(o.get('avg_box_area_px2', 0))}px²"
        for o in scene["objects"]
    )

    pose_dist = scene.get("pose_distribution", {})
    if pose_dist:
        total_obs = sum(pose_dist.values())
        pose_lines = "\n".join(
            f"  - {label}: {count} observations ({round(count/total_obs*100)}%)"
            for label, count in sorted(pose_dist.items(), key=lambda x: -x[1])
        )
        pose_block = f"\nPERSON POSE OBSERVATIONS:\n{pose_lines}"
    else:
        pose_block = ""

    active     = scene.get("active_persons", 0)
    mobile     = scene.get("mobile_persons", 0)
    stationary = active - mobile

    person_block = (
        f"\nPERSON ACTIVITY:\n"
        f"  - Active persons in window: {active}\n"
        f"  - Mobile (travel >50px): {mobile}\n"
        f"  - Likely stationary: {stationary}"
    ) if active > 0 else ""

    return f"""You are an aerial drone analyst. Write ONE sentence describing scene {index + 1}.

TIME WINDOW : {scene['start_s']}s → {scene['end_s']}s
DETECTION DATA (secondary reference only):
{obj_lines}{person_block}{pose_block}

Your sentence must prioritise VISUAL ENVIRONMENT over detections:
- What does the setting look like? (urban street, park, rooftop, open field, parking lot, beach, etc.)
- What time of day does it appear to be? (bright daylight, golden hour, dusk, night, overcast)
- What is the lighting quality? (harsh shadows suggesting midday, soft diffuse light, artificial lighting)
- What surface textures or structures are visible from above? (tarmac, grass, concrete, sand, rooftops)
- What is the general atmosphere or mood of the scene?
- Only briefly reference detected objects/persons if they add meaningful context.

Rules:
- Exactly one sentence.
- Lead with environment and time-of-day inference, not with object counts.
- Do not start with "In this scene".
- Write from an elevated aerial perspective (top-down or angled).
""".strip()


def global_summary_prompt(
    class_stats:       list[dict],
    detection_summary: dict,
    video_meta:        dict,
    scene_captions:    list[str],
    pose_distribution: dict | None = None,
    dominant_poses:    dict | None = None,
    pose_summary:      dict | None = None,
) -> str:
    caption_block = "\n".join(
        f"  Scene {i + 1}: {cap}" for i, cap in enumerate(scene_captions)
    )
    top_classes = ", ".join(
        f"{c['class']} ({c['unique_tracks']} unique, travel {round(c.get('avg_travel_px',0))}px)"
        for c in class_stats[:5]
    )

    if pose_distribution:
        total_obs = sum(pose_distribution.values())
        pose_lines = ", ".join(
            f"{label}: {count} ({round(count/total_obs*100)}%)"
            for label, count in sorted(pose_distribution.items(), key=lambda x: -x[1])
        )
        pose_block = f"\nFRAME-LEVEL POSE DISTRIBUTION : {pose_lines}"
    else:
        pose_block = ""

    if dominant_poses:
        dom_lines = ", ".join(
            f"{label}: {count} person(s)"
            for label, count in sorted(dominant_poses.items(), key=lambda x: -x[1])
        )
        dominant_block = f"\nDOMINANT POSE PER PERSON     : {dom_lines}"
    else:
        dominant_block = ""

    total_persons = sum(dominant_poses.values()) if dominant_poses else "?"

    return f"""You are a drone video intelligence analyst. Write a concise natural-language summary of this aerial surveillance footage.

VIDEO DURATION   : {video_meta.get('duration_s', '?')}s
RESOLUTION       : {video_meta.get('width', '?')}x{video_meta.get('height', '?')}
SOURCE FPS       : {video_meta.get('source_fps', '?')}
TOTAL DETECTIONS : {detection_summary.get('total_detections', '?')}
UNIQUE PERSONS   : {total_persons}
TOP CLASSES      : {top_classes}{pose_block}{dominant_block}

SCENE-BY-SCENE CAPTIONS:
{caption_block}

Your summary must prioritise CONTEXTUAL UNDERSTANDING:

1. ENVIRONMENT & SETTING — What type of location is this? (street, plaza, park, industrial area, residential, etc.)
2. TIME OF DAY — Based on lighting, shadows, and visibility, estimate the time of day.
3. ATMOSPHERE — What is the overall mood or context? (busy transit, quiet area, public event, emergency, etc.)
4. ACTIVITY PATTERNS — Are people moving or stationary? Clustered or dispersed? What does this suggest?
5. DETECTIONS (brief) — Only mention object/person counts if they add meaningful intelligence value.

Rules:
- 3-5 sentences maximum.
- Lead with environment and time-of-day, not with numbers.
- Interpret rather than report — what does the scene suggest is happening?
- Write in past tense.
- Do not repeat raw numbers verbatim.
""".strip()