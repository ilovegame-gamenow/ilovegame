import { newsSources } from "../lib/news-sources.js";
import { registerPendingArticle } from "../lib/article-queue-repository.js";

/**
 * ゲームニュース共通収集API
 *
 * source省略時は有効な全メーカーを収集する。
 * source指定時は指定メーカーのみ収集する。
 *
 * 各メーカーの最大確認件数は
 * news-sources.js の maxArticles で管理する。
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

  const source = req.query?.source;

  if (
    source !== undefined &&
    (
      typeof source !== "string" ||
      !Object.hasOwn(newsSources, source) ||
      !newsSources[source].enabled
    )
  ) {
    return res.status(400).json({
      success: false,
      error: "Unsupported news source"
    });
  }

  const selectedSources = source
    ? [[source, newsSources[source]]]
    : Object.entries(newsSources).filter(
        ([, config]) => config.enabled
      );

  if (selectedSources.length === 0) {
    return res.status(400).json({
      success: false,
      error: "No enabled news sources"
    });
  }

  const totals = {
    checked: 0,
    pending: 0,
    existing: 0,
    error: 0
  };

  const sources = [];

  for (const [key, collector] of selectedSources) {
    try {
      // news-sources.js の最大確認件数を適用
      const maxArticles = collector.maxArticles;

      if (
        !Number.isSafeInteger(maxArticles) ||
        maxArticles < 0
      ) {
        throw new Error(
          `Invalid maxArticles setting for ${key}`
        );
      }

      // 各メーカーの収集モジュールへ件数を渡す
      const articles = await collector.collect(maxArticles);

      // 念のため共通API側でも件数を制限
      const limitedArticles = articles.slice(0, maxArticles);

      // 検証時は登録対象を最大1件に制限
      const targetArticles =
        req.query?.test === "1"
          ? limitedArticles.slice(0, 1)
          : limitedArticles;

      const results = [];

      for (const article of targetArticles) {
        try {
          const result = await registerPendingArticle(
            article,
            {
              supabaseUrl,
              supabaseKey
            }
          );

          results.push(result);
        } catch (error) {
          console.error(
            `${collector.name} article registration failed:`,
            error
          );

          results.push({
            status: "error",
            error: error.message
          });
        }
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

      totals.checked += limitedArticles.length;

      for (const field of ["pending", "existing", "error"]) {
        totals[field] += counts[field];
      }

      sources.push({
        source: key,
        name: collector.name,
        maxArticles,
        checked: limitedArticles.length,
        ...counts,
        results
      });

    } catch (error) {
      console.error(
        `${collector.name} collection failed:`,
        error
      );

      totals.error += 1;

      sources.push({
        source: key,
        name: collector.name,
        success: false,
        error: error.message
      });
    }
  }

  const success = totals.error === 0;

  return res.status(success ? 200 : 500).json({
    success,
    ...totals,
    sources
  });
}
