import time
from threading import Lock
from typing import Any, Dict, Optional


_jobs: Dict[str, Dict[str, Any]] = {}
_lock = Lock()


def create_job(job_id: str, total_frames: Optional[int] = None) -> None:
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "created_at": time.time(),
            "started_at": time.time(),
            "finished_at": None,
            "elapsed_time": 0.0,
            "progress": {
                "current_frame": 0,
                "total_frames": total_frames,
                "percent": 0.0,
            },
            "performance_log": [],
            "detections_file": None,
            "video_file": None,
            "energy_wh": None,
            "summary": None,
            "summary_file": None,
            "error": None,
        }


def update_progress(
    job_id: str,
    current_frame: int,
    total_frames: Optional[int],
    performance_log: Optional[list] = None,
) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return

        job["elapsed_time"] = time.time() - job.get("started_at", job.get("created_at", time.time()))

        job_progress = job.setdefault("progress", {})
        job_progress["current_frame"] = current_frame
        job_progress["total_frames"] = total_frames
        if total_frames and total_frames > 0:
            job_progress["percent"] = min(100.0, (current_frame / total_frames) * 100.0)
        else:
            job_progress["percent"] = 0.0

        if performance_log is not None:
            job["performance_log"] = performance_log


def complete_job(job_id: str, result: Dict[str, Any]) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return

        job["status"] = "completed"
        job["finished_at"] = time.time()
        job["elapsed_time"] = job["finished_at"] - job.get("started_at", job["created_at"])

        for key in (
            "detections_file",
            "video_file",
            "energy_wh",
            "summary",
            "summary_file",
            "performance_log",
            "total_frames",
            "total_detections",
            "top_classes",
        ):
            if key in result:
                job[key] = result[key]


def fail_job(job_id: str, error_message: str) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return

        job["status"] = "failed"
        job["finished_at"] = time.time()
        job["elapsed_time"] = job["finished_at"] - job.get("started_at", job["created_at"])
        job["error"] = error_message


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return None
        # return a shallow copy to avoid external mutation
        return dict(job)


