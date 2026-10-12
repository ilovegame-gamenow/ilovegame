
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
