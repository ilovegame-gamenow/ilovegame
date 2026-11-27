import { publicPublisherLabel } from '../lib/publisher-directory.js';
import { getArticleDraft } from "../lib/article-draft-repository.js";
import { requireEditor } from "../lib/editor-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  const id = req.query.id;

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id) ||
    !Number.isSafeInteger(Number(id))
  ) {
    return res.status(400).json({ error: "Invalid article ID" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const fields = [
    "id",
    "title",
    "summary",
    "article_body",
    "ilovegame_point",
    "thumbnail_url",
    "source_name",
    "source_url",
    "source_published_at",
    "site_published_at",
    "created_at",
    "published_at",
    "importance",
    "processing_status",
    "status",
    "platforms",
    "category",
    "image_rights_status", "image_rights_note", "image_rights_source_url",
    "image_rights_original_url", "image_rights_evidence_url", "image_rights_holder",
    "image_rights_credit", "image_rights_scope", "image_rights_verified_at", "image_rights_expires_at"
  ].join(",");

  const params = new URLSearchParams({
    select: fields,
    id: `eq.${id}`,
    limit: "1"
  });

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/editor_article_image_rights?${params.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "Failed to fetch article"
      });
    }

    const articles = await response.json();

    if (!articles.length) {
      return res.status(404).json({
        error: "Article not found"
      });
    }

    return res.status(200).json({
      article: {...articles[0],source_display_name:await publicPublisherLabel(supabaseUrl,supabaseKey,articles[0].source_name)},
      draft: await getArticleDraft(supabaseUrl, supabaseKey, Number(id))
    });
  } catch {
    return res.status(502).json({
      error: "Database request failed"
    });
  }
}
