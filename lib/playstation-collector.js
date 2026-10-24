/**
 * PlayStation Blog（日本語版）のRSSから
 * 新着記事の基本情報を取得する。
 *
 * Supabaseへの保存やAI処理は行わない。
 */

const RSS_URL = "https://blog.ja.playstation.com/feed/";

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, number) =>
      String.fromCodePoint(parseInt(number, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getTagValue(xml, tagName) {
  const match = xml.match(
    new RegExp(
      `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
      "i"
    )
  );

  if (!match) {
    return null;
  }

  const value = match[1]
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .trim();

  return decodeXml(value);
}

function getThumbnailUrl(itemXml) {
  // RSSにmedia:contentがある場合
  const media = itemXml.match(
    /<media:content\b[^>]*\burl=["']([^"']+)["']/i
  );

  if (media) {
    return decodeXml(media[1]);
  }

  // RSSにmedia:thumbnailがある場合
  const thumbnail = itemXml.match(
    /<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i
  );

  if (thumbnail) {
    return decodeXml(thumbnail[1]);
  }

  return null;
}

export function parsePlayStationRss(xml) {
  if (typeof xml !== "string" || !xml) {
    throw new Error("PlayStation RSS is empty");
  }

  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  const articles = [];

  for (const itemXml of items) {
    const title = getTagValue(itemXml, "title");
    const link = getTagValue(itemXml, "link");
    const pubDate = getTagValue(itemXml, "pubDate");

    if (!title || !link) {
      continue;
    }

    let sourceUrl;

    try {
      const url = new URL(link);

      // PlayStation公式ブログの記事だけを対象にする
      if (
        url.protocol !== "https:" ||
        url.hostname !== "blog.ja.playstation.com"
      ) {
        continue;
      }

      url.hash = "";
      sourceUrl = url.toString();
    } catch {
      continue;
    }

    const publishedAt = pubDate
      ? new Date(pubDate)
      : null;

    articles.push({
      source_title: title,
      source_name: "PlayStation",
      source_url: sourceUrl,
      source_published_at:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt.toISOString()
          : null,
      thumbnail_url: getThumbnailUrl(itemXml)
    });
  }

  return articles;
}

export async function collectPlayStationArticles() {
  const response = await fetch(RSS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/rss+xml, application/xml, text/xml"
    }
  });

  if (!response.ok) {
    throw new Error(
      `PlayStation RSS fetch failed: ${response.status}`
    );
  }

  const xml = await response.text();

  return parsePlayStationRss(xml);
}
