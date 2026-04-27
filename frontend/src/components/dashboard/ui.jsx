export function Spinner() {
  return <span className="spinner" />;
}

export function ChipToggle({ id, label, icon, checked, onChange }) {
  return (
    <div
      className={`chip-toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(id, !checked)}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => e.key === " " && onChange(id, !checked)}
    >
      {icon && <span>{icon}</span>}
      <input type="checkbox" checked={checked} onChange={() => {}} style={{ pointerEvents: "none" }} />
      <span>{label}</span>
    </div>
  );
}

export function InlineField({ label, sub, children }) {
  return (
    <div className="inline-field">
      <div>
        <div className="inline-label">{label}</div>
        {sub && <div className="inline-sub">{sub}</div>}
      </div>
      <div className="inline-input">{children}</div>
    </div>
  );
}

export function ChartTip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0A0F0D",
        border: "1px solid #2A3428",
        borderRadius: 8,
        padding: "8px 12px",
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "#E0E8DC",
      }}
    >
      <div style={{ color: "#4A6047", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#7DC42B" }}>
          {p.name}: {p.value != null ? `${Number(p.value).toFixed(1)} ${unit}` : "—"}
        </div>
      ))}
    </div>
  );
}
