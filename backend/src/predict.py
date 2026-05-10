"""
predict.py — Production prediction pipeline for the hybrid LSTM + K-Means model.

Current serving contract matches the cleaned notebook and saved artifacts:
    - TIME_FEATURES    : monthly_kwh, month, lag_1, lag_2, lag_3
    - BEHAVIOR_FEATURES: ac_usage, wfh_impact, energy_intensity, ac_fraction
    - SEQ_LEN           : 6 months of history
    - Calibration       : validation-tuned blend + tier bias correction
"""

import json
import logging
from pathlib import Path
from typing import Optional, Sequence

import joblib
import numpy as np
import tensorflow as tf

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────
# Feature lists from the cleaned training notebook
# ──────────────────────────────────────────────────────────────────
TIME_FEATURES = [
    "monthly_kwh",
    "month",
    "lag_1",
    "lag_2",
    "lag_3",
]

BEHAVIOR_FEATURES = [
    "ac_usage",
    "wfh_impact",
    "energy_intensity",
    "ac_fraction",
]

CLUSTER_FEATURES = [
    "family_size",
    "avg_hours_wfh",
    "ac_usage",
    "energy_intensity",
    "has_ac",
    "ac_hours_per_day",
]

CLUSTER_LABELS = {
    0: "Moderate",
    1: "Efficient",
    2: "High Usage",
}

SEQ_LEN = 6

TIME_SCALE_FEATURE_IDXS = [0, 2, 3, 4]
TIME_FEATURE_WEIGHTS = {
    "monthly_kwh": 1.25,
    "month": 0.90,
    "lag_1": 1.35,
    "lag_2": 1.15,
    "lag_3": 1.10,
}

# CEB 2024 domestic tariff — 6 slabs (Cell 32)
CEB_SLABS = [
    (30,           8.00,  "0-30 units"),
    (60,          10.00,  "31-60 units"),
    (90,          16.00,  "61-90 units"),
    (120,         25.00,  "91-120 units"),
    (180,         45.00,  "121-180 units"),
    (float("inf"), 75.00, "181+ units"),
]

# ──────────────────────────────────────────────────────────────────
# Global model state (loaded once at startup)
# ──────────────────────────────────────────────────────────────────
_model         = None
_scaler_time   = None
_scaler_beh    = None
_scaler_y      = None
_scaler_cluster= None
_kmeans        = None
_cluster_labels= None
_cluster_features = None
_meta          = None
_mae           = 26.0       # default from notebook Cell 22 output
BLEND_ALPHA = 1.0
BLEND_SCALE = 1.0
BLEND_BIAS_KWH = 0.0
VAL_TIER_EDGES = np.asarray([0.0, np.inf], dtype=np.float32)
VAL_TIER_BIASES = np.asarray([0.0], dtype=np.float32)


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path) as handle:
        return json.load(handle)


def set_models(base_dir: Optional[Path] = None) -> None:
    """
    Load all model artifacts into module globals.
    Called once at FastAPI startup.
    """
    global _model, _scaler_time, _scaler_beh, _scaler_y
    global _scaler_cluster, _kmeans
    global _cluster_labels, _cluster_features, _meta, _mae
    global BLEND_ALPHA, BLEND_SCALE, BLEND_BIAS_KWH
    global VAL_TIER_EDGES, VAL_TIER_BIASES

    if base_dir is None:
        current = Path(__file__).resolve()
        # Walk up until backend/ to support execution from different cwd values.
        while current.name != "backend" and current.parent != current:
            current = current.parent
        base_dir = current

    lstm_dir = base_dir / "models" / "LSTM"
    kmeans_dir = base_dir / "models" / "K-means"
    meta_path = base_dir / "models" / "model_meta.json"

    model_candidates = [lstm_dir / "lstm_model.keras", lstm_dir / "lstm_model.h5"]
    model_path = next((path for path in model_candidates if path.exists()), None)
    if model_path is None:
        raise RuntimeError(f"Model file not found: {model_candidates[0]}")

    logger.info("Loading LSTM model from %s", model_path)
    _model = tf.keras.models.load_model(str(model_path), compile=False)

    # ── Scalers ──
    _scaler_time    = joblib.load(lstm_dir / "scaler_x.pkl")
    _scaler_beh     = joblib.load(lstm_dir / "scaler_b.pkl")
    _scaler_y       = joblib.load(lstm_dir / "scaler_y.pkl")
    _scaler_cluster = joblib.load(kmeans_dir / "scaler_cluster.pkl")
    _kmeans         = joblib.load(kmeans_dir / "kmeans_model.pkl")

    # ── Calibration metadata ──
    calibration_path = lstm_dir / "calibration_meta.json"
    calibration_meta = _load_json(calibration_path)
    if calibration_meta:
        BLEND_ALPHA = float(calibration_meta.get("blend_alpha", BLEND_ALPHA))
        BLEND_SCALE = float(calibration_meta.get("blend_scale", BLEND_SCALE))
        BLEND_BIAS_KWH = float(calibration_meta.get("blend_bias_kwh", BLEND_BIAS_KWH))
        tier_edges = calibration_meta.get("tier_edges", [0.0, np.inf])
        tier_biases = calibration_meta.get("tier_biases", [0.0])
        VAL_TIER_EDGES = np.asarray(tier_edges, dtype=np.float32)
        VAL_TIER_BIASES = np.asarray(tier_biases, dtype=np.float32)
        logger.info("Calibration metadata loaded from %s", calibration_path)

    # ── Cluster feature list (may differ if optional cols were added) ──
    cf_path = kmeans_dir / "cluster_feature_list.pkl"
    if cf_path.exists():
        _cluster_features = joblib.load(cf_path)
    else:
        _cluster_features = CLUSTER_FEATURES[:]

    # ── Cluster labels from meta ──
    cluster_meta_path = kmeans_dir / "cluster_meta.json"
    if meta_path.exists():
        with open(meta_path) as f:
            _meta = json.load(f)
        raw_labels = _meta.get("cluster_labels", {})
        _cluster_labels = {int(k): v for k, v in raw_labels.items()}
        _mae = _meta.get("metrics", {}).get("mae_kwh", 26.0)
    elif cluster_meta_path.exists():
        cluster_meta = _load_json(cluster_meta_path)
        raw_labels = cluster_meta.get("cluster_labels", {})
        _cluster_labels = {int(k): v for k, v in raw_labels.items()}
    else:
        _cluster_labels = CLUSTER_LABELS.copy()

    logger.info(
        "All artifacts loaded. TIME=%d BEH=%d CLUSTER=%d SEQ=%d MAE=%.2f",
        len(TIME_FEATURES), len(BEHAVIOR_FEATURES), len(_cluster_features), SEQ_LEN, _mae,
    )


# ──────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ──────────────────────────────────────────────────────────────────

def _normalize_month(month_num: int) -> int:
    month_num = int(month_num or 1)
    month_num %= 12
    return 12 if month_num == 0 else month_num


def _build_time_sequence(history_values: Sequence[float], month_num: int) -> np.ndarray:
    """Build a 6x5 time matrix from the latest monthly history."""
    history = [float(value) for value in history_values]
    if len(history) != SEQ_LEN:
        raise ValueError(f"Expected {SEQ_LEN} months of history, got {len(history)}")

    oldest_to_newest = list(reversed(history))
    rows: list[list[float]] = []
    for idx, monthly_kwh in enumerate(oldest_to_newest):
        month_value = _normalize_month(month_num - SEQ_LEN + idx)
        rows.append([
            monthly_kwh,
            float(month_value),
            oldest_to_newest[idx - 1] if idx >= 1 else 0.0,
            oldest_to_newest[idx - 2] if idx >= 2 else 0.0,
            oldest_to_newest[idx - 3] if idx >= 3 else 0.0,
        ])

    return np.asarray(rows, dtype=np.float32)


def _scale_time_sequence(time_seq: np.ndarray) -> np.ndarray:
    scaled = time_seq.astype(np.float32).copy()
    for idx in TIME_SCALE_FEATURE_IDXS:
        scaled[:, idx] = _scaler_time.transform(time_seq[:, idx].reshape(-1, 1)).ravel()
    for idx, feature_name in enumerate(TIME_FEATURES):
        scaled[:, idx] *= TIME_FEATURE_WEIGHTS.get(feature_name, 1.0)
    return scaled


def _derive_behavior_features(raw: dict, recent_mean_kwh: float) -> list:
    """Build the 4 BEHAVIOR_FEATURES from the raw user input dict."""
    family_size = max(float(raw.get("family_size", 4)), 1.0)
    has_ac = float(raw.get("has_ac", 0))
    ac_hours = float(raw.get("ac_hours_per_day", 0))
    avg_hours_wfh = float(raw.get("avg_hours_wfh", 0))
    ac_usage = has_ac * ac_hours
    wfh_impact = avg_hours_wfh * family_size
    energy_intensity = recent_mean_kwh / family_size
    ac_fraction = ac_usage / recent_mean_kwh if recent_mean_kwh > 0 else 0.0
    return [ac_usage, wfh_impact, energy_intensity, ac_fraction]


def _assign_cluster(raw_beh: dict, recent_mean_kwh: float) -> tuple[int, str]:
    """
    Assign K-Means cluster from behavioral features.
    Uses _cluster_features list loaded from artifact.
    """
    family_size = float(raw_beh.get("family_size", 4))
    avg_hours_wfh = float(raw_beh.get("avg_hours_wfh", 0))
    has_ac = float(raw_beh.get("has_ac", 0))
    ac_hours = float(raw_beh.get("ac_hours_per_day", 0))
    ac_usage = has_ac * ac_hours
    energy_intensity = recent_mean_kwh / max(family_size, 1.0)

    feature_map = {
        "family_size": float(family_size),
        "avg_hours_wfh": float(avg_hours_wfh),
        "ac_usage": float(ac_usage),
        "energy_intensity": float(energy_intensity),
        "has_ac": float(has_ac),
        "ac_hours_per_day": float(ac_hours),
    }

    row = np.array([[feature_map.get(f, 0.0) for f in _cluster_features]],
                   dtype=np.float32)
    row_scaled = _scaler_cluster.transform(row).astype(np.float32)

    # Manual nearest-centroid (avoids sklearn version issues)
    centers = np.asarray(_kmeans.cluster_centers_, dtype=np.float32)
    cluster_id = int(np.argmin(np.linalg.norm(centers - row_scaled[0], axis=1)))
    cluster_name = (_cluster_labels or CLUSTER_LABELS).get(cluster_id, "Moderate")
    return cluster_id, cluster_name


def _apply_product_calibration(model_pred_kwh: np.ndarray, naive_kwh: np.ndarray) -> np.ndarray:
    model_pred_kwh = np.asarray(model_pred_kwh, dtype=np.float32)
    naive_kwh = np.asarray(naive_kwh, dtype=np.float32)
    pred = (BLEND_ALPHA * model_pred_kwh + (1.0 - BLEND_ALPHA) * naive_kwh) * BLEND_SCALE + BLEND_BIAS_KWH
    tier_ids = np.searchsorted(VAL_TIER_EDGES[1:], naive_kwh, side="right")
    tier_ids = np.clip(tier_ids, 0, len(VAL_TIER_BIASES) - 1)
    pred = pred + VAL_TIER_BIASES[tier_ids]
    return np.clip(pred, 0, None)


def _calculate_bill(kwh: float) -> dict:
    """CEB 2024 domestic tariff — all 6 slabs (Cell 32)."""
    kwh = max(0.0, float(kwh))
    total, breakdown, remaining, prev = 0.0, [], kwh, 0
    for limit, rate, label in CEB_SLABS:
        if remaining <= 0:
            break
        units  = min(remaining, limit - prev)
        charge = units * rate
        total += charge
        breakdown.append({
            "slab":              label,
            "units":             round(units, 2),
            "rate_lkr_per_unit": rate,
            "charge_lkr":        round(charge, 2),
        })
        remaining -= units
        prev = limit
    return {"total_lkr": round(total, 2), "slab_breakdown": breakdown}


def _risk_level(kwh: float) -> dict:
    """Map predicted kWh to risk label + score."""
    if kwh < 100:
        return {"level": "low",       "score": round(kwh / 100 * 25, 1)}
    if kwh < 180:
        return {"level": "medium",    "score": round(25 + (kwh - 100) / 80 * 35, 1)}
    if kwh < 300:
        return {"level": "high",      "score": round(60 + (kwh - 180) / 120 * 25, 1)}
    return     {"level": "very high", "score": min(100.0, round(85 + (kwh - 300) / 200 * 15, 1))}


def _recommendations(
    kwh: float,
    cluster_name: str,
    raw_beh: dict,
) -> list[str]:
    """Generate personalised energy-saving recommendations."""
    tips = []

    if raw_beh.get("has_ac") and not raw_beh.get("inverter_ac"):
        tips.append("Switching to an inverter AC can reduce cooling costs by 30–40%.")
    if raw_beh.get("has_ac") and float(raw_beh.get("ac_hours_per_day", 0)) > 6:
        tips.append("Reduce AC usage by 2 hours/day — this can save 15–25 kWh/month.")
    if float(raw_beh.get("led_ratio", 1)) < 0.5:
        tips.append("Replace remaining non-LED bulbs. LEDs use 75% less energy for the same brightness.")
    if raw_beh.get("work_from_home") and float(raw_beh.get("avg_hours_wfh", 0)) > 6:
        tips.append("Run high-power appliances (washing machine, dishwasher) before 6 PM or after 9 PM to avoid peak tariffs.")
    if not raw_beh.get("has_solar") and kwh > 150:
        tips.append("Your consumption is high enough that rooftop solar panels would have a payback period under 5 years.")
    if raw_beh.get("has_geyser") and not raw_beh.get("water_heater_solar"):
        tips.append("A solar water heater can eliminate geyser electricity use, saving 20–40 kWh/month.")
    if cluster_name == "Peak Heavy":
        tips.append("Your peak-hour ratio is high. Shift heavy appliances to off-peak hours (before 6 PM) to reduce bill risk.")
    if cluster_name == "High Appliance" and kwh > 200:
        tips.append("With many appliances running, setting smart timers on non-essential devices can reduce baseline load.")
    if float(raw_beh.get("family_size", 0)) >= 5 and kwh > 180:
        tips.append("For large households, a pre-paid smart meter helps all members track usage in real time.")
    if not tips:
        tips.append("Your energy usage looks efficient. Keep monitoring monthly to catch any unexpected increases.")

    return tips[:5]


def _top_factors(history_values: Sequence[float], beh_vals: dict, recent_mean_kwh: float) -> list[dict]:
    """Return top contributing factors for the explanation panel."""
    factors = []
    total = recent_mean_kwh + 1e-5

    # Recent usage contribution (always dominant)
    factors.append({"label": "Recent usage history",
                    "contribution_pct": round(min(60, recent_mean_kwh / total * 60), 1)})

    if beh_vals.get("has_ac"):
        pct = round(min(20, float(beh_vals.get("ac_hours_per_day", 0)) / 12 * 20), 1)
        if pct > 0:
            factors.append({"label": "Air conditioning usage", "contribution_pct": pct})

    peak = float(beh_vals.get("peak_ratio", 0.5))
    if peak > 0.55:
        factors.append({"label": "Peak-hour usage", "contribution_pct": round((peak - 0.4) * 30, 1)})

    fs = float(beh_vals.get("family_size", 4))
    if fs > 3:
        factors.append({"label": f"Family size ({int(fs)})", "contribution_pct": round(min(8, fs * 1.5), 1)})

    if beh_vals.get("work_from_home"):
        wh = float(beh_vals.get("avg_hours_wfh", 0))
        if wh > 4:
            factors.append({"label": "Work from home load", "contribution_pct": round(min(8, wh * 0.8), 1)})

    # Normalise so they sum to ≤ 100
    total_pct = sum(f["contribution_pct"] for f in factors) or 1
    if total_pct > 100:
        for f in factors:
            f["contribution_pct"] = round(f["contribution_pct"] / total_pct * 100, 1)

    return sorted(factors, key=lambda x: -x["contribution_pct"])[:5]


# ──────────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────────

def full_prediction(prev_values: Sequence[float], behavior_values: dict) -> dict:
    """
    Run the full prediction pipeline.

    Args:
        prev_values:     [prev1_kwh, ..., prev6_kwh]
                 order: [t-1, ..., t-6]  (most recent first)
        behavior_values: dict with keys matching InputData.behavior_values()

    Returns:
        Full response dict matching the frontend contract.
    """
    if _model is None:
        raise RuntimeError("Models not loaded. Call set_models() first.")

    history_values = [float(value) for value in prev_values]
    if len(history_values) != SEQ_LEN:
        raise ValueError(f"Expected {SEQ_LEN} monthly kWh values, got {len(history_values)}")

    peak_ratio = float(behavior_values.get("peak_ratio", 0.5))
    month_num  = int(behavior_values.get("month", 6))
    temp       = float(behavior_values.get("temp", 29.0))
    humidity   = float(behavior_values.get("humidity", 75.0))
    district   = str(behavior_values.get("district", "Colombo")).strip()

    # Derived scalars needed across branches
    recent_mean = float(np.mean(history_values[:3]))

    # ── 2. Build TIME feature matrix (6 × 5) ────────────────────
    time_seq = _build_time_sequence(history_values, month_num)
    time_row = time_seq[np.newaxis, ...]

    # ── 3. Build BEHAVIOR feature row (1 × 4) ───────────────────
    beh_vals = dict(behavior_values)
    beh_vals.update({"temp": temp, "humidity": humidity, "peak_ratio": peak_ratio})

    beh_list = _derive_behavior_features(beh_vals, recent_mean)
    beh_row  = np.array([beh_list], dtype=np.float32)   # (1, 4)

    # ── 4. Scale ─────────────────────────────────────────────────

    seq_scaled = _scale_time_sequence(time_seq)
    t_scaled = seq_scaled.reshape(1, SEQ_LEN, -1)

    b_scaled = _scaler_beh.transform(beh_row).astype(np.float32)


    # ── 5. LSTM forward pass ──────────────────────────────────────
    y_s = _model.predict([t_scaled, b_scaled], verbose=0)  # (1, 1)
    pred_raw = float(_scaler_y.inverse_transform(y_s.reshape(-1, 1))[0][0])
    pred_kwh = float(np.clip(pred_raw, 5.0, 1000.0))

    # ── 6. Validation-calibrated product inference ───────────────
    pred_kwh = float(_apply_product_calibration(np.array([pred_kwh]), np.array([history_values[0]]))[0])

    # ── 7. Cluster assignment ─────────────────────────────────────
    cluster_id, cluster_name = _assign_cluster(beh_vals, recent_mean)

    # ── 8. Bill ───────────────────────────────────────────────────
    bill = _calculate_bill(pred_kwh)

    # ── 9. Confidence interval (±1 MAE) ──────────────────────────
    ci = {
        "lower_kwh": round(max(0.0, pred_kwh - _mae), 2),
        "upper_kwh": round(pred_kwh + _mae, 2),
    }

    # ── 10. Ancillary outputs ─────────────────────────────────────
    risk    = _risk_level(pred_kwh)
    tips    = _recommendations(pred_kwh, cluster_name, beh_vals)
    factors = _top_factors(history_values, beh_vals, recent_mean)

    return {
        "forecast": {
            "prediction_kwh":        round(pred_kwh, 2),
            "confidence_interval":   ci,
        },
        "billing": {
            "estimated_bill_lkr":    bill["total_lkr"],
            "slab_breakdown":        bill["slab_breakdown"],
        },
        "behavior": {
            "cluster_id":            cluster_id,
            "category":              cluster_name,
        },
        "insights": {
            "risk": risk,
        },
        "recommendations": tips,
        "explanation": {
            "top_factors": factors,
        },
    }
