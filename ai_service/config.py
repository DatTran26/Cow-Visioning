from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
AI_SERVICE_DIR = Path(__file__).resolve().parent
SUPPORTED_MODEL_EXTENSIONS = (".pt", ".onnx")
SUPPORTED_MODEL_BACKENDS = ("auto", "pt", "onnx")
DEFAULT_MODEL_CANDIDATES = tuple(
    AI_SERVICE_DIR / "models" / f"boudding_catllte_v1_22es{extension}"
    for extension in SUPPORTED_MODEL_EXTENSIONS
)
DEFAULT_BEHAVIOR_MAP_PATH = AI_SERVICE_DIR / "behavior_map.json"

load_dotenv(ROOT_DIR / ".env")


def resolve_repo_path(configured_path: str | Path) -> Path:
    path = Path(configured_path).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path.resolve()


def get_default_model_path() -> Path:
    for candidate in DEFAULT_MODEL_CANDIDATES:
        if candidate.exists():
            return candidate
    return DEFAULT_MODEL_CANDIDATES[0]


def get_configured_model_path() -> Path:
    configured = os.getenv("AI_MODEL_PATH")
    return resolve_repo_path(configured) if configured else get_default_model_path()


def get_model_path() -> Path:
    model_path = get_configured_model_path()
    if model_path.suffix.lower() not in SUPPORTED_MODEL_EXTENSIONS:
        supported = ", ".join(SUPPORTED_MODEL_EXTENSIONS)
        raise ValueError(
            f"Unsupported model format for {model_path}. Supported formats: {supported}."
        )
    return model_path


def get_model_format() -> str:
    return get_model_path().suffix.lower().lstrip(".") or "unknown"


def get_model_backend() -> str:
    configured = os.getenv("AI_MODEL_BACKEND", "auto").strip().lower()
    if configured not in SUPPORTED_MODEL_BACKENDS:
        supported = ", ".join(SUPPORTED_MODEL_BACKENDS)
        raise ValueError(f"Unsupported AI_MODEL_BACKEND={configured!r}. Supported values: {supported}.")

    resolved_format = get_model_format()
    if configured == "auto":
        return resolved_format
    if configured != resolved_format:
        raise ValueError(
            f"AI_MODEL_BACKEND={configured!r} does not match model format {resolved_format!r}."
        )
    return configured


def get_model_name() -> str:
    return os.getenv("AI_MODEL_NAME", get_configured_model_path().name)


def get_behavior_map_path() -> Path:
    configured = os.getenv("AI_BEHAVIOR_MAP_PATH", str(DEFAULT_BEHAVIOR_MAP_PATH))
    return resolve_repo_path(configured)


def get_class_names_path() -> Path | None:
    configured = os.getenv("AI_CLASS_NAMES_PATH")
    if not configured:
        return None
    return resolve_repo_path(configured)


def get_device() -> str:
    return os.getenv("AI_DEVICE", "cpu")


def get_confidence_threshold() -> float:
    return float(os.getenv("AI_CONF_THRESHOLD", "0.25"))


def get_iou_threshold() -> float:
    return float(os.getenv("AI_IOU_THRESHOLD", "0.45"))


def get_max_det() -> int:
    return int(os.getenv("AI_MAX_DET", "50"))
