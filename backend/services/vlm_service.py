import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
VLM_MODEL          = os.getenv("VLM_MODEL", "google/gemini-flash-2.5")

MAX_TOKENS   = int(os.getenv("VLM_MAX_TOKENS", "2048"))
TEMPERATURE  = float(os.getenv("VLM_TEMPERATURE", "0.4"))
MAX_RETRIES  = int(os.getenv("VLM_MAX_RETRIES", "3"))
RETRY_DELAY  = float(os.getenv("VLM_RETRY_DELAY", "1.5"))

TIMEOUT = httpx.Timeout(120.0, connect=10.0)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def call_vlm(prompt: str, images: list[str] | None = None) -> str:
    images = images or []

    content = [{"type": "text", "text": prompt}]
    for b64 in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
        })

    body = {
        "model": VLM_MODEL,
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "messages": [{"role": "user", "content": content if images else prompt}],
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://visioncore.local",
        "X-Title": "VisionCore",
    }

    last_error = None
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                res = await client.post(OPENROUTER_URL, json=body, headers=headers)
                print(f"[VLM] status={res.status_code} body={res.text[:500]}")
                res.raise_for_status()
                text = res.json()["choices"][0]["message"]["content"]
                if not text:
                    raise RuntimeError("OpenRouter returned empty content.")
                return text.strip()
            except Exception as exc:
                last_error = exc
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY * attempt)

    raise RuntimeError(f"VLM call failed after {MAX_RETRIES} attempts: {last_error}")