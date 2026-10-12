import { requireEditor } from "../lib/editor-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const status = req.query.status || "all";
  const allowedStatuses = ["all", "published", "pending", "rejected"];

  if (typeof status !== "string" || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const page = Number(req.query.page || 1);

  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
    return res.status(400).json({ error: "Invalid page" });
  }

  const limit = 20;
  const offset = (page - 1) * limit;

  const params = new URLSearchParams({
    select: "id,title,status,importance,processing_status,manually_reviewed,site_published_at,source_url",
    order: "id.desc",
    limit: String(limit),
    offset: String(offset)
  });

  if (status !== "all") {
    params.set("status", `eq.${status}`);
  }

  try {
    const countStatuses = ["pending", "published", "rejected"];

const counts = Object.fromEntries(
  await Promise.all(countStatuses.map(async (item) => {
    const countParams = new URLSearchParams({
      select: "id",
      status: `eq.${item}`,
      limit: "0"
    });

    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/articles?${countParams.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact"
        }
      }
    );

    if (!countResponse.ok) throw new Error("Count request failed");

    const range = countResponse.headers.get("content-range");
    const count = range ? Number(range.split("/")[1]) : NaN;

    if (!Number.isFinite(count)) throw new Error("Invalid count");

    return [item, count];
  }))
);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/articles?${params.toString()}`,
      {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "count=exact"
      }
    }
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch articles" });
    }
    const articles = await response.json();

    const contentRange = response.headers.get("content-range");
    const total = contentRange
        ? Number(contentRange.split("/")[1])
        : null;

    return res.status(200).json({
  articles,
  page,
  limit,
  total,
  counts
});

  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
