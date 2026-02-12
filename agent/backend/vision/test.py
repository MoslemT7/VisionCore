from vision.detector import PersonDetector
from vision.reid import ReIDModel, compute_embedding
from vision.anomaly import ConvAutoEncoder, anomaly_score
import cv2
import torch
import faiss
import numpy as np

# --- Initialize Models ---
detector = PersonDetector(model_path="vision/yolov8n.pt")
reid_model = ReIDModel()
anomaly_model = ConvAutoEncoder()

# FAISS index for embeddings
embedding_dim = 128
index = faiss.IndexFlatIP(embedding_dim)

# --- Load Video ---
video_path = "../data/inputs/test.mp4"
cap = cv2.VideoCapture(video_path)

frame_id = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_id += 1

    # --- Step 1: Detect objects ---
    detections = detector.detect(frame)

    # --- Step 2: Compute embeddings (Re-ID) ---
    for det in detections:
        emb = compute_embedding(frame, det["bbox"], reid_model)
        index.add(emb.cpu().numpy())  # store embedding in FAISS
        det["embedding"] = emb.cpu().numpy()

    # --- Step 3: Optional anomaly detection ---
    frame_tensor = torch.tensor(frame).permute(2,0,1).unsqueeze(0).float()/255.0
    score = anomaly_score(frame_tensor, anomaly_model)
    if score > 0.02:
        print(f"[Frame {frame_id}] Anomaly detected, score={score:.4f}")

    # --- Step 4: Display results on frame ---
    for det in detections:
        x1, y1, x2, y2 = map(int, det["bbox"])
        label = f"ID:{det.get('track_id', frame_id)}"
        cv2.rectangle(frame, (x1,y1), (x2,y2), (0,255,0), 2)
        cv2.putText(frame, label, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)

    cv2.imshow("Video Test", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
