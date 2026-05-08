from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.global_chat_service import global_chat, get_global_session, update_global_context

router = APIRouter(prefix="/chat/global", tags=["global-chat"])


class ChatTurn(BaseModel):
    role:    str
    content: str


class GlobalChatRequest(BaseModel):
    job_ids:      list[str]
    question:     str
    history:      list[ChatTurn] = []
    user_context: dict           = {}


class SessionRequest(BaseModel):
    job_ids: list[str]


class ContextRequest(BaseModel):
    job_ids: list[str]
    context: dict


@router.post("")
async def global_chat_endpoint(body: GlobalChatRequest):
    try:
        result = await global_chat(
            job_ids      = body.job_ids,
            question     = body.question,
            history      = [t.model_dump() for t in body.history],
            user_context = body.user_context,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/session")
async def fetch_session(body: SessionRequest):
    session = await get_global_session(body.job_ids)
    return {
        "history":      session.get("history", []),
        "user_context": session.get("user_context", {}),
        "turn_count":   session.get("turn_count", 0),
        "last_active":  session.get("last_active"),
    }


@router.post("/context")
async def set_context(body: ContextRequest):
    await update_global_context(body.job_ids, body.context)
    return {"ok": True}