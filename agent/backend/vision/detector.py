# detector.py
import os
from typing import List, Dict, Optional

import cv2
import numpy as np
from ultralytics import YOLO


class PersonDetector:
    @staticmethod
    def _build_model_path(model_size: str) -> str:
        """
        Map a simple size specifier (n/s/m) to a local YOLOv8 weights file.
        Uses the 'backend/models/yolo/' folder to avoid auto-downloads.
        """
        size = (model_size or "s").lower()
        mapping = {
            "n": "yolov8n.pt",
            "s": "yolov8s.pt",
            "m": "yolov8m.pt",
        }
        filename = mapping.get(size, "yolov8s.pt")
        return os.path.join("backend", "models", "yolo", filename)

    def __init__(
        self,
        model_size: str = "s",
        model_path: Optional[str] = None,
        conf_threshold: float = 0.25,
        imgsz: int = 640,
        device: str = "cpu",
    ):
        self.device = device
        if model_path is None:
            model_path = self._build_model_path(model_size)

        # Initialize YOLO model
        self.model = YOLO(model_path)
        self.model.to(device)

        self.conf_threshold = conf_threshold
        self.imgsz = imgsz
        self.class_names = self.model.names  # all class names

    def detect(self, image: np.ndarray) -> List[Dict]:
        """
        Run object detection on a single image and return a list of detections.
        """
        results = self.model(
            image,
            conf=self.conf_threshold,
            imgsz=self.imgsz,
            verbose=False,
        )

        detections = []

        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())

                detections.append({
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": self.class_names.get(cls_id, str(cls_id))
                })

        return detections
