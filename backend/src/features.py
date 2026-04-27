from __future__ import annotations

import math
from typing import Dict, List

import numpy as np


def derive_temporal_features(prev_values: List[float]) -> Dict[str, float]:
    values = np.array(prev_values, dtype=float)
    if values.size != 3:
        raise ValueError("prev_values must contain exactly 3 historical monthly values.")

    mean_3m = float(np.mean(values))
    std_3m = float(np.std(values))
    trend_3m = float(values[-1] - values[0])
    last_change = float(values[-1] - values[-2])

    cv_3m = 0.0
    if mean_3m > 0:
        cv_3m = float(std_3m / mean_3m)

    return {
        "mean_3m_kwh": round(mean_3m, 2),
        "std_3m_kwh": round(std_3m, 2),
        "trend_3m_kwh": round(trend_3m, 2),
        "last_change_kwh": round(last_change, 2),
        "volatility_cv_3m": round(cv_3m, 4),
    }


def seasonal_pair_health(month_sin: float, month_cos: float, tolerance: float = 0.12) -> Dict[str, float | bool]:
    radius = math.sqrt(float(month_sin) ** 2 + float(month_cos) ** 2)
    valid = abs(radius - 1.0) <= tolerance
    return {
        "radius": round(radius, 4),
        "is_valid": valid,
        "tolerance": tolerance,
    }


def build_usage_risk_score(pred_kwh: float, cluster: int, behavior: Dict[str, float], temporal: Dict[str, float]) -> Dict[str, float | str]:
    score = 0.0

    if pred_kwh > 450:
        score += 35
    elif pred_kwh > 300:
        score += 25
    elif pred_kwh > 200:
        score += 15

    score += {0: 6, 1: 12, 2: 18, 3: 24}.get(int(cluster), 15)

    if float(behavior.get("peak_ratio", 0.0)) > 0.6:
        score += 12
    elif float(behavior.get("peak_ratio", 0.0)) > 0.45:
        score += 8

    if float(behavior.get("home_hours", 0.0)) > 14:
        score += 8

    if int(bool(behavior.get("has_ac", 0))):
        score += 7

    cv = float(temporal.get("volatility_cv_3m", 0.0))
    if cv > 0.25:
        score += 12
    elif cv > 0.15:
        score += 8

    score = min(100.0, score)

    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    return {
        "score": round(score, 2),
        "level": level,
    }
