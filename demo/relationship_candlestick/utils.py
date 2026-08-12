"""Shared helpers."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
import yaml


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def load_config(path: str | Path | None) -> Dict[str, Any]:
    if path is None:
        path = Path(__file__).resolve().parent.parent / "config" / "default_weights.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


TIMEFRAME_TO_PANDAS = {
    "5min":  "5min",
    "15min": "15min",
    "30min": "30min",
    "1h":    "1h",
    "2h":    "2h",
    "4h":    "4h",
    "1d":    "1D",
    "1w":    "1W",
    "1mo":   "MS",
    "1q":    "QS",
    "1y":    "YS",
}


ALL_TIMEFRAMES = ["5min", "15min", "30min", "1h", "2h", "4h",
                  "1d", "1w", "1mo", "1q", "1y"]
