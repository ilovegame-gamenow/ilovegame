export default async function handler(req, res) {
  try {
    const pageUrl = "https://www.nintendo.com/jp/topics/list";

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();

    const matches = [
      ...html.matchAll(
        /<script[^>]+src=["']([^"']+)["'][^>]*>/gi
      )
    ];

    const scripts = [];
    const seen = new Set();

    for (const match of matches) {
      const scriptUrl = new URL(match[1], pageUrl).href;

      if (seen.has(scriptUrl)) continue;
      seen.add(scriptUrl);

      scripts.push(scriptUrl);
    }

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      count: scripts.length,
      scripts
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
