import { cleanArticleHtml } from "./html-text-cleaner.js";

/**
 * 元記事からAI処理用の本文テキストを取得する。
 */
export async function extractSourceText(sourceUrl) {
  const articleResponse = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!articleResponse.ok) {
    throw new Error(
      `Source article fetch failed: ${articleResponse.status}`
    );
  }

  const html = await articleResponse.text();

  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i);

  const articleHtml = mainMatch ? mainMatch[0] : html;

  return cleanArticleHtml(articleHtml);
}
