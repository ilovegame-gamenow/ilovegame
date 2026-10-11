import { requireEditor } from "./editor-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  const { id, status } = req.body || {};

  const allowedStatuses = ["published", "pending", "rejected"];

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof status !== "string" ||
    !allowedStatuses.includes(status)
  ) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const url =
    `${supabaseUrl}/rest/v1/articles?id=eq.${id}`;

  const updates = {
    status,
    manually_reviewed: true
  };

  if (status === "published") {
    updates.site_published_at = new Date().toISOString();
  }

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to update article" });
    }

    const articles = await response.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(404).json({ error: "Article not found" });
    }

    return res.status(200).json({
      ok: true,
      article: articles[0]
    });
  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
