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

    active   = scene.get("active_persons", 0)
    mobile   = scene.get("mobile_persons", 0)
    stationary = active - mobile

    person_block = (
        f"\nPERSON ACTIVITY:\n"
        f"  - Active persons in window: {active}\n"
        f"  - Mobile (travel >50px): {mobile}\n"
        f"  - Likely stationary: {stationary}"
    ) if active > 0 else ""

    return f"""You are a drone-based aerial surveillance analyst. Write ONE sentence describing scene {index + 1}.

TIME WINDOW : {scene['start_s']}s → {scene['end_s']}s
DETECTED OBJECTS:
{obj_lines}{person_block}{pose_block}

Rules:
- Exactly one sentence.
- Name objects explicitly — never say "various objects".
- Do not start with "In this scene".
- Write from an elevated aerial perspective (top-down or angled).
- Mention dominant pose/activity if pose data is present (e.g. walking, standing, lying).
- If mobile persons > 0, suggest movement or transit. If mostly stationary, suggest clustering or gathering.
- Reference object size (area) to infer proximity to camera if relevant.
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

    return f"""You are a drone video intelligence system. Write a concise natural-language summary of this aerial surveillance footage.

VIDEO DURATION   : {video_meta.get('duration_s', '?')}s
RESOLUTION       : {video_meta.get('width', '?')}x{video_meta.get('height', '?')}
SOURCE FPS       : {video_meta.get('source_fps', '?')}
TOTAL DETECTIONS : {detection_summary.get('total_detections', '?')}
UNIQUE PERSONS   : {total_persons}
UNIQUE OBJECTS   : {detection_summary.get('total_unique_objects', '?')}
TOP CLASSES      : {top_classes}
AVG DET/FRAME    : {detection_summary.get('avg_detections_per_frame', '?')}{pose_block}{dominant_block}

SCENE-BY-SCENE CAPTIONS:
{caption_block}

Rules:
- 3-5 sentences maximum.
- Cover: what is visible from aerial perspective, dominant activity, spatial organisation.
- Interpret pose data: what do the dominant postures suggest (crowd waiting, people in transit, individuals prone/injured)?
- Comment on movement patterns: are persons mobile or stationary? Clustered or dispersed?
- Do not repeat raw numbers verbatim — interpret and contextualise them.
- Write in past tense.
""".strip()