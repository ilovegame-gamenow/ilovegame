export default async function handler(req, res) {
  try {
    const jsUrl =
      "https://www.nintendo.com/jp/topics/main.61a655bbb473ca0b.js";

    const response = await fetch(jsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const js = await response.text();

    const keywords = [
      "api",
      ".json",
      "fetch(",
      "HttpClient",
      "article",
      "topics"
    ];

    const results = {};

    for (const keyword of keywords) {
      const index = js.toLowerCase().indexOf(keyword.toLowerCase());

      results[keyword] =
        index >= 0
          ? js.slice(
              Math.max(0, index - 300),
              index + 700
            )
          : null;
    }

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      length: js.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
