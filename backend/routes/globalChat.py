from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.global_chat_service import global_chat

router = APIRouter(prefix="/chat/global", tags=["global-chat"])


class ChatTurn(BaseModel):
    role:    str
    content: str


class GlobalChatRequest(BaseModel):
    job_ids:  list[str]
    question: str
    history:  list[ChatTurn] = []


@router.post("")
async def global_chat_endpoint(body: GlobalChatRequest):
    try:
        result = await global_chat(
            job_ids  = body.job_ids,
            question = body.question,
            history  = [t.model_dump() for t in body.history],
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))