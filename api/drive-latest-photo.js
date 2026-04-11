import { JWT } from "google-auth-library";

/**
 * GET — 폴더 안 이미지 중 modifiedTime 최신 1장을 Drive API로 받아 그대로 응답합니다.
 * Vercel 환경변수: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_IMAGE_FOLDER_ID
 * (폴더를 서비스 계정 이메일과 공유해야 합니다.)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const folderId = process.env.GOOGLE_DRIVE_IMAGE_FOLDER_ID;
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!folderId || !jsonRaw) {
    return res.status(503).json({
      error: "Configure GOOGLE_DRIVE_IMAGE_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_JSON",
    });
  }

  let credentials;
  try {
    credentials = JSON.parse(jsonRaw);
  } catch {
    return res.status(503).json({ error: "Invalid GOOGLE_SERVICE_ACCOUNT_JSON" });
  }

  try {
    const jwt = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const tokenResponse = await jwt.getAccessToken();
    const token = tokenResponse?.token;
    if (!token) {
      return res.status(503).json({ error: "Could not obtain access token" });
    }

    const q = `'${folderId.replace(/'/g, "\\'")}' in parents and mimeType contains 'image/' and trashed = false`;
    const listUrl =
      "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(q) +
      "&orderBy=" +
      encodeURIComponent("modifiedTime desc") +
      "&pageSize=1&fields=" +
      encodeURIComponent("files(id,name,mimeType)");

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      return res.status(502).json({
        error: "Drive files.list failed",
        status: listRes.status,
        detail: t.slice(0, 400),
      });
    }

    const listData = await listRes.json();
    const file = listData.files?.[0];
    if (!file?.id) {
      return res.status(404).json({ error: "No image files in folder" });
    }

    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mediaRes.ok) {
      const t = await mediaRes.text();
      return res.status(502).json({
        error: "Drive media download failed",
        detail: t.slice(0, 300),
      });
    }

    const mime =
      mediaRes.headers.get("content-type") || file.mimeType || "image/jpeg";
    const buf = Buffer.from(await mediaRes.arrayBuffer());

    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({
      error: "drive-latest-photo failed",
      detail: String(e?.message || e),
    });
  }
}
