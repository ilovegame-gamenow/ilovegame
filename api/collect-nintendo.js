export default async function handler(req, res) {
  try {
    const apiUrl =
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search";

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Nintendo API request failed"
      });
    }

    const data = await response.json();

    const articles = data.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      publishedAt: item.display_date,
      slug: item.slug,
      articleUrl:
        `https://www.nintendo.com/jp/topics/article/${item.slug}`,
      thumbnailKey:
        item.thumbnail?.url_key || null
    }));

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
