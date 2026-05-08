from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from services.settings_service import get_settings, save_settings, reset_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    profile_id: Optional[str]            = "default"
    theme:      Optional[dict[str, Any]] = None
    basic:      Optional[dict[str, Any]] = None
    advanced:   Optional[dict[str, Any]] = None


@router.get("")
async def read_settings(profile_id: str = "default"):
    try:
        return get_settings(profile_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("")
async def write_settings(payload: SettingsPayload):
    try:
        data = {k: v for k, v in payload.model_dump().items() if v is not None and k != "profile_id"}
        return save_settings(data, profile_id=payload.profile_id or "default")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/reset")
async def reset(profile_id: str = "default"):
    try:
        return reset_settings(profile_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))