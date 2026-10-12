import { processNewsQueue } from "../lib/news-processor.js";

/**
 * AIニュース処理キューの実行API。
 * 認証と環境変数を確認し、共通ニュース処理エンジンを呼び出す。
 */
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const cronSecret = process.env.CRON_SECRET;

    // CRON_SECRETによる実行認証
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

    // 必要な環境変数を確認
    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return res.status(500).json({
        success: false,
        error: "Environment variables are missing"
      });
    }

    // 共通ニュース処理エンジンを実行
    const result = await processNewsQueue({
      supabaseUrl,
      supabaseKey,
      openaiKey
    });

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
