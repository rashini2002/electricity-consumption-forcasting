"""
recommendations.py — High-strength personalized recommendation engine.

Generates actionable recommendations based on:
- Predicted consumption patterns
- Household appliances & behaviors
- Cluster risk profile
- Potential savings opportunities
"""

import logging
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────
# Recommendation Models
# ──────────────────────────────────────────────────────────────────

class Recommendation(BaseModel):
    """Single actionable recommendation with priority and impact."""
    title: str = Field(..., description="Short recommendation title")
    description: str = Field(..., description="Detailed recommendation")
    category: str = Field(..., description="appliance, behavior, solar, efficiency, etc.")
    priority: str = Field(..., description="high, medium, low")
    estimated_savings_kwh: float = Field(default=0.0, ge=0, description="Monthly kWh savings")
    estimated_savings_lkr: float = Field(default=0.0, ge=0, description="Monthly LKR savings")
    implementation_difficulty: str = Field(default="medium", description="easy, medium, hard")
    payback_months: Optional[float] = Field(default=None, description="Months to recover cost")


class RecommendationResponse(BaseModel):
    """Comprehensive recommendation system output."""
    forecast_kwh: float
    forecast_bill_lkr: float
    cluster_risk_level: str = Field(description="low, medium, high based on cluster")
    total_potential_savings_kwh: float = Field(description="Sum of all recommendations")
    total_potential_savings_lkr: float = Field(description="Sum of all recommendations")
    recommendations: list[Recommendation] = Field(description="Ranked by priority & impact")
    consumption_breakdown: dict = Field(description="Estimated % by appliance category")
    key_drivers: list[str] = Field(description="Top 3-5 consumption drivers")


# ──────────────────────────────────────────────────────────────────
# Recommendation Engine
# ──────────────────────────────────────────────────────────────────

def generate_recommendations(
    forecast_kwh: float,
    behavior: dict,
    cluster_id: int = 0,
    baseline_kwh: float = 103.0,
) -> RecommendationResponse:
    """
    Generate high-strength personalized recommendations based on:
    - Consumption forecast vs. baseline
    - Household behavior & appliances
    - Cluster risk profile
    - Savings potential

    Args:
        forecast_kwh: Predicted monthly consumption (must be >= 0)
        behavior: Household behavior dict from InputData.behavior_values()
        cluster_id: K-Means cluster (0=efficient, 1=moderate, 2=high, 3=extreme)
        baseline_kwh: Reference consumption level (default: 103 kWh)

    Returns:
        RecommendationResponse with prioritized recommendations

    Raises:
        ValueError: If forecast_kwh is invalid or behavior dict is malformed
    """
    # ── Input validation ───────────────────────────────────────────
    if forecast_kwh < 0:
        raise ValueError(f"forecast_kwh must be non-negative, got {forecast_kwh}")
    if baseline_kwh <= 0:
        raise ValueError(f"baseline_kwh must be positive, got {baseline_kwh}")
    if not isinstance(behavior, dict):
        raise ValueError(f"behavior must be a dict, got {type(behavior)}")

    recs: list[Recommendation] = []
    drivers = []

    # ── Consumption thresholds ─────────────────────────────────────
    kwh_to_lkr = 0.25  # Simplified 2024 CEB rate
    is_high_consumption = forecast_kwh > baseline_kwh * 1.3
    is_extreme = forecast_kwh > baseline_kwh * 1.8

    # ── A/C System (typically 30-50% of consumption if used) ────────
    try:
        ac_unit = behavior.get("has_ac", 0)
        ac_hours = behavior.get("ac_hours_per_day", 0)
        ac_active = bool(ac_unit) and float(ac_hours) > 0
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid A/C data: {e}, skipping A/C recommendations")
        ac_active = False
        ac_hours = 0

    if ac_active:
        try:
            is_inverter = bool(behavior.get("inverter_ac", 0))
            ac_consumption = float(ac_hours) * (3.5 if is_inverter else 4.5)
            drivers.append(f"A/C: {ac_consumption:.1f} kWh/day")
        except (ValueError, TypeError) as e:
            logger.warning(f"Error calculating A/C consumption: {e}")

        if ac_hours > 8:
            recs.append(Recommendation(
                title="Optimize A/C Usage",
                description="Reduce A/C hours by 2-3 hours/day or use programmable thermostat (24-27°C).",
                category="appliance",
                priority="high",
                estimated_savings_kwh=6.0 if not behavior.get("inverter_ac", 0) else 3.0,
                estimated_savings_lkr=150 if not behavior.get("inverter_ac", 0) else 75,
                implementation_difficulty="easy",
            ))

        if not behavior.get("inverter_ac", 0) and behavior.get("has_ac", 0):
            recs.append(Recommendation(
                title="Upgrade to Inverter A/C",
                description="Replace non-inverter A/C with inverter model (40% more efficient).",
                category="appliance",
                priority="high" if is_extreme else "medium",
                estimated_savings_kwh=1.5 * ac_hours,
                estimated_savings_lkr=37.5 * ac_hours,
                implementation_difficulty="hard",
                payback_months=18.0,
            ))

    # ── Geyser / Water Heating ─────────────────────────────────────
    geyser = behavior.get("has_geyser", 0)
    solar_geyser = behavior.get("water_heater_solar", 0)

    if geyser:
        geyser_daily = 1.5 if not solar_geyser else 0.3
        drivers.append(f"Water heater: {geyser_daily:.1f} kWh/day")

        if not solar_geyser:
            recs.append(Recommendation(
                title="Install Solar Water Heater",
                description="Solar water heater saves 70-80% on heating (paired with backup electric).",
                category="solar",
                priority="high",
                estimated_savings_kwh=1.2,
                estimated_savings_lkr=30,
                implementation_difficulty="hard",
                payback_months=24.0,
            ))

    # ── Cooking ────────────────────────────────────────────────────
    electric_cooking = behavior.get("has_electric_cooking", 0)
    if electric_cooking:
        drivers.append("Electric cooking: 1.2-1.8 kWh/day")
        recs.append(Recommendation(
            title="Use LPG Instead of Electric Stove",
            description="Switch to LPG cooking saves 60% vs. electric stove.",
            category="behavior",
            priority="medium",
            estimated_savings_kwh=1.5,
            estimated_savings_lkr=37.5,
            implementation_difficulty="medium",
        ))

    # ── Lighting ───────────────────────────────────────────────────
    led_ratio = behavior.get("led_ratio", 0.0)
    if led_ratio < 0.7:
        recs.append(Recommendation(
            title="Upgrade to LED Bulbs",
            description=f"Replace remaining incandescent/CFL bulbs with LED (80% efficient).",
            category="efficiency",
            priority="medium",
            estimated_savings_kwh=0.5,
            estimated_savings_lkr=12.5,
            implementation_difficulty="easy",
        ))

    # ── Refrigerator ───────────────────────────────────────────────
    fridge = behavior.get("has_refrigerator", 0)
    if fridge:
        drivers.append("Refrigerator: 0.8-1.2 kWh/day")

    # ── Washing Machine ────────────────────────────────────────────
    washer = behavior.get("has_washing_machine", 0)
    if washer:
        drivers.append("Washing machine: 0.3-0.5 kWh/use")

    # ── Water Pump ─────────────────────────────────────────────────
    pump = behavior.get("has_water_pump", 0)
    if pump:
        drivers.append("Water pump: 0.5-1.0 kWh/day")

    # ── Solar Installation ─────────────────────────────────────────
    has_solar = behavior.get("has_solar", 0)
    if not has_solar and forecast_kwh > baseline_kwh:
        recs.append(Recommendation(
            title="Install Rooftop Solar PV",
            description="3-5 kW solar system reduces grid consumption 50-70% (with battery storage).",
            category="solar",
            priority="high" if is_extreme else "medium",
            estimated_savings_kwh=forecast_kwh * 0.6,
            estimated_savings_lkr=forecast_kwh * 0.6 * kwh_to_lkr,
            implementation_difficulty="hard",
            payback_months=48.0,
        ))

    # ── Behavior: Work From Home ───────────────────────────────────
    wfh_hours = behavior.get("avg_hours_wfh", 0)
    family_size = behavior.get("family_size", 1)

    if wfh_hours > 6 and not ac_active:
        recs.append(Recommendation(
            title="Use Fans Instead of A/C",
            description="Use ceiling/table fans (0.05-0.1 kWh/h) instead of A/C when temperature permits.",
            category="behavior",
            priority="low",
            estimated_savings_kwh=0.5,
            estimated_savings_lkr=12.5,
            implementation_difficulty="easy",
        ))

    # ── Peak vs. Off-Peak Optimization ─────────────────────────────
    peak_ratio = behavior.get("peak_ratio", 0.5)
    if peak_ratio > 0.6:
        recs.append(Recommendation(
            title="Shift Load to Off-Peak Hours",
            description="Run washing machine, water pump, charging at off-peak (10 PM - 6 AM) for 25% savings.",
            category="behavior",
            priority="medium",
            estimated_savings_kwh=forecast_kwh * 0.08,
            estimated_savings_lkr=forecast_kwh * 0.08 * kwh_to_lkr,
            implementation_difficulty="easy",
        ))

    # ── Standby Power ──────────────────────────────────────────────
    recs.append(Recommendation(
        title="Reduce Standby Power",
        description="Use power strips for entertainment/office equipment. Standby can be 5-10% of consumption.",
        category="efficiency",
        priority="low",
        estimated_savings_kwh=forecast_kwh * 0.05,
        estimated_savings_lkr=forecast_kwh * 0.05 * kwh_to_lkr,
        implementation_difficulty="easy",
    ))

    # ── Sort by priority (high → medium → low) and savings ─────────
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: (priority_order.get(r.priority, 3), -r.estimated_savings_kwh))
    
    logger.info(f"Generated {len(recs)} recommendations for forecast_kwh={forecast_kwh:.2f}")

    # ── Cluster risk assessment ────────────────────────────────────
    cluster_risk = "low"
    if is_extreme:
        cluster_risk = "high"
    elif is_high_consumption:
        cluster_risk = "medium"

    # ── Calculate totals ───────────────────────────────────────────
    total_savings_kwh = sum(r.estimated_savings_kwh for r in recs)
    total_savings_lkr = sum(r.estimated_savings_lkr for r in recs)

    # ── Top drivers ────────────────────────────────────────────────
    top_drivers = drivers[:5] if drivers else ["General consumption"]

    # ── Consumption breakdown ──────────────────────────────────────
    breakdown = {
        "AC": (35 if ac_active else 0),
        "Water_heating": (15 if geyser else 0),
        "Lighting": (12),
        "Refrigeration": (10 if fridge else 0),
        "Cooking": (15 if electric_cooking else 0),
        "Other": max(13 - (35 if ac_active else 0) - (15 if geyser else 0) - (15 if electric_cooking else 0), 0),
    }

    logger.info(f"Risk level: {cluster_risk}, Total savings: {total_savings_kwh:.2f} kWh, {total_savings_lkr:.2f} LKR")

    return RecommendationResponse(
        forecast_kwh=round(forecast_kwh, 2),
        forecast_bill_lkr=round(forecast_kwh * kwh_to_lkr, 2),
        cluster_risk_level=cluster_risk,
        total_potential_savings_kwh=round(total_savings_kwh, 2),
        total_potential_savings_lkr=round(total_savings_lkr, 2),
        recommendations=recs[:10],  # Top 10 recommendations
        consumption_breakdown=breakdown,
        key_drivers=top_drivers,
    )
