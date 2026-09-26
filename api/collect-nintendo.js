export default async function handler(req, res) {
  try {
    const url = "https://www.nintendo.com/jp/topics/list";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await response.text();

    const links = [
      ...html.matchAll(
        /href=["']([^"']*\/jp\/topics\/article\/[^"']+)["']/g
      )
    ];

    const articles = [];
    const seen = new Set();

    for (const match of links) {
      const path = match[1];

      if (seen.has(path)) continue;
      seen.add(path);

      articles.push({
        url: new URL(path, "https://www.nintendo.com").href
      });

      if (articles.length >= 10) break;
    }

    return res.status(200).json({
      success: true,
      count: articles.length,
      articles
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
