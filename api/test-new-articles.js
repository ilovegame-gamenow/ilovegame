export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: "Supabase environment variables are missing"
      });
    }

    const articles = [];

    // Nintendo Topics の1〜4ページを取得
    for (let page = 1; page <= 4; page++) {
      const response = await fetch(
        `https://www.nintendo.com/jp/topics/c/_/v0/posts/search?page=${page}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Nintendo API failed on page ${page}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      articles.push(...data);
    }

    const newArticles = [];

    // Supabaseに存在しない記事だけ数える
    for (const item of articles) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      const checkUrl = new URL(
        `${supabaseUrl}/rest/v1/articles`
      );

      checkUrl.searchParams.set("select", "id");
      checkUrl.searchParams.set("source_url", `eq.${sourceUrl}`);

      const response = await fetch(checkUrl.toString(), {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });

      
if (!response.ok) {
    const detail = await response.text();
    throw new Error(
        `Supabase check failed (${response.status}): ${detail}`
    );
}


      const existing = await response.json();

      if (Array.isArray(existing) && existing.length === 0) {
        newArticles.push({
          title: item.title,
          source_url: sourceUrl
        });
      }
    }

    return res.status(200).json({
      success: true,
      total: articles.length,
      existing: articles.length - newArticles.length,
      new: newArticles.length,
      newArticles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
