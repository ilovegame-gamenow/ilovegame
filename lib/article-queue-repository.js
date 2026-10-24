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

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`
  };

  // 既存記事を確認
  const checkUrl = new URL(`${supabaseUrl}/rest/v1/articles`);
  checkUrl.searchParams.set("select", "id");
  checkUrl.searchParams.set("source_url", `eq.${item.source_url}`);

  const checkResponse = await fetch(checkUrl.toString(), {
    headers
  });

  if (!checkResponse.ok) {
    throw new Error("Supabase check failed");
  }

  const existing = await checkResponse.json();

  if (Array.isArray(existing) && existing.length > 0) {
    return {
      title: item.source_title,
      status: "existing"
    };
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
    `${supabaseUrl}/rest/v1/articles`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(article)
    }
  );

  if (!saveResponse.ok) {
    const errorText = await saveResponse.text();

    // 重複登録は正常扱い
    if (
      saveResponse.status === 409 ||
      errorText.includes("23505")
    ) {
      return {
        title: item.source_title,
        status: "existing"
      };
    }

    return {
      title: item.source_title,
      status: "error",
      error: errorText
    };
  }

  return {
    title: item.source_title,
    status: "pending"
  };
}
