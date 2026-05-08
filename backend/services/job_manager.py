import time
from typing import Optional

_jobs: dict = {}

def create_job(job_id: str, total_frames: Optional[int] = None) -> dict:
    job = {
        "job_id":          job_id,
        "status":          "pending",
        "progress":        0,
        "total_frames":    total_frames,
        "total_detections": 0,
        "top_classes":     [],
        "summary":         "",
        "summary_file":    None,
        "detections_file": None,
        "video_file":      None,
        "performance_log": [],
        "energy_wh":       0.0,
        "elapsed_time":    0.0,
        "error":           None,
        "created_at":      time.time(),
    }
    _jobs[job_id] = job
    return job


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def fail_job(job_id: str, error: str) -> None:
    update_job(job_id, status="failed", error=error)


def complete_job(job_id: str, **kwargs) -> None:
    update_job(job_id, status="completed", progress=100, **kwargs)