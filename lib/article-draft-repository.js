// 下書き専用のデータアクセス。公開記事は applyArticleDraft だけが更新する。
async function request(url, key, path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(`Draft request failed: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function getArticleDraft(url, key, id) {
  const rows = await request(url, key, `article_drafts?article_id=eq.${id}&limit=1`);
  return rows[0] || null;
}

export async function saveArticleDraft(url, key, id, content) {
  const rows = await request(url, key, 'article_drafts?on_conflict=article_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ ...content, article_id: id, updated_at: new Date().toISOString() })
  });
  return rows[0];
}

export async function applyArticleDraft(url, key, id) {
  await request(url, key, 'rpc/apply_article_draft', {
    method: 'POST',
    body: JSON.stringify({ p_article_id: id })
  });
}

export async function discardArticleDraft(url, key, id) {
  await request(url, key, `article_drafts?article_id=eq.${id}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}
