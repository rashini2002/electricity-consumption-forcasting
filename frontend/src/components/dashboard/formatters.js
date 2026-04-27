export function fmtLKR(value) {
  return `LKR ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

export function fmtK(value, unit = "kWh") {
  return `${Number(value || 0).toFixed(1)} ${unit}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
