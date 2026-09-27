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
      "ADMIN_API_PATH",
      "article-post",
      "/posts",
      "posts?",
      "/post",
      "post?",
      "page=",
      "category="
    ];

    const results = {};

    for (const keyword of keywords) {
      const matches = [];
      let start = 0;

      while (matches.length < 5) {
        const index = js.indexOf(keyword, start);

        if (index === -1) break;

        matches.push(
          js.slice(
            Math.max(0, index - 500),
            index + 1000
          )
        );

        start = index + keyword.length;
      }

      results[keyword] = matches;
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
