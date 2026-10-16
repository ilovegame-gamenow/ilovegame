import { requireEditor } from "../lib/editor-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  const { id, title, summary, article_body, ilovegame_point } = req.body || {};

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 300 ||
    typeof summary !== "string" ||
    summary.length > 3000 ||
    typeof article_body !== "string" ||
    article_body.length > 50000 ||
    typeof ilovegame_point !== "string" ||
    ilovegame_point.length > 3000
  ) {
    return res.status(400).json({ error: "Invalid article data" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const updates = {
    title: title.trim(),
    summary: summary.trim(),
    article_body: article_body.trim(),
    ilovegame_point: ilovegame_point.trim()
  };

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/articles?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(updates)
      }
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to save article" });
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
