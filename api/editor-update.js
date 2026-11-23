import { requireEditor, requireEditorOrigin } from "../lib/editor-auth.js";
import { isGameId } from "../lib/game-catalog-input.js";
import { catalogRequest } from "../lib/catalog-database.js";
import { getArticleById } from "../lib/article-repository.js";
import { canPublishArticle } from "../lib/article-publication.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  const { id, status, exclude_game_id } = req.body || {};

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

  if (exclude_game_id !== undefined) {
    if (status !== "rejected" || !isGameId(exclude_game_id)) return res.status(400).json({error:"作品の指定が正しくありません"});
    if (!requireEditorOrigin(req,res)) return;
    try {
      const ok=await catalogRequest(supabaseUrl,supabaseKey,'rpc/reject_article_with_tracking',{method:'POST',body:JSON.stringify({p_article_id:id,p_game_id:exclude_game_id})});
      if(ok!==true)return res.status(409).json({error:"記事の処理状態または関連作品が変わりました。再読み込みしてください。"});
      return res.status(200).json({ok:true});
    } catch { return res.status(502).json({error:"非掲載・追跡対象外の保存に失敗しました"}); }
  }

  const url =
    `${supabaseUrl}/rest/v1/articles?id=eq.${id}`;
  if (status === "published") {
  try {
    const article = await getArticleById(
      supabaseUrl,
      supabaseKey,
      id
    );

    if (!article) {
      return res.status(404).json({
        error: "Article not found"
      });
    }

    if (!canPublishArticle(article)) {
  return res.status(409).json({
    error: "AI処理またはAI再生成後の保存が未完了、もしくは記事内容が未完成のため掲載できません"
  });
}
  } catch {
    return res.status(502).json({
      error: "Failed to verify article"
    });
  }
}

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
