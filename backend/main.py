from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routes.analyze  import router as analyze_router
from routes.upload   import router as upload_router
from routes.history  import router as history_router
from routes.export   import router as export_router
from routes.caption  import router as caption_router
from routes.settings  import router as settings_router
from routes.thumbnail import router as thumbnail_router
from routes.settings import router as settings_router
from routes.globalChat import router as globalChat_router
from routes.chat import router as chat_router
from db.mongo        import close_client
from db.analysis_record import ensure_indexes
from db.mongo        import get_db
from utils.config_loader import load_config, get_config_path
from datetime import datetime

def create_app() -> FastAPI:
    app = FastAPI(title="Video AI Analysis API")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    async def health_check():
        return {"status": "online", "timestamp": datetime.utcnow().isoformat()}

    @app.get("/health/ollama", tags=["system"])
    async def ollama_health():
        from services.ollama_health import check_ollama
        return await check_ollama()

    app.include_router(analyze_router)
    app.include_router(upload_router)
    app.include_router(history_router)
    app.include_router(export_router)
    app.include_router(caption_router)
    app.include_router(globalChat_router)
    app.include_router(chat_router)
    app.include_router(settings_router)
    app.include_router(thumbnail_router)
    app.include_router(settings_router)
    
    app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

    @app.on_event("startup")
    async def startup():
        await ensure_indexes(get_db())

    @app.on_event("shutdown")
    async def shutdown():
        await close_client()

    return app

app = create_app()

if __name__ == "__main__":
    config = load_config(get_config_path("system.yaml"))
    api_config = config.get("api", {})
    
    import uvicorn
    uvicorn.run(
        "main:app",
        host=api_config.get("host", "127.0.0.1"),
        port=api_config.get("port", 8000),
        reload=False,
    )