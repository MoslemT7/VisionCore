from fastapi import APIRouter, HTTPException
from services.caption_service import generate_captions, get_captions

router = APIRouter(prefix="/caption", tags=["caption"])

@router.post("/{job_id}")
async def create_captions(job_id: str):
    try:
        return await generate_captions(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
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
        raise HTTPException(status_code=500, detail=str(exc))