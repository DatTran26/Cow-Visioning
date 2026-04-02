from __future__ import annotations

import json
from functools import lru_cache

from ai_service.config import (
    get_behavior_map_path,
    get_class_names_path,
    get_model_backend,
    get_model_path,
)


ALLOWED_BEHAVIORS = {"standing", "lying", "eating", "drinking", "walking", "abnormal"}


def normalize_label(label: object) -> str:
    return str(label).strip().lower().replace(" ", "_")


def map_behavior(raw_label: str, behavior_map: dict[str, str]) -> str | None:
    normalized = normalize_label(raw_label)
    if normalized in behavior_map:
        return behavior_map[normalized]
    if normalized in ALLOWED_BEHAVIORS:
        return normalized
    return None


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
def load_predictor():
    model_path = get_model_path()
    backend = get_model_backend()

    if backend == "pt":
        from ai_service.backends.pt_backend import PtBackend

        return PtBackend(model_path)

    if backend == "onnx":
        from ai_service.backends.onnx_backend import OnnxRuntimeBackend

        return OnnxRuntimeBackend(model_path, class_names_path=get_class_names_path())

    raise ValueError(f"Unsupported predictor backend: {backend}")
