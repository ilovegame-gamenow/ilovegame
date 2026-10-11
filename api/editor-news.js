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
    const response = await fetch(
      `${supabaseUrl}/rest/v1/articles?${params.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch articles" });
    }

    const articles = await response.json();

    return res.status(200).json({
      articles,
      page,
      limit
    });
  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
