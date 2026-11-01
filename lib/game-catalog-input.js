// Shared validation for the editor API and catalog repository; never accept publication fields.
export const GAME_PAGE_SIZE = 20;
export function isGameId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function isArticleId(value) { return Number.isSafeInteger(value) && value > 0; }
export function readGameInput(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return null;
  const allowed = ['id','title','original_title','description','source_url','source_type'];
  if (Object.keys(input).some(key => !allowed.includes(key)) || !isGameId(input.id)) return null;
  for (const [key,max] of [['title',300],['original_title',300],['description',5000],['source_url',2000]]) {
    if (typeof input[key] !== 'string' || input[key].length > max) return null;
  }
  if (!input.title.trim() || !['official','store','media','community'].includes(input.source_type)) return null;
  let source;
  try { source = new URL(input.source_url.trim()); } catch { return null; }
  // Stored as evidence only; this API does not fetch the supplied URL.
  if (!['https:','http:'].includes(source.protocol) || !source.hostname || source.username || source.password) return null;
  source.hash = '';
  const sourceUrl = source.toString();
  if (sourceUrl.length > 2000) return null;
  return { id:input.id.toLowerCase(), title:input.title.trim(), original_title:input.original_title.trim(), description:input.description, source_url:sourceUrl, source_type:input.source_type };
}
export function readGameQuery(query = {}) {
  if (Object.keys(query).some(key => !['q','page','article_id'].includes(key))) return null;
  const q = query.q ?? '';
  const page = query.page ?? '1';
  if (typeof q !== 'string' || q.length > 100 || typeof page !== 'string' || !/^[1-9]\d{0,4}$/.test(page) || Number(page)>10001) return null;
  let articleId = null;
  if (query.article_id !== undefined) {
    if (typeof query.article_id !== 'string' || !/^[1-9]\d*$/.test(query.article_id) || !isArticleId(Number(query.article_id))) return null;
    articleId = Number(query.article_id);
  }
  return { q:q.trim(), page:Number(page), articleId };
}
