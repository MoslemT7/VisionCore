import httpx
import os

OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("VLM_MODEL", "gemma3:4b-it-q4_K_M")

async def check_ollama() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            res.raise_for_status()
            models = [m["name"] for m in res.json().get("models", [])]
            loaded = any(OLLAMA_MODEL in m for m in models)
            return {
                "online": True,
                "model_available": loaded,
                "model": OLLAMA_MODEL,
            }
    except Exception as exc:
        return {"online": False, "model_available": False, "model": OLLAMA_MODEL, "error": str(exc)}