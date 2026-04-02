from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RuntimeOptions:
    device: str
    conf_threshold: float
    iou_threshold: float
    max_det: int


@dataclass(frozen=True)
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    raw_label: str
    track_id: int | None = None

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    def to_api_dict(self, mapped_behavior: str | None) -> dict[str, Any]:
        return {
            "x1": round(self.x1, 2),
            "y1": round(self.y1, 2),
            "x2": round(self.x2, 2),
            "y2": round(self.y2, 2),
            "width": round(self.width, 2),
            "height": round(self.height, 2),
            "confidence": round(self.confidence, 6),
            "class_id": self.class_id,
            "track_id": self.track_id,
            "raw_label": self.raw_label,
            "mapped_behavior": mapped_behavior,
        }


@dataclass(frozen=True)
class PredictionResult:
    detections: list[Detection]
    annotated_image: Any
    inference_ms: float
