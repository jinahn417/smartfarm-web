/**
 * Vercel 서버리스: 브라우저는 동일 출처 POST /api/control 만 호출하고,
 * 여기서 Node-RED(또는 Pi)의 실제 /api/control 로 프록시합니다.
 * (터널 URL을 VITE_ 로 빌드에 넣어 직접 호출하면 404·CORS 이슈가 나기 쉬움)
 *
 * Vercel 환경변수: CONTROL_API_UPSTREAM — 예: https://xxx.trycloudflare.com
 * (끝에 / 붙이지 않음, /api/control 이 자동으로 붙음)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  /* 주소창·즐겨찾기는 GET → 제어는 POST만 허용 */
  if (req.method === "GET") {
    const host = req.headers?.host || "";
    const base = host ? `https://${host}` : "";
    return res.status(200).json({
      ok: false,
      hint: "제어는 POST(JSON body)만 됩니다. 브라우저 주소창으로 열면 GET이라 여기까지 옵니다. ACTUATOR 탭 Manual control 또는 아래 curl을 쓰세요.",
      postBodyExample: { device: "FAN", state: false },
      curlExample: `curl -X POST -H "Content-Type: application/json" -d "{\\"device\\":\\"FAN\\",\\"state\\":false}" ${base}/api/control`,
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", allow: ["POST", "GET"] });
  }

  const upstream = process.env.CONTROL_API_UPSTREAM;
  if (!upstream || !String(upstream).trim()) {
    return res.status(500).json({
      error: "CONTROL_API_UPSTREAM not configured",
      hint: "Vercel 프로젝트 Settings → Environment Variables 에 Node-RED/Pi 베이스 URL을 넣으세요.",
    });
  }

  const base = String(upstream).trim().replace(/\/$/, "");
  const target = `${base}/api/control`;

  let bodyText = "";
  if (typeof req.body === "string") {
    bodyText = req.body;
  } else if (req.body != null && typeof req.body === "object") {
    bodyText = JSON.stringify(req.body);
  } else {
    bodyText = await readBody(req);
  }

  try {
    const r = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText || "{}",
    });
    const text = await r.text();
    const ct = r.headers.get("content-type") || "";

    /* 업스트림 404 = Node-RED 주소·포트 틀림 또는 플로우에 POST /api/control 없음 — 그대로 404면 Vercel 라우트 없음과 헷갈림 */
    if (r.status === 404) {
      return res.status(502).json({
        error: "UPSTREAM_404",
        message:
          "Vercel은 Node-RED에 연결했지만, 그 베이스 주소에 POST /api/control 이 없습니다. Vercel 환경변수 CONTROL_API_UPSTREAM 을 Node-RED HTTP가 열린 URL로 맞추세요(예: 공인IP:21880 포워딩이면 http://공인IP:21880). 센서용 8765와 포트가 다를 수 있습니다.",
        triedUrl: target,
      });
    }

    if (ct.includes("application/json")) {
      try {
        return res.status(r.status).json(JSON.parse(text || "{}"));
      } catch {
        return res.status(r.status).send(text);
      }
    }
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({
      error: "Upstream control request failed",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
