import os
import uuid
from fastapi import APIRouter, UploadFile, File, Query, BackgroundTasks, HTTPException, Body

from services.video_analysis_service import analyze_video_job
from services.image_analysis_service import analyze_images_job
from services.job_manager import get_job, create_job

router = APIRouter(prefix="/analyze", tags=["analysis"])

@router.post("/video")
async def start_video_analysis(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
):
    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    filename = video.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if not ((video.content_type or "").startswith("video/") or ext in allowed_ext):
        raise HTTPException(status_code=400, detail="Invalid file type")

    job_id = str(uuid.uuid4())
    upload_path = f"uploads/{job_id}{ext if ext else '.mp4'}"
    output_dir = f"outputs/{job_id}"

    os.makedirs("uploads", exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with open(upload_path, "wb") as f:
        f.write(await video.read())

    create_job(job_id, total_frames=None)

    background_tasks.add_task(
        analyze_video_job,
        job_id=job_id,
        video_path=upload_path,
        output_dir=output_dir,
    )

    return {"job_id": job_id}

@router.get("/video/{job_id}")
async def get_video_analysis_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    status = job.get("status")
    elapsed_time = float(job.get("elapsed_time") or 0.0)

    if status in ("pending", "running"):
        return {
            "job_id": job_id,
            "status": status,
            "progress": job.get("progress", 0),
            "total_frames": job.get("total_frames"),
            "total_detections": job.get("total_detections", 0),
            "unique_objects": job.get("unique_objects", 0),
            "elapsed_time": elapsed_time,
            "performance_log": job.get("performance_log", []),
            "error": job.get("error"),
        }

    if status == "failed":
        return {
            "job_id": job_id,
            "status": status,
            "error": job.get("error"),
            "elapsed_time": elapsed_time,
        }

    rich_stats = job.get("rich_stats", {})

    return {
        "job_id": job_id,
        "status": status,
        "progress": 100,
        "summary": job.get("summary", ""),
        "elapsed_time": elapsed_time,
        "energy_wh": job.get("energy_wh", 0.0),
        "video_file": job.get("video_file"),
        "heatmap_file": job.get("heatmap_file"),
        "detections_file": job.get("detections_file"),
        "rich_stats_file": job.get("rich_stats_file"),
        "track_details_file": job.get("track_details_file"),
        "keypoints_file": job.get("keypoints_file"),
        "total_frames": job.get("total_frames", 0),
        "total_detections": job.get("total_detections", 0),
        "total_unique_objects": job.get("total_unique", 0),
        "top_classes": job.get("top_classes", []),
        "video_meta": rich_stats.get("video_meta", {}),
        "performance": rich_stats.get("performance", {}),
        "detection_summary": rich_stats.get("detection_summary", {}),
        "class_stats": rich_stats.get("class_stats", []),
        "track_details": job.get("track_details", []),
        "performance_log": rich_stats.get("performance_log", job.get("performance_log", [])),
    }

@router.post("/images")
async def start_images_analysis(
    background_tasks: BackgroundTasks,
    body: dict = Body(default={})
):
    job_id = str(uuid.uuid4())
    print(job_id)
    images_dir = r"M:\Projects\PFE\data\frame_test"
    output_dir = fr"M:\Projects\PFE\backend\outputs\{job_id}"

    if not os.path.exists(images_dir):
        raise HTTPException(status_code=404, detail=f"Folder '{images_dir}' not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}
    images = [
        f for f in os.listdir(images_dir)
        if os.path.splitext(f)[1].lower() in allowed_ext
    ]

    if not images:
        raise HTTPException(status_code=400, detail="No valid images found in folder")

    os.makedirs(output_dir, exist_ok=True)

    create_job(job_id, total_frames=len(images))

    background_tasks.add_task(
        analyze_images_job,
        job_id=job_id,
        images_dir=images_dir,
        output_dir=output_dir
    )

    return {"job_id": job_id, "total_images": len(images)}

@router.get("/images/{job_id}")
async def get_images_analysis_status(job_id: str):
    job = get_job(job_id)
    print(job)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job