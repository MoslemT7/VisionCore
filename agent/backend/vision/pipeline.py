from detector import PersonDetector
from tracker import TrackerWrapper
from reid import ReIDModel, compute_embedding
from anomaly import ConvAutoEncoder, anomaly_score
import cv2
import faiss
import torch
import numpy as np

# Initialize modules
detector = PersonDetector()
tracker = TrackerWrapper()
reid_model = ReIDModel()
anomaly_model = ConvAutoEncoder()

# FAISS for embeddings
embedding_dim = 128
index = faiss.IndexFlatIP(embedding_dim)

# Load video
video_path = "sample_video.mp4"
cap = cv2.VideoCapture(video_path)

frame_id = 0
while True:
    ret, frame = cap.read()
    if not ret: break
    frame_id += 1

    # Step 1: Detect objects
    detections = detector.detect(frame)

    # Step 2: Track objects
    # For simplicity, assume track_id = detection index
    for i, det in enumerate(detections):
        det["track_id"] = i

    # Step 3: Compute embeddings for each object
    for det in detections:
        emb = compute_embedding(frame, det["bbox"], reid_model)
        emb_np = emb.cpu().numpy()
        index.add(emb_np)

    # Step 4: Anomaly detection (optional)
    frame_tensor = torch.tensor(frame).permute(2,0,1).unsqueeze(0).float()/255.0
    score = anomaly_score(frame_tensor, anomaly_model)
    if score > 0.02:
        print(f"Anomaly detected in frame {frame_id} with score {score:.4f}")

cap.release()
