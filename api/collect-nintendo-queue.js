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

    const latest = [];

    // Nintendo Topics 1〜4ページを取得
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

      latest.push(...data);
    }

    const results = [];

    for (const item of latest) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      // 既存記事を確認
      const checkUrl = new URL(
        `${supabaseUrl}/rest/v1/articles`
      );

      checkUrl.searchParams.set("select", "id");
      checkUrl.searchParams.set("source_url", `eq.${sourceUrl}`);

      const checkResponse = await fetch(checkUrl.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });

      if (!checkResponse.ok) {
        throw new Error("Supabase check failed");
      }

      const existing = await checkResponse.json();

      // すでに存在する記事は何もしない
      if (Array.isArray(existing) && existing.length > 0) {
        results.push({
          title: item.title,
          status: "existing"
        });
        continue;
      }

      // 新着記事はAI処理せずpendingで保存
      const article = {
        source_title: item.title,
        title: item.title,
        category: "NEWS",
        thumbnail_url: item.thumbnail?.url_key || null,
        source_name: "Nintendo",
        source_url: sourceUrl,
        source_published_at: item.display_date,
        importance: 0,
        is_breaking: false,
        status: "pending",
        processing_status: "pending",
        published_at: null
      };

      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/articles`,
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify(article)
        }
      );

      if (!saveResponse.ok) {
        results.push({
          title: item.title,
          status: "error",
          error: await saveResponse.text()
        });
        continue;
      }

      results.push({
        title: item.title,
        status: "pending"
      });
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
