from fastapi import APIRouter, HTTPException
from services.history_service import (
    get_history,
    get_aggregate,
    get_job_stats,
    get_history_paginated,
    get_history_details
)

router = APIRouter(prefix="/history", tags=["history"])

@router.get("")
def list_history(
    page: int = 1,
    page_size: int = 10,
    status: str = "all",
    sort_by: str = "analysed_at",
    sort_order: str = "desc"
):
    return get_history_paginated(page, page_size, status, sort_by, sort_order)

@router.get("/aggregate")
def aggregate():
    return get_aggregate()

@router.get("/{job_id}/stats")
def job_stats(job_id: str):
    data = get_job_stats(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return data

@router.get("/details/{job_id}")
def history_details(job_id: str):
    return get_history_details(job_id)