/**
 * Google Apps Script 웹앱(JSON: mimeType + base64 data) → 이미지 바이너리로 변환해 응답.
 * 서비스 계정 JSON 키 없이, 스크립트 실행 계정(본인 Google) 권한으로 Drive 접근.
 *
 * Vercel 환경변수: APPS_SCRIPT_WEBAPP_URL = 웹앱 배포 URL (…/exec)
 *
 * ---------- 아래는 Google Apps Script 편집기에 붙여넣을 코드 ----------
 * 1. script.google.com → 새 프로젝트
 * 2. 코드.gs 에 붙여넣기 후 FOLDER_ID 만 본인 폴더로 수정
 * 3. 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 → 액세스: 모든 사용자(또는 조직)
 * 4. 생성된 웹 앱 URL을 Vercel APPS_SCRIPT_WEBAPP_URL 에 저장
 *
 * function doGet(e) {
 *   var FOLDER_ID = "여기에_Drive_폴더_ID";
 *   try {
 *     var folder = DriveApp.getFolderById(FOLDER_ID);
 *     var files = folder.getFiles();
 *     var latest = null;
 *     var latestTime = 0;
 *     while (files.hasNext()) {
 *       var f = files.next();
 *       var mime = f.getMimeType();
 *       if (mime.indexOf("image/") !== 0) continue;
 *       var t = f.getLastUpdated().getTime();
 *       if (t > latestTime) {
 *         latestTime = t;
 *         latest = f;
 *       }
 *     }
 *     if (!latest) {
 *       return ContentService.createTextOutput(JSON.stringify({ error: "폴더에 이미지 없음" }))
 *         .setMimeType(ContentService.MimeType.JSON);
 *     }
 *     var blob = latest.getBlob();
 *     var out = {
 *       mimeType: blob.getContentType(),
 *       name: latest.getName(),
 *       data: Utilities.base64Encode(blob.getBytes()),
 *     };
 *     return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ error: String(err.message || err) }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 * ---------- 끝 ----------
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const scriptUrl = process.env.APPS_SCRIPT_WEBAPP_URL;
  if (!scriptUrl || !String(scriptUrl).trim()) {
    return res.status(503).json({
      error: "Vercel에 APPS_SCRIPT_WEBAPP_URL(Apps Script 웹앱 URL)을 설정하세요.",
    });
  }

  try {
    const r = await fetch(String(scriptUrl).trim(), {
      redirect: "follow",
    });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Apps Script 응답이 JSON이 아닙니다. 웹앱 배포·권한을 확인하세요.",
        detail: text.slice(0, 300),
      });
    }
    if (j.error) {
      return res.status(404).json({ error: j.error });
    }
    if (!j.data || !j.mimeType) {
      return res.status(502).json({
        error: "Apps Script JSON에 data/mimeType이 없습니다.",
      });
    }
    const buf = Buffer.from(j.data, "base64");
    res.setHeader("Content-Type", j.mimeType);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({
      error: "apps-script-photo proxy failed",
      detail: String(e?.message || e),
    });
  }
}
