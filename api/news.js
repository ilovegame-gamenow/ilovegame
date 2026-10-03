export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });
    }

    const fields =
      "id,title,summary,article_body,ilovegame_point,platforms,category,thumbnail_url,source_name,source_url,source_published_at,importance,is_breaking,status,published_at";

    const url =
      `${supabaseUrl}/rest/v1/articles` +
      `?select=${encodeURIComponent(fields)}` +
      `&status=eq.published` +
      `&order=published_at.desc` +
      `&limit=30`;

    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Supabase request failed",
        details: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
