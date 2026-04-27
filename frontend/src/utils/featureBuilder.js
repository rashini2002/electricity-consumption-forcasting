export function calcPeakRatio(prev1, prev2, prev3) {
  const mean = ((Number(prev1) || 0) + (Number(prev2) || 0) + (Number(prev3) || 0)) / 3;
  if (mean <= 0) return 0.5;

  const base = 0.45 + (mean / 600) * 0.25;
  return Math.min(0.85, Math.max(0.35, Number(base.toFixed(2))));
}

export function calcLedRatio(ledCount, totalCount) {
  const led = Number(ledCount) || 0;
  const total = Math.max(Number(totalCount) || 1, 1);
  return Number((led / total).toFixed(2));
}

export function buildDashboardPayload({ kwh, month, district, weather, behavior, peakRatio, ledRatio }) {
  const month_sin = Math.sin((2 * Math.PI * month) / 12);
  const month_cos = Math.cos((2 * Math.PI * month) / 12);

  return {
    prev1_kwh: Number(kwh.p1),
    prev2_kwh: Number(kwh.p2),
    prev3_kwh: Number(kwh.p3),
    peak_ratio: peakRatio,
    month_sin,
    month_cos,
    temp: weather?.temp ?? 29,
    humidity: weather?.humidity ?? 75,
    rain: weather?.rain ?? 0,
    district,
    family_size: behavior.family_size,
    has_refrigerator: behavior.has_refrigerator ? 1 : 0,
    has_ac: behavior.has_ac ? 1 : 0,
    has_geyser: behavior.has_geyser ? 1 : 0,
    has_electric_cooking: behavior.has_electric_cooking ? 1 : 0,
    has_washing_machine: behavior.has_washing_machine ? 1 : 0,
    has_water_pump: behavior.has_water_pump ? 1 : 0,
    inverter_ac: behavior.inverter_ac ? 1 : 0,
    non_inverter_ac: behavior.non_inverter_ac ? 1 : 0,
    ac_hours_per_day: behavior.ac_hours_per_day,
    work_from_home: behavior.work_from_home ? 1 : 0,
    no_members_wfh: behavior.no_members_wfh,
    avg_hours_wfh: behavior.avg_hours_wfh,
    has_solar: behavior.has_solar ? 1 : 0,
    water_heater_solar: behavior.water_heater_solar ? 1 : 0,
    led_ratio: ledRatio,
    home_hours: behavior.avg_hours_wfh > 0 ? 8 + behavior.avg_hours_wfh : 8,
  };
}

export function normalizeWhatIfOverrides(overrides) {
  return {
    ...overrides,
    has_solar: overrides.has_solar ? true : undefined,
    inverter_ac: overrides.inverter_ac ? true : undefined,
    work_from_home: overrides.work_from_home ? true : undefined,
  };
}