const scopeKeys = ['thumbnail','article','hotlink','local_save','advertising','modification','website_republication'];

export function parseImageRights(body) {
  if (!body || !['pending','confirmed','blocked'].includes(body.decision)) return null;
  const result = { decision: body.decision };
  for (const key of ['thumbnail_url','source_url','original_image_url','rights_url','rights_holder','credit','notes']) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > 8192) return null;
    result[key] = value.trim() || null;
    if (key.endsWith('_url') && result[key]) {
      try { const u = new URL(result[key]); if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return null; } catch { return null; }
    }
  }
  if (!result.thumbnail_url || (result.decision !== 'pending' && !result.rights_url)) return null;
  const scope = body.usage_scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).some(key => !scopeKeys.includes(key) || typeof scope[key] !== 'boolean')) return null;
  result.usage_scope = scope;
  if (result.decision === 'confirmed' && (!result.source_url || scope.thumbnail !== true || scope.website_republication === false)) return null;
  const expires = body.expires_at;
  if (expires != null && expires !== '') {
    if (typeof expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return null;
    const date = new Date(`${expires}T23:59:59+09:00`);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return null;
    result.expires_at = date.toISOString();
  } else result.expires_at = null;
  return result;
}

export async function saveImageRights(url, key, id, record, article) {
  if (!article || article.thumbnail_url !== record.thumbnail_url) return false;
  const now = new Date().toISOString();
  const response = await fetch(`${url}/rest/v1/article_image_rights?on_conflict=article_id`, {
    method:'POST', headers:{apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({...record, article_id:id, reviewed_by:'editor', verified_at:record.decision === 'pending' ? null : now, updated_at:now})
  });
  if (!response.ok) throw new Error('Image rights save failed');
  return true;
}
