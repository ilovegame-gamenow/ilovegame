import { newsSources } from './news-sources.js';

const statuses = ['all', 'pending', 'published', 'rejected'];
const sources = Object.entries(newsSources).map(([id, source]) => ({ id, label:source.name }));
const validSource = value => value === 'all' || value === 'other' || sources.some(source => source.id === value);

export function parseEditorNewsQuery(query) {
  const status = query.status ?? 'all';
  const source = query.source ?? 'all';
  const rawPage = query.page ?? '1';
  const page = Number(rawPage);
  if (!statuses.includes(status) || !validSource(source) ||
      !['string','number'].includes(typeof rawPage) || !Number.isSafeInteger(page) || page < 1 || page > 1000) return null;
  return { status, source, page };
}

function filters(params, status, source) {
  if (status !== 'all') params.set('status', `eq.${status}`);
  if (source === 'other') {
    // Keep legacy/unclassified rows reachable without confusing them with a known maker.
    const names = sources.map(({label}) => `"${label.replaceAll('\\','\\\\').replaceAll('"','\\"')}"`).join(',');
    params.set('or', `(source_name.is.null,source_name.not.in.(${names}))`);
  } else if (source !== 'all') {
    params.set('source_name', `eq.${sources.find(item=>item.id===source).label}`);
  }
  return params;
}
function totalFrom(response) {
  if (!response.ok && response.status !== 416) throw new Error('Article count request failed');
  const range = response.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : NaN;
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid article count');
  return total;
}

export async function getEditorNews({ supabaseUrl, supabaseKey, status, source, page, limit }) {
  const headers = { apikey:supabaseKey, Authorization:`Bearer ${supabaseKey}`, Prefer:'count=exact' };
  const request = params => fetch(`${supabaseUrl}/rest/v1/articles?${params}`, { headers });
  const params = filters(new URLSearchParams({
    select:'id,title,summary,thumbnail_url,source_name,platforms,created_at,published_at,status,importance,processing_status,manually_reviewed,site_published_at,source_url',
    order:'id.desc', limit:String(limit), offset:String((page-1)*limit)
  }), status, source);
  const pageResponse = request(params);
  // Reuse the list's exact count and share any identical count requests.
  const countRequests = new Map([[`${status}:${source}`, pageResponse.then(totalFrom)]]);
  function count(statusFilter, sourceFilter) {
    const key = `${statusFilter}:${sourceFilter}`;
    if (!countRequests.has(key)) {
      countRequests.set(key, request(filters(new URLSearchParams({select:'id',limit:'0'}), statusFilter, sourceFilter)).then(totalFrom));
    }
    return countRequests.get(key);
  }
  const sourceOptions = [{id:'all',label:'すべて'}, ...sources, {id:'other',label:'その他'}];
  const [response, countEntries, sourceCounts] = await Promise.all([
    pageResponse,
    Promise.all(statuses.map(async value => [value, await count(value,source)])),
    Promise.all(sourceOptions.map(async option => ({...option, count:await count(status,option.id)})))
  ]);
  const total = totalFrom(response);
  const correctedPage = Math.min(page, Math.max(1,Math.ceil(total/limit)));
  let articleResponse = response;
  if (correctedPage !== page) {
    params.set('offset',String((correctedPage-1)*limit));
    articleResponse = await request(params);
  }
  if (!articleResponse.ok) throw new Error('Article request failed');
  const articles = await articleResponse.json();
  return {
    articles, page:correctedPage, limit, total,
    counts:Object.fromEntries(countEntries),
    sources:sourceCounts.filter(option=>option.id!=='other'||option.count>0||source==='other'),
    filters:{status,source}
  };
}
