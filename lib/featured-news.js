import { catalogRequest } from './catalog-database.js';

// Shared selection for featured slots and the latest-news exclusion.
export async function getFeaturedNews(url, key, secret, settings) {
  const slots=await catalogRequest(url,secret,`article_feature_slots?${new URLSearchParams({select:'article_id,slot,selected_at,expires_at',expires_at:`gt.${new Date().toISOString()}`,order:'selected_at.desc,article_id.desc',limit:'100'})}`);
  const ids=[...new Set(slots.map(s=>s.article_id).filter(id=>Number.isSafeInteger(id)&&id>0))];
  if(!ids.length)return {breaking:null,pickup:[]};
  const params=new URLSearchParams({select:'id,title,summary,ilovegame_point,platforms,source_name,thumbnail_url,site_published_at,created_at,published_at',id:`in.(${ids.join(',')})`});
  const response=await fetch(`${url}/rest/v1/published_articles?${params}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw Error('Articles unavailable');
  const articles=new Map((await response.json()).map(a=>[a.id,a]));
  const now=Date.now(),maxAge=settings.breaking_max_age_hours*3600000;
  const breakingSlot=slots.find(s=>s.slot==='breaking'&&articles.has(s.article_id)&&Date.parse(s.selected_at)<=now&&now-Date.parse(s.selected_at)<=maxAge);
  const breaking=breakingSlot?articles.get(breakingSlot.article_id):null;
  const pickup=slots.filter(s=>s.slot==='discovery'&&s.article_id!==breaking?.id&&Date.parse(s.selected_at)<=now).map(s=>articles.get(s.article_id)).filter(Boolean).slice(0,settings.pickup_max_articles);
  return {breaking,pickup};
}
