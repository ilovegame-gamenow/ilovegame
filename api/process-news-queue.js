import { newsConfig } from "../lib/news-config.js";
import { generateArticle } from "../lib/article-generator.js";
import { extractSourceText } from "../lib/source-extractor.js";
import { evaluateNewsImportance } from "../lib/news-evaluator.js";
import { determinePublicationPolicy } from "../lib/publication-policy.js";
import { updateArticle } from "../lib/article-repository.js";
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const cronSecret = process.env.CRON_SECRET;

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
    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return res.status(500).json({
        success: false,
        error: "Environment variables are missing"
      });
    }

    // pendingの記事を古い順に最大3件取得
    const queueUrl = new URL(
      `${supabaseUrl}/rest/v1/articles`
    );

    queueUrl.searchParams.set(
      "select",
      "id,source_title,source_name,source_url,source_published_at,site_published_at"
    );
    queueUrl.searchParams.set(
      "processing_status",
      "eq.pending"
    );
    queueUrl.searchParams.set(
  "manually_reviewed",
  "not.is.true"
);
    queueUrl.searchParams.set(
      "order",
      "source_published_at.asc"
    );
    queueUrl.searchParams.set("limit", "3");

    const queueResponse = await fetch(
      queueUrl.toString(),
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!queueResponse.ok) {
      throw new Error(
        `Queue fetch failed: ${await queueResponse.text()}`
      );
    }

    const pendingArticles =
      await queueResponse.json();

    if (
      !Array.isArray(pendingArticles) ||
      pendingArticles.length === 0
    ) {
      return res.status(200).json({
        success: true,
        processed: 0,
        message: "No pending articles"
      });
    }

    const results = [];

    for (const item of pendingArticles) {
      try {
        // 処理中に変更
        await updateArticle(
          supabaseUrl,
          supabaseKey,
          item.id,
          {
            processing_status: "processing"
          }
        );
        // 公式記事の本文を取得し、不要なHTML要素を除去してテキストを抽出
        const cleanText = await extractSourceText(item.source_url);
        // STEP 1：AIで記事の重要度を事前評価する
        const preScore = await evaluateNewsImportance({
          sourceTitle: item.source_title,
          sourceText: cleanText,
          openaiKey
        });
        const publicationPolicy = determinePublicationPolicy(preScore);
        // 50点以下は記事を生成せず、自動非掲載にする
        if (publicationPolicy === "rejected") {
  await updateArticle(
    supabaseUrl,
    supabaseKey,
    item.id,
    {
      importance: preScore,
      status: "rejected",
      processing_status: "completed",
      article_body: null,
      site_published_at: null
    }
  );

  results.push({
    id: item.id,
    importance: preScore,
    status: "rejected"
  });

  continue;
}
        // AI記事生成（重要度の事前判定後に実行する）
        const aiArticle = await generateArticle({
          sourceTitle: item.source_title,
          sourceText: cleanText,
          openaiKey
        });
        
        const importance = preScore;

        // 51〜79点はAI記事を保存し、手動審査を待つ
        if (publicationPolicy === "review") {
  await updateArticle(
    supabaseUrl,
    supabaseKey,
    item.id,
    {
      title: aiArticle.title || item.source_title,
      summary: aiArticle.summary || "",
      article_body: aiArticle.article_body || "",
      ilovegame_point: aiArticle.ilovegame_point || "",
      importance,
      status: "pending",
      processing_status: "completed",
      published_at: null,
      site_published_at: null
    }
  );

  results.push({
    id: item.id,
    title: aiArticle.title || item.source_title,
    importance,
    status: "pending"
  });

  continue;
}

        // 設定した掲載基準以上は記事として公開
        await updateArticle(
          supabaseUrl,
          supabaseKey,
          item.id,
          {
            title:
              aiArticle.title ||
              item.source_title,
            summary:
              aiArticle.summary || "",
            article_body:
              aiArticle.article_body || "",
            ilovegame_point:
              aiArticle.ilovegame_point || "",
            importance,
            status: "published",
            processing_status: "completed",
            site_published_at: item.site_published_at || new Date().toISOString(),
            published_at:
              item.source_published_at ||
              new Date().toISOString()
          }
        );

        results.push({
          id: item.id,
          title:
            aiArticle.title ||
            item.source_title,
          importance,
          status: "published"
        });

      } catch (error) {
        // 失敗した記事は次回やり直せるようpendingへ戻す
        try {
          await updateArticle(
            supabaseUrl,
            supabaseKey,
            item.id,
            {
              processing_status: "pending"
            }
          );
        } catch (_) {}

        results.push({
          id: item.id,
          title: item.source_title,
          status: "error",
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
