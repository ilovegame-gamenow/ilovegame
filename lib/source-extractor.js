import { cleanArticleHtml } from "./html-text-cleaner.js";
import { extractPlayStationArticleHtml } from "./playstation-extractor.js";

/**
 * 元記事からAI処理用の本文テキストを取得する。
 * PlayStation Blogは専用抽出処理を使用し、
 * それ以外は従来の抽出処理を維持する。
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

  const hostname = new URL(sourceUrl).hostname.toLowerCase();

  let articleHtml;

  if (hostname === "blog.ja.playstation.com") {
    articleHtml = extractPlayStationArticleHtml(html);

    if (!articleHtml) {
      throw new Error(
        "PlayStation article body not found"
      );
    }
  } else {
    // Nintendoなど、従来の本文抽出処理
    const mainMatch =
      html.match(/<main[\s\S]*?<\/main>/i) ||
      html.match(/<article[\s\S]*?<\/article>/i);

    articleHtml = mainMatch ? mainMatch[0] : html;
  }

  return cleanArticleHtml(articleHtml);
}
