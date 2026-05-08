# Vision-Language System

Local, frugal, optimized Vision-Language system for PFE project.

## Setup

```bash
pip install -r requirements.txt
```

## Configuration

Edit `config/system.yaml` and `config/thresholds.yaml` for system settings.

## Run

```bash
cd agent/backend
python main.py
```

Access frontend at `agent/frontend/src/index.html` or via API at `http://127.0.0.1:8000`

## API Endpoints

- `GET /health` - Health check
- `POST /analyze/image` - Analyze image (multipart/form-data)
- `POST /analyze/query` - Natural language query (JSON)
- `POST /analyze/video` - Analyze video (multipart/form-data)
- `GET /metrics` - System metrics

## LLM Setup

For LLM functionality, ensure Ollama is running:
```bash
ollama serve
ollama pull llama3.2:1b
```

System falls back to rule-based parsing if LLM unavailable.

