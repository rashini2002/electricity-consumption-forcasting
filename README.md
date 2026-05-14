# ⚡ Electricity Consumption Forecasting & Behavioral Analysis (Sri Lanka)

## 📌 Project Overview
This project predicts **monthly household electricity consumption (kWh)** using a Hybrid Machine Learning approach combining:

- 📈 **LSTM (Long Short-Term Memory)** → Time-series forecasting
- 🧠 **K-Means Clustering** → Behavioral segmentation

The system forecasts future electricity usage and analyzes household behavior patterns to generate actionable insights and recommendations.

---

## 🎯 Objectives
- Predict next-month electricity consumption (kWh)
- Identify household energy behavior patterns
- Improve prediction accuracy using hybrid modeling
- Provide insights for energy optimization and bill estimates

---

## 🧠 Methodology

### 1. Data Preprocessing
- Merge smart meter, survey and weather data
- Create time-series features (`prev1`, `prev2`, `prev3`) and expand to six-month input when needed
- Apply cyclic encoding for seasonality (`month_sin`, `month_cos`)
- Clean missing and inconsistent values

---

### 2. LSTM Forecasting Model
- Input: previous months' consumption + behavioral & environmental features
- Target: monthly kWh (scaled)

Training notes:
- Trained on normalized data and converted back using inverse scaling

---

### 3. Behavioral Clustering (K-Means)

Clustering uses features like appliance ownership/usage, `home_hours`, and `peak_ratio`.
- `StandardScaler` for preprocessing
- Clusters capture typical household energy behaviours

Cluster types (example):

| Cluster | Description |
|--------:|-------------|
| 0 | Energy Efficient |
| 1 | Moderate Usage |
| 2 | High Appliance Usage |
| 3 | Peak Heavy Users |

---

### 4. Hybrid Prediction System
Pipeline:
1. LSTM predicts base consumption
2. K-Means assigns behavioral cluster
3. Model output is calibrated and blended (metadata-driven)
4. Final prediction is used to estimate monthly bill and decomposed into daily/hourly views

---

## 🧾 Evaluation — Latest Results
These metrics were extracted from the model metadata and evaluation notebooks:

- MAE: 12.46 kWh
- RMSE: 20.48 kWh
- WMAPE: 12.08%
- R²: 0.8704

Calibration details:
- The deployed model uses a linear blend (alpha), scale and bias correction stored in `models/LSTM/calibration_meta.json` to reduce systematic error observed post-training.

Robustness:
- If model artifacts are missing, the backend falls back to a deterministic heuristic predictor so the API remains usable (`_fallback_predict_kwh` in `backend/src/predict.py`).

---

## 🛠️ Tech Stack

- Python 3.12, FastAPI, Uvicorn
- TensorFlow / Keras (LSTM)
- scikit-learn (K-Means, scalers)
- Pandas, NumPy
- React + Vite frontend, Recharts visualizations
- MongoDB for user/session/history
- Open‑Meteo (frontend) for weather lookup

---

## 🖥️ Frontend Panel

Location: `frontend/` — React + Vite. Key files:
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/services/api.js`
- `frontend/src/services/weather.js` (uses Open‑Meteo)

Features:
- Six-month forecast form with validated inputs
- Forecast, bill, and risk cards
- Recommendation and top-driver visualization
- What‑if simulator (`/predict/what-if`)

---

## 🚀 Local Development & Demo (examiner checklist)

1. Start MongoDB (example):

```bash
mongod --dbpath ~/mongo-data --bind_ip 127.0.0.1 --port 27017 &
```

2. Backend (FastAPI):

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python3.12 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

3. Frontend (Vite):

```bash
cd frontend
npm install
npm run dev
```

4. Open the Vite URL printed in the terminal (e.g. `http://127.0.0.1:5175`).

Demonstration flow:
- Register a test user via UI
- Run a forecast to create a `prediction_history` record
- Inspect saved records using MongoDB Compass or `mongosh`:

```bash
mongosh
use gridpulse
db.prediction_history.find().pretty()
```

---

## 🔌 API (selected endpoints)

### POST `/predict`
Accepts validated fields for history, weather, behavior and returns forecast, billing, cluster and recommendations.

Example (minimal) request body:

```json
{
	"prev1_kwh": 210.0,
	"prev2_kwh": 198.0,
	"prev3_kwh": 205.5,
	"month": 5,
	"district": "Colombo",
	"temp": 31.2,
	"humidity": 78.0,
	"rain": 0,
	"peak_ratio": 0.62,
	"family_size": 4,
	"has_ac": true
}
```

Response (truncated example):

```json
{
	"forecast": { "prediction_kwh": 245.31 },
	"billing": { "estimated_bill_lkr": 10935.5 },
	"behavior": { "cluster": 3, "category": "Peak Heavy" },
	"recommendations": ["Set AC to 24-26C and use timers during midday peaks."]
}
```

### GET `/model-info`
Returns model readiness, required artifacts and expected input fields.

### POST `/predict/what-if`
Compare baseline and scenario; response includes `baseline`, `scenario` and `delta` fields.

---

## 🧠 Key Insight
Combining time-series forecasting with behavioral clustering significantly improves electricity consumption prediction accuracy and produces interpretable recommendations.

---

## ⭐ Acknowledgment
Dataset: LIRNEasia Sri Lankan Electricity Consumption Dataset

---





