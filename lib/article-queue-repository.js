/**
 * ニュース収集時の共通記事登録処理。
 *
 * Nintendo・PlayStation・Xboxなどの収集モジュールから
 * 利用する。
 *
 * AI評価や記事生成は行わず、pendingで保存する。
 */

export async function registerPendingArticle(item, options = {}) {
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey = options.supabaseKey || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing");
  }

  if (!item.source_url || !item.source_title || !item.source_name) {
    throw new Error("Required article fields are missing");
  }

  // 新着記事をAI処理待ちとして保存
  const article = {
    source_title: item.source_title,
    title: item.source_title,
    category: "NEWS",
    thumbnail_url: item.thumbnail_url || null,
    source_name: item.source_name,
    source_url: item.source_url,
    source_published_at: item.source_published_at || null,
    importance: 0,
    is_breaking: false,
    status: "pending",
    processing_status: "pending",
    published_at: null
  };

  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/articles?on_conflict=source_url&select=id`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation"
      },
      body: JSON.stringify(article)
    }
  );

  if (!saveResponse.ok) {
    const errorText = await saveResponse.text();

    return {
      title: item.source_title,
      status: "error",
      error: errorText
    };
  }

  // source_url の一意制約で重複を防ぎ、既存の記事本文・掲載状態は変更しない。
  const inserted = await saveResponse.json();
  if (!Array.isArray(inserted)) throw new Error("Invalid registration response");
  return {
    title: item.source_title,
    status: inserted.length ? "pending" : "existing"
  };
}
