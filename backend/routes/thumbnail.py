import os
import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
THUMB_SIZE = (320, 180)

router = APIRouter(prefix="/thumbnail", tags=["thumbnail"])


def _col():
    return MongoClient(MONGO_URI)["VisionCore"]["AnalysisHistory"]


def _extract_frame(video_path: str, width: int, height: int) -> bytes:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        mid   = max(0, total // 4)
        cap.set(cv2.CAP_PROP_POS_FRAMES, mid)
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
        if not ret:
            raise RuntimeError("Could not read any frame from video.")
        frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
        if not ok:
            raise RuntimeError("Failed to encode frame as JPEG.")
        return buf.tobytes()
    finally:
        cap.release()


@router.get("/{job_id}")
def get_thumbnail(job_id: str, w: int = 320, h: int = 180):
    w = max(64, min(w, 640))
    h = max(36, min(h, 360))

    doc = _col().find_one({"job_id": job_id}, {"video_file": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found.")

    video_path = doc.get("video_file")
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk.")

    try:
        jpeg = _extract_frame(video_path, w, h)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )