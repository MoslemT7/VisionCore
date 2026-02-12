from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.analyze import router as analyze_router
from utils.config_loader import load_config, get_config_path
from routes.metrics import router as metrics_router

def create_app() -> FastAPI:
    app = FastAPI(title="Video AI Analysis API")

    # Allow local frontend dev by default
    app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",   # <-- add this
        "http://localhost:3000",    # <-- add this
    ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analyze_router)
    app.include_router(metrics_router)  # <-- metrics endpoint

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
