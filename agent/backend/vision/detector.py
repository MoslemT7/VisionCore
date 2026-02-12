import os
from typing import List, Dict, Optional
import numpy as np
from ultralytics import YOLO


class PersonDetector:
    @staticmethod
    def _build_model_path(model_size: str) -> str:
        size = (model_size or "s").lower()
        mapping = {
            "n": "yolov8n.pt",
            "s": "yolov8s.pt",
            "m": "yolov8m.pt",
        }

        filename = mapping.get(size, "yolov8s.pt")
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        return os.path.join(backend_dir, "models", "yolo", filename)

    def __init__(
        self,
        model_size: str = "s",
        model_path: Optional[str] = None,
        conf_threshold: float = 0.25,
        imgsz: int = 640,
        device: str = "cpu",
        enable_tracking: bool = True,
    ):
        self.device = device
        self.enable_tracking = enable_tracking

        if model_path is None:
            model_path = self._build_model_path(model_size)

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found at: {model_path}")

        # Load YOLO model
        self.model = YOLO(model_path)
        self.model.to(device)

        self.conf_threshold = conf_threshold
        self.imgsz = imgsz
        self.class_names = self.model.names

    def detect(self, image: np.ndarray) -> List[Dict]:
        results = self.model.track(
            image,
            conf=self.conf_threshold,
            imgsz=self.imgsz,
            persist=True,
            tracker="bytetrack.yaml",  # ensure tracking
            verbose=False,
        )

        detections = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes

            for i in range(len(boxes)):
                box = boxes[i]

                # Extract class, confidence, bbox
                cls_id = int(box.cls.item())
                conf = float(box.conf.item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # Track ID
                track_id = None
                if box.id is not None:
                    track_id = int(box.id.item())

                detections.append({
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": self.class_names.get(cls_id, str(cls_id)),
                    "track_id": track_id,
                })

        return detections
