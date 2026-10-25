import { newsSources } from "../lib/news-sources.js";
import { registerPendingArticle } from "../lib/article-queue-repository.js";

/**
 * ゲームニュース共通収集API
 *
 * source=nintendo または source=playstation
 * source省略時はNintendoを収集する。
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

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: "Supabase environment variables are missing"
    });
  }

  const source = req.query?.source || "nintendo";

  if (
  typeof source !== "string" ||
  !Object.hasOwn(newsSources, source) ||
  !newsSources[source].enabled
) {
    return res.status(400).json({
      success: false,
      error: "Unsupported news source"
    });
  }

  const collector = newsSources[source];

  try {
    const articles = await collector.collect();

    // 検証時は登録対象を最大1件に制限
    const targetArticles =
      req.query?.test === "1"
        ? articles.slice(0, 1)
        : articles;

    const results = [];

    for (const article of targetArticles) {
      const result = await registerPendingArticle(article, {
        supabaseUrl,
        supabaseKey
      });

      results.push(result);
    }

    const counts = {
      pending: results.filter(
        result => result.status === "pending"
      ).length,
      existing: results.filter(
        result => result.status === "existing"
      ).length,
      error: results.filter(
        result => result.status === "error"
      ).length
    };

    return res.status(counts.error > 0 ? 500 : 200).json({
      success: counts.error === 0,
      source: collector.name,
      checked: articles.length,
      ...counts,
      results
    });
  } catch (error) {
    console.error(
      `${collector.name} collection failed:`,
      error
    );

    return res.status(500).json({
      success: false,
      source: collector.name,
      error: error.message
    });
  }
}
