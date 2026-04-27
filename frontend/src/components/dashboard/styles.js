export const DASHBOARD_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg0:       #05070f;
  --bg1:       #0b1222;
  --bg2:       #141c30;
  --surface:   rgba(255, 255, 255, 0.08);
  --surface2:  rgba(255, 255, 255, 0.12);
  --surface3:  rgba(255, 255, 255, 0.05);
  --border:    rgba(255, 255, 255, 0.18);
  --border2:   rgba(255, 255, 255, 0.28);
  --text:      #eef5ff;
  --text2:     #d4e2ff;
  --muted:     #9eb2d9;
  --muted2:    #7d94c2;
  --lime:      #8afc6f;
  --lime2:     #65e6b8;
  --cyan:      #45deff;
  --purple:    #ae7bff;
  --amber:     #ffc668;
  --red:       #ff6482;
  --r:         14px;
  --r2:        18px;
  --r3:        24px;
  --mono:      'JetBrains Mono', monospace;
  --sans:      'Manrope', sans-serif;
  --serif:     'Space Grotesk', sans-serif;
  --transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

html, body, #root {
  height: 100%;
  background:
    radial-gradient(40rem 40rem at 8% 12%, rgba(69, 222, 255, 0.20), transparent 60%),
    radial-gradient(32rem 32rem at 92% 8%, rgba(174, 123, 255, 0.22), transparent 55%),
    radial-gradient(28rem 28rem at 78% 88%, rgba(138, 252, 111, 0.16), transparent 60%),
    linear-gradient(145deg, var(--bg0) 0%, var(--bg1) 45%, var(--bg2) 100%);
  color: var(--text);
  font-family: var(--sans); font-size: 13px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.32); border-radius: 2px; }

/* ── LAYOUT ── */
.shell {
  display: grid;
  grid-template-rows: 64px 1fr;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.shell::before {
  content: "";
  position: absolute;
  inset: -20% 20% auto -20%;
  height: 30rem;
  background: radial-gradient(ellipse at center, rgba(69, 222, 255, 0.22), transparent 65%);
  pointer-events: none;
  z-index: 0;
}

.shell::after {
  content: "";
  position: absolute;
  inset: auto -18% -24% auto;
  width: 30rem;
  height: 30rem;
  background: radial-gradient(circle at center, rgba(174, 123, 255, 0.18), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 22px;
  background: rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(18px);
  position: relative;
  z-index: 50;
}
.logo { display: flex; align-items: center; gap: 10px; }
.logo-bolt {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, var(--cyan), var(--lime));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 24px rgba(69, 222, 255, 0.55);
}
.logo-bolt svg { width: 16px; height: 16px; }
.logo-name { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -.2px; }
.logo-tag { font-family: var(--mono); font-size: 10px; color: var(--cyan); margin-left: 4px; }
.header-mid { flex: 1; display: flex; justify-content: center; }
.step-trail { display: flex; align-items: center; gap: 0; }
.step-node {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 99px;
  font-family: var(--mono); font-size: 10px; color: var(--muted);
  transition: var(--transition); cursor: pointer;
}
.step-node.active {
  background: rgba(69, 222, 255, 0.18);
  color: var(--cyan);
  box-shadow: 0 0 14px rgba(69, 222, 255, 0.28);
}
.step-node.done { color: var(--lime); }
.step-sep { width: 20px; height: 1px; background: rgba(255,255,255,.22); flex-shrink: 0; }
.header-right { display: flex; align-items: center; gap: 8px; }
.api-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px 10px; font-family: var(--mono); font-size: 10px;
}
.api-row input {
  background: transparent; border: none; color: var(--muted);
  font-family: var(--mono); font-size: 10px; width: 170px; outline: none;
}
.pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--lime); flex-shrink: 0;
  box-shadow: 0 0 0 0 rgba(138, 252, 111, .6); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(138,252,111,.6)} 50%{box-shadow:0 0 0 7px rgba(138,252,111,0)} }

/* ── BODY ── */
.body { display: grid; grid-template-columns: 420px 1fr; overflow: hidden; position: relative; z-index: 2; }
.pane { overflow-y: auto; }
.left-pane {
  border-right: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
  backdrop-filter: blur(20px);
}
.right-pane {
  background: transparent;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── STEP PANELS ── */
.step-panel { border-bottom: 1px solid rgba(255,255,255,.12); }
.step-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer; user-select: none;
  transition: var(--transition);
}
.step-header:hover { background: rgba(255,255,255,.05); }
.step-num {
  width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.26);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 10px; color: var(--muted);
  flex-shrink: 0; transition: var(--transition);
}
.step-num.active {
  background: linear-gradient(135deg, var(--cyan), var(--lime));
  border-color: transparent;
  color: #05111a;
  box-shadow: 0 0 18px rgba(69, 222, 255, 0.45);
}
.step-num.done { background: rgba(138,252,111,.16); border-color: rgba(138,252,111,.45); color: var(--lime); }
.step-title { font-size: 12px; font-weight: 600; color: var(--text2); flex: 1; letter-spacing: .01em; }
.step-title.active { color: var(--text); }
.step-badge {
  font-family: var(--mono); font-size: 10px; padding: 2px 8px;
  border-radius: 99px;
  background: rgba(255,255,255,.08);
  color: var(--muted);
  border: 1px solid rgba(255,255,255,.12);
}
.step-badge.ok { background: rgba(138,252,111,.14); color: var(--lime); border-color: rgba(138,252,111,.3); }
.step-content { padding: 4px 16px 16px; display: none; }
.step-content.open { display: block; }

/* ── FIELDS ── */
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.label {
  font-family: var(--mono); font-size: 10px; color: var(--muted);
  text-transform: uppercase; letter-spacing: .06em;
}
.label span { color: var(--text2); font-size: 11px; text-transform: none; letter-spacing: 0; margin-left: 4px; }
.hint { font-size: 11px; color: var(--muted2); margin-top: 2px; }

input[type=number], input[type=text], input[type=url], select {
  background: rgba(255,255,255,.08);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text); padding: 8px 10px; font-family: var(--mono); font-size: 12px;
  width: 100%; outline: none; transition: var(--transition);
}
input:focus, select:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 0 3px rgba(69, 222, 255, .16), 0 0 18px rgba(69, 222, 255, .22);
}
input[type=checkbox] { accent-color: var(--lime); width: 14px; height: 14px; cursor: pointer; }
input[type=range] {
  -webkit-appearance: none; appearance: none; height: 4px;
  background: var(--surface2); border-radius: 2px; outline: none; width: 100%; cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: var(--lime); cursor: pointer; border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
}

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

/* ── TOGGLE CHIPS ── */
.chip-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chip-toggle {
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 99px;
  font-size: 12px; cursor: pointer; user-select: none;
  transition: var(--transition);
  color: var(--muted);
  background: rgba(255,255,255,.05);
}
.chip-toggle:hover { border-color: var(--cyan); color: var(--text); }
.chip-toggle.on {
  background: linear-gradient(135deg, rgba(69,222,255,.18), rgba(138,252,111,.14));
  border-color: rgba(69,222,255,.45);
  color: var(--text);
  font-weight: 500;
}
.chip-toggle svg { width: 12px; height: 12px; flex-shrink: 0; }

/* ── INLINE FIELD ── */
.inline-field {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--surface2);
}
.inline-field:last-child { border-bottom: none; }
.inline-label { font-size: 12px; color: var(--text2); }
.inline-sub { font-size: 11px; color: var(--muted2); }
.inline-input { display: flex; align-items: center; gap: 8px; }
.inline-input input[type=number] { width: 80px; text-align: right; }

/* ── STATUS BADGES ── */
.status-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px; font-family: var(--mono); font-size: 10px;
}
.sp-loading { background: rgba(232,160,32,.12); color: var(--amber); }
.sp-ok { background: rgba(125,196,43,.12); color: var(--lime); }
.sp-err { background: rgba(212,64,64,.12); color: var(--red); }

/* ── WEATHER CARD ── */
.weather-row {
  display: flex; gap: 8px; padding: 10px 0;
}
.weather-item {
  flex: 1;
  background: rgba(255,255,255,.08);
  border: 1px solid var(--border);
  border-radius: var(--r2); padding: 10px; text-align: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
}
.weather-val { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
.weather-lbl { font-family: var(--mono); font-size: 10px; color: var(--muted); text-transform: uppercase; }

/* ── PEAK BAR ── */
.peak-display {
  background: rgba(255,255,255,.08);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  padding: 12px; margin-top: 10px;
}
.peak-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.peak-label { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.peak-value { font-family: var(--mono); font-size: 16px; font-weight: 600; color: var(--text); }
.peak-track { height: 8px; background: rgba(255,255,255,.12); border-radius: 4px; overflow: hidden; }
.peak-fill { height: 100%; border-radius: 4px; transition: width .5s cubic-bezier(.4,0,.2,1); }

/* ── PREDICT BUTTON ── */
.predict-btn {
  width: 100%; padding: 13px; border: none; border-radius: var(--r2);
  background: linear-gradient(135deg, #103447, #183a2a 52%, #2b2b55);
  color: #e8f8ff;
  font-family: var(--sans);
  font-size: 13px; font-weight: 700; cursor: pointer; display: flex;
  align-items: center; justify-content: center; gap: 8px;
  transition: var(--transition);
  letter-spacing: -.1px;
  box-shadow: 0 10px 30px rgba(69,222,255,.25), 0 4px 16px rgba(138,252,111,.18);
}
.predict-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 34px rgba(69,222,255,.3), 0 8px 22px rgba(174,123,255,.2);
}
.predict-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

.ghost-btn {
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  color: var(--muted);
  font-size: 11px;
  font-family: var(--mono);
  padding: 5px 12px;
  cursor: pointer; transition: var(--transition);
}
.ghost-btn:hover {
  border-color: var(--cyan);
  color: var(--cyan);
  box-shadow: 0 0 14px rgba(69,222,255,.22);
}

/* ══ RIGHT PANE ══ */

/* ── METRIC GRID ── */
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.metric {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r3);
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 16px 30px rgba(5,8,20,.38);
}
.metric::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--cyan), var(--lime), var(--purple));
}
.metric-eyebrow { font-family: var(--mono); font-size: 9px; color: var(--muted2);
  text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
.metric-val { font-family: var(--serif); font-size: 34px; color: var(--text);
  line-height: 1; letter-spacing: -1px; margin-bottom: 6px; }
.metric-val.lime { color: var(--lime); }
.metric-sub { font-family: var(--mono); font-size: 11px; color: var(--muted); }

/* ── CLUSTER BADGE ── */
.cluster-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 99px;
  font-family: var(--mono); font-size: 11px; font-weight: 500;
}
.cluster-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r3);
  padding: 16px;
  backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 16px 28px rgba(5,8,20,.36);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(69,222,255,.32);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 18px 34px rgba(69,222,255,.15);
}
.card-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
.card-title { font-size: 13px; font-weight: 600; }
.card-note { font-family: var(--mono); font-size: 10px; color: var(--muted2); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* ── CHART ── */
.chart-wrap { height: 170px; }

/* ── SLAB TABLE ── */
.slab-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.slab-table th { font-family: var(--mono); font-size: 9px; color: var(--muted2);
  text-transform: uppercase; letter-spacing: .06em; padding: 4px 0; text-align: left; }
.slab-table td { font-family: var(--mono); font-size: 11px; padding: 5px 0;
  border-top: 1px solid rgba(255,255,255,.08); color: var(--text2); }
.slab-table td:last-child { text-align: right; color: var(--lime); }
.slab-total td { font-weight: 600; color: var(--text); padding-top: 8px; }
.slab-total td:last-child { color: var(--lime); }

/* ── RISK ── */
.risk-track { height: 6px; background: rgba(255,255,255,.12); border-radius: 3px; margin-top: 8px; overflow: hidden; }
.risk-fill { height: 100%; border-radius: 3px; transition: width .6s cubic-bezier(.4,0,.2,1); }

/* ── TIPS ── */
.tip-list { display: flex; flex-direction: column; gap: 6px; }
.tip {
  display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px;
  background: rgba(255,255,255,.07);
  border-radius: var(--r);
  border: 1px solid rgba(255,255,255,.14);
  font-size: 12px; line-height: 1.5; color: var(--text2);
}
.tip-i { font-size: 14px; flex-shrink: 0; margin-top: 1px; }

/* ── WHAT-IF ── */
.whatif-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.delta-strip {
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: rgba(255,255,255,.08);
  border: 1px solid var(--border);
  border-radius: var(--r);
  font-family: var(--mono); font-size: 12px; margin-top: 10px;
}
.up { color: var(--red); } .dn { color: var(--lime); }

/* ── EMPTY STATE ── */
.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; height: 100%; color: var(--muted); text-align: center; padding: 60px 40px;
}
.empty-graphic {
  width: 72px; height: 72px;
  border: 1.5px solid rgba(255,255,255,.3);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 28px; opacity: .5;
}
.empty h3 { font-size: 15px; font-weight: 600; color: var(--text2); }
.empty p { font-size: 12px; line-height: 1.7; max-width: 280px; }

/* ── FOOTER ── */
.footer {
  position: fixed; bottom: 0; right: 0; left: 420px;
  height: 32px; display: flex; align-items: center; padding: 0 20px; gap: 16px;
  background: rgba(255,255,255,.07);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(14px);
  z-index: 40;
}
.footer span { font-family: var(--mono); font-size: 10px; color: var(--muted2); }
.footer .ok { color: var(--lime); }
.footer .err { color: var(--red); }

/* ── SPINNER ── */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  width: 12px; height: 12px; border: 2px solid var(--border2);
  border-top-color: var(--lime); border-radius: 50%;
  animation: spin .6s linear infinite; flex-shrink: 0;
}

/* ── FADE ── */
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fade { animation: fadeUp .22s ease both; }

/* ── TOOLTIP ── */
.recharts-default-tooltip {
  background: rgba(7, 12, 24, .95) !important;
  border: 1px solid rgba(255,255,255,.18) !important;
  border-radius: 8px !important; font-family: var(--mono) !important;
  font-size: 11px !important; color: #E0E8DC !important;
}

/* ── RESPONSIVE ── */
@media (max-width: 1200px) {
  .body { grid-template-columns: 360px 1fr; }
  .footer { left: 360px; }
  .metrics { grid-template-columns: 1fr; }
}

@media (max-width: 900px) {
  .header-mid { display: none; }
  .body { grid-template-columns: 1fr; }
  .left-pane { border-right: none; border-bottom: 1px solid var(--border); max-height: 48vh; }
  .footer { left: 0; }
  .two-col { grid-template-columns: 1fr; }
}
`;
