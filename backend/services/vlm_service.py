import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("VLM_MODEL", "gemma3:4b-it-q4_K_M")

MAX_TOKENS   = int(os.getenv("VLM_MAX_TOKENS", "2048"))
TEMPERATURE  = float(os.getenv("VLM_TEMPERATURE", "0.4"))
MAX_RETRIES  = int(os.getenv("VLM_MAX_RETRIES", "3"))
RETRY_DELAY  = float(os.getenv("VLM_RETRY_DELAY", "1.5"))

TIMEOUT      = httpx.Timeout(120.0, connect=10.0)


async def call_vlm(prompt: str, images: list[str] | None = None) -> str:
    images = images or []

    content = [{"type": "text", "text": prompt}]
    for b64 in images:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})

    body = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": content if images else prompt}],
        "stream": False,
        "options": {
            "num_predict": MAX_TOKENS,
            "temperature": TEMPERATURE,
        },
    }

    last_error = None
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                res = await client.post(f"{OLLAMA_URL}/api/chat", json=body)
                res.raise_for_status()
                text = res.json()["message"]["content"]
                if not text:
                    raise RuntimeError("Ollama returned empty content.")
                return text.strip()
            except Exception as exc:
                last_error = exc
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY * attempt)

    raise RuntimeError(f"VLM call failed after {MAX_RETRIES} attempts: {last_error}")