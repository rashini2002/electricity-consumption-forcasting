# ⚡ Electricity Consumption Forecasting & Behavioral Analysis (Sri Lanka)

## 📌 Project Overview
This project predicts **monthly household electricity consumption (kWh)** using a Hybrid Machine Learning approach combining:

- 📈 **LSTM (Long Short-Term Memory)** → Time-series forecasting  
- 🧠 **K-Means Clustering** → Behavioral segmentation  

The system not only forecasts future electricity usage but also **analyzes household behavior patterns** to generate smarter insights.

---

## 🎯 Objectives
- Predict next month electricity consumption (kWh)
- Identify household energy behavior patterns
- Improve prediction accuracy using hybrid modeling
- Provide insights for energy optimization

---

## 🧠 Methodology

### 1. Data Preprocessing
- Merged smart meter + survey + weather data
- Created time-series features (`prev1`, `prev2`, `prev3`)
- Applied cyclic encoding for seasonality:
  - `month_sin`, `month_cos`
- Cleaned missing and inconsistent values

---

### 2. LSTM Forecasting Model
- Input:
  - Previous 3 months consumption
  - Behavioral + environmental features
- Target:
  - `monthly_kwh` (scaled)

✔ Trained on normalized data (0–1 range)  
✔ Predictions converted back using inverse scaling  

---

### 3. Behavioral Clustering (K-Means)

Clustering based on key features:

- Appliance usage (AC, geyser, washing machine)
- Household activity (`home_hours`)
- Energy usage pattern (`peak_ratio`)

✔ StandardScaler used  
✔ Noise & invalid values handled  

---

### 📊 Clustering Result


### Cluster Types:
| Cluster | Description |
|--------|------------|
| 0 | Energy Efficient |
| 1 | Moderate Usage |
| 2 | High Appliance Usage |
| 3 | Peak Heavy Users |

---

### 4. Hybrid Prediction System

Final prediction pipeline:

1. LSTM predicts base consumption  
2. K-Means identifies behavior cluster  
3. Prediction adjusted using cluster factor  
4. Electricity bill estimated  

---

## 🛠️ Tech Stack

- Python
- TensorFlow / Keras
- Scikit-learn
- Pandas / NumPy
- Matplotlib
- Jupyter Notebook

---

## 🚀 Future Improvements

- Build FastAPI backend for model serving
- Develop React dashboard for user interaction
- Add real-time electricity insights
- Improve clustering using advanced methods (DBSCAN)

---

## 🖥️ Frontend Panel

A modern dashboard panel is available in the `frontend/` folder:

- `frontend/index.html`
- `frontend/main.jsx`
- `frontend/App.jsx`
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/services/api.js`

### Features

- Six-month forecast form with validated inputs
- Forecast + bill + risk cards
- Recommendation and top-driver visualization
- What-if simulator powered by `/predict/what-if`
- Auto model metadata fetch from `/model-info`

### Run Frontend Locally

1. Start backend API (FastAPI) on `http://127.0.0.1:8000`
2. Install and run the Vite frontend:

```bash
cd frontend
npm install
npm run dev
```

3. Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`

The panel has an editable API base URL at the top-right if your backend is hosted elsewhere.

---

## 🔌 API (FastAPI)

### POST `/predict`

The prediction API accepts named, validated fields. For migration safety, it also supports the legacy `prev_values` + `behavior_values` payload format.

Example request body:

```json
{
  "prev1_kwh": 210.0,
  "prev2_kwh": 198.0,
  "prev3_kwh": 205.5,
  "prev4_kwh": 192.4,
  "prev5_kwh": 188.1,
  "prev6_kwh": 176.8,
  "peak_ratio": 0.62,
  "month": 5,
  "family_size": 4,
  "has_refrigerator": true,
  "has_ac": true,
  "has_geyser": false,
  "has_electric_cooking": true,
  "has_washing_machine": true,
  "has_water_pump": false,
  "home_hours": 13.5,
  "temp": 31.2,
  "humidity": 78.0,
  "rain": 42.0,
  "district": "Colombo"
}
```

Example response body:

```json
{
  "forecast": {
    "prediction_kwh": 245.31,
    "confidence_interval": {
      "level": "approx_95pct",
      "uncertainty_pct": 16.0,
      "lower_kwh": 206.06,
      "upper_kwh": 284.56
    }
  },
  "billing": {
    "estimated_bill_lkr": 10935.5,
    "energy_charge_lkr": 8935.5,
    "fixed_charge_lkr": 2000.0,
    "slab_breakdown": [],
    "note": "Indicative estimate. Utility tariff revisions and taxes are not included."
  },
  "behavior": {
    "cluster": 3,
    "category": "Peak Heavy"
  },
  "insights": {
    "temporal": {
      "mean_3m_kwh": 204.5,
      "std_3m_kwh": 4.69,
      "trend_3m_kwh": -4.5,
      "last_change_kwh": 7.5,
      "volatility_cv_3m": 0.0229
    },
    "risk": {
      "score": 58.0,
      "level": "medium"
    },
    "seasonality_input_health": {
      "radius": 0.9944,
      "is_valid": true,
      "tolerance": 0.12
    }
  },
  "recommendations": [
    "Set AC to 24-26C and use timers during midday peaks."
  ],
  "explanation": {
    "method": "heuristic_feature_scoring",
    "top_factors": [],
    "summary": "Top factors estimate which behaviors most influenced the forecast."
  }
}
```

### GET `/model-info`

Returns model serving metadata (model types, artifacts, required fields, compatibility flags).

### POST `/predict/what-if`

Compares baseline forecast against a modified scenario.

Example request body:

```json
{
  "base": {
    "prev1_kwh": 210.0,
    "prev2_kwh": 198.0,
    "prev3_kwh": 205.5,
    "peak_ratio": 0.62,
    "family_size": 4,
    "has_refrigerator": true,
    "has_ac": true,
    "has_geyser": false,
    "has_electric_cooking": true,
    "has_washing_machine": true,
    "has_water_pump": false,
    "home_hours": 13.5,
    "temp": 31.2,
    "humidity": 78.0,
    "rain": 42.0,
    "month_sin": 0.5,
    "month_cos": 0.86,
    "district": "Colombo"
  },
  "overrides": {
    "has_ac": false,
    "peak_ratio": 0.48
  }
}
```

The response includes `baseline`, `scenario`, and `delta` (`kwh_change`, `bill_lkr_change`).

---

## 🧠 Key Insight

This project demonstrates that:

> Combining time-series forecasting with behavioral clustering significantly improves electricity consumption prediction accuracy.

## ⭐ Acknowledgment
Dataset: LIRNEasia Sri Lankan Electricity Consumption Dataset
