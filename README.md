# Dronaeon

## Overview

Dronaeon is a final-year engineering project (PFE) focused on the development of an intelligent drone video analysis platform designed for environments with limited computational, memory, and energy resources.

The platform combines lightweight computer vision and artificial intelligence models to automatically detect people, estimate human poses, classify postures, and provide conversational access to analysis results through a natural language assistant.

Analysis outputs are consolidated into a structured JSON format that can be consumed both by the web interface and the integrated AI assistant.

---

## Features

### Person Detection
- Human detection using **YOLO26m**
- Fine-tuned on drone imagery datasets for improved aerial surveillance performance

### Pose Estimation
- Human pose extraction using **YOLO26x-Pose**
- Generates body keypoints for each detected person

### Posture Classification
- Classification based on extracted keypoints
- Supported postures:
  - Standing
  - Walking
  - Lying

### Conversational Assistant
- Natural language interaction powered by **Gemma 3 4B**
- Automatic fallback to **Gemini 2.5 via OpenRouter** when a local LLM is unavailable
- Allows users to query video analysis results using natural language

### Web Dashboard
- Upload and analyze drone videos
- Visualize detections and posture classifications
- Explore generated JSON reports
- Interact with the AI assistant directly from the interface

---

## System Architecture

The platform consists of four main modules:

1. Person Detection (YOLO26m)
2. Pose Estimation (YOLO26x-Pose)
3. Posture Classification
4. Conversational AI Assistant (Gemma 3 / Gemini 2.5)

The resulting analysis is stored in a JSON file that serves as a common data source for both the web interface and the conversational assistant.

---

## Technologies Used

### Frontend
- React

### Backend
- Python
- FastAPI

### Database
- MongoDB

### Authentication
- Firebase Authentication

### Artificial Intelligence
- YOLO26m
- YOLO26x-Pose
- Gemma 3 4B
- Gemini 2.5 (OpenRouter fallback)

---

## Performance

### Person Detection Model

| Metric | Score |
|----------|----------|
| Precision | 0.849 |
| Recall | 0.701 |
| mAP@50 | 0.816 |
| mAP@50-95 | 0.577 |

### Posture Classification Model

| Metric | Score |
|----------|----------|
| Validation Accuracy | 0.74 |
| Test Accuracy | 0.70 |

---

## Installation

### Prerequisites

- Python 3.10+
- Node.js
- MongoDB
- Firebase Project
- Ollama

### Install Gemma 3

```bash
ollama run gemma3:4b
```

The application will automatically use the local Gemma model when available.

If Gemma is unavailable, Dronaeon automatically switches to Gemini 2.5 through OpenRouter.

---

## Running the Project

Use the provided `launch.bat` file:

```bat
@echo off

:: Opens Windows Terminal, sets the title, starts the backend,
:: then adds a new tab for the frontend.
wt -w 0 nt -d "M:\Projects\PFE\backend" --title "Backend" cmd /k "python main.py" ; nt -d "M:\Projects\PFE\frontend" --title "Frontend" cmd /k "npm run dev"
```

Then start Gemma locally:

```bash
ollama run gemma3:4b
```

---

## Project Structure

```text
Dronaeon/
├── backend/
│   ├── AI models
│   ├── FastAPI services
│   └── JSON generation
│
├── frontend/
│   ├── React application
│   ├── Dashboard
│   └── Chat assistant interface
│
├── database/
│   └── MongoDB collections
│
└── launch.bat
```

## Authors

Final Year Project (PFE)

Developed as part of an engineering degree project focused on lightweight AI-powered drone video analysis and conversational exploration of extracted information.
