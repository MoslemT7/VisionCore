from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.chat_service import chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatTurn(BaseModel):
    role:    str
    content: str


class ChatRequest(BaseModel):
    question: str
    history:  list[ChatTurn] = []


@router.post("/{job_id}")
async def chat_endpoint(job_id: str, body: ChatRequest):
    try:
        answer = await chat(
            job_id   = job_id,
            question = body.question,
            history  = [t.model_dump() for t in body.history],
        )
        return {"answer": answer}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))