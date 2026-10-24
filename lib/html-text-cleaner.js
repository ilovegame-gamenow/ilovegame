/**
 * HTMLをAI処理用のプレーンテキストに変換する。
 * Nintendo・PlayStationなどで共通利用する。
 */
export function cleanArticleHtml(articleHtml) {
  let cleanText = articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const cutoffMarkers = [
    "関連リンク",
    "この記事のほかにも、こんな記事があります。"
  ];

  for (const marker of cutoffMarkers) {
    const index = cleanText.indexOf(marker);

    if (index !== -1) {
      cleanText = cleanText.slice(0, index).trim();
    }
  }

  return cleanText;
}
