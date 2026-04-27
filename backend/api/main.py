"""
main.py — FastAPI backend for GridPulse electricity forecasting.

Endpoints:
  GET  /              → health check
  GET  /model-info    → model metadata
  POST /predict       → single household forecast
  POST /predict/what-if → scenario comparison
"""

import logging
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure repository root is importable even when uvicorn is launched from backend/.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Import predictor only from this repository.
from backend.src.predict import full_prediction
from backend.src.predict import set_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────
# App
# ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GridPulse Electricity Forecast API",
    description="Hybrid LSTM + K-Means electricity forecasting for Sri Lankan households",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────
# Model state
# ──────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).resolve().parents[1]
_loaded     = False
_load_error: Optional[str] = None


def _ensure_loaded() -> None:
    """Load model artifacts once. Raises HTTPException 503 on failure."""
    global _loaded, _load_error

    if _loaded:
        return

    _load_error = None
    required = [
        BASE_DIR / "models" / "LSTM"     / "lstm_model.h5",
        BASE_DIR / "models" / "LSTM"     / "scaler_time.pkl",
        BASE_DIR / "models" / "LSTM"     / "scaler_beh.pkl",
        BASE_DIR / "models" / "LSTM"     / "scaler_y.pkl",
        BASE_DIR / "models" / "le_district.pkl",
        BASE_DIR / "models" / "K-means"  / "kmeans_model.pkl",
        BASE_DIR / "models" / "K-means"  / "scaler_cluster.pkl",
    ]
    # Accept .keras as alternative for LSTM model
    if not required[0].exists():
        keras_path = BASE_DIR / "models" / "LSTM" / "lstm_model.keras"
        if keras_path.exists():
            required[0] = keras_path

    missing = [str(p) for p in required if not p.exists()]
    if missing:
        _load_error = f"Missing model files: {', '.join(missing)}"
        logger.error(_load_error)
        raise HTTPException(status_code=503, detail=_load_error)

    try:
        set_models()
        _loaded = True
        logger.info("Models loaded successfully from %s", BASE_DIR / "models")
    except Exception as exc:
        _load_error = f"Failed to load models: {exc}"
        logger.exception(_load_error)
        raise HTTPException(status_code=503, detail=_load_error)


# ──────────────────────────────────────────────────────────────────
# Request schemas
# ──────────────────────────────────────────────────────────────────

class InputData(BaseModel):
    """
    All fields that come from the user via the React dashboard.
    prev1/2/3 are raw kWh (not pre-scaled).
    Weather fields are fetched by the frontend via Open-Meteo.
    Behavioral features are entered by the user.
    """

    # ── Time history (required) ──
    prev1_kwh: float = Field(..., ge=0, description="Last month kWh (t-1)")
    prev2_kwh: float = Field(..., ge=0, description="Two months ago kWh (t-2)")
    prev3_kwh: float = Field(..., ge=0, description="Three months ago kWh (t-3)")

    # ── Date & location (required) ──
    peak_ratio: float = Field(..., ge=0, le=1,
        description="Peak-hour fraction — auto-calculated by frontend")
    month_sin:  float = Field(..., ge=-1, le=1)
    month_cos:  float = Field(..., ge=-1, le=1)
    district:   str   = Field(..., min_length=2, max_length=50)

    # ── Weather — fetched from Open-Meteo by frontend ──
    temp:     float = Field(..., ge=-10, le=60)
    humidity: float = Field(..., ge=0, le=100)
    rain:     float = Field(..., ge=0)

    # ── Household profile ──
    family_size:         int   = Field(..., ge=1, le=20)
    has_refrigerator:    bool  = False
    has_ac:              bool  = False
    inverter_ac:         bool  = False
    non_inverter_ac:     bool  = False
    ac_hours_per_day:    float = Field(default=0.0, ge=0, le=24)
    has_geyser:          bool  = False
    has_electric_cooking:bool  = False
    has_washing_machine: bool  = False
    has_water_pump:      bool  = False
    work_from_home:      bool  = False
    no_members_wfh:      int   = Field(default=0, ge=0, le=20)
    avg_hours_wfh:       float = Field(default=0.0, ge=0, le=24)
    has_solar:           bool  = False
    water_heater_solar:  bool  = False
    led_ratio:           float = Field(default=0.0, ge=0, le=1,
        description="LED bulbs / total bulbs — auto-calculated by frontend")

    # ── Legacy compatibility (home_hours kept for old clients) ──
    home_hours: Optional[float] = Field(default=None, ge=0, le=24)

    def prev_values(self) -> list[float]:
        """Return [prev1, prev2, prev3] in most-recent-first order."""
        return [self.prev1_kwh, self.prev2_kwh, self.prev3_kwh]

    def behavior_values(self) -> dict:
        """
        Build the behavior dict that predict.py expects.
        Derives month_num from month_sin / month_cos via atan2.
        """
        import math
        month_num = round(math.atan2(self.month_sin, self.month_cos)
                          / (2 * math.pi) * 12) % 12 or 12

        return {
            "peak_ratio":          self.peak_ratio,
            "month":               month_num,
            "temp":                self.temp,
            "humidity":            self.humidity,
            "rain":                self.rain,
            "district":            self.district,
            "family_size":         self.family_size,
            "has_refrigerator":    int(self.has_refrigerator),
            "has_ac":              int(self.has_ac),
            "inverter_ac":         int(self.inverter_ac),
            "non_inverter_ac":     int(self.non_inverter_ac),
            "ac_hours_per_day":    self.ac_hours_per_day,
            "has_geyser":          int(self.has_geyser),
            "has_electric_cooking":int(self.has_electric_cooking),
            "has_washing_machine": int(self.has_washing_machine),
            "has_water_pump":      int(self.has_water_pump),
            "work_from_home":      int(self.work_from_home),
            "no_members_wfh":      self.no_members_wfh,
            "avg_hours_wfh":       self.avg_hours_wfh,
            "has_solar":           int(self.has_solar),
            "water_heater_solar":  int(self.water_heater_solar),
            "led_ratio":           self.led_ratio,
        }


class ScenarioOverrides(BaseModel):
    """All fields are optional — only filled overrides are applied."""
    peak_ratio:          Optional[float] = Field(default=None, ge=0, le=1)
    family_size:         Optional[int]   = Field(default=None, ge=1, le=20)
    has_ac:              Optional[bool]  = None
    inverter_ac:         Optional[bool]  = None
    has_solar:           Optional[bool]  = None
    has_geyser:          Optional[bool]  = None
    ac_hours_per_day:    Optional[float] = Field(default=None, ge=0, le=24)
    avg_hours_wfh:       Optional[float] = Field(default=None, ge=0, le=24)
    no_members_wfh:      Optional[int]   = Field(default=None, ge=0, le=20)
    led_ratio:           Optional[float] = Field(default=None, ge=0, le=1)
    work_from_home:      Optional[bool]  = None
    temp:                Optional[float] = Field(default=None, ge=-10, le=60)
    humidity:            Optional[float] = Field(default=None, ge=0, le=100)


class WhatIfRequest(BaseModel):
    base:      InputData
    overrides: ScenarioOverrides


# ──────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    """Health check — does not require models to be loaded."""
    return {"status": "ok", "service": "GridPulse API v1.0"}


@app.get("/model-info")
def model_info():
    """Return model metadata. Triggers model loading on first call."""
    _ensure_loaded()
    import json
    meta_path = BASE_DIR / "models" / "model_meta.json"
    metrics = {}
    cluster_labels = {}
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
        metrics        = meta.get("metrics", {})
        cluster_labels = meta.get("cluster_labels", {})

    return {
        "model_status":   "READY",
        "forecast_model": {
            "type":     "Hybrid LSTM",
            "seq_len":  3,
            "n_time_features":    11,
            "n_behavior_features": 18,
        },
        "cluster_model": {
            "type":           "K-Means",
            "n_clusters":     4,
            "cluster_labels": cluster_labels,
        },
        "metrics":        metrics,
        "api_version":    "1.0.0",
    }


@app.post("/predict")
def predict(data: InputData):
    """
    Run the full LSTM + K-Means forecast for a single household.

    Returns forecast, billing, behavior cluster, risk, recommendations
    and top consumption drivers.
    """
    _ensure_loaded()

    try:
        result = full_prediction(
            prev_values=data.prev_values(),
            behavior_values=data.behavior_values(),
        )
        return result

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Prediction error")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/what-if")
def what_if(data: WhatIfRequest):
    """
    Run a baseline prediction and a scenario prediction side-by-side.

    Returns both full results plus a delta showing kWh and bill change.
    Only non-None override fields are applied.
    """
    _ensure_loaded()

    try:
        # ── Baseline ──────────────────────────────────────────────
        baseline = full_prediction(
            prev_values=data.base.prev_values(),
            behavior_values=data.base.behavior_values(),
        )

        # ── Build scenario payload ────────────────────────────────
        base_dict     = data.base.model_dump()
        override_dict = {
            k: v for k, v in data.overrides.model_dump().items()
            if v is not None
        }
        scenario_dict = {**base_dict, **override_dict}
        scenario_data = InputData.model_validate(scenario_dict)

        scenario = full_prediction(
            prev_values=scenario_data.prev_values(),
            behavior_values=scenario_data.behavior_values(),
        )

        # ── Delta ─────────────────────────────────────────────────
        base_kwh  = baseline["forecast"]["prediction_kwh"]
        scen_kwh  = scenario["forecast"]["prediction_kwh"]
        base_bill = baseline["billing"]["estimated_bill_lkr"]
        scen_bill = scenario["billing"]["estimated_bill_lkr"]

        return {
            "baseline":         baseline,
            "scenario":         scenario,
            "delta": {
                "kwh_change":      round(scen_kwh  - base_kwh,  2),
                "bill_lkr_change": round(scen_bill - base_bill, 2),
            },
            "applied_overrides": override_dict,
        }

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("What-if error")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/favicon.ico")
def favicon():
    return {}
