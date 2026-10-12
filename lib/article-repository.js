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
