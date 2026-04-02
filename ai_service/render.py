from __future__ import annotations

import cv2
import numpy as np

from ai_service.types import Detection


_PALETTE = (
    (56, 56, 255),
    (151, 157, 255),
    (31, 112, 255),
    (29, 178, 255),
    (49, 210, 207),
    (10, 249, 72),
    (23, 204, 146),
    (134, 219, 61),
    (52, 147, 26),
    (187, 212, 0),
)


def _color_for_class(class_id: int) -> tuple[int, int, int]:
    return _PALETTE[class_id % len(_PALETTE)]


def render_detections(image: np.ndarray, detections: list[Detection]) -> np.ndarray:
    annotated = image.copy()

    for detection in detections:
        color = _color_for_class(detection.class_id)
        x1, y1, x2, y2 = (
            int(round(detection.x1)),
            int(round(detection.y1)),
            int(round(detection.x2)),
            int(round(detection.y2)),
        )
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        label = detection.raw_label
        if detection.track_id is not None:
            label = f"{label} #{detection.track_id}"
        label = f"{label} {detection.confidence:.2f}"

        (text_width, text_height), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2
        )
        text_bottom = max(y1, text_height + baseline + 4)
        text_top = max(0, text_bottom - text_height - baseline - 6)
        text_right = min(annotated.shape[1], x1 + text_width + 8)

        cv2.rectangle(annotated, (x1, text_top), (text_right, text_bottom), color, -1)
        cv2.putText(
            annotated,
            label,
            (x1 + 4, text_bottom - baseline - 3),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    return annotated
