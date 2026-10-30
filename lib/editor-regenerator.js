import { getArticleById } from "./article-repository.js";
import { extractSourceText } from "./source-extractor.js";
import { generateArticle } from "./article-generator.js";

/**
 * 編集室から指定された記事をAIで再生成する。
 * 生成結果を返すだけで、Supabaseには保存しない。
 */
export async function regenerateEditorArticle({
  id,
  supabaseUrl,
  supabaseKey,
  openaiKey
}) {
  const article = await getArticleById(supabaseUrl, supabaseKey, id);

  if (!article) {
    throw new Error("Article not found");
  }

  if (!article.source_title || !article.source_url) {
    throw new Error("Article source is missing");
  }

  const sourceUrl = new URL(article.source_url);

  
const allowedHosts = [
  "www.nintendo.com",
  "blog.ja.playstation.com"
];

if (
  sourceUrl.protocol !== "https:" ||
  !allowedHosts.includes(sourceUrl.hostname.toLowerCase())
) {
  throw new Error("Unsupported source URL");
}


  const sourceText = await extractSourceText(sourceUrl.toString());

  return generateArticle({
    sourceTitle: article.source_title,
    sourceText,
    openaiKey
  });
}
