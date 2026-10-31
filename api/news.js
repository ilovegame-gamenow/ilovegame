import { getSiteSettings } from "../lib/site-settings.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });
    }
    let page = Math.max(1, parseInt(req.query.page, 10) || 1);
    if (!Number.isSafeInteger(page)) page = 1;
    const articleId = req.query.id;
    const limit = articleId ? 1 : (await getSiteSettings(supabaseUrl, process.env.SUPABASE_SECRET_KEY)).public_page_size;
    const offset = (page - 1) * limit;
    const fields =
      "id,title,summary,article_body,ilovegame_point,platforms,category,thumbnail_url,source_name,source_url,source_published_at,importance,is_breaking,status,published_at,created_at,site_published_at";
    const url =
    
    `${supabaseUrl}/rest/v1/published_articles` +
    `?select=${encodeURIComponent(fields)}` +


    (articleId
        ? `&id=eq.${encodeURIComponent(articleId)}&limit=1`
        : `&order=site_published_at.desc.nullslast,id.desc&limit=${limit}&offset=${offset}`);

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "count=exact"
        }
    });

    let data = await response.json();

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

    const lastPage = Math.max(1, Math.ceil(total / limit));
    if (page > lastPage) {
      page = lastPage;
      const correctedUrl = new URL(url);
      correctedUrl.searchParams.set("offset", String((page - 1) * limit));
      const corrected = await fetch(correctedUrl, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (!corrected.ok) throw new Error("Failed to fetch corrected page");
      data = await corrected.json();
    }
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
