export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const fields =
      "id,title,summary,article_body,ilovegame_point,platforms,category,thumbnail_url,source_name,source_url,source_published_at,importance,is_breaking,status,published_at,created_at,site_published_at";
    const articleId = req.query.id;
    const url =
    `${supabaseUrl}/rest/v1/articles` +
    `?select=${encodeURIComponent(fields)}` +
    `&status=eq.published` +
    (articleId
        ? `&id=eq.${encodeURIComponent(articleId)}&limit=1`
        : `&order=site_published_at.desc.nullslast&limit=${limit}&offset=${offset}`);

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "count=exact"
        }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase request failed",
        details: data
      });
    }
    if (articleId) {
      if (!data.length) {
          return res.status(404).json({ error: "記事が見つかりません" });
      }
    return res.status(200).json(data[0]);
    }
    const contentRange = response.headers.get("content-range");
    const total = Number(contentRange?.split("/")[1]) || 0;

    return res.status(200).json({
        articles: data,
        total,
        page,
        limit
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
