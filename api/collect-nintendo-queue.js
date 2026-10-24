import { registerPendingArticle } from "../lib/article-queue-repository.js";

/**
 * Nintendo Topicsの新着記事を収集し、
 * 共通の記事登録処理を使ってpendingで保存する。
 */
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const cronSecret = process.env.CRON_SECRET;

    // Cron認証
    const authHeader = req.headers.authorization;

    if (
      !cronSecret ||
      authHeader !== `Bearer ${cronSecret}`
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: "Supabase environment variables are missing"
      });
    }

    const latest = [];

    // Nintendo Topics 1〜4ページを取得
    for (let page = 1; page <= 4; page++) {
      const response = await fetch(
        `https://www.nintendo.com/jp/topics/c/_/v0/posts/search?page=${page}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Nintendo API failed on page ${page}`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      latest.push(...data);
    }

    const results = [];

    for (const item of latest) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      // Nintendo固有のデータを共通形式に変換
      const article = {
        source_title: item.title,
        source_name: "Nintendo",
        source_url: sourceUrl,
        source_published_at: item.display_date,
        thumbnail_url: item.thumbnail?.url_key || null
      };

      // 重複確認・pending登録は共通処理に任せる
      const result = await registerPendingArticle(article, {
        supabaseUrl,
        supabaseKey
      });

      results.push(result);
    }

    return res.status(200).json({
      success: true,
      checked: latest.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
