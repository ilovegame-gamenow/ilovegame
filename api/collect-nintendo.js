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

    // Nintendo Topics 最新記事を取得
    const nintendoResponse = await fetch(
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!nintendoResponse.ok) {
      return res.status(nintendoResponse.status).json({
        success: false,
        error: "Nintendo API request failed"
      });
    }

    const data = await nintendoResponse.json();
    const latest = data.slice(0, 10);

    const results = [];

    for (const item of latest) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      const article = {
        title: item.title,
        category: "NEWS",
        thumbnail_url: item.thumbnail?.url_key || null,
        source_name: "Nintendo",
        source_url: sourceUrl,
        source_published_at: item.display_date,
        importance: 50,
        is_breaking: false,
        status: "published",
        published_at: item.display_date
      };

      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/articles?on_conflict=source_url`,
        {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(article)
        }
      );

      if (insertResponse.ok) {
        results.push({
          title: item.title,
          success: true
        });
      } else {
        results.push({
          title: item.title,
          success: false,
          error: await insertResponse.text()
        });
      }
    }

    return res.status(200).json({
      success: true,
      checked: latest.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
