export default async function handler(req, res) {
  try {
    const url = "https://www.nintendo.com/jp/topics/list";

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();

    const words = [
      "/jp/topics/article/",
      "topics/article",
      "__NEXT_DATA__",
      "__NUXT__",
      "application/json",
      "topics"
    ];

    const diagnostics = {};

    for (const word of words) {
      diagnostics[word] = html.includes(word);
    }

    const topicsIndex = html.indexOf("topics");

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      length: html.length,
      diagnostics,
      sample:
        topicsIndex >= 0
          ? html.slice(
              Math.max(0, topicsIndex - 300),
              topicsIndex + 700
            )
          : html.slice(0, 1000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
