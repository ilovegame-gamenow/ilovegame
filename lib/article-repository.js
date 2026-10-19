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
  "id,source_title,source_url,title,article_body,processing_status,status"
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
