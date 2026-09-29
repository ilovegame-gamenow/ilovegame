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
        source_title: item.title,
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
      const existingResponse = await fetch(
  `${supabaseUrl}/rest/v1/articles?source_url=eq.${encodeURIComponent(sourceUrl)}&select=id`,
  {
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`
    }
  }
);

const existingArticles = await existingResponse.json();
const alreadyExists = Array.isArray(existingArticles) && existingArticles.length > 0;
let saveResponse;

if (alreadyExists) {
  const updateArticle = { ...article };
  delete updateArticle.title;

  saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/articles?source_url=eq.${encodeURIComponent(sourceUrl)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(updateArticle)
    }
  );
} else {
  saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/articles`,
    {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(article)
    }
  );
}
      if (saveResponse.ok) {
        results.push({
          title: item.title,
          success: true
        });
      } else {
        results.push({
          title: item.title,
          success: false,
          error: await saveResponse.text()
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
