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
