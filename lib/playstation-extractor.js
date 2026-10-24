/**
 * PlayStation Blogの記事本文領域を抽出する。
 * HTMLから本文部分を切り出し、共通のテキスト整形処理へ渡す。
 */
export function extractPlayStationArticleHtml(html) {
  if (typeof html !== "string" || !html) {
    return null;
  }

  const openingTag = /<div\b[^>]*class=["'][^"']*\bpost-single__content\b[^"']*["'][^>]*>/i;
  const match = openingTag.exec(html);

  if (!match) {
    return null;
  }

  const start = match.index;
  let position = start + match[0].length;
  let depth = 1;

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = position;

  let tagMatch;

  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const tag = tagMatch[0];

    if (/^<\/div/i.test(tag)) {
      depth -= 1;

      if (depth === 0) {
        return html.slice(start, tagPattern.lastIndex);
      }
    } else if (!/\/>$/.test(tag)) {
      depth += 1;
    }

    position = tagPattern.lastIndex;
  }

  return null;
}
