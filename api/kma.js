export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { baseDate, baseTime, nx, ny } = req.query;
  const serviceKey = process.env.KMA_SERVICE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: "KMA_SERVICE_KEY not configured on server" });
  }
  if (!baseDate || !baseTime || !nx || !ny) {
    return res.status(400).json({ error: "Missing query params: baseDate, baseTime, nx, ny" });
  }

  const url = new URL(
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
  );
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", nx);
  url.searchParams.set("ny", ny);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: "KMA API request failed", detail: e.message });
  }
}
