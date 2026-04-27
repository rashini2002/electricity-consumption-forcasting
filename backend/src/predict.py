"""
predict.py — Full prediction pipeline for Hybrid LSTM + K-Means model.

Exact pipeline from lstm.ipynb:
    - TIME_FEATURES   : 11 features (prev1-3, derived, seasonal)
    - BEHAVIOR_FEATURES: 18 features (household + interaction terms)
    - CLUSTER_FEATURES : 5 features
    - scaler_time     : MinMaxScaler (fits on flattened time matrix)
    - scaler_beh      : StandardScaler
    - scaler_y        : MinMaxScaler on raw kWh target
    - Inverse         : scaler_y.inverse → kWh
    - Calibration     : optional isotonic calibration on validation set
"""

import json
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import tensorflow as tf
from sklearn.isotonic import IsotonicRegression

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────
# EXACT feature lists from Cell 10 of lstm.ipynb
# ──────────────────────────────────────────────────────────────────
TIME_FEATURES = [
    "prev1",
    "prev2",
    "prev3",
    "prev_mean_3",
    "prev_std_3",
    "prev_trend",
    "peak_ratio",
    "month_sin",
    "month_cos",
    "consumption_variability",   # std / (mean + eps)
    "trend_strength",            # prev_trend * prev_mean_3
]

BEHAVIOR_FEATURES = [
    "family_size",
    "district_enc",
    "ac_intensity",              # has_ac * ac_hours_per_day
    "appliance_score",           # weighted appliance sum
    "inverter_ac",
    "non_inverter_ac",
    "has_solar",
    "water_heater_solar",
    "led_ratio",
    "work_from_home",
    "avg_hours_wfh",
    "has_refrigerator",
    "has_electric_cooking",
    "temp_usage",                # temp * prev_mean_3
    "humidity_usage",            # humidity * prev_mean_3
    "log_prev_mean",             # log1p(prev_mean_3)
    "log_appliance",             # log1p(appliance_score)
    "energy_behavior_index",     # appliance_score + wfh_load + peak_ratio*10 + family_size
]

# Optional enriched columns appended during training if present
OPTIONAL_FEATURES = ["room_count", "load_variance", "tou_aware"]

CLUSTER_FEATURES = [
    "family_size",
    "ac_intensity",
    "appliance_score",
    "avg_hours_wfh",
    "peak_ratio",
]

CLUSTER_LABELS = {
    0: "Energy Efficient",
    1: "Moderate",
    2: "High Appliance",
    3: "Peak Heavy",
}

SEQ_LEN = 3

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
_le_district   = None
_kmeans        = None
_iso_cal       = None       # isotonic calibrator (optional)
_cluster_labels= None
_cluster_features = None
_meta          = None
_mae           = 26.0       # default from notebook Cell 22 output


def set_models(base_dir: Optional[Path] = None) -> None:
    """
    Load all model artifacts into module globals.
    Called once at FastAPI startup.
    """
    global _model, _scaler_time, _scaler_beh, _scaler_y
    global _scaler_cluster, _le_district, _kmeans
    global _iso_cal, _cluster_labels, _cluster_features, _meta, _mae

    if base_dir is None:
        current = Path(__file__).resolve()
        # Walk up until backend/ to support execution from different cwd values.
        while current.name != "backend" and current.parent != current:
            current = current.parent
        base_dir = current

    lstm_dir = base_dir / "models" / "LSTM"
    kmeans_dir = base_dir / "models" / "K-means"
    meta_path = base_dir / "models" / "model_meta.json"

    # Prefer .h5 first. The existing .keras artifact was produced with a newer
    # Keras serialization format and can fail to deserialize under tf.keras 2.15.
    model_candidates = [lstm_dir / "lstm_model.h5", lstm_dir / "lstm_model.keras"]
    load_errors = []
    _model = None

    for model_path in model_candidates:
        if not model_path.exists():
            continue
        logger.info("Loading LSTM model from %s", model_path)
        try:
            _model = tf.keras.models.load_model(
                str(model_path),
                compile=False,
                custom_objects={
                    "Orthogonal": tf.keras.initializers.Orthogonal,
                },
            )
            break
        except Exception as exc:
            load_errors.append(f"{model_path.name}: {exc}")

    if _model is None:
        details = "; ".join(load_errors) if load_errors else "No model artifact found"
        raise RuntimeError(f"Unable to load LSTM model. {details}")

    # ── Scalers ──
    _scaler_time    = joblib.load(lstm_dir / "scaler_time.pkl")
    _scaler_beh     = joblib.load(lstm_dir / "scaler_beh.pkl")
    _scaler_y       = joblib.load(lstm_dir / "scaler_y.pkl")
    _scaler_cluster = joblib.load(kmeans_dir / "scaler_cluster.pkl")
    _le_district    = joblib.load(base_dir / "models" / "le_district.pkl")
    _kmeans         = joblib.load(kmeans_dir / "kmeans_model.pkl")

    # ── Optional isotonic calibrator ──
    iso_path = lstm_dir / "iso_calibrator.pkl"
    if iso_path.exists():
        _iso_cal = joblib.load(iso_path)
        logger.info("Isotonic calibrator loaded")

    # ── Cluster feature list (may differ if optional cols were added) ──
    cf_path = kmeans_dir / "cluster_feature_list.pkl"
    if cf_path.exists():
        _cluster_features = joblib.load(cf_path)
    else:
        _cluster_features = CLUSTER_FEATURES[:]

    # ── Cluster labels from meta ──
    if meta_path.exists():
        with open(meta_path) as f:
            _meta = json.load(f)
        raw_labels = _meta.get("cluster_labels", {})
        _cluster_labels = {int(k): v for k, v in raw_labels.items()}
        _mae = _meta.get("metrics", {}).get("mae_kwh", 26.0)
    else:
        _cluster_labels = CLUSTER_LABELS.copy()

    logger.info(
        "All artifacts loaded. TIME=%d BEH=%d CLUSTER=%d SEQ=%d MAE=%.2f",
        len(TIME_FEATURES), len(BEHAVIOR_FEATURES),
        len(_cluster_features), SEQ_LEN, _mae,
    )


# ──────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ──────────────────────────────────────────────────────────────────

def _encode_district(district: Optional[str]) -> int:
    """Encode district string → integer. Unknown → 0."""
    if _le_district is None or not district:
        return 0
    try:
        return int(_le_district.transform([district.strip()])[0])
    except ValueError:
        return 0


def _derive_time_features(p1: float, p2: float, p3: float,
                           peak_ratio: float,
                           month_num: int) -> list:
    """
    Build the 11 TIME_FEATURES from raw kWh values.
    Mirrors Cell 8 + Cell 34 of the notebook exactly.
    """
    pm3  = np.mean([p1, p2, p3])
    pstd = np.std([p1, p2, p3])
    ptr  = p1 - p3
    msin = np.sin(2 * np.pi * month_num / 12)
    mcos = np.cos(2 * np.pi * month_num / 12)
    cv   = pstd / (pm3 + 1e-5)   # consumption_variability
    ts   = ptr * pm3              # trend_strength

    return [p1, p2, p3, pm3, pstd, ptr, peak_ratio, msin, mcos, cv, ts]


def _derive_behavior_features(
    raw: dict,
    dist_enc: int,
    pm3: float,
    pstd: float,
) -> list:
    """
    Build the 18 BEHAVIOR_FEATURES from the raw user input dict.
    Mirrors Cell 8 (feature engineering) + Cell 34 exactly.
    """
    g = raw.get  # shorthand

    has_ac              = float(g("has_ac", 0))
    ac_hours            = float(g("ac_hours_per_day", 0))
    has_geyser          = float(g("has_geyser", 0))
    has_washing_machine = float(g("has_washing_machine", 0))
    has_water_pump      = float(g("has_water_pump", 0))
    family_size         = float(g("family_size", 4))
    avg_hours_wfh       = float(g("avg_hours_wfh", 0))
    no_members_wfh      = float(g("no_members_wfh", 0))
    peak_ratio          = float(g("peak_ratio", 0.5))
    temp                = float(g("temp", 29.0))
    humidity            = float(g("humidity", 75.0))
    inverter_ac         = float(g("inverter_ac", 0))
    non_inverter_ac     = float(g("non_inverter_ac", 0))
    has_solar           = float(g("has_solar", 0))
    wh_solar            = float(g("water_heater_solar", 0))
    led_ratio           = float(g("led_ratio", 0.0))
    work_from_home      = float(g("work_from_home", 0))
    has_refrigerator    = float(g("has_refrigerator", 0))
    has_elec_cooking    = float(g("has_electric_cooking", 0))

    # Interaction features — exact formulas from Cell 8
    ac_intensity        = has_ac * ac_hours
    appliance_score     = has_ac * 3 + has_geyser * 2 + has_washing_machine * 1.5 + has_water_pump * 2
    wfh_load            = avg_hours_wfh * no_members_wfh
    temp_usage          = temp * pm3
    humidity_usage      = humidity * pm3
    log_prev_mean       = np.log1p(pm3)
    log_appliance       = np.log1p(appliance_score)
    energy_beh_index    = appliance_score + wfh_load + peak_ratio * 10 + family_size

    return [
        family_size, dist_enc,
        ac_intensity, appliance_score,
        inverter_ac, non_inverter_ac,
        has_solar, wh_solar,
        led_ratio, work_from_home, avg_hours_wfh,
        has_refrigerator, has_elec_cooking,
        temp_usage, humidity_usage,
        log_prev_mean, log_appliance,
        energy_beh_index,
    ]


def _assign_cluster(raw_beh: dict, pm3: float) -> tuple[int, str]:
    """
    Assign K-Means cluster from behavioral features.
    Uses _cluster_features list loaded from artifact.
    """
    has_ac    = float(raw_beh.get("has_ac", 0))
    ac_hours  = float(raw_beh.get("ac_hours_per_day", 0))
    ac_int    = has_ac * ac_hours

    has_geyser  = float(raw_beh.get("has_geyser", 0))
    has_wm      = float(raw_beh.get("has_washing_machine", 0))
    has_wp      = float(raw_beh.get("has_water_pump", 0))
    app_score   = has_ac * 3 + has_geyser * 2 + has_wm * 1.5 + has_wp * 2

    feature_map = {
        "family_size":    float(raw_beh.get("family_size", 4)),
        "ac_intensity":   ac_int,
        "appliance_score":app_score,
        "avg_hours_wfh":  float(raw_beh.get("avg_hours_wfh", 0)),
        "peak_ratio":     float(raw_beh.get("peak_ratio", 0.5)),
    }

    row = np.array([[feature_map.get(f, 0.0) for f in _cluster_features]],
                   dtype=np.float32)
    row_scaled = _scaler_cluster.transform(row).astype(np.float32)

    # Manual nearest-centroid (avoids sklearn version issues)
    centers = np.asarray(_kmeans.cluster_centers_, dtype=np.float32)
    cluster_id = int(np.argmin(np.linalg.norm(centers - row_scaled[0], axis=1)))
    cluster_name = (_cluster_labels or CLUSTER_LABELS).get(cluster_id, "Moderate")
    return cluster_id, cluster_name


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


def _top_factors(time_vals: list, beh_vals: dict, pm3: float) -> list[dict]:
    """Return top contributing factors for the explanation panel."""
    factors = []
    total = pm3 + 1e-5

    # Prev kWh contribution (always dominant)
    factors.append({"label": "Recent usage history",
                    "contribution_pct": round(min(60, pm3 / total * 60), 1)})

    if beh_vals.get("has_ac"):
        pct = round(min(20, float(beh_vals.get("ac_hours_per_day", 0)) / 12 * 20), 1)
        if pct > 0:
            label = "Inverter AC" if beh_vals.get("inverter_ac") else "Non-inverter AC"
            factors.append({"label": label, "contribution_pct": pct})

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

def full_prediction(prev_values: list, behavior_values: dict) -> dict:
    """
    Run the full prediction pipeline.

    Args:
        prev_values:     [prev1_kwh, prev2_kwh, prev3_kwh]
                         order: [t-1, t-2, t-3]  (most recent first)
        behavior_values: dict with keys matching InputData.behavior_values()

    Returns:
        Full response dict matching the frontend contract.
    """
    if _model is None:
        raise RuntimeError("Models not loaded. Call set_models() first.")

    # ── 1. Extract prev kWh ──────────────────────────────────────
    # prev_values comes from InputData.prev_values() = [prev1, prev2, prev3]
    # Notebook convention: p1=most recent, p2=one before, p3=oldest
    p1 = float(prev_values[0])   # t-1 (last month)
    p2 = float(prev_values[1])   # t-2
    p3 = float(prev_values[2])   # t-3

    peak_ratio = float(behavior_values.get("peak_ratio", 0.5))
    month_num  = int(behavior_values.get("month", 6))
    temp       = float(behavior_values.get("temp", 29.0))
    humidity   = float(behavior_values.get("humidity", 75.0))
    district   = str(behavior_values.get("district", "Colombo")).strip()

    # Derived scalars needed across branches
    pm3  = np.mean([p1, p2, p3])
    pstd = np.std([p1, p2, p3])

    # ── 2. Build TIME feature row (1 × 11) ──────────────────────
    time_vals = _derive_time_features(p1, p2, p3, peak_ratio, month_num)
    time_row  = np.array([time_vals], dtype=np.float32)   # (1, 11)

    # ── 3. Build BEHAVIOR feature row (1 × 25) ──────────────────
    beh_vals = dict(behavior_values)
    beh_vals.update({"temp": temp, "humidity": humidity, "peak_ratio": peak_ratio})

    dist_enc = _encode_district(district)
    beh_list = _derive_behavior_features(beh_vals, dist_enc, pm3, pstd)
    beh_row  = np.array([beh_list], dtype=np.float32)   # (1, 25)

    # ── 4. Scale ─────────────────────────────────────────────────

    seq = [
    _derive_time_features(p3, p3, p3, peak_ratio, month_num),
    _derive_time_features(p2, p3, p3, peak_ratio, month_num),
    _derive_time_features(p1, p2, p3, peak_ratio, month_num),
    ]

    seq = np.array(seq, dtype=np.float32)

    seq_scaled = _scaler_time.transform(seq)

    t_scaled = seq_scaled.reshape(1, SEQ_LEN, -1)

    b_scaled = _scaler_beh.transform(beh_row).astype(np.float32)


    # ── 5. LSTM forward pass ──────────────────────────────────────
    y_s = _model.predict([t_scaled, b_scaled], verbose=0)  # (1, 1)
    pred_raw = float(_scaler_y.inverse_transform(y_s.reshape(-1, 1))[0][0])
    pred_kwh = float(np.clip(pred_raw, 5.0, 1000.0))

    # ── 6. Optional isotonic calibration ────────────────────────
    if _iso_cal is not None:
        pred_kwh = float(np.clip(_iso_cal.transform([pred_kwh])[0], 5.0, 1000.0))

    # ── 7. Cluster assignment ─────────────────────────────────────
    cluster_id, cluster_name = _assign_cluster(beh_vals, pm3)

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
    factors = _top_factors(time_vals, beh_vals, pm3)

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
