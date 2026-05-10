import { MONTH_NAMES, SL_DISTRICTS } from "./constants";
import { Spinner, ChipToggle, InlineField } from "./ui";
import {
  Snowflake,
  ShowerHead,
  UtensilsCrossed,
  Shirt,
  Droplets,
  Wind,
  Zap,
  Plug,
  Laptop,
  Sun,
  Thermometer,
} from "lucide-react";

export default function LeftPane({
  openStep,
  setOpenStep,
  kwh,
  setKwh,
  kwhReady,
  peakRatio,
  peakColor,
  wxReady,
  weatherLoading,
  weatherErr,
  weather,
  month,
  setMonth,
  district,
  setDistrict,
  behavior,
  setB,
  ledRatio,
  handleSubmit,
  loading,
}) {
  function stepStatus(n) {
    if (n === 1) return kwhReady ? "done" : (openStep === 1 ? "active" : "");
    if (n === 2) return wxReady ? "done" : (openStep === 2 ? "active" : "");
    if (n === 3) return openStep === 3 ? "active" : "";
    return "";
  }

  const iconProps = { size: 14, strokeWidth: 2 };

  return (
    <aside className="left-pane pane">
      <div className="step-panel">
        <div className="step-header" onClick={() => setOpenStep(openStep === 1 ? 0 : 1)}>
          <div className={`step-num ${stepStatus(1) || ""}`}>{kwhReady ? "✓" : "1"}</div>
          <div className={`step-title ${openStep === 1 ? "active" : ""}`}>Monthly Consumption History</div>
          <div className={`step-badge ${kwhReady ? "ok" : ""}`}>{kwhReady ? "Ready" : "Required"}</div>
        </div>

        <div className={`step-content ${openStep === 1 ? "open" : ""}`}>
          <p className="hint" style={{ marginBottom: 12 }}>
            Enter kWh from your last 3 electricity bills. Older months are estimated automatically for the model.
          </p>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            {[
              ["p3", "3 Months Ago"],
              ["p2", "2 Months Ago"],
              ["p1", "Last Month"],
            ].map(([k, lbl]) => (
              <div className="field" key={k}>
                <div className="label">{lbl}</div>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="kWh"
                  value={kwh[k]}
                  onChange={(e) => setKwh((p) => ({ ...p, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {kwhReady && (
            <div className="peak-display">
              <div className="peak-row">
                <div className="peak-label">Calculated Peak Ratio</div>
                <div className="peak-value" style={{ color: peakColor }}>{peakRatio}</div>
              </div>
              <div className="peak-track">
                <div
                  className="peak-fill"
                  style={{ width: `${peakRatio * 100}%`, background: `linear-gradient(90deg,var(--lime),${peakColor})` }}
                />
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                {peakRatio > 0.65
                  ? "⚠ High peak-hour usage detected (6–9 PM)"
                  : peakRatio < 0.45
                    ? "✓ Low peak-hour usage — good energy habits"
                    : "Moderate peak-hour usage"}
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                The older 3 months are inferred from the recent trend so you only need to remember the last 3 bills.
              </div>
            </div>
          )}

          <button className="ghost-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => setOpenStep(2)} disabled={!kwhReady}>
            Continue to Date & Weather →
          </button>
        </div>
      </div>

      <div className="step-panel">
        <div className="step-header" onClick={() => setOpenStep(openStep === 2 ? 0 : 2)}>
          <div className={`step-num ${stepStatus(2) || ""}`}>{wxReady ? "✓" : "2"}</div>
          <div className={`step-title ${openStep === 2 ? "active" : ""}`}>Target Month & Location</div>
          <div className={`step-badge ${wxReady ? "ok" : ""}`}>{weatherLoading ? "Fetching…" : wxReady ? "Weather loaded" : "Required"}</div>
        </div>

        <div className={`step-content ${openStep === 2 ? "open" : ""}`}>
          <p className="hint" style={{ marginBottom: 12 }}>
            Select the month you want to forecast and your district. Weather data is fetched automatically.
          </p>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <div className="label">Predict Month</div>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="label">District</div>
              <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                {SL_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {weatherErr && <div className="hint" style={{ color: "var(--amber)", marginBottom: 8 }}>⚠ {weatherErr}</div>}

          {weatherLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>
              <Spinner /> Fetching live weather for {district}…
            </div>
          )}

          {weather && !weatherLoading && (
            <div className="weather-row">
              <div className="weather-item"><div className="weather-val">{weather.temp}°C</div><div className="weather-lbl">Temperature</div></div>
              <div className="weather-item"><div className="weather-val">{weather.humidity}%</div><div className="weather-lbl">Humidity</div></div>
              <div className="weather-item"><div className="weather-val">{weather.rain} mm</div><div className="weather-lbl">Rainfall</div></div>
            </div>
          )}

          <button className="ghost-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => setOpenStep(3)} disabled={!wxReady}>
            Continue to Behaviour →
          </button>
        </div>
      </div>

      <div className="step-panel">
        <div className="step-header" onClick={() => setOpenStep(openStep === 3 ? 0 : 3)}>
          <div className={`step-num ${openStep === 3 ? "active" : ""}`}>3</div>
          <div className={`step-title ${openStep === 3 ? "active" : ""}`}>Household Behaviour</div>
          <div className="step-badge">Optional details improve accuracy</div>
        </div>

        <div className={`step-content ${openStep === 3 ? "open" : ""}`}>
          <div className="label" style={{ marginBottom: 6 }}>Household Size</div>
          <InlineField label="Family members" sub="Adults + children">
            <input
              type="number"
              min={1}
              max={20}
              value={behavior.family_size}
              onChange={(e) => setB("family_size", Number(e.target.value))}
              style={{ width: 70, textAlign: "right" }}
            />
          </InlineField>

          <div className="label" style={{ margin: "12px 0 6px" }}>Appliances Owned</div>
          <div className="chip-grid">
            {[
              { id: "has_refrigerator", label: "Fridge", icon: <Snowflake {...iconProps} /> },
              { id: "has_geyser", label: "Geyser", icon: <ShowerHead {...iconProps} /> },
              { id: "has_electric_cooking", label: "Elec. Cooker", icon: <UtensilsCrossed {...iconProps} /> },
              { id: "has_washing_machine", label: "Washing Machine", icon: <Shirt {...iconProps} /> },
              { id: "has_water_pump", label: "Water Pump", icon: <Droplets {...iconProps} /> },
            ].map((a) => (
              <ChipToggle key={a.id} id={a.id} label={a.label} icon={a.icon} checked={!!behavior[a.id]} onChange={setB} />
            ))}
          </div>

          <div className="label" style={{ margin: "12px 0 6px" }}>Air Conditioning</div>
          <ChipToggle id="has_ac" label="Has Air Conditioner" icon={<Wind {...iconProps} />} checked={!!behavior.has_ac} onChange={setB} />

          {behavior.has_ac && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r2)", padding: "10px 12px", marginTop: 8 }}>
              <div className="label" style={{ marginBottom: 8 }}>AC Type</div>
              <div className="chip-grid" style={{ marginBottom: 10 }}>
                <ChipToggle
                  id="inverter_ac"
                  label="Inverter AC"
                  icon={<Zap {...iconProps} />}
                  checked={!!behavior.inverter_ac}
                  onChange={(k, v) => {
                    setB(k, v);
                    if (v) setB("non_inverter_ac", false);
                  }}
                />
                <ChipToggle
                  id="non_inverter_ac"
                  label="Non-Inverter AC"
                  icon={<Plug {...iconProps} />}
                  checked={!!behavior.non_inverter_ac}
                  onChange={(k, v) => {
                    setB(k, v);
                    if (v) setB("inverter_ac", false);
                  }}
                />
              </div>
              <InlineField label="Average hours AC runs per day" sub="Estimate for target month">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={behavior.ac_hours_per_day}
                  onChange={(e) => setB("ac_hours_per_day", Number(e.target.value))}
                  style={{ width: 70, textAlign: "right" }}
                />
              </InlineField>
            </div>
          )}

          <div className="label" style={{ margin: "12px 0 6px" }}>Work From Home</div>
          <ChipToggle id="work_from_home" label="Household members work from home" icon={<Laptop {...iconProps} />} checked={!!behavior.work_from_home} onChange={setB} />

          {behavior.work_from_home && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r2)", padding: "10px 12px", marginTop: 8 }}>
              <InlineField label="Members who work from home">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={behavior.no_members_wfh}
                  onChange={(e) => setB("no_members_wfh", Number(e.target.value))}
                  style={{ width: 70, textAlign: "right" }}
                />
              </InlineField>
              <InlineField label="Average WFH hours per day">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={behavior.avg_hours_wfh}
                  onChange={(e) => setB("avg_hours_wfh", Number(e.target.value))}
                  style={{ width: 70, textAlign: "right" }}
                />
              </InlineField>
            </div>
          )}

          <div className="label" style={{ margin: "12px 0 6px" }}>Solar Energy</div>
          <ChipToggle id="has_solar" label="Solar panels installed" icon={<Sun {...iconProps} />} checked={!!behavior.has_solar} onChange={setB} />
          {behavior.has_solar && (
            <div style={{ marginTop: 6 }}>
              <ChipToggle id="water_heater_solar" label="Solar water heater" icon={<Thermometer {...iconProps} />} checked={!!behavior.water_heater_solar} onChange={setB} />
            </div>
          )}

          <div className="label" style={{ margin: "12px 0 6px" }}>Lighting</div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r2)", padding: "10px 12px" }}>
            <InlineField label="Number of LED bulbs" sub="Energy-saving bulbs">
              <input
                type="number"
                min={0}
                max={100}
                value={behavior.led_bulbs}
                onChange={(e) => setB("led_bulbs", Number(e.target.value))}
                style={{ width: 70, textAlign: "right" }}
              />
            </InlineField>
            <InlineField label="Total bulbs in home" sub="All types combined">
              <input
                type="number"
                min={1}
                max={200}
                value={behavior.total_bulbs}
                onChange={(e) => setB("total_bulbs", Number(e.target.value))}
                style={{ width: 70, textAlign: "right" }}
              />
            </InlineField>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="hint">LED ratio (auto-calculated)</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--lime)" }}>
                {(ledRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="peak-track" style={{ marginTop: 6 }}>
              <div className="peak-fill" style={{ width: `${ledRatio * 100}%`, background: "var(--lime)" }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <button className="predict-btn" onClick={handleSubmit} disabled={loading || !kwhReady}>
          {loading ? <><Spinner />Running LSTM Forecast…</> : <><Zap size={15} strokeWidth={2} /> Generate Forecast for {MONTH_NAMES[month - 1]}</>}
        </button>
      </div>
    </aside>
  );
}
