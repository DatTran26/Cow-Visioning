from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np
from ultralytics import YOLO

from ai_service.render import render_detections
from ai_service.types import Detection, PredictionResult, RuntimeOptions


def _resolve_raw_label(class_names: Any, class_id: int) -> str:
    if isinstance(class_names, dict):
        return str(class_names.get(class_id, class_id))
    if isinstance(class_names, list) and 0 <= class_id < len(class_names):
        return str(class_names[class_id])
    return str(class_id)


class PtBackend:
    def __init__(self, model_path: Path):
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {model_path}. Set AI_MODEL_PATH to the correct .pt file."
            )

        self._model = YOLO(str(model_path))

    def predict(self, image: np.ndarray, options: RuntimeOptions) -> PredictionResult:
        start = time.perf_counter()
        results = self._model.predict(
            source=image,
            conf=options.conf_threshold,
            iou=options.iou_threshold,
            max_det=options.max_det,
            device=options.device,
            verbose=False,
        )
        inference_ms = round((time.perf_counter() - start) * 1000, 2)

        if not results:
            raise RuntimeError("Model did not return any results.")

        result = results[0]
        boxes = list(result.boxes) if result.boxes is not None else []
        if not boxes:
            raise RuntimeError("No detections found in the image.")

        class_names = result.names or getattr(self._model, "names", {}) or {}
        detections: list[Detection] = []

        for box in boxes:
            x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            track_id = int(box.id[0]) if box.id is not None else None
            detections.append(
                Detection(
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    confidence=confidence,
                    class_id=class_id,
                    raw_label=_resolve_raw_label(class_names, class_id),
                    track_id=track_id,
                )
            )

        return PredictionResult(
            detections=detections,
            annotated_image=render_detections(image, detections),
            inference_ms=inference_ms,
        )
