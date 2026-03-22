from __future__ import annotations

import json
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
from fastapi import FastAPI
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from ultralytics import YOLO


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "models" / "boudding_catllte_v1_22es.pt"
DEFAULT_BEHAVIOR_MAP_PATH = Path(__file__).resolve().with_name("behavior_map.json")
ALLOWED_BEHAVIORS = {"standing", "lying", "eating", "drinking", "walking", "abnormal"}

load_dotenv(ROOT_DIR / ".env")


class PredictRequest(BaseModel):
    image_path: str = Field(..., min_length=1)
    output_dir: str = Field(..., min_length=1)
    request_id: str = Field(..., min_length=1)


class HealthResponse(BaseModel):
    status: str
    model_name: str
    model_path: str
    device: str


app = FastAPI(title="Cow Visioning AI Service", version="1.0.0")


def get_model_path() -> Path:
    configured = os.getenv("AI_MODEL_PATH", str(DEFAULT_MODEL_PATH))
    return Path(configured).expanduser().resolve()


def get_behavior_map_path() -> Path:
    configured = os.getenv("AI_BEHAVIOR_MAP_PATH", str(DEFAULT_BEHAVIOR_MAP_PATH))
    return Path(configured).expanduser().resolve()


def get_model_name() -> str:
    return os.getenv("AI_MODEL_NAME", get_model_path().name)


def get_device() -> str:
    return os.getenv("AI_DEVICE", "cpu")


def get_confidence_threshold() -> float:
    return float(os.getenv("AI_CONF_THRESHOLD", "0.25"))


def get_iou_threshold() -> float:
    return float(os.getenv("AI_IOU_THRESHOLD", "0.45"))


def get_max_det() -> int:
    return int(os.getenv("AI_MAX_DET", "50"))


@lru_cache(maxsize=1)
def load_behavior_map() -> dict[str, str]:
    map_path = get_behavior_map_path()
    if not map_path.exists():
        raise FileNotFoundError(f"Behavior map file not found: {map_path}")

    raw = json.loads(map_path.read_text(encoding="utf-8"))
    mapped: dict[str, str] = {}
    for key, value in raw.items():
        normalized_value = str(value).strip().lower()
        if normalized_value not in ALLOWED_BEHAVIORS:
            raise ValueError(f"Unsupported mapped behavior: {value}")
        mapped[str(key).strip().lower()] = normalized_value
    return mapped


@lru_cache(maxsize=1)
def load_model() -> YOLO:
    model_path = get_model_path()
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path}. Set AI_MODEL_PATH to the correct .pt file."
        )
    return YOLO(str(model_path))


def normalize_label(label: Any) -> str:
    return str(label).strip().lower().replace(" ", "_")


def map_behavior(raw_label: str, behavior_map: dict[str, str]) -> str | None:
    normalized = normalize_label(raw_label)
    if normalized in behavior_map:
        return behavior_map[normalized]
    if normalized in ALLOWED_BEHAVIORS:
        return normalized
    return None


def build_output_path(output_dir: Path, request_id: str, image_path: Path) -> Path:
    suffix = image_path.suffix or ".jpg"
    safe_request_id = "".join(ch for ch in request_id if ch.isalnum() or ch in ("-", "_")) or "predict"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / f"{safe_request_id}{suffix}"


def serialize_box(box: Any) -> dict[str, Any]:
    x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
    confidence = float(box.conf[0])
    class_id = int(box.cls[0])
    track_id = int(box.id[0]) if box.id is not None else None
    return {
        "x1": round(x1, 2),
        "y1": round(y1, 2),
        "x2": round(x2, 2),
        "y2": round(y2, 2),
        "width": round(max(0.0, x2 - x1), 2),
        "height": round(max(0.0, y2 - y1), 2),
        "confidence": round(confidence, 6),
        "class_id": class_id,
        "track_id": track_id,
    }


def predict_image(payload: PredictRequest) -> dict[str, Any]:
    image_path = Path(payload.image_path).expanduser().resolve()
    if not image_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    output_dir = Path(payload.output_dir).expanduser().resolve()
    model = load_model()
    behavior_map = load_behavior_map()

    start = time.perf_counter()
    results = model.predict(
        source=str(image_path),
        conf=get_confidence_threshold(),
        iou=get_iou_threshold(),
        max_det=get_max_det(),
        device=get_device(),
        verbose=False,
    )
    inference_ms = round((time.perf_counter() - start) * 1000, 2)

    if not results:
        raise RuntimeError("Model did not return any results.")

    result = results[0]
    boxes = list(result.boxes) if result.boxes is not None else []
    if not boxes:
        raise RuntimeError("No detections found in the image.")

    class_names = result.names or getattr(model, "names", {}) or {}
    detections: list[dict[str, Any]] = []
    mapped_detections: list[dict[str, Any]] = []

    for box in boxes:
        box_data = serialize_box(box)
        raw_label = class_names.get(box_data["class_id"], str(box_data["class_id"]))
        mapped_behavior = map_behavior(raw_label, behavior_map)
        detection = {
            **box_data,
            "raw_label": str(raw_label),
            "mapped_behavior": mapped_behavior,
        }
        detections.append(detection)
        if mapped_behavior:
            mapped_detections.append(detection)

    if not mapped_detections:
        raise RuntimeError(
            "Detections were found, but none of the labels could be mapped to a supported behavior."
        )

    primary = max(mapped_detections, key=lambda item: item["confidence"])
    annotated_path = build_output_path(output_dir, payload.request_id, image_path)
    plotted = result.plot()
    if not cv2.imwrite(str(annotated_path), plotted):
        raise RuntimeError(f"Failed to write annotated image: {annotated_path}")

    return {
        "status": "ok",
        "predicted_behavior": primary["mapped_behavior"],
        "confidence": primary["confidence"],
        "annotated_image_path": str(annotated_path),
        "primary_bbox": {
            "x1": primary["x1"],
            "y1": primary["y1"],
            "x2": primary["x2"],
            "y2": primary["y2"],
            "width": primary["width"],
            "height": primary["height"],
        },
        "detection_count": len(detections),
        "detections": detections,
        "model_name": get_model_name(),
        "inference_ms": inference_ms,
        "error": None,
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_name=get_model_name(),
        model_path=str(get_model_path()),
        device=get_device(),
    )


@app.post("/predict")
def predict(payload: PredictRequest) -> dict[str, Any]:
    try:
        return predict_image(payload)
    except Exception as exc:  # pragma: no cover - surfaced to caller as API data
        return {
            "status": "error",
            "predicted_behavior": None,
            "confidence": None,
            "annotated_image_path": None,
            "primary_bbox": None,
            "detection_count": 0,
            "detections": [],
            "model_name": get_model_name(),
            "inference_ms": None,
            "error": str(exc),
        }
