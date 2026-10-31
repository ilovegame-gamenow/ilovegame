import { getSiteSettings, toNewsConfig } from "./site-settings.js";
import { generateArticle } from "./article-generator.js";
import { extractSourceText } from "./source-extractor.js";
import { evaluateNewsImportance } from "./news-evaluator.js";
import { determinePublicationPolicy } from "./publication-policy.js";
import { updateArticle, getPendingArticles } from "./article-repository.js";

/**
 * AI処理待ちのニュースを取得し、順番に処理する。
 * 収集元に依存しない共通ニュース処理エンジン。
 */
export async function processNewsQueue({
  supabaseUrl,
  supabaseKey,
  openaiKey
}) {
  const pendingArticles = await getPendingArticles(supabaseUrl, supabaseKey);

  if (!Array.isArray(pendingArticles) || pendingArticles.length === 0) {
    return {
      success: true,
      processed: 0,
      message: "No pending articles"
    };
  }

  const config = toNewsConfig(await getSiteSettings(supabaseUrl, supabaseKey));
  const results = [];

  for (const item of pendingArticles) {
    try {
      // 処理中に変更
      await updateArticle(supabaseUrl, supabaseKey, item.id, {
        processing_status: "processing"
      });

      // 公式記事の本文を取得
      const cleanText = await extractSourceText(item.source_url);

      // AIによる重要度の事前評価
      const preScore = await evaluateNewsImportance({
        sourceTitle: item.source_title,
        sourceText: cleanText,
        openaiKey,
        evaluationGuidelines: config.evaluationGuidelines
      });

      const publicationPolicy = determinePublicationPolicy(preScore, config);

      // 生成しない点数以下：記事を生成せず非掲載
      if (publicationPolicy === "rejected") {
        await updateArticle(supabaseUrl, supabaseKey, item.id, {
          importance: preScore,
          status: "rejected",
          processing_status: "completed",
          article_body: null,
          site_published_at: null
        });

        results.push({
          id: item.id,
          importance: preScore,
          status: "rejected"
        });

        continue;
      }

      // 生成対象の点数：AI記事を生成
      const aiArticle = await generateArticle({
        sourceTitle: item.source_title,
        sourceText: cleanText,
        openaiKey
      });

      const importance = preScore;

      // 自動掲載の基準未満：記事生成後、手動審査へ
      if (publicationPolicy === "review") {
        await updateArticle(supabaseUrl, supabaseKey, item.id, {
          title: aiArticle.title || item.source_title,
          summary: aiArticle.summary || "",
          article_body: aiArticle.article_body || "",
          ilovegame_point: aiArticle.ilovegame_point || "",
          importance,
          status: "pending",
          processing_status: "completed",
          published_at: null,
          site_published_at: null
        });

        results.push({
          id: item.id,
          title: aiArticle.title || item.source_title,
          importance,
          status: "pending"
        });

        continue;
      }

      // 自動掲載の基準以上：自動掲載
      await updateArticle(supabaseUrl, supabaseKey, item.id, {
        title: aiArticle.title || item.source_title,
        summary: aiArticle.summary || "",
        article_body: aiArticle.article_body || "",
        ilovegame_point: aiArticle.ilovegame_point || "",
        importance,
        status: "published",
        processing_status: "completed",
        site_published_at:
          item.site_published_at || new Date().toISOString(),
        published_at:
          item.source_published_at || new Date().toISOString()
      });

      results.push({
        id: item.id,
        title: aiArticle.title || item.source_title,
        importance,
        status: "published"
      });

    } catch (error) {
      // 失敗した記事は次回やり直せるようpendingへ戻す
      try {
        await updateArticle(supabaseUrl, supabaseKey, item.id, {
          processing_status: "pending"
        });
      } catch (_) {}

      results.push({
        id: item.id,
        title: item.source_title,
        status: "error",
        error: error.message
      });
    }
  }

  return {
    success: true,
    processed: results.length,
    results
  };
}
