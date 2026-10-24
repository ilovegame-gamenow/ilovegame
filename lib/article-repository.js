/**
 * Supabaseのarticlesテーブルにある記事をIDで指定して更新する。
 */
export async function updateArticle(
  supabaseUrl,
  supabaseKey,
  id,
  changes
) {
  const updateUrl = new URL(
    `${supabaseUrl}/rest/v1/articles`
  );

  updateUrl.searchParams.set(
    "id",
    `eq.${id}`
  );

  const response = await fetch(
    updateUrl.toString(),
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(changes)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Supabase update failed: ${await response.text()}`
    );
  }
}
/**
 * AI処理待ちの記事を、元記事の公開日時が古い順に最大3件取得する。
 * 手動審査済みの記事は対象外にする。
 */
export async function getPendingArticles(supabaseUrl, supabaseKey) {
  const queueUrl = new URL(
    `${supabaseUrl}/rest/v1/articles`
  );

  queueUrl.searchParams.set(
    "select",
    "id,source_title,source_name,source_url,source_published_at,site_published_at"
  );
  queueUrl.searchParams.set(
    "processing_status",
    "eq.pending"
  );
  queueUrl.searchParams.set(
    "manually_reviewed",
    "not.is.true"
  );
  queueUrl.searchParams.set(
    "order",
    "source_published_at.asc"
  );
  queueUrl.searchParams.set("limit", "3");

  const queueResponse = await fetch(
    queueUrl.toString(),
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  if (!queueResponse.ok) {
    throw new Error(
      `Queue fetch failed: ${await queueResponse.text()}`
    );
  }

  return await queueResponse.json();
}

/**
 * 記事IDを指定して、元記事の情報を取得する。
 * AI再生成などの共通処理で利用する。
 */
export async function getArticleById(supabaseUrl, supabaseKey, id) {
  const url = new URL(`${supabaseUrl}/rest/v1/articles`);

  url.searchParams.set(
  "select",
  "id,source_title,source_url,title,summary,article_body,ilovegame_point,processing_status,status,editor_regenerated_at,editor_regenerated_saved_at"
);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Article fetch failed: ${response.status}`);
  }

  const articles = await response.json();
  return articles[0] || null;
}

/**
 * 収集したニュースをSupabaseに保存する。
 * source_urlで重複を確認し、未登録の記事だけ追加する。
 * Nintendo / PlayStation / Xbox 共通。
 */
export async function saveCollectedArticle(
  supabaseUrl,
  supabaseKey,
  article
) {
  if (!article.source_url || !article.source_name || !article.source_title) {
    throw new Error("Missing required source fields");
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  };

  const checkUrl = new URL(`${supabaseUrl}/rest/v1/articles`);
  checkUrl.searchParams.set("select", "id");
  checkUrl.searchParams.set("source_url", `eq.${article.source_url}`);
  checkUrl.searchParams.set("limit", "1");

  const checkResponse = await fetch(checkUrl.toString(), { headers });

  if (!checkResponse.ok) {
    throw new Error(`Duplicate check failed: ${await checkResponse.text()}`);
  }

  const existing = await checkResponse.json();

  if (existing.length > 0) {
    return { status: "skipped", reason: "duplicate" };
  }

  const record = {
    source_title: article.source_title,
    title: article.source_title,
    category: "NEWS",
    thumbnail_url: article.thumbnail_url || null,
    source_name: article.source_name,
    source_url: article.source_url,
    source_published_at: article.source_published_at || null,
    importance: 0,
    is_breaking: false,
    status: "pending",
    processing_status: "pending",
    published_at: null
  };

  const insertResponse = await fetch(
    `${supabaseUrl}/rest/v1/articles`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(record)
    }
  );

  if (!insertResponse.ok) {
    const errorText = await insertResponse.text();

    if (
      insertResponse.status === 409 ||
      errorText.includes("23505")
    ) {
      return { status: "skipped", reason: "duplicate" };
    }

    throw new Error(`Article insert failed: ${errorText}`);
  }

  return { status: "inserted" };
}
