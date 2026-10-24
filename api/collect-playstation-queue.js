import { collectPlayStationArticles } from "../lib/playstation-collector.js";
import { registerPendingArticle } from "../lib/article-queue-repository.js";

/**
 * PlayStation Blogの新着記事を収集し、
 * 共通の記事登録処理でpending保存する。
 *
 * CRON_SECRETによる認証が必要。
 */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    req.headers.authorization !== `Bearer ${cronSecret}`
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  try {
    const articles = await collectPlayStationArticles();

    const results = [];

    for (const article of articles) {
      const result = await registerPendingArticle(article);
      results.push(result);
    }

    const counts = {
      pending: results.filter(r => r.status === "pending").length,
      existing: results.filter(r => r.status === "existing").length,
      error: results.filter(r => r.status === "error").length
    };

    return res.status(counts.error > 0 ? 500 : 200).json({
      success: counts.error === 0,
      source: "PlayStation",
      checked: articles.length,
      ...counts,
      results
    });

  } catch (error) {
    console.error("PlayStation collection failed:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
