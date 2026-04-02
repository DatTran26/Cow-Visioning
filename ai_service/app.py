from __future__ import annotations

import base64
import binascii
import tempfile
from pathlib import Path
from typing import Any

import cv2
from fastapi import FastAPI
from pydantic import BaseModel, Field

from ai_service.config import (
    get_confidence_threshold,
    get_device,
    get_iou_threshold,
    get_max_det,
    get_model_format,
    get_model_name,
    get_model_path,
)
from ai_service.predictor import load_behavior_map, load_predictor, map_behavior
from ai_service.types import RuntimeOptions


class PredictRequest(BaseModel):
    image_path: str | None = Field(default=None, min_length=1)
    output_dir: str | None = Field(default=None, min_length=1)
    request_id: str = Field(..., min_length=1)
    image_base64: str | None = None
    return_annotated_image_base64: bool = False
    device: str | None = None
    conf_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    iou_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    max_det: int | None = Field(default=None, ge=1, le=1000)


class HealthResponse(BaseModel):
    status: str
    model_name: str
    model_path: str
    model_format: str
    device: str


app = FastAPI(title="Cow Visioning AI Service", version="1.0.0")


def resolve_device(payload: PredictRequest) -> str:
    return payload.device.strip() if isinstance(payload.device, str) and payload.device.strip() else get_device()


def resolve_confidence_threshold(payload: PredictRequest) -> float:
    return float(payload.conf_threshold) if payload.conf_threshold is not None else get_confidence_threshold()


def resolve_iou_threshold(payload: PredictRequest) -> float:
    return float(payload.iou_threshold) if payload.iou_threshold is not None else get_iou_threshold()


def resolve_max_det(payload: PredictRequest) -> int:
    return int(payload.max_det) if payload.max_det is not None else get_max_det()


def build_runtime_options(payload: PredictRequest) -> RuntimeOptions:
    return RuntimeOptions(
        device=resolve_device(payload),
        conf_threshold=resolve_confidence_threshold(payload),
        iou_threshold=resolve_iou_threshold(payload),
        max_det=resolve_max_det(payload),
    )


def build_output_path(output_dir: Path, request_id: str, image_path: Path) -> Path:
    suffix = image_path.suffix or ".jpg"
    safe_request_id = "".join(ch for ch in request_id if ch.isalnum() or ch in ("-", "_")) or "predict"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / f"{safe_request_id}{suffix}"


def resolve_source_image(payload: PredictRequest) -> tuple[Path, Path | None]:
    if payload.image_path:
        image_path = Path(payload.image_path).expanduser().resolve()
        if image_path.exists():
            return image_path, None

    if payload.image_base64:
        suffix = Path(payload.image_path).suffix if payload.image_path else ".jpg"
        try:
            raw_bytes = base64.b64decode(payload.image_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("image_base64 is not valid base64 data") from exc

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix or ".jpg") as tmp_file:
            tmp_file.write(raw_bytes)
            temp_path = Path(tmp_file.name).resolve()

        return temp_path, temp_path

    if payload.image_path:
        raise FileNotFoundError(f"Image file not found: {payload.image_path}")

    raise ValueError("Either image_path or image_base64 is required.")


def load_image(image_path: Path) -> Any:
    image = cv2.imread(str(image_path))
    if image is None:
        raise RuntimeError(f"Failed to read image: {image_path}")
    return image


def predict_image(payload: PredictRequest) -> dict[str, Any]:
    image_path, temp_image_path = resolve_source_image(payload)

    try:
        predictor = load_predictor()
        behavior_map = load_behavior_map()
        prediction = predictor.predict(load_image(image_path), build_runtime_options(payload))

        detections: list[dict[str, Any]] = []
        mapped_detections: list[dict[str, Any]] = []

        for detection in prediction.detections:
            mapped_behavior = map_behavior(detection.raw_label, behavior_map)
            payload_detection = detection.to_api_dict(mapped_behavior)
            detections.append(payload_detection)
            if mapped_behavior:
                mapped_detections.append(payload_detection)

        if not mapped_detections:
            raise RuntimeError(
                "Detections were found, but none of the labels could be mapped to a supported behavior."
            )

        primary = max(mapped_detections, key=lambda item: item["confidence"])
        annotated_image = prediction.annotated_image

        annotated_image_path: str | None = None
        annotated_image_base64: str | None = None
        annotated_image_ext: str | None = None

        if payload.return_annotated_image_base64:
            ok, encoded = cv2.imencode(".jpg", annotated_image)
            if not ok:
                raise RuntimeError("Failed to encode annotated image")
            annotated_image_base64 = base64.b64encode(encoded.tobytes()).decode("ascii")
            annotated_image_ext = ".jpg"
        else:
            if not payload.output_dir:
                raise ValueError("output_dir is required when returning a file path")
            output_dir = Path(payload.output_dir).expanduser().resolve()
            annotated_path = build_output_path(output_dir, payload.request_id, image_path)
            if not cv2.imwrite(str(annotated_path), annotated_image):
                raise RuntimeError(f"Failed to write annotated image: {annotated_path}")
            annotated_image_path = str(annotated_path)
            annotated_image_ext = annotated_path.suffix or ".jpg"

        return {
            "status": "ok",
            "predicted_behavior": primary["mapped_behavior"],
            "confidence": primary["confidence"],
            "annotated_image_path": annotated_image_path,
            "annotated_image_base64": annotated_image_base64,
            "annotated_image_ext": annotated_image_ext,
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
            "model_format": get_model_format(),
            "inference_ms": prediction.inference_ms,
            "error": None,
        }
    finally:
        if temp_image_path and temp_image_path.exists():
            temp_image_path.unlink(missing_ok=True)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_name=get_model_name(),
        model_path=str(get_model_path()),
        model_format=get_model_format(),
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
            "annotated_image_base64": None,
            "annotated_image_ext": None,
            "primary_bbox": None,
            "detection_count": 0,
            "detections": [],
            "model_name": get_model_name(),
            "model_format": get_model_format(),
            "inference_ms": None,
            "error": str(exc),
        }
