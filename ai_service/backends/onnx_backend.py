from __future__ import annotations

import ast
import json
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort

from ai_service.render import render_detections
from ai_service.types import Detection, PredictionResult, RuntimeOptions


def _is_int_like(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_names_payload(raw_value: Any) -> dict[int, str]:
    if isinstance(raw_value, str):
        try:
            raw_value = json.loads(raw_value)
        except json.JSONDecodeError:
            raw_value = ast.literal_eval(raw_value)

    if isinstance(raw_value, dict):
        parsed: dict[int, str] = {}
        for key, value in raw_value.items():
            if isinstance(key, str) and key.isdigit():
                parsed[int(key)] = str(value)
            elif _is_int_like(key):
                parsed[int(key)] = str(value)
        return parsed

    if isinstance(raw_value, (list, tuple)):
        return {index: str(value) for index, value in enumerate(raw_value)}

    raise ValueError("Class names must be a JSON object, array, or parseable metadata string.")


def _xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    converted = boxes.copy()
    converted[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
    converted[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
    converted[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
    converted[:, 3] = boxes[:, 1] + boxes[:, 3] / 2
    return converted


def _compute_iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])

    intersections = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
    box_area = max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1])
    boxes_area = np.maximum(0.0, boxes[:, 2] - boxes[:, 0]) * np.maximum(0.0, boxes[:, 3] - boxes[:, 1])
    union = box_area + boxes_area - intersections
    return intersections / np.clip(union, a_min=1e-6, a_max=None)


def _class_aware_nms(
    boxes: np.ndarray,
    scores: np.ndarray,
    class_ids: np.ndarray,
    iou_threshold: float,
    max_det: int,
) -> list[int]:
    selected: list[int] = []

    for class_id in np.unique(class_ids):
        indices = np.where(class_ids == class_id)[0]
        ordered = indices[np.argsort(scores[indices])[::-1]]

        while ordered.size > 0:
            current = int(ordered[0])
            selected.append(current)
            if len(selected) >= max_det or ordered.size == 1:
                break

            remaining = ordered[1:]
            ious = _compute_iou(boxes[current], boxes[remaining])
            ordered = remaining[ious <= iou_threshold]

        if len(selected) >= max_det:
            break

    selected.sort(key=lambda index: float(scores[index]), reverse=True)
    return selected[:max_det]


class OnnxRuntimeBackend:
    def __init__(self, model_path: Path, class_names_path: Path | None = None):
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {model_path}. Set AI_MODEL_PATH to the correct .onnx file."
            )

        self._model_path = model_path
        self._available_providers = ort.get_available_providers()
        self._sessions: dict[str, ort.InferenceSession] = {}
        bootstrap_session = self._get_session("cpu")
        self._input_name = bootstrap_session.get_inputs()[0].name
        self._input_size = self._resolve_input_size(bootstrap_session)
        self._class_names = self._load_class_names(bootstrap_session, class_names_path)

    def predict(self, image: np.ndarray, options: RuntimeOptions) -> PredictionResult:
        session = self._get_session(options.device)
        input_tensor, ratio, padding = self._preprocess(image)

        start = time.perf_counter()
        outputs = session.run(None, {self._input_name: input_tensor})
        inference_ms = round((time.perf_counter() - start) * 1000, 2)

        detections = self._postprocess(
            outputs=outputs,
            original_shape=image.shape[:2],
            ratio=ratio,
            padding=padding,
            options=options,
        )
        if not detections:
            raise RuntimeError("No detections found in the image.")

        return PredictionResult(
            detections=detections,
            annotated_image=render_detections(image, detections),
            inference_ms=inference_ms,
        )

    def _get_session(self, requested_device: str) -> ort.InferenceSession:
        providers = self._resolve_providers(requested_device)
        cache_key = "|".join(providers)
        if cache_key not in self._sessions:
            self._sessions[cache_key] = ort.InferenceSession(
                str(self._model_path),
                providers=providers,
            )
        return self._sessions[cache_key]

    def _resolve_providers(self, requested_device: str) -> list[str]:
        normalized = requested_device.strip().lower()
        if normalized in {"", "cpu"}:
            return ["CPUExecutionProvider"]

        if normalized in {"cuda", "cuda:0", "gpu", "gpu:0"} or normalized.isdigit():
            if "CUDAExecutionProvider" not in self._available_providers:
                raise RuntimeError(
                    "CUDAExecutionProvider is not available for onnxruntime. "
                    "Install the GPU runtime or set AI_DEVICE=cpu."
                )
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]

        raise ValueError(
            f"Unsupported ONNX device {requested_device!r}. Use cpu, cuda, cuda:0, or a GPU index."
        )

    def _resolve_input_size(self, session: ort.InferenceSession) -> tuple[int, int]:
        input_shape = session.get_inputs()[0].shape
        height = input_shape[-2] if len(input_shape) >= 2 else None
        width = input_shape[-1] if len(input_shape) >= 1 else None

        if isinstance(height, int) and height > 0 and isinstance(width, int) and width > 0:
            return int(height), int(width)

        metadata = session.get_modelmeta().custom_metadata_map or {}
        for key in ("imgsz", "img_size", "image_size"):
            raw_value = metadata.get(key)
            if not raw_value:
                continue
            try:
                parsed = json.loads(raw_value)
            except json.JSONDecodeError:
                parsed = ast.literal_eval(raw_value)

            if isinstance(parsed, (list, tuple)) and len(parsed) >= 2:
                return int(parsed[0]), int(parsed[1])
            if _is_int_like(parsed):
                return int(parsed), int(parsed)

        return 640, 640

    def _load_class_names(
        self,
        session: ort.InferenceSession,
        class_names_path: Path | None,
    ) -> dict[int, str]:
        if class_names_path:
            if not class_names_path.exists():
                raise FileNotFoundError(f"Class names file not found: {class_names_path}")
            payload = json.loads(class_names_path.read_text(encoding="utf-8"))
            return _parse_names_payload(payload)

        metadata = session.get_modelmeta().custom_metadata_map or {}
        for key in ("names", "model.names", "classes"):
            raw_value = metadata.get(key)
            if not raw_value:
                continue
            return _parse_names_payload(raw_value)

        return {}

    def _preprocess(self, image: np.ndarray) -> tuple[np.ndarray, float, tuple[float, float]]:
        target_height, target_width = self._input_size
        image_height, image_width = image.shape[:2]
        ratio = min(target_width / image_width, target_height / image_height)

        resized_width = int(round(image_width * ratio))
        resized_height = int(round(image_height * ratio))
        resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)

        pad_width = target_width - resized_width
        pad_height = target_height - resized_height
        pad_left = pad_width / 2
        pad_top = pad_height / 2

        top = int(round(pad_top - 0.1))
        bottom = int(round(pad_top + 0.1))
        left = int(round(pad_left - 0.1))
        right = int(round(pad_left + 0.1))

        padded = cv2.copyMakeBorder(
            resized,
            top,
            bottom,
            left,
            right,
            cv2.BORDER_CONSTANT,
            value=(114, 114, 114),
        )
        rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
        tensor = rgb.transpose(2, 0, 1).astype(np.float32) / 255.0
        tensor = np.expand_dims(tensor, axis=0)
        return tensor, ratio, (pad_left, pad_top)

    def _postprocess(
        self,
        outputs: list[np.ndarray],
        original_shape: tuple[int, int],
        ratio: float,
        padding: tuple[float, float],
        options: RuntimeOptions,
    ) -> list[Detection]:
        prediction = self._extract_prediction_tensor(outputs)
        prediction = self._ensure_rows_are_detections(prediction)

        if prediction.shape[1] in {6, 7}:
            boxes, scores, class_ids = self._decode_nms_output(prediction)
        else:
            boxes, scores, class_ids = self._decode_raw_output(prediction, options.conf_threshold)

        if boxes.size == 0:
            return []

        confidence_mask = scores >= options.conf_threshold
        if not np.any(confidence_mask):
            return []
        boxes = boxes[confidence_mask]
        scores = scores[confidence_mask]
        class_ids = class_ids[confidence_mask]

        boxes = self._scale_boxes(boxes, original_shape, ratio, padding)
        keep_indices = _class_aware_nms(
            boxes=boxes,
            scores=scores,
            class_ids=class_ids,
            iou_threshold=options.iou_threshold,
            max_det=options.max_det,
        )
        return [
            Detection(
                x1=float(boxes[index][0]),
                y1=float(boxes[index][1]),
                x2=float(boxes[index][2]),
                y2=float(boxes[index][3]),
                confidence=float(scores[index]),
                class_id=int(class_ids[index]),
                raw_label=self._class_names.get(int(class_ids[index]), str(int(class_ids[index]))),
            )
            for index in keep_indices
        ]

    def _extract_prediction_tensor(self, outputs: list[np.ndarray]) -> np.ndarray:
        for output in outputs:
            if isinstance(output, np.ndarray) and output.size > 0:
                prediction = output
                break
        else:
            raise RuntimeError("ONNX model did not return any tensor outputs.")

        while prediction.ndim > 2 and prediction.shape[0] == 1:
            prediction = prediction[0]

        if prediction.ndim == 1:
            prediction = prediction.reshape(1, -1)

        if prediction.ndim != 2:
            raise RuntimeError(f"Unsupported ONNX output shape: {prediction.shape}")

        return prediction.astype(np.float32, copy=False)

    def _ensure_rows_are_detections(self, prediction: np.ndarray) -> np.ndarray:
        rows, cols = prediction.shape
        if rows <= 128 and cols > 128:
            return prediction.T
        return prediction

    def _decode_nms_output(self, prediction: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        if prediction.shape[1] == 7:
            prediction = prediction[:, 1:]

        column_four = prediction[:, 4]
        column_five = prediction[:, 5]

        if np.all((column_four >= 0.0) & (column_four <= 1.0 + 1e-6)):
            scores = column_four
            class_ids = np.rint(column_five).astype(np.int32)
        else:
            scores = column_five
            class_ids = np.rint(column_four).astype(np.int32)

        return prediction[:, :4], scores.astype(np.float32), class_ids

    def _decode_raw_output(
        self,
        prediction: np.ndarray,
        conf_threshold: float,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        if prediction.shape[1] < 6:
            raise RuntimeError(
                f"Unsupported ONNX detection output shape: {prediction.shape}. "
                "Expected raw YOLO predictions or an NMS-ready [N, 6] tensor."
            )

        class_scores = prediction[:, 4:]
        class_ids = np.argmax(class_scores, axis=1)
        scores = class_scores[np.arange(class_scores.shape[0]), class_ids]
        mask = scores >= conf_threshold
        if not np.any(mask):
            empty_boxes = np.empty((0, 4), dtype=np.float32)
            empty_scores = np.empty((0,), dtype=np.float32)
            empty_class_ids = np.empty((0,), dtype=np.int32)
            return empty_boxes, empty_scores, empty_class_ids

        boxes = _xywh_to_xyxy(prediction[mask, :4])
        return boxes, scores[mask].astype(np.float32), class_ids[mask].astype(np.int32)

    def _scale_boxes(
        self,
        boxes: np.ndarray,
        original_shape: tuple[int, int],
        ratio: float,
        padding: tuple[float, float],
    ) -> np.ndarray:
        original_height, original_width = original_shape
        pad_left, pad_top = padding
        scaled = boxes.copy()
        scaled[:, [0, 2]] -= pad_left
        scaled[:, [1, 3]] -= pad_top
        scaled /= max(ratio, 1e-6)
        scaled[:, [0, 2]] = np.clip(scaled[:, [0, 2]], 0, original_width)
        scaled[:, [1, 3]] = np.clip(scaled[:, [1, 3]], 0, original_height)
        return scaled
