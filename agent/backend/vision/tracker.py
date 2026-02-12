from ultralytics import YOLO
from typing import List, Dict

class TrackerWrapper:
    def __init__(self, model_path="yolov8n.pt", conf_threshold=0.25, device="cpu"):
        self.model = YOLO(model_path)
        self.model.to(device)
        self.conf_threshold = conf_threshold

    def track_video(self, video_path: str) -> List[Dict]:
        results = self.model.track(
            source=video_path,
            conf=self.conf_threshold,
            persist=True,
            show=False,
            stream=False
        )
        tracks = []
        for result in results:
            frame_id = int(result.frame)
            for box in result.boxes:
                tracks.append({
                    "frame_id": frame_id,
                    "track_id": int(box.id) if hasattr(box, "id") else -1,
                    "class": int(box.cls),
                    "bbox": box.xyxy[0].tolist()
                })
        return tracks
