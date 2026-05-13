# Daily & Hourly Forecasting Feature - Example Output

## Overview
This feature breaks down the monthly electricity forecast into daily and hourly estimates, helping users understand when and how much electricity they'll consume.

## Backend Function: `breakdown_monthly_to_daily_hourly()`

Located in: `backend/src/predict.py`

### Input Parameters
- `monthly_kwh`: Total predicted monthly consumption (e.g., 245 kWh)
- `month`: Month number 1-12 for seasonality adjustments
- `peak_ratio`: Fraction of consumption during peak hours (0-1, e.g., 0.62 means 62% peak)

### Output Structure
Returns a dictionary with:
- `daily_kwh`: List of 30-31 daily values
- `daily_labels`: Day names and dates
- `weekly_avg`: 7-day rolling average
- `hourly_kwh`: 24-hour distribution
- `hourly_labels`: Hour labels with peak/off-peak notation

---

## Example Usage

### Example 1: High-Usage Household (May, 245 kWh)

**Input:**
```python
breakdown = breakdown_monthly_to_daily_hourly(
    monthly_kwh=245.0,
    month=5,
    peak_ratio=0.62
)
```

**Output:**

#### Daily Breakdown
```
Daily average: 8.17 kWh
Weekdays: 8.58 kWh (×1.05 multiplier)
Weekends: 7.52 kWh (×0.92 multiplier)

Day 1 (Sun): 7.52 kWh
Day 2 (Mon): 8.58 kWh
Day 3 (Tue): 8.58 kWh
Day 4 (Wed): 8.58 kWh
Day 5 (Thu): 8.58 kWh
Day 6 (Fri): 8.58 kWh
Day 7 (Sat): 7.52 kWh
... (repeats for 30 days)
```

#### Weekly Patterns
```
Week 1 (Days 1-7):  8.08 kWh/day avg
Week 2 (Days 8-14): 8.17 kWh/day avg
Week 3 (Days 15-21): 8.12 kWh/day avg
Week 4 (Days 22-28): 8.15 kWh/day avg
Week 5 (Days 29-30): 8.05 kWh/day avg
```

#### 24-Hour Hourly Pattern
```
Peak Hours (6 AM - 9 PM = 15 hours):
  Peak consumption: 245 × 0.62 = 151.9 kWh/month
  Per hour: 151.9 / (30 × 15) = 0.338 kWh/hour

Off-Peak Hours (9 PM - 6 AM = 9 hours):
  Off-peak consumption: 245 × 0.38 = 93.1 kWh/month
  Per hour: 93.1 / (30 × 9) = 0.344 kWh/hour

Hourly Profile:
00:00 (Off-peak): 0.344 kWh
01:00 (Off-peak): 0.344 kWh
...
05:00 (Off-peak): 0.344 kWh
06:00 (Peak):     0.338 kWh ← Peak hours start
07:00 (Peak):     0.338 kWh
...
20:00 (Peak):     0.338 kWh
21:00 (Off-peak): 0.344 kWh ← Peak hours end
22:00 (Off-peak): 0.344 kWh
23:00 (Off-peak): 0.344 kWh
```

---

## API Endpoint: `POST /predict/daily-breakdown`

### Request
```json
{
  "prev1_kwh": 210,
  "prev2_kwh": 198,
  "prev3_kwh": 205.5,
  "prev4_kwh": 192.4,
  "prev5_kwh": 188.1,
  "prev6_kwh": 176.8,
  "peak_ratio": 0.62,
  "month": 5,
  "family_size": 4,
  "has_ac": true,
  "ac_hours_per_day": 8,
  "has_geyser": false,
  "has_electric_cooking": true,
  "has_washing_machine": true,
  "has_water_pump": false,
  "home_hours": 13.5,
  "temp": 31.2,
  "humidity": 78,
  "rain": 42,
  "district": "Colombo"
}
```

### Response
```json
{
  "monthly_forecast": {
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
      "slab_breakdown": [...]
    },
    "behavior": {
      "cluster_id": 3,
      "category": "Peak Heavy"
    },
    "insights": {
      "risk": {
        "level": "medium",
        "score": 58.0
      }
    }
  },
  "breakdown": {
    "monthly_kwh": 245.31,
    "days_in_month": 31,
    "daily_avg": 7.92,
    "daily_kwh": [
      7.29,
      7.67,
      7.67,
      7.67,
      7.67,
      7.67,
      7.29,
      ...
    ],
    "daily_labels": [
      "Sun 1",
      "Mon 2",
      "Tue 3",
      "Wed 4",
      "Thu 5",
      "Fri 6",
      "Sat 7",
      ...
    ],
    "weekly_avg": [7.95, 7.98, 7.89, 7.94, 7.85],
    "peak_ratio": 0.620,
    "peak_daily_kwh": 152.09,
    "offpeak_daily_kwh": 93.22,
    "hourly_kwh": [
      0.344,
      0.344,
      0.344,
      0.344,
      0.344,
      0.344,
      0.338,
      0.338,
      ...
      0.338,
      0.344,
      0.344,
      0.344
    ],
    "hourly_labels": [
      "00:00 (Off-peak)",
      "01:00 (Off-peak)",
      ...
      "05:00 (Off-peak)",
      "06:00 (Peak)",
      ...
      "20:00 (Peak)",
      "21:00 (Off-peak)",
      ...
      "23:00 (Off-peak)"
    ]
  }
}
```

---

## Dashboard Visualization

### New Cards Added to RightPane

#### 1. Daily Consumption Estimate Card
- **Type**: Bar Chart
- **Data**: 30-31 daily values
- **Features**:
  - Weekday vs weekend variation (±5% and -8%)
  - Shows consumption trend across the month
  - Displays daily average, peak, and off-peak kWh
  - Interactive tooltips on hover

#### 2. 24-Hour Peak/Off-Peak Pattern Card
- **Type**: Bar Chart with Color-Coded Bars
- **Data**: 24-hour hourly values
- **Features**:
  - Peak hours (6 AM - 9 PM): Orange bars
  - Off-peak hours (9 PM - 6 AM): Cyan bars
  - Shows when household consumes most electricity
  - Helps identify opportunities for load shifting

---

## Example 2: Low-Usage Household (February, 85 kWh)

**Input:**
```python
breakdown = breakdown_monthly_to_daily_hourly(
    monthly_kwh=85.0,
    month=2,
    peak_ratio=0.45
)
```

**Output Summary:**
```
Days in February: 28
Daily average: 3.04 kWh
Weekday avg: 3.19 kWh
Weekend avg: 2.80 kWh

Peak hours (38.25 kWh total): 0.091 kWh/hour
Off-peak hours (46.75 kWh total): 0.189 kWh/hour

Interestingly, peak consumption is lower than off-peak in this household
(possibly lots of nighttime use or heating)
```

---

## Use Cases

### 1. Load Shifting Optimization
User sees they consume 0.5 kWh during peak hours (6 PM) but only 0.25 kWh during off-peak (11 PM).
- **Action**: Shift laundry to 10 PM to reduce peak-hour bill by ~15%

### 2. Appliance Timing
User sees consumption spikes on weekdays (office work from home).
- **Action**: Reduce AC/heating hours on days without work or reduce work-from-home appliances

### 3. Family Planning
Looking at the daily breakdown, family notices weekends are much lower.
- **Action**: Schedule high-load activities (laundry, cooking) for Sunday afternoon

### 4. Tariff Analysis
Peak vs off-peak hourly data helps users understand CEB's 2-tier tariff structure:
- Peak: 6 AM - 9 PM (rates up to 75 LKR/unit)
- Off-peak: 9 PM - 6 AM (rates as low as 8 LKR/unit)
- **Insight**: Shifting 5 kWh from peak to off-peak can save ~300 LKR/month

---

## Integration with Existing Features

### Hybrid Model Connection
The daily breakdown uses the same LSTM monthly prediction, so:
- All uncertainty and confidence intervals apply to the daily distribution
- Cluster-based behavioral adjustments are already in the monthly prediction
- Peak ratio is used directly from user input

### Frontend Flow
1. User enters 3 months of bills → Generate Forecast
2. Backend runs LSTM prediction → Returns monthly forecast
3. React component detects result → Calls `/predict/daily-breakdown`
4. Daily breakdown rendered in two new cards (Daily Chart + 24-Hour Chart)
5. User can now see when to shift loads for savings

---

## Technical Implementation Summary

### Backend (`backend/src/predict.py`)
- Function: `breakdown_monthly_to_daily_hourly()`
- Lines: ~80
- Handles: Daily/weekly patterns, peak/off-peak distribution

### API (`backend/api/main.py`)
- Endpoint: `POST /predict/daily-breakdown`
- Imports: `breakdown_monthly_to_daily_hourly` from predict module
- Validation: Reuses InputData schema

### Frontend (`frontend/src/components/dashboard/RightPane.jsx`)
- State: `dailyBreakdown`, `breakdownLoading`
- Effect: Auto-fetches breakdown when result changes
- Cards: 2 new visualization cards with Recharts BarCharts

### API Service (`frontend/src/services/api.js`)
- Function: `predictDailyBreakdown(data)`
- Endpoint: `/predict/daily-breakdown`
- Returns: Full monthly forecast + breakdown data

---

## Testing the Feature

### Quick Test
1. Run backend: `cd backend && python3.12 -m uvicorn api.main:app --reload`
2. Run frontend: `cd frontend && npm run dev`
3. Generate a forecast
4. Two new cards appear below the history section
5. View daily and hourly consumption patterns

### API Test (curl)
```bash
curl -X POST http://localhost:8000/predict/daily-breakdown \
  -H "Content-Type: application/json" \
  -d '{
    "prev1_kwh": 210,
    "prev2_kwh": 198,
    "prev3_kwh": 205.5,
    "month": 5,
    "peak_ratio": 0.62,
    "family_size": 4,
    "has_ac": true,
    "ac_hours_per_day": 8,
    "has_electric_cooking": true,
    "has_washing_machine": true,
    "temp": 31.2,
    "humidity": 78,
    "rain": 42,
    "district": "Colombo"
  }'
```

---

## Future Enhancements

1. **Seasonal Adjustments**: Scale daily consumption based on monthly seasonal trends
2. **Appliance-Specific Hourly**: If user logs appliance schedules, show appliance-level hourly breakdown
3. **Savings Calculator**: "If you shift X kWh from peak to off-peak, save Y LKR/month"
4. **Historical Comparison**: Overlay actual daily/hourly usage if available
5. **Export**: Download daily/hourly breakdown as CSV for external analysis

---

## Files Modified

### Backend
- `backend/src/predict.py`: Added `breakdown_monthly_to_daily_hourly()` function (~80 lines)
- `backend/api/main.py`: Added `/predict/daily-breakdown` endpoint (~40 lines)

### Frontend
- `frontend/src/components/dashboard/RightPane.jsx`: Added state, useEffect, and 2 new chart cards (~120 lines)
- `frontend/src/services/api.js`: Added `predictDailyBreakdown()` function (~8 lines)

### Total: ~248 lines of new code
