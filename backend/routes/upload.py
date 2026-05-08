# backend/routes/upload.py

import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
UPLOAD_DIR = os.path.normpath(UPLOAD_DIR)

os.makedirs(UPLOAD_DIR, exist_ok=True)
print(f"[DEBUG] Saving uploads to: {UPLOAD_DIR}")

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

@router.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[-1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid video format.")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    print(f"[DEBUG] Saved: {file_path}")
    return {
        "original_name": file.filename,
        "saved_as":      unique_name,
        "path":          file_path,
    }
