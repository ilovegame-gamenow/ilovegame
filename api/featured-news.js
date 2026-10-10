import { newsConfig } from "./news-config.js";

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });
    }

    const fields = "id,title,summary,source_name,importance,site_published_at,created_at,published_at";

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    };

    const baseUrl =
      `${supabaseUrl}/rest/v1/articles` +
      `?select=${encodeURIComponent(fields)}` +
      `&status=eq.published` +
      `&title=not.ilike.${encodeURIComponent("*テスト*")}` +
      `&source_name=not.ilike.${encodeURIComponent("*I LOVE GAME*")}`;

    const now = Date.now();
    const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();

    // BREAKING：48時間以内の最高得点記事
    const breakingUrl =
      baseUrl +
      `&site_published_at=gte.${encodeURIComponent(fortyEightHoursAgo)}` +
      `&order=importance.desc.nullslast,site_published_at.desc` +
      `&limit=1`;

    // PICK UP：サイト全体から高評価記事を選定
    const pickupUrl =
      baseUrl +
      `&importance=gte.${newsConfig.pickupThreshold}` +
      `&order=importance.desc.nullslast,site_published_at.desc` +
      `&limit=${newsConfig.maxPickupArticles + 1}`;

    const [breakingResponse, pickupResponse] = await Promise.all([
      fetch(breakingUrl, { headers }),
      fetch(pickupUrl, { headers })
    ]);

    if (!breakingResponse.ok || !pickupResponse.ok) {
      return res.status(502).json({
        error: "Featured news request failed"
      });
    }

    const [breakingData, pickupData] = await Promise.all([
      breakingResponse.json(),
      pickupResponse.json()
    ]);

    const breaking = breakingData[0] || null;
    const pickup = pickupData
      .filter(article => !breaking || article.id !== breaking.id)
      .slice(0, newsConfig.maxPickupArticles);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({ breaking, pickup });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
