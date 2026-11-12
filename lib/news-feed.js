import '../platform-display.js';
import { catalogRequest } from './catalog-database.js';
import { createPublicReadCache } from './public-read-cache.js';

export const feedFilters = ['all','switch','playstation','xbox','pc','mobile','movie'];
export const normalizeSearch = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim();
export function filterFeed(rows, { filter='all', q='', includeFeatured=false, featured=null, linkedTitles=new Map() }={}) {
  const term=normalizeSearch(q);
  const excluded=new Set(term || includeFeatured ? [] : [featured?.breaking?.id,...(featured?.pickup||[]).map(a=>a.id)]);
  return rows.filter(a=>{
    if(excluded.has(a.id)) return false;
    if(term) return [a.title,a.game_title,...(linkedTitles.get(a.id)||[])].some(t=>normalizeSearch(t).includes(term));
    if(filter==='all') return true;
    if(filter==='movie') return String(a.category).toUpperCase()==='MOVIE';
    return (a.platforms||[]).some(p=>{
      const platform=GamePlatforms.describe(p);
      return filter==='switch' ? ['Switch','Switch 2'].includes(platform.label) : platform.color===filter;
    });
  });
}

// Read lightweight public metadata in batches; fetch full card fields only for the selected page.
async function readPages(url,key,table,params) {
  const rows=[];
  for(let offset=0;;offset+=500){
    const page=await catalogRequest(url,key,`${table}?${new URLSearchParams({...params,limit:'500',offset:String(offset)})}`);
    if(!Array.isArray(page)) throw new Error('Invalid news response');
    rows.push(...page);
    if(page.length<500) return rows;
  }
}
const readPublicIndex=createPublicReadCache();
const cardFields='id,title,summary,platforms,category,thumbnail_url,source_name,site_published_at,created_at,published_at';
const order='site_published_at.desc.nullslast,id.desc';
function requestedPage(query){const n=Number.parseInt(query.page,10)||1;return Number.isSafeInteger(n)?Math.max(1,n):1;}
function clampPage(requested,total,limit){return Math.min(requested,Math.max(1,Math.ceil(total/limit)));}

// The common ALL/MOVIE feed transfers only the requested page, even with years of articles.
async function readFeedPage(url,key,limit,query,featured,filter) {
  const requested=requestedPage(query),offset=(requested-1)*limit;
  const params=new URLSearchParams({select:cardFields,order,limit:String(limit),offset:String(Number.isSafeInteger(offset)?offset:0)});
  if(filter==='movie')params.set('category','ilike.MOVIE');
  const excluded=query.include_featured==='1'?[]:[featured?.breaking?.id,...(featured?.pickup||[]).map(a=>a.id)];
  const ids=[...new Set(excluded.filter(id=>Number.isSafeInteger(id)&&id>0))];
  if(ids.length)params.set('id',`not.in.(${ids.join(',')})`);
  const headers={apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'};
  const fetchPage=()=>fetch(`${url}/rest/v1/published_articles?${params}`,{headers});
  const response=await fetchPage();
  if(!response.ok && response.status!==416)throw new Error('News page unavailable');
  const count=response.headers.get('content-range')?.split('/')[1];
  const total=Number(count);
  if(!count || !Number.isSafeInteger(total) || total<0)throw new Error('Invalid article count');
  const page=clampPage(requested,total,limit);
  let articles=response.ok?await response.json():[];
  if(total>0 && (page!==requested || !Number.isSafeInteger(offset))){
    params.set('offset',String((page-1)*limit));
    const corrected=await fetchPage();
    if(!corrected.ok)throw new Error('Corrected news page unavailable');
    articles=await corrected.json();
  }
  if(!Array.isArray(articles))throw new Error('Invalid news page');
  return {articles,total,page};
}

// Preserve NFKC/literal search and all platform aliases without schema/data changes.
// These small indexes are fetched only for search/platform filters, shared for 10 seconds.
async function readFilteredIndex(url,key,secret,q) {
  const select=q?'id,title,game_title':'id,platforms,category';
  const rowsTask=readPublicIndex(JSON.stringify([url,key,select]),()=>readPages(url,key,'published_articles',{select,order}));
  const linksTask=q?readPublicIndex(JSON.stringify([url,secret,'linked-titles']),()=>readPages(url,secret,'article_games',{
    select:'article_id,game:games!inner(title,original_title,status)','game.status':'eq.published',order:'article_id.asc,game_id.asc'
  })):Promise.resolve([]);
  const [rows,links]=await Promise.all([rowsTask,linksTask]);
  const linkedTitles=new Map();
  for(const link of links){
    const titles=linkedTitles.get(link.article_id)||[];
    linkedTitles.set(link.article_id,[...titles,link.game?.title,link.game?.original_title]);
  }
  return {rows,linkedTitles};
}
export async function getNewsFeed(url,key,secret,settings,query,featured) {
  const q=String(query.q||'').trim().slice(0,100);
  const filter=feedFilters.includes(query.filter)?query.filter:'all';
  const direct=!q && ['all','movie'].includes(filter);
  // Start independent index/linked-title reads before waiting for settings and featured slots.
  const [display,selection,index]=await Promise.all([settings,featured,direct?null:readFilteredIndex(url,key,secret,q)]);
  const limit=display.public_page_size;
  let result;
  if(direct)result=await readFeedPage(url,key,limit,query,selection,filter);
  else {
    const selected=filterFeed(index.rows,{filter,q,includeFeatured:query.include_featured==='1',featured:selection,linkedTitles:index.linkedTitles});
    const total=selected.length,page=clampPage(requestedPage(query),total,limit);
    const ids=selected.slice((page-1)*limit,page*limit).map(a=>a.id);
    const articles=ids.length?await catalogRequest(url,key,`published_articles?${new URLSearchParams({select:cardFields,id:`in.(${ids.join(',')})`,order})}`):[];
    result={articles,total,page};
  }
  return {...result,limit,featured:selection,filter:q?'all':filter,q,include_featured:!!q||query.include_featured==='1'};
}
