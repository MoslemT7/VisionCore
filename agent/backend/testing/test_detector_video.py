import sys
import os
import cv2
import json
import csv
from ultralytics import YOLO

# Add backend folder to Python path so vision module works
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vision.detector import PersonDetector  # your detector

# ------------------- Paths -------------------
video_path = "../../data/testing/test1.mp4"
model_path = "../vision/yolov8n.pt"

output_video_path = "output_detection.mp4"
output_json_path = "detection_output.json"
output_csv_path = "detection_summary.csv"

# ------------------- Check video -------------------
if not os.path.exists(video_path):
    print(f"Video not found: {os.path.abspath(video_path)}")
    exit()

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(f"Cannot open video: {os.path.abspath(video_path)}")
    exit()
else:
    print("Video opened successfully!")

# ------------------- Initialize detector -------------------
detector = PersonDetector(model_path=model_path, conf_threshold=0.25)

# Get class names directly from the YOLO model
class_names = detector.model.names  # {0: 'person', 1: 'bicycle', 2: 'car', ...}

# ------------------- Prepare output video -------------------
ret, frame = cap.read()
if not ret:
    print("Cannot read first frame!")
    exit()

out = cv2.VideoWriter(
    output_video_path,
    cv2.VideoWriter_fourcc(*'mp4v'),
    20,
    (frame.shape[1], frame.shape[0])
)
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # rewind video

# ------------------- Detection loop -------------------
video_data = []
frame_id = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_id += 1

    # Detect objects
    detections = detector.detect(frame)

    frame_info = {
        "frame": frame_id,
        "detections": []
    }

    for det in detections:
        cls_id = det.get("class_id", None)
        cls_name = class_names.get(cls_id, str(cls_id))  # <-- fixed here
        conf = det.get("confidence", 0)
        bbox = det.get("bbox", [0,0,0,0])

        # Draw bounding box and label
        x1, y1, x2, y2 = map(int, bbox)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
        cv2.putText(frame, f"{cls_name}:{conf:.2f}", (x1, y1-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)

        # Collect JSON data
        frame_info["detections"].append({
            "class_name": cls_name,
            "class_id": cls_id,
            "confidence": conf,
            "bbox": bbox
        })

    video_data.append(frame_info)
    out.write(frame)

cap.release()
out.release()
print(f"Annotated video saved: {output_video_path}")

# ------------------- Save JSON -------------------
with open(output_json_path, "w") as f:
    json.dump(video_data, f, indent=4)
print(f"Detection JSON saved: {output_json_path}")

# ------------------- Save CSV summary -------------------
with open(output_csv_path, "w", newline="") as csvfile:
    fieldnames = ["frame", "class_name", "class_id", "confidence", "x1", "y1", "x2", "y2"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()

    for frame in video_data:
        for det in frame["detections"]:
            x1, y1, x2, y2 = det["bbox"]
            writer.writerow({
                "frame": frame["frame"],
                "class_name": det["class_name"],
                "class_id": det["class_id"],
                "confidence": det["confidence"],
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            })

print(f"Detection summary CSV saved: {output_csv_path}")
