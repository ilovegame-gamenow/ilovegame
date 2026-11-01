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

// Recovery must not replace a draft changed in another session while logged out.
export async function recoverArticleDraft(url, key, id, content, expectedUpdatedAt) {
  const values = { ...content, updated_at:new Date().toISOString() };
  const path = expectedUpdatedAt === null
    ? 'article_drafts?on_conflict=article_id'
    : `article_drafts?article_id=eq.${id}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`;
  const rows = await request(url, key, path, {
    method:expectedUpdatedAt === null ? 'POST' : 'PATCH',
    headers:{ Prefer:expectedUpdatedAt === null ? 'resolution=ignore-duplicates,return=representation' : 'return=representation' },
    body:JSON.stringify(expectedUpdatedAt === null ? {...values,article_id:id} : values)
  });
  return rows?.[0] || null;
}

// Registration creates a private editing shell; duplicate source URLs never overwrite any article or draft.
export async function findArticleBySource(url,key,sourceUrl){
  const params=new URLSearchParams({select:'id,status',source_url:`eq.${sourceUrl}`,limit:'1'});
  const rows=await request(url,key,`articles?${params}`);return rows[0]||null;
}
export async function createMediaArticle(url,key,item,sourceName){
  const rows=await request(url,key,'articles?on_conflict=source_url',{
    method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify({title:item.title.slice(0,300),source_title:item.title,source_name:sourceName,source_url:item.url,source_published_at:item.published_at,
      summary:'',article_body:'',ilovegame_point:'',status:'pending',processing_status:'completed',manually_reviewed:true,importance:0,is_breaking:false,published_at:null,site_published_at:null})
  });
  const article=rows?.[0]||await findArticleBySource(url,key,item.url);
  if(!article||!Number.isSafeInteger(article.id)||article.id<=0)throw Error('Article registration unavailable');
  return {id:article.id,status:article.status,created:Boolean(rows?.length)};
}
