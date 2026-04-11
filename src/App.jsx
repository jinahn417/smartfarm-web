import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./dashboard.css";

/** 센서 타일 아이콘·차트 시리즈 공통 (톤다운 팔레트) */
const SENSOR_COLORS = {
  shtTemp: "#c48989",
  shtHum: "#7d95b5",
  soilTemp: "#c49a78",
  soilHum: "#73a8a2",
};

const fmt1 = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "-";
const fmt2 = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "-";

/** VPD 0~2, 근권/수분 0~100 — 아래부터 물결 면적 비율 */
function liquidFillPath(ratio) {
  const r = Math.max(0, Math.min(1, ratio));
  const base = 100 * (1 - r);
  const amp = 3.2;
  const cycles = 2.5;
  const wave = (x) => {
    const y = base + amp * Math.sin((x / 100) * Math.PI * 2 * cycles);
    return Math.max(0, Math.min(100, y));
  };
  let d = `M 0 100 L 0 ${wave(0)}`;
  for (let x = 2; x <= 100; x += 2) {
    d += ` L ${x} ${wave(x)}`;
  }
  d += " L 100 100 Z";
  return d;
}

/** 채움·테두리 공통 기준색(톤다운 + 약 10% 톤업: 원색 쪽으로 10% 블렌딩) */
const METRIC_BASE = {
  vpd: "#568f86",
  soilT: "#84a5b7",
  soilM: "#718fb3",
};

const METRIC_FILL_ALPHA = 0.9;
const METRIC_BORDER_ALPHA = 0.2;

function hexToRgba(hex, alpha) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function LiquidMetricPill({ baseColor, ratio, label, valueNum, unitSuffix, hint }) {
  const border = hexToRgba(baseColor, METRIC_BORDER_ALPHA);
  const fill = hexToRgba(baseColor, METRIC_FILL_ALPHA);
  return (
    <div className="metric-pill metric-pill--liquid" style={{ borderColor: border }}>
      <div className="metric-pill__liquid-layer" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <path d={liquidFillPath(ratio)} fill={fill} />
        </svg>
      </div>
      <div className="metric-pill__stack">
        <div className="metric-pill__front">
          <span className="metric-pill__label">{label}</span>
          <p className="metric-pill__hint">
            <span className="metric-pill__hint-inner">{hint}</span>
          </p>
          <span className="metric-pill__val">
            <span className="metric-pill__num">{valueNum}</span>
            <span className="metric-pill__unit-suffix">{unitSuffix}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewMetricPills({ latest }) {
  const vpdV = numVal(latest.vpd_kpa);
  const vpdRatio =
    typeof vpdV === "number" && Number.isFinite(vpdV) ? Math.max(0, Math.min(1, vpdV / 2)) : 0;
  const rz = latest.rz_temp_idx;
  const rzOk = typeof rz === "number" && Number.isFinite(rz);
  const rzRatio = rzOk ? Math.max(0, Math.min(1, rz / 100)) : 0;
  const soilRaw =
    typeof latest.soil_moist_idx === "number" && Number.isFinite(latest.soil_moist_idx)
      ? latest.soil_moist_idx
      : numVal(latest.soil_hum);
  const soilOk = typeof soilRaw === "number" && Number.isFinite(soilRaw);
  const soilRatio = soilOk ? Math.max(0, Math.min(1, soilRaw / 100)) : 0;
  return (
    <>
      <LiquidMetricPill
        baseColor={METRIC_BASE.vpd}
        ratio={vpdRatio}
        label="VPD"
        valueNum={fmt2(vpdV)}
        unitSuffix="kPa"
        hint="＃0.5▽ 과습병해위험 / 0.8~1.2 최적 / 1.5△ 고온건조"
      />
      <LiquidMetricPill
        baseColor={METRIC_BASE.soilT}
        ratio={rzRatio}
        label="근권온도지표"
        valueNum={rzOk ? fmt1(rz) : "-"}
        unitSuffix="점"
        hint="＃(21℃기준) 80점△ 양호 / 50점▽ 위험"
      />
      <LiquidMetricPill
        baseColor={METRIC_BASE.soilM}
        ratio={soilRatio}
        label="토양수분지표"
        valueNum={soilOk ? fmt1(soilRaw) : "-"}
        unitSuffix="점"
        hint="＃(35~65%기준) 80점△ 양호 / 40점▽ 위험"
      />
    </>
  );
}
const asBool = (v) => v === 1 || v === true || v === "1";
const numVal = (v) => (typeof v === "number" ? v : Number(v));

function toTimeLabel(ts) {
  if (!ts) return "";
  const parts = String(ts).split(" ");
  return parts.length >= 2 ? parts[1] : String(ts);
}
function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(String(ts).trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Drive 최신 이미지 URL에 캐시 무력화 쿼리 붙이기 */
function withCacheBust(url, bust) {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}bust=${bust}`;
}

/** .env VITE_DRIVE_PHOTO_REFRESH_MS (밀리초), 기본 10분 */
const DRIVE_PHOTO_REFRESH_MS = (() => {
  const v = import.meta.env.VITE_DRIVE_PHOTO_REFRESH_MS;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 600_000;
})();

const IconThermo = ({ color = "#ef4444", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);
const IconDrop = ({ color = "#3b82f6", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

/** FAN — 펌프·LED와 동일 stroke 스타일(심플 십자 날개) */
const IconFanSmall = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="2" stroke="#64748b" strokeWidth="1.5" />
    <path
      d="M12 12V6M12 12h6M12 12v6M12 12H6"
      stroke="#64748b"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
/** 가로형 펌프(좌우 배관) */
const IconPumpSmall = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M2 12h3.5M18.5 12H22M6 9.5h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z"
      stroke="#0ea5e9"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="12" r="1.3" fill="#0ea5e9" />
    <circle cx="15" cy="12" r="1.3" fill="#0ea5e9" />
  </svg>
);
const IconLedSmall = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 18h6M10 22h4M12 2a4 4 0 0 1 4 4c0 2.5-1.5 4-2 6H10c-.5-2-2-3.5-2-6a4 4 0 0 1 4-4z"
      stroke="#ca8a04"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
/** 심플 불꽃 */
const IconHeaterSmall = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#ea580c"
      d="M12 21c-2.8 0-4-2.2-2.8-4.8.4-1 1.2-2.4 2-4L12 8l.8 4.2c.8 1.6 1.6 3 2 4 1.2 2.6 0 4.8-2.8 4.8z"
    />
  </svg>
);

/** Overview — Drive 최신 사진 (중첩 삼항 대신 분리해 파서 오류 방지) */
function DriveLatestPhotoPanelBody({
  drivePhotoBase,
  driveFetchLoading,
  drivePreviewUrl,
  driveFetchError,
  onRetry,
}) {
  if (!drivePhotoBase) {
    return (
      <>
        Drive 최신 사진은 서버 API가 필요합니다.
        <br />
        <span style={{ fontSize: 10, fontWeight: 600, marginTop: 8, display: "block", lineHeight: 2 }}>
          Apps Script: <code style={{ color: "#94a3b8" }}>VITE_DRIVE_LATEST_PHOTO_URL=/api/apps-script-photo</code> + Vercel{" "}
          <code style={{ color: "#94a3b8" }}>APPS_SCRIPT_WEBAPP_URL</code>
          <br />
          또는 Drive API: <code style={{ color: "#94a3b8" }}>GOOGLE_SERVICE_ACCOUNT_JSON</code>,{" "}
          <code style={{ color: "#94a3b8" }}>GOOGLE_DRIVE_IMAGE_FOLDER_ID</code> +{" "}
          <code style={{ color: "#94a3b8" }}>/api/drive-latest-photo</code>
        </span>
      </>
    );
  }
  if (driveFetchLoading || (!drivePreviewUrl && !driveFetchError)) {
    return <span style={{ color: "#94a3b8" }}>Drive 이미지 불러오는 중…</span>;
  }
  if (drivePreviewUrl) {
    return <img src={drivePreviewUrl} alt="Drive 최신 온실 사진" />;
  }
  const err = String(driveFetchError ?? "");
  const looks404 = /404|Not Found/i.test(err);
  const isAppsScriptPath = /apps-script-photo/i.test(String(drivePhotoBase));
  const isDriveApiPath = /drive-latest-photo/i.test(String(drivePhotoBase));
  return (
    <>
      <div
        style={{
          textAlign: "left",
          maxWidth: "100%",
          wordBreak: "break-word",
          lineHeight: 2,
        }}
      >
        <strong style={{ color: "#cbd5e1" }}>이미지를 불러오지 못했습니다</strong>
        <br />
        <code
          style={{
            display: "block",
            marginTop: 8,
            fontSize: 10,
            color: "#f87171",
            lineHeight: 1.6,
          }}
        >
          {driveFetchError}
        </code>
        {isAppsScriptPath ? (
          <span style={{ display: "block", marginTop: 10, fontSize: 10, color: "#64748b" }}>
            Vercel에 <code style={{ color: "#94a3b8" }}>APPS_SCRIPT_WEBAPP_URL</code>(Apps Script 웹앱{" "}
            <code style={{ color: "#94a3b8" }}>…/exec</code> URL)이 있는지, 로컬은{" "}
            <code style={{ color: "#94a3b8" }}>vite.config.js</code>의 <code style={{ color: "#94a3b8" }}>/api</code>{" "}
            프록시가 켜져 있는지 확인하세요. <code style={{ color: "#94a3b8" }}>Failed to fetch</code>는 다른 도메인으로
            직접 요청할 때 자주 납니다.
          </span>
        ) : null}
        {isDriveApiPath ? (
          <span style={{ display: "block", marginTop: 10, fontSize: 10, color: "#64748b" }}>
            Vercel에{" "}
            <code style={{ color: "#94a3b8" }}>GOOGLE_SERVICE_ACCOUNT_JSON</code>,{" "}
            <code style={{ color: "#94a3b8" }}>GOOGLE_DRIVE_IMAGE_FOLDER_ID</code> 설정 후, Drive 폴더를
            서비스 계정 이메일(키 JSON의 <code style={{ color: "#94a3b8" }}>client_email</code>)과
            공유했는지 확인하세요.
          </span>
        ) : null}
        {looks404 && isDriveApiPath ? (
          <p style={{ marginTop: 12, fontSize: 10, color: "#94a3b8", lineHeight: 2 }}>
            <strong style={{ color: "#cbd5e1" }}>HTTP 404</strong>는 요청 URL에{" "}
            <code style={{ color: "#fbbf24" }}>/api/drive-latest-photo</code> 서버가 없을 때 흔합니다.
            Cloudflare 터널만 쓰는 주소는 정적 페이지만 열리고 API가 없을 수 있습니다.{" "}
            <code style={{ color: "#94a3b8" }}>VITE_DRIVE_LATEST_PHOTO_URL</code>을{" "}
            <strong>Vercel에 배포된 사이트 주소</strong>(예:{" "}
            <code style={{ color: "#94a3b8" }}>https://프로젝트명.vercel.app/api/drive-latest-photo</code>
            )로 바꾼 뒤 <code style={{ color: "#94a3b8" }}>npm run dev</code>를 다시 실행하세요.
          </p>
        ) : null}
      </div>
      <button type="button" className="btn-refresh" style={{ marginTop: 12 }} onClick={onRetry}>
        다시 시도
      </button>
    </>
  );
}

function Card({ title, children, style, className }) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        background: "white",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginBottom: 10,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function ActuatorItem({ label, on }) {
  return (
    <div className={`actuator-item ${on ? "actuator-item--on" : "actuator-item--off"}`}>
      <div className="actuator-item__dot" aria-hidden />
      <div className="actuator-item__label">{label}</div>
      <div className="actuator-item__status">{on ? "ON" : "OFF"}</div>
    </div>
  );
}

const DEVICE_API = { FAN: "fan", PUMP: "pump", LED2: "led2", HEATER: "heater" };

function ActuatorSwitch({ label, icon, checked, onChange, disabled }) {
  return (
    <div className="actuator-switch-row">
      <span className="actuator-switch-row__label">
        {icon ? <span className="actuator-switch-row__icon">{icon}</span> : null}
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label} ${checked ? "켜짐" : "꺼짐"}`}
        disabled={disabled}
        className={`actuator-switch ${checked ? "actuator-switch--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="actuator-switch__thumb" aria-hidden />
      </button>
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

function exportCsv(rows, columns, filename = "smartfarm_data.csv") {
  const BOM = "\uFEFF";
  const header = columns.map((c) => c.label).join(",");
  const body = rows
    .map((r) =>
      columns.map((c) => `"${String(c.render(r)).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([BOM + header + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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
  return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${params}`;
}
function getKmaBaseDateTime(date = new Date()) {
  const d = new Date(date.getTime() - 10 * 60 * 1000);
  return {
    baseDate: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
    baseTime: `${String(d.getHours()).padStart(2, "0")}00`,
  };
}

function SensorTile({ label, value, unit, icon }) {
  return (
    <div className="sensor-tile">
      <div className="sensor-tile__icon-col" aria-hidden>
        {icon}
      </div>
      <div className="sensor-tile__body">
        <div className="sensor-tile__label">{label}</div>
        <div className="sensor-tile__value-row">
          <span className="sensor-tile__value">{value}</span>
          <span className="sensor-tile__unit">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiBase = import.meta.env.VITE_API_BASE;
  const controlApiBase = import.meta.env.VITE_CONTROL_API_BASE || apiBase;
  const camUrl = import.meta.env.VITE_ESP32CAM_URL;
  const driveEnvTrim =
    typeof import.meta.env.VITE_DRIVE_LATEST_PHOTO_URL === "string"
      ? import.meta.env.VITE_DRIVE_LATEST_PHOTO_URL.trim()
      : "";
  const drivePhotoBase =
    driveEnvTrim.toLowerCase() === "off"
      ? ""
      : driveEnvTrim || (import.meta.env.PROD ? "/api/drive-latest-photo" : "");
  const [drivePhotoBust, setDrivePhotoBust] = useState(0);
  /** fetch로 이미지 검증 후 blob URL (서버가 JSON 오류를 주면 img onError로는 원인 파악 불가) */
  const [drivePreviewUrl, setDrivePreviewUrl] = useState(null);
  const [driveFetchError, setDriveFetchError] = useState(null);
  const [driveFetchLoading, setDriveFetchLoading] = useState(false);
  const driveBlobUrlRef = useRef(null);
  const abortRef = useRef(null);

  const loadReadings = async (opts = {}) => {
    const silent = !!opts.silent;
    const url = `${apiBase}/api/readings/recent?limit=200`;
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadReadings();
    const id = setInterval(loadReadings, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Drive 최신 이미지: env 주기(기본 10분)마다 자동 재요청. 수동 갱신은 Overview 패널 버튼. */
  useEffect(() => {
    if (!drivePhotoBase) return;
    const id = setInterval(() => setDrivePhotoBust((n) => n + 1), DRIVE_PHOTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [drivePhotoBase]);

  useEffect(() => {
    if (!drivePhotoBase) {
      setDrivePreviewUrl(null);
      setDriveFetchError(null);
      setDriveFetchLoading(false);
      if (driveBlobUrlRef.current) {
        URL.revokeObjectURL(driveBlobUrlRef.current);
        driveBlobUrlRef.current = null;
      }
      return;
    }
    let cancelled = false;
    setDriveFetchLoading(true);
    setDriveFetchError(null);
    if (driveBlobUrlRef.current) {
      URL.revokeObjectURL(driveBlobUrlRef.current);
      driveBlobUrlRef.current = null;
    }
    setDrivePreviewUrl(null);
    const url = withCacheBust(drivePhotoBase, drivePhotoBust);
    (async () => {
      try {
        const res = await fetch(url, { mode: "cors" });
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (!res.ok) {
          const text = await res.text();
          let msg = `HTTP ${res.status}`;
          try {
            const j = JSON.parse(text);
            if (j.error) msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
            if (j.detail != null) msg += ` — ${String(j.detail).slice(0, 300)}`;
          } catch {
            if (text) msg += `: ${text.slice(0, 200)}`;
          }
          if (!cancelled) {
            setDriveFetchError(msg);
            setDrivePreviewUrl(null);
          }
          return;
        }
        if (!ct.startsWith("image/")) {
          const text = await res.text();
          let msg = "응답이 이미지가 아닙니다.";
          try {
            const j = JSON.parse(text);
            if (j.error) msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
          } catch {
            if (text) msg = text.slice(0, 220);
          }
          if (!cancelled) {
            setDriveFetchError(msg);
            setDrivePreviewUrl(null);
          }
          return;
        }
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        driveBlobUrlRef.current = obj;
        if (!cancelled) {
          setDrivePreviewUrl(obj);
          setDriveFetchError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDriveFetchError(e instanceof Error ? e.message : String(e));
          setDrivePreviewUrl(null);
        }
      } finally {
        if (!cancelled) setDriveFetchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (driveBlobUrlRef.current) {
        URL.revokeObjectURL(driveBlobUrlRef.current);
        driveBlobUrlRef.current = null;
      }
    };
  }, [drivePhotoBase, drivePhotoBust]);

  const hasData = Array.isArray(data) && data.length > 0;
  const latest = useMemo(() => (hasData ? data[0] : null), [data, hasData]);

  const chartData24h = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const newest = parseTs(data[0]?.ts) ?? new Date();
    const since = new Date(newest.getTime() - 24 * 3600_000);
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
    const since = new Date(newest.getTime() - 3 * 3600_000);
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
      [r.ts, r.sht_temp, r.soil_temp, r.sht_hum, r.soil_hum]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [chartData3h, tableFilter]);

  const tableCols = [
    { key: "ts", label: "ts", render: (r) => r.ts ?? "-" },
    { key: "sht_temp", label: "sht_temp", render: (r) => fmt1(r.sht_temp) },
    { key: "soil_temp", label: "soil_temp", render: (r) => fmt1(r.soil_temp) },
    { key: "sht_hum", label: "sht_hum", render: (r) => fmt1(r.sht_hum) },
    { key: "soil_hum", label: "soil_hum", render: (r) => fmt1(r.soil_hum) },
  ];

  const [weather, setWeather] = useState({
    loading: false,
    error: null,
    data: null,
    meta: null,
  });
  const loadWeather = async () => {
    const serviceKey = import.meta.env.VITE_KMA_SERVICE_KEY;
    const nx = import.meta.env.VITE_KMA_NX ?? "60",
      ny = import.meta.env.VITE_KMA_NY ?? "127";
    const useProxy = import.meta.env.PROD || !serviceKey;
    if (!useProxy && !serviceKey) {
      setWeather({
        loading: false,
        error: "KMA 환경변수 없음",
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
      setWeather({
        loading: true,
        error: null,
        data: null,
        meta: { baseDate, baseTime, nx, ny },
      });
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
    if (tab === "overview") loadWeather();
  }, [tab]);

  const [control, setControl] = useState({
    fan: false,
    pump: false,
    led2: false,
    heater: false,
  });
  /** 제어 직후 loadReadings가 새 행(아직 릴레이 반영 전)을 가져오면 useEffect가 ON으로 되돌리는 경우 방지 */
  const skipControlSyncUntilRef = useRef(0);
  const latestRef = useRef(latest);
  latestRef.current = latest;
  // id만 쓰면 행 단위로 안정적. id 없으면 ts(덜 안정하지만 초기 동기화용).
  const latestRowKey = latest
    ? latest.id != null && String(latest.id).length > 0
      ? `id:${String(latest.id)}`
      : `ts:${String(latest.ts ?? "")}`
    : "";
  useEffect(() => {
    const L = latestRef.current;
    if (!L) return;
    if (Date.now() < skipControlSyncUntilRef.current) return;
    setControl({
      fan: asBool(L.fan),
      pump: asBool(L.pump),
      led2: asBool(L.led2),
      heater: asBool(L.heater),
    });
  }, [latestRowKey]);

  const [controlMsg, setControlMsg] = useState(null);
  const [controlBusy, setControlBusy] = useState(false);
  const sendControl = async (device, state) => {
    const key = DEVICE_API[device];
    if (!key) return;
    try {
      setControlBusy(true);
      setControlMsg("전송 중...");
      const res = await fetch(`${controlApiBase}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, state }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      skipControlSyncUntilRef.current = Date.now() + 5000;
      setControlMsg("전송 완료");
      setTimeout(() => setControlMsg(null), 1500);
      await loadReadings({ silent: true });
    } catch (e) {
      setControl((s) => ({ ...s, [key]: !state }));
      setControlMsg(`제어 API 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setControlBusy(false);
    }
  };

  const pageTitleLabel =
    tab === "overview" ? "OVERVIEW" : tab === "actuator" ? "ACTUATOR" : "RAW DATA";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-title">GREEN HOUSE</div>
          <div className="app-sidebar__brand-sub">CONTROL SYSTEM</div>
        </div>
        <button
          type="button"
          className={`app-nav-btn app-nav-btn--overview ${tab === "overview" ? "app-nav-btn--active" : ""}`}
          onClick={() => setTab("overview")}
        >
          OVERVIEW
        </button>
        <button
          type="button"
          className={`app-nav-btn app-nav-btn--actuator ${tab === "actuator" ? "app-nav-btn--active" : ""}`}
          onClick={() => setTab("actuator")}
        >
          ACTUATOR
        </button>
        <button
          type="button"
          className={`app-nav-btn app-nav-btn--raw ${tab === "rawdata" ? "app-nav-btn--active" : ""}`}
          onClick={() => setTab("rawdata")}
        >
          RAW DATA
        </button>
      </aside>

      <main className="app-main">
        <div className="app-main-header">
          <div className="app-main-title-block">
            <h1 className="app-main-title-block__hero">SMART GREENER</h1>
          </div>
          <div className="app-header-actions">
            <div className="app-profile">
              <div className="app-profile__avatar">J</div>
              <div className="app-profile__name">JINAHN</div>
            </div>
          </div>
        </div>

        <div className="page-hash-row">
          <h2 className="page-hash"># {pageTitleLabel}</h2>
          <button type="button" className="btn-refresh" onClick={loadReadings}>
            새로고침
          </button>
        </div>

        {loading && !hasData && (
          <div className="state-center">로딩중...</div>
        )}
        {error && (
          <div className="state-center state-error">에러: {error}</div>
        )}
        {!loading && !error && !hasData && (
          <div className="state-center">데이터가 없습니다.</div>
        )}

        {hasData && latest && tab === "overview" && (
          <>
            <div className="overview-top">
              <div className="sensor-grid-mini">
                <SensorTile
                  label="TEMP"
                  value={fmt1(numVal(latest.sht_temp))}
                  unit="°C"
                  icon={<IconThermo color={SENSOR_COLORS.shtTemp} size={72} />}
                />
                <SensorTile
                  label="HUMI"
                  value={fmt1(numVal(latest.sht_hum))}
                  unit="%"
                  icon={<IconDrop color={SENSOR_COLORS.shtHum} size={72} />}
                />
                <SensorTile
                  label="SOIL_TEMP"
                  value={fmt1(numVal(latest.soil_temp))}
                  unit="°C"
                  icon={<IconThermo color={SENSOR_COLORS.soilTemp} size={72} />}
                />
                <SensorTile
                  label="SOIL_HUMI"
                  value={fmt1(numVal(latest.soil_hum))}
                  unit="%"
                  icon={<IconDrop color={SENSOR_COLORS.soilHum} size={72} />}
                />
              </div>
              <div className="chart-panel">
                <div className="chart-panel__title">CHART</div>
                <div className="chart-panel__body">
                  <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                    <ComposedChart data={chartData24h}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis yAxisId="temp" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        labelFormatter={(l, p) => p?.[0]?.payload?.ts ?? l}
                      />
                      <Legend
                        align="right"
                        verticalAlign="top"
                        wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
                      />
                      <Area
                        yAxisId="temp"
                        type="monotone"
                        dataKey="soil_temp"
                        name="soil_temp(°C)"
                        dot={false}
                        stroke={SENSOR_COLORS.soilTemp}
                        strokeWidth={1.5}
                        fill={SENSOR_COLORS.soilTemp}
                        fillOpacity={0.4}
                      />
                      <Area
                        yAxisId="hum"
                        type="monotone"
                        dataKey="soil_hum"
                        name="soil_hum(%)"
                        dot={false}
                        stroke={SENSOR_COLORS.soilHum}
                        strokeWidth={1.5}
                        fill={SENSOR_COLORS.soilHum}
                        fillOpacity={0.4}
                      />
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="sht_temp"
                        name="sht_temp(°C)"
                        dot={false}
                        stroke={SENSOR_COLORS.shtTemp}
                        strokeWidth={1.5}
                      />
                      <Line
                        yAxisId="hum"
                        type="monotone"
                        dataKey="sht_hum"
                        name="sht_hum(%)"
                        dot={false}
                        stroke={SENSOR_COLORS.shtHum}
                        strokeWidth={1.5}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overview-bottom">
              <div className="stream-panel">
                <div className="stream-panel__head">
                  <div className="stream-panel__title">LATEST PHOTO (Google Drive)</div>
                  {drivePhotoBase ? (
                    <button
                      type="button"
                      className="btn-refresh"
                      onClick={() => setDrivePhotoBust((n) => n + 1)}
                    >
                      갱신
                    </button>
                  ) : null}
                </div>
                <div className="stream-panel__body">
                  <DriveLatestPhotoPanelBody
                    drivePhotoBase={drivePhotoBase}
                    driveFetchLoading={driveFetchLoading}
                    drivePreviewUrl={drivePreviewUrl}
                    driveFetchError={driveFetchError}
                    onRetry={() => setDrivePhotoBust((n) => n + 1)}
                  />
                </div>
              </div>

              <div className="metrics-column">
                <div className="overview-middle-row">
                  <div className="metric-strip">
                    <OverviewMetricPills latest={latest} />
                  </div>
                  <div className="dif-actuator-card dif-actuator-card--compact">
                    <div className="dif-actuator-card__dif-zone">
                      <div className="dif-block dif-block--inline">
                        <span className="dif-block__label">DIF</span>
                        <div className="dif-block__value-group">
                          <span className="dif-block__value">
                            {fmt1(numVal(latest.dif_intraday_c))}
                          </span>
                          <span className="dif-block__unit">°C</span>
                        </div>
                      </div>
                      <p className="dif-block__hint">
                        ＃0~5℃ 적정생육 / 10℃△ 줄기신장,고온스트레스
                      </p>
                    </div>
                    <div className="actuator-block">
                      <div className="actuator-block__title">ACTUATOR STATUS</div>
                      <ActuatorItem label="FAN" on={control.fan} />
                      <ActuatorItem label="PUMP" on={control.pump} />
                      <ActuatorItem label="HEATER" on={control.heater} />
                      <ActuatorItem label="LED2" on={control.led2} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="weather-panel">
                <div className="weather-panel__title">기상청 WEATHER</div>
                <div className="weather-panel__body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                      초단기실황
                    </span>
                    <button type="button" className="btn-refresh" onClick={loadWeather}>
                      갱신
                    </button>
                  </div>
                  {weather.loading && <div style={{ color: "#64748b", fontSize: 13 }}>로딩중...</div>}
                  {weather.error && (
                    <div style={{ color: "#b91c1c", fontSize: 12 }}>{weather.error}</div>
                  )}
                  {weather.data && (
                    <>
                      <div style={{ fontSize: 40, lineHeight: 1 }}>
                        {kmaSkyIcon({ pty: weather.data.pty, sky: weather.data.sky })}
                      </div>
                      <MetricRow label="기온(T1H)" value={`${weather.data.tempC ?? "-"} °C`} />
                      <MetricRow label="습도(REH)" value={`${weather.data.humPct ?? "-"} %`} />
                      <MetricRow label="하늘(SKY)" value={`${weather.data.sky ?? "-"}`} />
                      <MetricRow label="강수(PTY)" value={`${weather.data.pty ?? "-"}`} />
                      <div className="meta-api">
                        base: <code>{weather.meta?.baseDate}</code>{" "}
                        <code>{weather.meta?.baseTime}</code>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="meta-api" style={{ marginTop: 12 }}>
              읽기 API: <code>{apiBase}</code>
              {controlApiBase !== apiBase ? (
                <>
                  {" "}
                  · 제어 API: <code>{controlApiBase}</code>
                </>
              ) : null}{" "}
              · Latest: <code>{latest.ts ?? "-"}</code> (id:{latest.id ?? "-"})
            </div>
          </>
        )}

        {hasData && latest && tab === "actuator" && (
          <div className="actuator-tab-row">
            <div className="actuator-tab-col actuator-tab-col--manual">
              <div className="manual-control-column actuator-tab-inner">
                <Card
                  className="actuator-tab-card actuator-tab-card--short"
                  title="Manual control"
                  style={{ padding: "10px 12px" }}
                >
                  <ActuatorSwitch
                    label="FAN"
                    icon={<IconFanSmall />}
                    checked={control.fan}
                    disabled={controlBusy}
                    onChange={(c) => {
                      setControl((s) => ({ ...s, fan: c }));
                      sendControl("FAN", c);
                    }}
                  />
                  <ActuatorSwitch
                    label="PUMP"
                    icon={<IconPumpSmall />}
                    checked={control.pump}
                    disabled={controlBusy}
                    onChange={(c) => {
                      setControl((s) => ({ ...s, pump: c }));
                      sendControl("PUMP", c);
                    }}
                  />
                  <ActuatorSwitch
                    label="LED2"
                    icon={<IconLedSmall />}
                    checked={control.led2}
                    disabled={controlBusy}
                    onChange={(c) => {
                      setControl((s) => ({ ...s, led2: c }));
                      sendControl("LED2", c);
                    }}
                  />
                  <ActuatorSwitch
                    label="HEATER"
                    icon={<IconHeaterSmall />}
                    checked={control.heater}
                    disabled={controlBusy}
                    onChange={(c) => {
                      setControl((s) => ({ ...s, heater: c }));
                      sendControl("HEATER", c);
                    }}
                  />
                  {controlMsg && (
                    <div style={{ marginTop: 10, color: "#6b7280" }}>{controlMsg}</div>
                  )}
                </Card>
                <p className="manual-control-footnote">
                  Node-RED <code>POST /api/control</code> → 아두이노 시리얼{" "}
                  <code>FAN:1</code> 형식. 아래 스위치·상태는 제어 직후 바로 반영되며, DB 읽기
                  행이 갱신될 때 서버 값과 다시 맞춥니다.
                </p>
              </div>
            </div>
            <div className="actuator-tab-col actuator-tab-col--status">
              <Card
                  className="actuator-tab-card actuator-tab-card--short"
                  title="Actuator Status"
                  style={{ padding: "10px 12px" }}
                >
                <ActuatorItem label="FAN" on={control.fan} />
                <ActuatorItem label="PUMP" on={control.pump} />
                <ActuatorItem label="HEATER" on={control.heater} />
                <ActuatorItem label="LED2" on={control.led2} />
              </Card>
            </div>
            <div className="actuator-tab-col actuator-tab-col--stream">
              <div className="stream-panel stream-panel--actuator-row">
                <div className="stream-panel__title">LIVE PHOTO / STREAM</div>
                <div className="stream-panel__body">
                  {camUrl ? (
                    <img src={camUrl} alt="온실 MJPEG 스트림" />
                  ) : (
                    <>
                      ACTUATOR용 라이브 스트림 — .env에{" "}
                      <code style={{ fontSize: 10, color: "#94a3b8" }}>VITE_ESP32CAM_URL</code> 설정
                      <br />
                      <code style={{ fontSize: 10, marginTop: 8, color: "#94a3b8" }}>
                        VITE_ESP32CAM_URL=http://ESP32_IP/stream
                      </code>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasData && latest && tab === "rawdata" && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>
                Raw data (최근 3시간)
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                    width: 180,
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    exportCsv(
                      filteredRows3h,
                      tableCols,
                      `smartfarm_${new Date().toISOString().slice(0, 10)}.csv`
                    )
                  }
                  style={{
                    border: "1px solid #16a34a",
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  Excel 추출
                </button>
              </div>
            </div>
            <DataTable rows={filteredRows3h} columns={tableCols} />
          </Card>
        )}
      </main>
    </div>
  );
}
