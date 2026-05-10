import {
  LineChart,
  Line,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import { MONTH_NAMES, CLUSTER_STYLE, RISK_COLOR, TIPS_ICONS } from "./constants";
import { fmtLKR, fmtK, clamp } from "./formatters";
import { Spinner, ChipToggle, ChartTip } from "./ui";
import { expandHistoryToSixMonths } from "../../utils/featureBuilder";

export default function RightPane({
  result,
  month,
  kwh,
  history6,
  behavior,
  district,
  weather,
  peakRatio,
  ledRatio,
  overrides,
  setOverrides,
  delta,
  deltaLoading,
  handleWhatIf,
}) {
  const forecast = result?.forecast || {};
  const billing = result?.billing || {};
  const behaviorRes = result?.behavior || {};
  const insights = result?.insights || {};
  const risk = insights.risk || {};
  const ci = forecast.confidence_interval || {};
  const slabs = billing.slab_breakdown || [];
  const recs = result?.recommendations || [];
  const factors = result?.explanation?.top_factors || [];
  const cluster = behaviorRes.category || "";
  const clusterStyle = CLUSTER_STYLE[cluster] || CLUSTER_STYLE.Moderate;
  const sixMonthHistory = history6 || expandHistoryToSixMonths(kwh);

  const histData = result
    ? [
        { name: "6 Mo Ago (est.)", kwh: Number(sixMonthHistory.p6) || 0 },
        { name: "5 Mo Ago (est.)", kwh: Number(sixMonthHistory.p5) || 0 },
        { name: "4 Mo Ago (est.)", kwh: Number(sixMonthHistory.p4) || 0 },
        { name: "3 Mo Ago", kwh: Number(kwh.p3) || 0 },
        { name: "2 Mo Ago", kwh: Number(kwh.p2) || 0 },
        { name: "Last Mo", kwh: Number(kwh.p1) || 0 },
        { name: "Predicted", pred: forecast.prediction_kwh },
      ]
    : [];

  const peakData = [
    { name: "Peak Usage", value: peakRatio * 100 },
    { name: "Off-Peak", value: (1 - peakRatio) * 100 },
  ];

  const applianceInsightRaw = [
    { name: "Cooling", value: behavior.has_ac ? Math.max(Number(behavior.ac_hours_per_day || 0) * 1.4, 1) : 0, color: "#1DB8A0" },
    { name: "Hot Water", value: behavior.has_geyser ? 2.2 : 0, color: "#E8A020" },
    { name: "Cooking", value: behavior.has_electric_cooking ? 2.6 : 0, color: "#D44040" },
    { name: "Laundry", value: behavior.has_washing_machine ? 1.4 : 0, color: "#7DC42B" },
    { name: "Water Pump", value: behavior.has_water_pump ? 1.8 : 0, color: "#7A8CFF" },
    { name: "WFH Load", value: behavior.work_from_home ? Math.max(Number(behavior.avg_hours_wfh || 0) * 0.45, 1) : 0, color: "#C15DD8" },
    { name: "Lighting", value: Math.max((1 - ledRatio) * 2.5, 0.6), color: "#06b6d4" },
  ];

  const applianceInsightData = applianceInsightRaw.filter((d) => d.value > 0.01);

  const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"]; 
  const billBreakdownPie = slabs.map((s, i) => ({
    name: s.slab,
    value: Number(s.charge_lkr || 0),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <section className="right-pane pane" style={{ paddingBottom: 52 }}>
      {!result ? (
        <div className="empty">
          <div className="empty-graphic">⚡</div>
          <h3>No forecast generated yet</h3>
          <p>
            Complete the 3 steps on the left — enter your last 3 months of kWh,
            select your target month and district, add household details, then click
            Generate Forecast.
          </p>
        </div>
      ) : (
        <>
          <div className="metrics fade">
            <div className="metric">
              <div className="metric-eyebrow">Predicted Usage — {MONTH_NAMES[month - 1]}</div>
              <div className="metric-val lime">{fmtK(forecast.prediction_kwh)}</div>
              <div className="metric-sub">
                CI: {ci.lower_kwh?.toFixed(1)} – {ci.upper_kwh?.toFixed(1)} kWh
              </div>
            </div>
            <div className="metric">
              <div className="metric-eyebrow">Estimated Electricity Bill</div>
              <div className="metric-val">{fmtLKR(billing.estimated_bill_lkr)}</div>
              <div className="metric-sub" style={{ marginTop: 8 }}>
                {cluster && (
                  <span className="cluster-badge" style={{ background: clusterStyle.bg, color: clusterStyle.color }}>
                    <span className="cluster-dot" style={{ background: clusterStyle.color }} />
                    {cluster}
                  </span>
                )}
              </div>
            </div>
            <div className="metric">
              <div className="metric-eyebrow">Consumption Risk</div>
              <div className="metric-val" style={{ color: RISK_COLOR[risk.level?.toLowerCase()] || "var(--amber)" }}>
                {risk.level || "—"}
              </div>
              <div className="risk-track">
                <div
                  className="risk-fill"
                  style={{
                    width: `${clamp(risk.score, 0, 100)}%`,
                    background: RISK_COLOR[risk.level?.toLowerCase()] || "var(--amber)",
                    boxShadow: `0 0 8px ${RISK_COLOR[risk.level?.toLowerCase()] || "var(--amber)"}`,
                  }}
                />
              </div>
              <div className="metric-sub" style={{ marginTop: 6 }}>Score: {risk.score?.toFixed(1) || "—"} / 100</div>
            </div>
          </div>

          <div className="two-col fade">
            <div className="card">
              <div className="card-head">
                <div className="card-title">Prediction Chart</div>
                <div className="card-note">Line + forecast point, older months inferred</div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={histData} margin={{ left: -16, right: 10, top: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--text-sub)" }} stroke="none" />
                    <YAxis fontSize={11} tick={{ fill: "var(--text-sub)" }} stroke="none" unit=" kWh" />
                    <Tooltip content={<ChartTip unit="kWh" />} />
                    <ReferenceLine y={forecast.prediction_kwh} stroke="rgba(125,196,43,.3)" strokeDasharray="4 3" />
                    <Area type="monotone" dataKey="kwh" stroke="none" fill="url(#colorKwh)" />
                    <Line
                      type="monotone"
                      dataKey="kwh"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                      connectNulls={false}
                      name="Actual"
                    />
                    <Line
                      type="monotone"
                      dataKey="pred"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                      name="Predicted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">Peak Ratio Chart</div>
                <div className="card-note">Peak vs off-peak load share</div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakData} margin={{ left: -16, right: 10, top: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPeak" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--text-sub)" }} stroke="none" />
                    <YAxis fontSize={11} tick={{ fill: "var(--text-sub)" }} stroke="none" unit="%" domain={[0, 100]} />
                    <Tooltip content={<ChartTip unit="%" />} />
                    <Bar dataKey="value" name="Share" radius={[12, 12, 12, 12]} fill="url(#gradPeak)">
                      {peakData.map((d, i) => (
                        <Cell key={d.name} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                Peak ratio is <strong style={{ color: "var(--text)" }}>{peakRatio.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div className="two-col fade">
            <div className="card">
              <div className="card-head">
                <div className="card-title">Appliance / Behavior Insight</div>
                <div className="card-note">Estimated share by activity</div>
              </div>
              {applianceInsightData.length > 0 ? (
                <>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={applianceInsightData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={58}
                          innerRadius={28}
                          paddingAngle={2}
                        >
                          {applianceInsightData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTip unit="score" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="slab-table">
                    <thead>
                      <tr><th>Behavior</th><th>Score</th></tr>
                    </thead>
                    <tbody>
                      {applianceInsightData.map((s, i) => (
                        <tr key={i}>
                          <td>{s.name}</td>
                          <td>{s.value.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No behavior insight data</div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">Bill Breakdown</div>
                <div className="card-note">CEB 2024 domestic tariff</div>
              </div>
              {billBreakdownPie.length > 0 ? (
                <>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={billBreakdownPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                          paddingAngle={2}
                        >
                          {billBreakdownPie.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTip unit="LKR" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="slab-table">
                    <thead>
                      <tr><th>Slab</th><th>Charge</th></tr>
                    </thead>
                    <tbody>
                      {slabs.map((s, i) => (
                        <tr key={i}>
                          <td>{s.slab}</td>
                          <td>₨{s.charge_lkr?.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="slab-total">
                        <td>Total</td>
                        <td>{fmtLKR(billing.estimated_bill_lkr)}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No bill data</div>
              )}
            </div>
          </div>

          <div className="two-col fade">
            <div className="card">
              <div className="card-head">
                <div className="card-title">Personalised Recommendations</div>
                <div className="card-note">{recs.length} suggestions</div>
              </div>
              {recs.length ? (
                <div className="tip-list">
                  {recs.map((tip, i) => (
                    <div key={i} className="tip">
                      <span className="tip-i">{TIPS_ICONS[i % TIPS_ICONS.length]}</span>
                      {tip}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No recommendations returned</div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">Top Consumption Drivers</div>
                <div className="card-note">From model explanation</div>
              </div>
              {factors.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {factors.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 99,
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--text2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(f.contribution_pct, 50)}px`,
                          height: 3,
                          borderRadius: 2,
                          background: "var(--lime)",
                          flexShrink: 0,
                        }}
                      />
                      {f.label}: {f.contribution_pct}%
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 12, padding: "10px 0" }}>
                  <p style={{ marginBottom: 8 }}>No driver data from API.</p>
                  <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    Key inputs used:<br />
                    Peak ratio: <strong style={{ color: "var(--text)" }}>{peakRatio}</strong> ·
                    LED ratio: <strong style={{ color: "var(--text)" }}>{(ledRatio * 100).toFixed(0)}%</strong> ·
                    {behavior.has_ac && <span> AC {behavior.ac_hours_per_day}h/day ·</span>}
                    {behavior.has_solar && <span> Solar ·</span>}
                    {behavior.work_from_home && <span> WFH</span>}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--surface2)" }}>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--muted2)",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    marginBottom: 8,
                  }}
                >
                  Inputs used for this forecast
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontFamily: "var(--mono)", fontSize: 11 }}>
                  {[
                    ["District", district],
                    ["Month", MONTH_NAMES[month - 1]],
                    ["Temp", `${weather?.temp ?? 29}°C`],
                    ["Humidity", `${weather?.humidity ?? 75}%`],
                    ["Peak Ratio", peakRatio],
                    ["LED Ratio", `${(ledRatio * 100).toFixed(0)}%`],
                    ["Family", `${behavior.family_size} members`],
                    ["AC", behavior.has_ac ? `${behavior.ac_hours_per_day}h/day${behavior.inverter_ac ? " (inv)" : ""}` : "No"],
                    ["Solar", behavior.has_solar ? "Yes" : "No"],
                    ["WFH", behavior.work_from_home ? `${behavior.no_members_wfh} members` : "No"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 4, color: "var(--muted)" }}>
                      <span>{k}</span>
                      <span style={{ color: "var(--text2)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card fade">
            <div className="card-head">
              <div className="card-title">⚙ What-If Scenario Simulator</div>
              <button className="ghost-btn" onClick={handleWhatIf} disabled={deltaLoading}>
                {deltaLoading ? <><Spinner />Comparing…</> : "Compare Scenario"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 12 }}>
              Override specific inputs to see the kWh and bill impact. Leave blank to keep baseline.
            </p>
            <div className="whatif-inner">
              {[
                ["peak_ratio", "Peak Ratio Override", 0, 1, 0.01],
                ["ac_hours_per_day", "AC Hours/Day", 0, 24, 0.5],
                ["avg_hours_wfh", "WFH Hours/Day", 0, 24, 0.5],
                ["no_members_wfh", "WFH Members", 0, 10, 1],
                ["led_ratio", "LED Ratio", 0, 1, 0.01],
                ["family_size", "Family Size", 1, 20, 1],
              ].map(([id, lbl, mn, mx, st]) => (
                <div className="field" key={id}>
                  <div className="label">{lbl}</div>
                  <input
                    type="number"
                    min={mn}
                    max={mx}
                    step={st}
                    placeholder="—"
                    value={overrides[id] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOverrides((p) => (v === "" ? (({ [id]: _, ...r }) => r)(p) : { ...p, [id]: Number(v) }));
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="chip-grid">
              {[
                ["ov_solar", "Add Solar", "☀️", "has_solar"],
                ["ov_inv", "Use Inverter AC", "⚡", "inverter_ac"],
                ["ov_wfh", "Enable WFH", "💻", "work_from_home"],
              ].map(([id, lbl, icon, key]) => (
                <ChipToggle
                  key={id}
                  id={key}
                  label={lbl}
                  icon={icon}
                  checked={!!overrides[key]}
                  onChange={(k, v) => setOverrides((p) => ({ ...p, [k]: v ? 1 : undefined }))}
                />
              ))}
            </div>
            {delta && (
              <div className="delta-strip">
                <span style={{ color: "var(--muted2)" }}>Scenario result:</span>
                <span className={delta.kwh_change >= 0 ? "up" : "dn"}>
                  {delta.kwh_change >= 0 ? "▲" : "▼"} {Math.abs(delta.kwh_change).toFixed(1)} kWh
                </span>
                <span style={{ color: "var(--border2)" }}>|</span>
                <span className={delta.bill_lkr_change >= 0 ? "up" : "dn"}>
                  {delta.bill_lkr_change >= 0 ? "▲" : "▼"} {fmtLKR(Math.abs(delta.bill_lkr_change || 0))}
                </span>
                <span style={{ color: "var(--muted2)", marginLeft: "auto", fontSize: 10 }}>
                  {delta.kwh_change < 0 ? "💡 Savings detected" : "⚠ Higher usage scenario"}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
