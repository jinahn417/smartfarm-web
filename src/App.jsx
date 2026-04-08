import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function clamp(n, min, max) {
  if (typeof n !== "number" || !Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const to = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({ r: lerp(A.r, B.r, t), g: lerp(A.g, B.g, t), b: lerp(A.b, B.b, t) });
}

const fmt1 = (n) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "-");
const fmt2 = (n) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "-");
const asBool = (v) => v === 1 || v === true || v === "1";

function toTimeLabel(ts) {
  if (!ts) return "";
  const s = String(ts);
  const parts = s.split(" ");
  return parts.length >= 2 ? parts[1] : s;
}

function parseTs(ts) {
  if (!ts) return null;
  const s = String(ts).trim().replace(" ", "T");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Card({ title, children, style }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white", ...style }}>
      {title && <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>{title}</div>}
      {children}
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px dashed #eee" }}>
      <div style={{ color: "#374151" }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value}</div>
    </div>
  );
}

function Badge({ on, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999,
      border: "1px solid", borderColor: on ? "#16a34a" : "#9ca3af",
      background: on ? "#dcfce7" : "#f3f4f6", color: on ? "#166534" : "#374151",
      fontWeight: 600, fontSize: 13,
    }}>
      {label}: {on ? "ON" : "OFF"}
    </span>
  );
}

function Tabs({ items, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} type="button" onClick={() => onChange(it.value)} style={{
            border: "1px solid", borderColor: active ? "#111827" : "#e5e7eb",
            background: active ? "#111827" : "white", color: active ? "white" : "#111827",
            padding: "8px 12px", borderRadius: 999, fontWeight: 700, cursor: "pointer", fontSize: 13,
          }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, disabled }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "10px 0", borderBottom: "1px dashed #eee",
      opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer",
    }}>
      <div style={{ color: "#111827", fontWeight: 700 }}>{label}</div>
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} style={{ width: 44, height: 24 }} />
    </label>
  );
}

function BarGauge({ label, value, min = 0, max = 100, unit = "", decimals = 1 }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const v = isNum ? value : 0;
  const t = isNum ? clamp((v - min) / (max - min), 0, 1) : 0;
  const display = isNum ? v.toFixed(decimals) : "-";
  const barColor = mixHex("#a3d977", "#2d5016", t);
  const maxH = 110;
  const barH = Math.max(6, maxH * t);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "1 1 0", minWidth: 60 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>
        {display} <span style={{ fontSize: 10, color: "#6b7280" }}>{unit}</span>
      </div>
      <div style={{ width: "100%", maxWidth: 44, height: maxH, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ width: "100%", height: barH, borderRadius: "6px 6px 4px 4px", background: barColor, transition: "height 0.4s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

function DonutSensor({ value, label, unit, min = 0, max = 100, decimals = 1 }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const v = isNum ? value : 0;
  const t = isNum ? clamp((v - min) / (max - min), 0, 1) : 0;
  const pct = Math.round(t * 100);
  const display = isNum ? v.toFixed(decimals) : "-";

  const size = 88;
  const strokeW = 7;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * t;
  const gap = c - dash;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={strokeW} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#1a7a3a" strokeWidth={strokeW} fill="none"
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeDasharray={`${dash} ${gap}`} style={{ transition: "stroke-dasharray 0.4s ease" }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1 }}>
            {display}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{unit}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textAlign: "center" }}>{label}</div>
      <div style={{ fontSize: 10, color: "#9ca3af" }}>{pct}%</div>
    </div>
  );
}

function DataTable({ rows, columns }) {
  return (
    <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "10px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id ?? idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function kmaSkyIcon({ pty, sky }) {
  if (pty === "1" || pty === 1) return "\u{1f327}\ufe0f";
  if (pty === "2" || pty === 2) return "\u{1f328}\ufe0f";
  if (pty === "3" || pty === 3) return "\u2744\ufe0f";
  if (pty === "4" || pty === 4) return "\u{1f326}\ufe0f";
  if (sky === "1" || sky === 1) return "\u2600\ufe0f";
  if (sky === "3" || sky === 3) return "\u26c5";
  if (sky === "4" || sky === 4) return "\u2601\ufe0f";
  return "\u{1f321}\ufe0f";
}

function buildKmaUltraSrtNcstUrl({ serviceKey, baseDate, baseTime, nx, ny }) {
  const base = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
  const params = new URLSearchParams({
    serviceKey, pageNo: "1", numOfRows: "1000", dataType: "JSON",
    base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny),
  });
  return `${base}?${params.toString()}`;
}

function getKmaBaseDateTime(date = new Date()) {
  const d = new Date(date.getTime() - 10 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return { baseDate: `${yyyy}${mm}${dd}`, baseTime: `${hh}00` };
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiBase = import.meta.env.VITE_API_BASE;
  const abortRef = useRef(null);

  const loadReadings = async () => {
    const url = `${apiBase}/api/readings/recent?limit=200`;
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReadings();
    const id = setInterval(loadReadings, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = useMemo(() => (Array.isArray(data) && data.length > 0 ? data[0] : null), [data]);

  const chartData24h = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const newest = parseTs(data[0]?.ts) ?? new Date();
    const since = new Date(newest.getTime() - 24 * 60 * 60 * 1000);
    return [...data]
      .filter((r) => { const d = parseTs(r.ts); return d && d >= since && d <= newest; })
      .reverse()
      .map((r) => ({ t: toTimeLabel(r.ts), ts: r.ts, id: r.id, sht_temp: r.sht_temp, soil_temp: r.soil_temp, sht_hum: r.sht_hum, soil_hum: r.soil_hum }));
  }, [data]);

  const chartData3h = useMemo(() => {
    if (chartData24h.length === 0) return [];
    const newest = parseTs(chartData24h[chartData24h.length - 1]?.ts) ?? new Date();
    const since = new Date(newest.getTime() - 3 * 60 * 60 * 1000);
    return chartData24h.filter((r) => { const d = parseTs(r.ts); return d && d >= since && d <= newest; });
  }, [chartData24h]);

  const [tableFilter, setTableFilter] = useState("");
  const filteredRows3h = useMemo(() => {
    const rows = [...chartData3h].reverse();
    const q = tableFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.ts, r.sht_temp, r.soil_temp, r.sht_hum, r.soil_hum]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [chartData3h, tableFilter]);

  const [weather, setWeather] = useState({ loading: false, error: null, data: null, meta: null });
  const loadWeather = async () => {
    const serviceKey = import.meta.env.VITE_KMA_SERVICE_KEY;
    const nx = import.meta.env.VITE_KMA_NX ?? "60";
    const ny = import.meta.env.VITE_KMA_NY ?? "127";
    const isProd = import.meta.env.PROD;
    const useProxy = isProd || !serviceKey;
    if (!useProxy && !serviceKey) {
      setWeather({ loading: false, error: "KMA \ud658\uacbd\ubcc0\uc218\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.", data: null, meta: null });
      return;
    }
    const { baseDate, baseTime } = getKmaBaseDateTime();
    const url = useProxy
      ? `/api/kma?baseDate=${baseDate}&baseTime=${baseTime}&nx=${nx}&ny=${ny}`
      : buildKmaUltraSrtNcstUrl({ serviceKey, baseDate, baseTime, nx, ny });
    try {
      setWeather({ loading: true, error: null, data: null, meta: { baseDate, baseTime, nx, ny } });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = json?.response?.body?.items?.item ?? [];
      const dict = {};
      for (const it of items) dict[it.category] = it.obsrValue;
      setWeather({ loading: false, error: null, data: { raw: dict, tempC: dict.T1H ?? null, humPct: dict.REH ?? null, sky: dict.SKY ?? null, pty: dict.PTY ?? null }, meta: { baseDate, baseTime, nx, ny } });
    } catch (e) {
      setWeather({ loading: false, error: e instanceof Error ? e.message : String(e), data: null, meta: { baseDate, baseTime, nx, ny } });
    }
  };

  useEffect(() => {
    if (tab !== "weather") return;
    loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [control, setControl] = useState({ fan: false, pump: false, led2: false, heater: false });
  useEffect(() => {
    if (!latest) return;
    setControl({ fan: asBool(latest.fan), pump: asBool(latest.pump), led2: asBool(latest.led2), heater: asBool(latest.heater) });
  }, [latest]);

  const [controlMsg, setControlMsg] = useState(null);
  const sendControl = async (device, state) => {
    const url = `${apiBase}/api/control`;
    try {
      setControlMsg("\uc804\uc1a1 \uc911...");
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device, state }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setControlMsg("\uc804\uc1a1 \uc644\ub8cc");
      setTimeout(() => setControlMsg(null), 1500);
    } catch (e) {
      setControlMsg(`\uc81c\uc5b4 API \uc2e4\ud328: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}>로딩중...</div>;
  if (error) return <div style={{ padding: 24, textAlign: "center" }}>에러: {error}</div>;
  if (!latest) return <div style={{ padding: 24, textAlign: "center" }}>데이터가 없습니다.</div>;

  const numVal = (v) => (typeof v === "number" ? v : Number(v));

  return (
    <div style={{ padding: "12px 16px", background: "#f8fafc", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 32px)", letterSpacing: -0.5 }}>
              여.라.心
            </h1>
            <div style={{ fontSize: "clamp(11px, 2.5vw, 14px)", color: "#6b7280", fontWeight: 600, marginTop: 2 }}>
              greenhouse control solution
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#9ca3af", lineHeight: 1.6, flexShrink: 0 }}>
            <div>API: <code style={{ fontSize: 10 }}>{apiBase}</code></div>
            <div>Latest: <code style={{ fontSize: 10 }}>{latest.ts ?? "-"}</code> (id:{latest.id ?? "-"})</div>
          </div>
        </div>

        {/* Tabs + Refresh */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Tabs
            items={[
              { value: "overview", label: "Overview" },
              { value: "weather", label: "Weather" },
              { value: "control", label: "Manual control" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <button type="button" onClick={loadReadings} style={{
            border: "1px solid #e5e7eb", background: "white", padding: "8px 12px",
            borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12,
          }}>
            새로고침
          </button>
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Row 1: Chart (full width) */}
            <Card title="온도/습도 (최근 24시간)">
              <div style={{ width: "100%", height: "clamp(200px, 30vw, 300px)" }}>
                <ResponsiveContainer>
                  <LineChart data={chartData24h}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={20} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label, payload) => {
                        const p = payload?.[0]?.payload;
                        return p?.ts ?? label;
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 11 }} />
                    <Line yAxisId="temp" type="monotone" dataKey="sht_temp" name="sht_temp(°C)" dot={false} stroke="#ef4444" strokeWidth={1.5} />
                    <Line yAxisId="temp" type="monotone" dataKey="soil_temp" name="soil_temp(°C)" dot={false} stroke="#f97316" strokeWidth={1.5} />
                    <Line yAxisId="hum" type="monotone" dataKey="sht_hum" name="sht_hum(%)" dot={false} stroke="#3b82f6" strokeWidth={1.5} />
                    <Line yAxisId="hum" type="monotone" dataKey="soil_hum" name="soil_hum(%)" dot={false} stroke="#14b8a6" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Row 2: Sensor donuts + Bar gauges (responsive) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>

              {/* Sensor donuts */}
              <Card title="센서 (최신)">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, justifyItems: "center" }}>
                  <DonutSensor value={numVal(latest.sht_temp)} label="sht_temp" unit="°C" min={0} max={50} decimals={1} />
                  <DonutSensor value={numVal(latest.soil_temp)} label="soil_temp" unit="°C" min={0} max={50} decimals={1} />
                  <DonutSensor value={numVal(latest.air_temp)} label="air_temp" unit="°C" min={0} max={50} decimals={1} />
                  <DonutSensor value={numVal(latest.sht_hum)} label="sht_hum" unit="%" min={0} max={100} decimals={1} />
                  <DonutSensor value={numVal(latest.soil_hum)} label="soil_hum" unit="%" min={0} max={100} decimals={1} />
                  <DonutSensor value={numVal(latest.vpd_kpa)} label="vpd_kpa" unit="kPa" min={0} max={3} decimals={2} />
                </div>
              </Card>

              {/* Bar gauges */}
              <Card title="지표 게이지">
                <div style={{ display: "flex", gap: 12, justifyContent: "space-around", padding: "8px 0" }}>
                  <BarGauge label="VPD" value={numVal(latest.vpd_kpa)} min={0} max={3} unit="kPa" decimals={2} />
                  <BarGauge label="DIF" value={numVal(latest.dif_intraday_c)} min={-10} max={10} unit="°C" decimals={1} />
                  <BarGauge label="soil_moist" value={numVal(latest.soil_moist_idx)} min={0} max={100} unit="" decimals={0} />
                  <BarGauge label="rz_temp" value={numVal(latest.rz_temp_idx)} min={0} max={100} unit="" decimals={0} />
                </div>
              </Card>
            </div>

            {/* Row 3: Relay status (compact) */}
            <Card title="릴레이 상태">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge on={asBool(latest.fan)} label="FAN" />
                <Badge on={asBool(latest.pump)} label="PUMP" />
                <Badge on={asBool(latest.heater)} label="HEATER" />
                <Badge on={asBool(latest.led2)} label="LED2" />
              </div>
            </Card>

            {/* Row 4: Raw data table (bottom) */}
            <Card title="Raw data (최근 3시간)">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <input
                  type="text"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="필터(시간/숫자)"
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 12, width: "100%", maxWidth: 220 }}
                />
              </div>
              <DataTable
                rows={filteredRows3h}
                columns={[
                  { key: "ts", label: "ts", render: (r) => r.ts ?? "-" },
                  { key: "sht_temp", label: "sht_temp", render: (r) => fmt1(r.sht_temp) },
                  { key: "soil_temp", label: "soil_temp", render: (r) => fmt1(r.soil_temp) },
                  { key: "sht_hum", label: "sht_hum", render: (r) => fmt1(r.sht_hum) },
                  { key: "soil_hum", label: "soil_hum", render: (r) => fmt1(r.soil_hum) },
                ]}
              />
            </Card>
          </div>
        )}

        {/* ===== WEATHER TAB ===== */}
        {tab === "weather" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <Card title="기상청 연동 (초단기실황)">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  .env 설정 필요: <code>VITE_KMA_SERVICE_KEY</code>, <code>VITE_KMA_NX</code>, <code>VITE_KMA_NY</code>
                </div>
                <button type="button" onClick={loadWeather} style={{
                  border: "1px solid #e5e7eb", background: "white", padding: "8px 12px",
                  borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12,
                }}>
                  날씨 새로고침
                </button>
              </div>
              {weather.loading && <div style={{ marginTop: 12 }}>로딩중...</div>}
              {weather.error && <div style={{ marginTop: 12, color: "#b91c1c" }}>에러: {weather.error}</div>}
              {weather.data && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 42, lineHeight: 1 }}>{kmaSkyIcon({ pty: weather.data.pty, sky: weather.data.sky })}</div>
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                    <MetricRow label="기온(T1H)" value={`${weather.data.tempC ?? "-"} °C`} />
                    <MetricRow label="습도(REH)" value={`${weather.data.humPct ?? "-"} %`} />
                    <MetricRow label="하늘(SKY)" value={`${weather.data.sky ?? "-"}`} />
                    <MetricRow label="강수형태(PTY)" value={`${weather.data.pty ?? "-"}`} />
                  </div>
                  <div style={{ marginTop: 10, color: "#6b7280", fontSize: 11 }}>
                    base: <code>{weather.meta?.baseDate}</code> <code>{weather.meta?.baseTime}</code> / nx,ny: <code>{weather.meta?.nx}</code>,<code>{weather.meta?.ny}</code>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ===== CONTROL TAB ===== */}
        {tab === "control" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <Card title="Manual control">
              <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
                백엔드에 <code>POST /api/control</code> 구현 시 실제 제어 가능
              </div>
              <ToggleSwitch label="FAN" checked={control.fan} onChange={(c) => { setControl((s) => ({ ...s, fan: c })); sendControl("FAN", c); }} />
              <ToggleSwitch label="PUMP" checked={control.pump} onChange={(c) => { setControl((s) => ({ ...s, pump: c })); sendControl("PUMP", c); }} />
              <ToggleSwitch label="LED2" checked={control.led2} onChange={(c) => { setControl((s) => ({ ...s, led2: c })); sendControl("LED2", c); }} />
              <ToggleSwitch label="HEATER" checked={control.heater} onChange={(c) => { setControl((s) => ({ ...s, heater: c })); sendControl("HEATER", c); }} />
              {controlMsg && <div style={{ marginTop: 10, color: "#6b7280" }}>{controlMsg}</div>}
            </Card>
            <Card title="릴레이 상태(최신)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge on={asBool(latest.fan)} label="FAN" />
                <Badge on={asBool(latest.pump)} label="PUMP" />
                <Badge on={asBool(latest.heater)} label="HEATER" />
                <Badge on={asBool(latest.led2)} label="LED2" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
