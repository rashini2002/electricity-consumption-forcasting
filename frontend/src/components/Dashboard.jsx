import { useState, useEffect, useCallback } from "react";
import { setApiBase as setApiBaseService, pingApi, predict, predictWhatIf } from "../services/api";
import { getWeather } from "../services/weather";
import {
  buildDashboardPayload,
  normalizeWhatIfOverrides,
  calcPeakRatio,
  calcLedRatio,
} from "../utils/featureBuilder";

import { DASHBOARD_STYLES } from "./dashboard/styles";
import LeftPane from "./dashboard/LeftPane";
import RightPane from "./dashboard/RightPane";

export default function Dashboard() {
  const [kwh, setKwh] = useState({ p1: "", p2: "", p3: "", p4: "", p5: "", p6: "" });
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [district, setDistrict] = useState("Colombo");
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherErr, setWeatherErr] = useState("");

  const [behavior, setBehavior] = useState({
    family_size: 4,
    has_refrigerator: false,
    has_ac: false,
    has_geyser: false,
    has_electric_cooking: false,
    has_washing_machine: false,
    has_water_pump: false,
    inverter_ac: false,
    non_inverter_ac: false,
    ac_hours_per_day: 0,
    work_from_home: false,
    no_members_wfh: 0,
    avg_hours_wfh: 0,
    has_solar: false,
    water_heater_solar: false,
    led_bulbs: 0,
    total_bulbs: 5,
  });

  const [apiBase, setApiBase] = useState("http://127.0.0.1:8000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [statusErr, setStatusErr] = useState(false);
  const [delta, setDelta] = useState(null);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [modelInfo, setModelInfo] = useState(null);
  const [openStep, setOpenStep] = useState(1);

  const peakRatio = calcPeakRatio(kwh.p1, kwh.p2, kwh.p3);
  const ledRatio = calcLedRatio(behavior.led_bulbs, behavior.total_bulbs);
  const kwhReady = Object.values(kwh).every((value) => Number(value) > 0);
  const wxReady = !!weather;
  const peakColor = peakRatio > 0.7 ? "#D44040" : peakRatio > 0.55 ? "#E8A020" : "#7DC42B";

  useEffect(() => {
    let active = true;

    async function connectApi() {
      setApiBaseService(apiBase);
      try {
        const info = await pingApi();
        if (!active) return;
        setModelInfo(info);
        setStatus("Connected to API ✓");
        setStatusErr(false);
      } catch (e) {
        if (!active) return;
        setModelInfo(null);
        setStatus(e.message || "API connection failed");
        setStatusErr(true);
      }
    }

    connectApi();
    return () => {
      active = false;
    };
  }, [apiBase]);

  const fetchWx = useCallback(async (d) => {
    setWeatherLoading(true);
    setWeatherErr("");
    try {
      const wx = await getWeather(d);
      setWeather(wx);
    } catch {
      setWeatherErr("Could not fetch weather — using defaults");
      setWeather({ temp: 29, humidity: 75, rain: 0 });
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) fetchWx(district);
  }, [district, fetchWx]);

  const setB = (k, v) => setBehavior((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!kwhReady) {
      setStatus("Enter 6 months of kWh first");
      setStatusErr(true);
      return;
    }

    setLoading(true);
    setStatus("Running LSTM forecast…");
    setStatusErr(false);
    setResult(null);

    try {
      const payload = buildDashboardPayload({
        kwh,
        month,
        district,
        weather,
        behavior,
        peakRatio,
        ledRatio,
      });
      const data = await predict(payload);
      setResult({ ...data, _payload: payload });
      setDelta(null);
      setStatus("Forecast complete ✓");
    } catch (e) {
      setStatus(e.message);
      setStatusErr(true);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatIf = async () => {
    if (!result?._payload) {
      setStatus("Run a forecast first");
      setStatusErr(true);
      return;
    }

    setDeltaLoading(true);
    setStatus("Comparing scenario…");
    setStatusErr(false);

    try {
      const normalizedOverrides = normalizeWhatIfOverrides(overrides);
      const data = await predictWhatIf(result._payload, normalizedOverrides);
      setDelta(data.delta);
      setStatus("Scenario compared");
    } catch (e) {
      setStatus(e.message);
      setStatusErr(true);
    } finally {
      setDeltaLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASHBOARD_STYLES }} />
      <div className="shell">
        <header className="header">
          <div className="logo">
            <div className="logo-bolt">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0A0F0D" strokeWidth="2.5">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div className="logo-name">GridPulse<span className="logo-tag">SL</span></div>
            </div>
          </div>

          <div className="header-mid">
            <div className="step-trail">
              {["kWh History", "Date & Weather", "Behaviour"].map((s, i) => {
                const n = i + 1;
                const st = n === 1 ? (kwhReady ? "done" : (openStep === 1 ? "active" : ""))
                  : n === 2 ? (wxReady ? "done" : (openStep === 2 ? "active" : ""))
                    : (openStep === 3 ? "active" : "");
                return [
                  <div key={s} className={`step-node ${st}`} onClick={() => setOpenStep(n)}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{String(n).padStart(2, "0")}</span>
                    {s}
                  </div>,
                  i < 2 && <div key={`sep-${i}`} className="step-sep" />,
                ];
              })}
            </div>
          </div>

          <div className="header-right">
            <div className="api-row">
              <div className="pulse" />
              <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
            </div>
            {modelInfo && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#4A6047", textAlign: "right" }}>
                {modelInfo.forecast_model?.type || "LSTM"}
                {" · "}
                {modelInfo.forecast_model?.seq_len || 6} mo
                {modelInfo.metrics?.mae_kwh ? ` · MAE ${Number(modelInfo.metrics.mae_kwh).toFixed(1)}` : ""}
              </span>
            )}
          </div>
        </header>

        <div className="body">
          <LeftPane
            openStep={openStep}
            setOpenStep={setOpenStep}
            kwh={kwh}
            setKwh={setKwh}
            kwhReady={kwhReady}
            peakRatio={peakRatio}
            peakColor={peakColor}
            wxReady={wxReady}
            weatherLoading={weatherLoading}
            weatherErr={weatherErr}
            weather={weather}
            month={month}
            setMonth={setMonth}
            district={district}
            setDistrict={setDistrict}
            behavior={behavior}
            setB={setB}
            ledRatio={ledRatio}
            handleSubmit={handleSubmit}
            loading={loading}
          />

          <RightPane
            result={result}
            month={month}
            kwh={kwh}
            behavior={behavior}
            district={district}
            weather={weather}
            peakRatio={peakRatio}
            ledRatio={ledRatio}
            overrides={overrides}
            setOverrides={setOverrides}
            delta={delta}
            deltaLoading={deltaLoading}
            handleWhatIf={handleWhatIf}
          />
        </div>

        <footer className="footer">
          <span className={statusErr ? "err" : "ok"}>{statusErr ? "⚠ " : "● "}{status}</span>
          <span>Peak ratio: {peakRatio}</span>
          <span>LED ratio: {(ledRatio * 100).toFixed(0)}%</span>
          {weather && <span>Weather: {weather.temp}°C · {weather.humidity}% RH · {weather.rain}mm</span>}
          <span style={{ marginLeft: "auto" }}>GridPulse — Sri Lankan Household Energy Intelligence</span>
        </footer>
      </div>
    </>
  );
}
