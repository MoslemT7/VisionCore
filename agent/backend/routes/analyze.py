import os
import uuid

from fastapi import APIRouter, UploadFile, File, Query, BackgroundTasks, HTTPException

from services.video_analysis_service import analyze_video_job
from services.job_manager import get_job, create_job

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/video")
async def start_video_analysis(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    fps: float = Query(1.0, ge=0.1, le=60.0, description="Frame sampling rate in FPS"),
    model_size: str = Query("s", regex="^(n|s|m)$", description="YOLOv8 model size: n, s, or m"),
    conf_threshold: float = Query(0.25, ge=0.0, le=1.0, description="Detection confidence threshold"),
    imgsz: int = Query(640, ge=320, le=1280, description="YOLO input image size"),
):
    """
    Start an asynchronous video analysis job.
    Returns only the job_id; frontend should poll GET /analyze/video/{job_id}.
    """
    job_id = str(uuid.uuid4())
    upload_path = f"uploads/{job_id}.mp4"
    output_dir = f"outputs/{job_id}"

    os.makedirs("uploads", exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with open(upload_path, "wb") as f:
        f.write(await video.read())

    # Initialize job with unknown total_frames; will be updated when video opens
    create_job(job_id, total_frames=None)

    background_tasks.add_task(
        analyze_video_job,
        job_id=job_id,
        video_path=upload_path,
        output_dir=output_dir,
        fps=fps,
        model_size=model_size,
        conf_threshold=conf_threshold,
        imgsz=imgsz,
    )

    return {"job_id": job_id}


@router.get("/video/{job_id}")
async def get_video_analysis_status(job_id: str):
    """
    Get current status or final result of a video analysis job.
    On completion, this matches the expected response structure.
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    status = job.get("status")
    performance_log = job.get("performance_log", [])
    elapsed_time = float(job.get("elapsed_time") or 0.0)

    # If completed, return full spec with structured JSON for frontend
    if status == "completed":
        return {
            "job_id": job_id,
            "status": status,
            "summary": job.get("summary", ""),
            "summary_file": job.get("summary_file"),
            "total_frames": job.get("total_frames", 0),
            "total_detections": job.get("total_detections", 0),
            "top_classes": job.get("top_classes", []),
            "energy_wh": job.get("energy_wh", 0.0),
            "elapsed_time": elapsed_time,
            "detections_file": job.get("detections_file"),
            "video_file": job.get("video_file"),
            "performance_log": performance_log,
            "progress": job.get("progress"),
        }

    # If running or failed, return partial info with status & progress
    return {
        "job_id": job_id,
        "status": status,
        "progress": job.get("progress"),
        "performance_log": performance_log,
        "elapsed_time": elapsed_time,
        "error": job.get("error"),
    }
