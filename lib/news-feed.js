import '../platform-display.js';
import { catalogRequest } from './catalog-database.js';

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
export async function getNewsFeed(url,key,secret,settings,query,featured) {
  const q=String(query.q||'').trim().slice(0,100);
  const filter=feedFilters.includes(query.filter)?query.filter:'all';
  const rows=await readPages(url,key,'published_articles',{select:'id,title,game_title,platforms,category',order:'site_published_at.desc.nullslast,id.desc'});
  const linkedTitles=new Map();
  if(q){
    const links=await readPages(url,secret,'article_games',{select:'article_id,game:games!inner(title,original_title,status)', 'game.status':'eq.published',order:'article_id.asc,game_id.asc'});
    for(const link of links) {
      const titles=linkedTitles.get(link.article_id)||[];
      linkedTitles.set(link.article_id,[...titles,link.game?.title,link.game?.original_title]);
    }
  }
  const selected=filterFeed(rows,{filter,q,includeFeatured:query.include_featured==='1',featured,linkedTitles});
  const limit=settings.public_page_size,total=selected.length;
  const requested=Number.parseInt(query.page,10)||1;
  const page=Math.max(1,Math.min(Number.isSafeInteger(requested)?requested:1,Math.max(1,Math.ceil(total/limit))));
  const ids=selected.slice((page-1)*limit,page*limit).map(a=>a.id);
  let articles=[];
  if(ids.length){
    articles=await catalogRequest(url,key,`published_articles?${new URLSearchParams({select:'id,title,summary,platforms,category,thumbnail_url,source_name,site_published_at,created_at,published_at',id:`in.(${ids.join(',')})`,order:'site_published_at.desc.nullslast,id.desc'})}`);
  }
  return {articles,total,page,limit,featured,filter:q?'all':filter,q,include_featured:!!q||query.include_featured==='1'};
}
