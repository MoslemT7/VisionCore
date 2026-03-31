import os
import asyncio
import httpx
import json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_KEY   = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("VLM_MODEL", "google/gemini-1.5-pro")
OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions"

APP_URL          = os.getenv("APP_URL",  "http://localhost:8000")
APP_NAME         = os.getenv("APP_NAME", "VisionCore")

MAX_TOKENS       = int(os.getenv("VLM_MAX_TOKENS",   "2048"))
TEMPERATURE      = float(os.getenv("VLM_TEMPERATURE", "0.4"))
MAX_RETRIES      = int(os.getenv("VLM_MAX_RETRIES",   "3"))
RETRY_DELAY      = float(os.getenv("VLM_RETRY_DELAY", "1.5"))

TIMEOUT          = httpx.Timeout(60.0, connect=10.0)

def _prepare_payload(prompt: str, images: list[str]) -> tuple[dict, dict]:
    if not images:
        content = prompt
    else:
        content = [{"type": "text", "text": prompt}]
        for b64 in images:
            content.append({
                "type": "image_url", 
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            })

    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "HTTP-Referer":  APP_URL,
        "X-Title":       APP_NAME,
        "Content-Type":  "application/json",
    }
    
    body = {
        "model":       OPENROUTER_MODEL,
        "messages":    [{"role": "user", "content": content}],
        "max_tokens":  MAX_TOKENS,
        "temperature": TEMPERATURE,
    }
    return headers, body

async def call_vlm(prompt: str, images: list[str] | None = None) -> str:
    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is missing from .env")

    images = images or []
    headers, body = _prepare_payload(prompt, images)
    last_error = None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                res = await client.post(OPENROUTER_URL, headers=headers, json=body)
                
                if res.status_code != 200:
                    print(f"[DEBUG] OpenRouter Error {res.status_code}: {res.text}")
                
                res.raise_for_status()
                
                data = res.json()
                choices = data.get("choices", [])
                if not choices:
                    raise RuntimeError("OpenRouter returned no choices.")
                
                text = choices[0].get("message", {}).get("content")
                if not text:
                    raise RuntimeError("OpenRouter returned an empty message content.")
                
                return text.strip()

            except Exception as exc:
                last_error = exc
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY * attempt)

    raise RuntimeError(f"VLM call failed after {MAX_RETRIES} attempts: {last_error}")