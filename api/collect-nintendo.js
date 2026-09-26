export default async function handler(req, res) {
  try {
    const url = "https://www.nintendo.com/jp/index.html";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await response.text();

    const matches = [
      ...html.matchAll(
        /href=["']([^"']*\/jp\/topics\/article\/[^"'?#]+[^"']*)["']/g
      )
    ];

    const articles = [];
    const seen = new Set();

    for (const match of matches) {
      const articleUrl =
        new URL(match[1], "https://www.nintendo.com").href;

      if (seen.has(articleUrl)) continue;
      seen.add(articleUrl);

      articles.push({
        url: articleUrl
      });

      if (articles.length >= 10) break;
    }

    return res.status(200).json({
      success: response.ok,
      status: response.status,
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
