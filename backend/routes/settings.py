import os
from dotenv import load_dotenv, set_key, dotenv_values
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

load_dotenv()

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    vlmProvider:     Optional[str]   = None
    openrouterModel: Optional[str]   = None
    geminiModel:     Optional[str]   = None
    vlmTemperature:  Optional[float] = None
    vlmMaxTokens:    Optional[int]   = None
    yoloModel:       Optional[str]   = None
    defaultFps:      Optional[float] = None
    defaultConf:     Optional[float] = None
    defaultImgsz:    Optional[int]   = None
    nScenes:         Optional[int]   = None


ENV_MAP = {
    "vlmProvider":     "VLM_PROVIDER",
    "openrouterModel": "OPENROUTER_MODEL",
    "geminiModel":     "GEMINI_MODEL",
    "vlmTemperature":  "VLM_TEMPERATURE",
    "vlmMaxTokens":    "VLM_MAX_TOKENS",
    "yoloModel":       "YOLO_DEFAULT_MODEL",
    "defaultFps":      "DEFAULT_FPS",
    "defaultConf":     "DEFAULT_CONF_THRESHOLD",
    "defaultImgsz":    "DEFAULT_IMGSZ",
    "nScenes":         "CAPTION_N_SCENES",
}


@router.get("")
def get_settings():
    values = dotenv_values(ENV_PATH)
    return {
        "vlmProvider":     values.get("VLM_PROVIDER",           "openrouter"),
        "openrouterModel": values.get("OPENROUTER_MODEL",        "google/gemini-1.5-pro"),
        "geminiModel":     values.get("GEMINI_MODEL",            "gemini-1.5-pro"),
        "vlmTemperature":  float(values.get("VLM_TEMPERATURE",   "0.4")),
        "vlmMaxTokens":    int(values.get("VLM_MAX_TOKENS",      "2048")),
        "yoloModel":       values.get("YOLO_DEFAULT_MODEL",      "s"),
        "defaultFps":      float(values.get("DEFAULT_FPS",       "1.0")),
        "defaultConf":     float(values.get("DEFAULT_CONF_THRESHOLD", "0.25")),
        "defaultImgsz":    int(values.get("DEFAULT_IMGSZ",       "640")),
        "nScenes":         int(values.get("CAPTION_N_SCENES",    "4")),
    }


@router.post("")
def save_settings(payload: SettingsPayload):
    try:
        data = payload.model_dump(exclude_none=True)
        for field, env_key in ENV_MAP.items():
            if field in data:
                set_key(ENV_PATH, env_key, str(data[field]))
        load_dotenv(override=True)
        return {"saved": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))