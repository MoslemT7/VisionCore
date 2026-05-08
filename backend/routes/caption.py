from fastapi import APIRouter, HTTPException
import traceback
from services.caption_service import generate_captions, get_captions
import asyncio

router = APIRouter(prefix="/caption", tags=["caption"])
_caption_status: dict = {}

@router.post("/{job_id}")
async def create_captions(job_id: str):
    try:
        return await generate_captions(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{job_id}")
async def fetch_captions(job_id: str):
    try:
        result = await get_captions(job_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Captions for job {job_id} not found.")
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
    


@router.post("/{job_id}")
async def create_captions(job_id: str):
    try:
        _caption_status[job_id] = {"stage": "starting", "scene": 0, "total": 0}
        result = await generate_captions(job_id, status_cb=lambda s: _caption_status.update({job_id: s}))
        _caption_status.pop(job_id, None)
        return result
    except ValueError as exc:
        _caption_status.pop(job_id, None)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        _caption_status.pop(job_id, None)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{job_id}/status")
async def caption_status(job_id: str):
    return _caption_status.get(job_id, {"stage": "idle"})