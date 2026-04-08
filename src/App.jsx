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

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px dashed #eee",
      }}
    >
      <div style={{ color: "#374151" }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {value}
      </div>
    </div>
  );
}

function Badge({ on, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid",
        borderColor: on ? "#16a34a" : "#9ca3af",
        background: on ? "#dcfce7" : "#f3f4f6",
        color: on ? "#166534" : "#374151",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
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
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            style={{
              border: "1px solid",
              borderColor: active ? "#111827" : "#e5e7eb",
              background: active ? "#111827" : "white",
              color: active ? "white" : "#111827",
              padding: "8px 12px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, disabled }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px dashed #eee",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ color: "#111827", fontWeight: 700 }}>{label}</div>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 44, height: 24 }}
      />
    </label>
  );
}

function CircularGauge({ label, value, min = 0, max = 100, unit = "", decimals = 1 }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const v = isNum ? value : NaN;
  const t = isNum ? clamp((v - min) / (max - min), 0, 1) : 0;
  const display = isNum ? v.toFixed(decimals) : "-";
  const stroke = mixHex("#d1fae5", "#111827", t); // min=연녹색, max=검정

  const size = 110;
  const strokeW = 10;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * t;
  const gap = c - dash;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "white",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#e5e7eb"
            strokeWidth={strokeW}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeDasharray={`${dash} ${gap}`}
          />
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 16, fontWeight: 900, fill: "#111827" }}
          >
            {display}
          </text>
          <text
            x="50%"
            y="66%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 800, fill: "#6b7280" }}
          >
            {unit}
          </text>
        </svg>
        <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>
          <div>
            range: <code>{min}</code>–<code>{max}</code>
          </div>
          <div>
            level: <code>{Math.round(t * 100)}%</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const fmt1 = (n) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "-");
const fmt2 = (n) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "-");
const asBool = (v) => v === 1 || v === true || v === "1";

function toTimeLabel(ts) {
  if (!ts) return "";
  // "2026-04-07 15:42:18" -> "15:42:18"
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

function SensorTile({ value, label, unit }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "white",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 1000, color: "#111827", lineHeight: 1.15 }}>
        {value} <span style={{ fontSize: 14, fontWeight: 900, color: "#6b7280" }}>{unit}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{label}</div>
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
              <th
                key={c.key}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  borderBottom: "1px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id ?? idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function kmaSkyIcon({ pty, sky }) {
  // PTY: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기 (통상)
  if (pty === "1" || pty === 1) return "🌧️";
  if (pty === "2" || pty === 2) return "🌨️";
  if (pty === "3" || pty === 3) return "❄️";
  if (pty === "4" || pty === 4) return "🌦️";
  // SKY: 1 맑음, 3 구름많음, 4 흐림 (통상)
  if (sky === "1" || sky === 1) return "☀️";
  if (sky === "3" || sky === 3) return "⛅";
  if (sky === "4" || sky === 4) return "☁️";
  return "🌡️";
}

function buildKmaUltraSrtNcstUrl({ serviceKey, baseDate, baseTime, nx, ny }) {
  const base = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  return `${base}?${params.toString()}`;
}

function getKmaBaseDateTime(date = new Date()) {
  // 초단기실황은 보통 HH00 기준(정각), 데이터 생성 지연 고려해 10분 빼서 직전 정각으로 맞춤
  const d = new Date(date.getTime() - 10 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return { baseDate: `${yyyy}${mm}${dd}`, baseTime: `${hh}00` };
}

export default function App() {
  const [tab, setTab] = useState("overview"); // overview | weather | control

  const [data, setData] = useState(null); // readings 배열(최신이 앞)
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
      .filter((r) => {
        const d = parseTs(r.ts);
        return d && d >= since && d <= newest;
      })
      .reverse()
      .map((r) => ({
        t: toTimeLabel(r.ts),
        ts: r.ts,
        id: r.id,
        sht_temp: r.sht_temp,
        soil_temp: r.soil_temp,
        sht_hum: r.sht_hum,
        soil_hum: r.soil_hum,
      }));
  }, [data]);

  const chartData3h = useMemo(() => {
    if (chartData24h.length === 0) return [];
    const newest = parseTs(chartData24h[chartData24h.length - 1]?.ts) ?? new Date();
    const since = new Date(newest.getTime() - 3 * 60 * 60 * 1000);
    return chartData24h.filter((r) => {
      const d = parseTs(r.ts);
      return d && d >= since && d <= newest;
    });
  }, [chartData24h]);

  const [tableFilter, setTableFilter] = useState("");
  const filteredRows3h = useMemo(() => {
    const rows = [...chartData3h].reverse();
    const q = tableFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.ts,
        r.sht_temp,
        r.soil_temp,
        r.sht_hum,
        r.soil_hum,
      ]
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
      setWeather({
        loading: false,
        error: "KMA 환경변수가 없습니다. (.env: VITE_KMA_SERVICE_KEY, VITE_KMA_NX, VITE_KMA_NY)",
        data: null,
        meta: null,
      });
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
      setWeather({
        loading: false,
        error: null,
        data: {
          raw: dict,
          tempC: dict.T1H ?? null,
          humPct: dict.REH ?? null,
          sky: dict.SKY ?? null,
          pty: dict.PTY ?? null,
        },
        meta: { baseDate, baseTime, nx, ny },
      });
    } catch (e) {
      setWeather({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
        data: null,
        meta: { baseDate, baseTime, nx, ny },
      });
    }
  };

  useEffect(() => {
    if (tab !== "weather") return;
    loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [control, setControl] = useState({
    fan: false,
    pump: false,
    led2: false,
    heater: false,
  });

  useEffect(() => {
    if (!latest) return;
    setControl({
      fan: asBool(latest.fan),
      pump: asBool(latest.pump),
      led2: asBool(latest.led2),
      heater: asBool(latest.heater),
    });
    // 최신값이 갱신될 때마다 UI를 현재 상태로 맞춤
  }, [latest]);

  const [controlMsg, setControlMsg] = useState(null);
  const sendControl = async (device, state) => {
    // 백엔드가 아직 없을 수 있으므로, 실패해도 UI는 유지하고 안내만 띄움
    const url = `${apiBase}/api/control`;
    try {
      setControlMsg("전송 중...");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, state }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setControlMsg("전송 완료");
      setTimeout(() => setControlMsg(null), 1500);
    } catch (e) {
      setControlMsg(`제어 API가 없습니다(또는 실패): ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>로딩중...</div>;
  if (error) return <div style={{ padding: 16 }}>에러: {error}</div>;
  if (!latest) return <div style={{ padding: 16 }}>데이터가 없습니다.</div>;

  return (
    <div style={{ padding: 16, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ margin: 0 }}>Smartfarm</h1>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            API: <code>{apiBase}</code>
          </div>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            Latest: <code>{latest.ts ?? "-"}</code> (id: <code>{latest.id ?? "-"}</code>)
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Tabs
              items={[
                { value: "overview", label: "Overview" },
                { value: "weather", label: "Weather" },
                { value: "control", label: "Manual control" },
              ]}
              value={tab}
              onChange={setTab}
            />
            <button
              type="button"
              onClick={loadReadings}
              style={{
                border: "1px solid #e5e7eb",
                background: "white",
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              새로고침
            </button>
          </div>
        </div>

        {tab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <Card title="온도/습도 차트 (최근 24시간, 이중축)" >
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData24h}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={20} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label, payload) => {
                        const p = payload?.[0]?.payload;
                        return p?.ts ?? label;
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />

                    <Line yAxisId="temp" type="monotone" dataKey="sht_temp" name="sht_temp(°C)" dot={false} stroke="#ef4444" />
                    <Line yAxisId="temp" type="monotone" dataKey="soil_temp" name="soil_temp(°C)" dot={false} stroke="#f97316" />
                    <Line yAxisId="hum" type="monotone" dataKey="sht_hum" name="sht_hum(%)" dot={false} stroke="#3b82f6" />
                    <Line yAxisId="hum" type="monotone" dataKey="soil_hum" name="soil_hum(%)" dot={false} stroke="#14b8a6" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Raw data (최근 3시간)</div>
                  <input
                    type="text"
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    placeholder="필터(시간/숫자)"
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      minWidth: 180,
                    }}
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
              </div>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card title="센서(최신)">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  <SensorTile value={fmt1(latest.sht_temp)} unit="°C" label="sht_temp" />
                  <SensorTile value={fmt1(latest.soil_temp)} unit="°C" label="soil_temp" />
                  <SensorTile value={fmt1(latest.air_temp)} unit="°C" label="air_temp" />
                  <SensorTile value={fmt1(latest.sht_hum)} unit="%" label="sht_hum" />
                  <SensorTile value={fmt1(latest.soil_hum)} unit="%" label="soil_hum" />
                  <SensorTile value={fmt2(latest.vpd_kpa)} unit="kPa" label="vpd_kpa" />
                </div>
              </Card>

              <Card title="지표 게이지">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <CircularGauge label="VPD (kPa)" value={typeof latest.vpd_kpa === "number" ? latest.vpd_kpa : Number(latest.vpd_kpa)} min={0} max={3} unit="kPa" decimals={2} />
                  <CircularGauge label="DIF (°C)" value={typeof latest.dif_intraday_c === "number" ? latest.dif_intraday_c : Number(latest.dif_intraday_c)} min={-10} max={10} unit="°C" decimals={1} />
                  <CircularGauge label="soil_moist_idx" value={typeof latest.soil_moist_idx === "number" ? latest.soil_moist_idx : Number(latest.soil_moist_idx)} min={0} max={100} unit="" decimals={0} />
                  <CircularGauge label="rz_temp_idx" value={typeof latest.rz_temp_idx === "number" ? latest.rz_temp_idx : Number(latest.rz_temp_idx)} min={0} max={100} unit="" decimals={0} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "weather" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <Card title="기상청 연동 (초단기실황)">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ color: "#6b7280" }}>
                    .env 설정 필요: <code>VITE_KMA_SERVICE_KEY</code>, <code>VITE_KMA_NX</code>, <code>VITE_KMA_NY</code>
                </div>
                <button
                  type="button"
                  onClick={loadWeather}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "white",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
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
                  <div style={{ marginTop: 10, color: "#6b7280", fontSize: 12 }}>
                    base_date/time: <code>{weather.meta?.baseDate}</code> <code>{weather.meta?.baseTime}</code> / nx,ny:{" "}
                    <code>{weather.meta?.nx}</code>,<code>{weather.meta?.ny}</code>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "control" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <Card title="Manual control">
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>
                현재는 UI만 제공됩니다. 백엔드에 <code>POST /api/control</code> 이 구현되면 실제 제어가 됩니다.
              </div>

              <ToggleSwitch
                label="FAN"
                checked={control.fan}
                onChange={(checked) => {
                  setControl((s) => ({ ...s, fan: checked }));
                  sendControl("FAN", checked);
                }}
              />
              <ToggleSwitch
                label="PUMP"
                checked={control.pump}
                onChange={(checked) => {
                  setControl((s) => ({ ...s, pump: checked }));
                  sendControl("PUMP", checked);
                }}
              />
              <ToggleSwitch
                label="LED2"
                checked={control.led2}
                onChange={(checked) => {
                  setControl((s) => ({ ...s, led2: checked }));
                  sendControl("LED2", checked);
                }}
              />
              <ToggleSwitch
                label="HEATER"
                checked={control.heater}
                onChange={(checked) => {
                  setControl((s) => ({ ...s, heater: checked }));
                  sendControl("HEATER", checked);
                }}
              />

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