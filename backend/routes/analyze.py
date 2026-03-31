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
    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    filename = video.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    is_video_by_mime = (video.content_type or "").startswith("video/")
    is_video_by_ext = ext in allowed_ext
    if not (is_video_by_mime or is_video_by_ext):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a video.")

    job_id = str(uuid.uuid4())
    upload_suffix = ext if ext else ".mp4"
    upload_path = f"uploads/{job_id}{upload_suffix}"
    output_dir = f"outputs/{job_id}"

    os.makedirs("uploads", exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with open(upload_path, "wb") as f:
        f.write(await video.read())

    job = create_job(job_id, total_frames=None)

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
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    status       = job.get("status")
    elapsed_time = float(job.get("elapsed_time") or 0.0)

    if status in ("pending", "running"):
        return {
            "job_id":          job_id,
            "status":          status,
            "progress":        job.get("progress", 0),
            "total_frames":    job.get("total_frames"),
            "total_detections": job.get("total_detections", 0),
            "unique_objects":  job.get("unique_objects", 0),
            "elapsed_time":    elapsed_time,
            "performance_log": job.get("performance_log", []),
            "error":           job.get("error"),
        }

    if status == "failed":
        return {
            "job_id":      job_id,
            "status":      status,
            "error":       job.get("error"),
            "elapsed_time": elapsed_time,
        }

    rich_stats = job.get("rich_stats", {})

    return {
        "job_id":  job_id,
        "status":  status,
        "progress": 100,
        "summary":      job.get("summary", ""),
        "elapsed_time": elapsed_time,
        "energy_wh":    job.get("energy_wh", 0.0),
        "video_file":      job.get("video_file"),
        "heatmap_file":    job.get("heatmap_file"),
        "detections_file": job.get("detections_file"),
        "total_frames":        job.get("total_frames", 0),
        "total_detections":    job.get("total_detections", 0),
        "total_unique_objects": job.get("total_unique", 0),
        "top_classes":         job.get("top_classes", []),
        "video_meta": rich_stats.get("video_meta", {}),
        "performance": rich_stats.get("performance", {}),
        "detection_summary": rich_stats.get("detection_summary", {}),
        "class_stats": rich_stats.get("class_stats", []),
        "track_details": rich_stats.get("track_details", []),
        "performance_log": job.get("performance_log", []),
    }