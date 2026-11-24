import { catalogRequest } from './catalog-database.js';

// Shared selection for featured slots and the latest-news exclusion.
export async function getFeaturedNews(url, key, secret, settings, {onExpiry=()=>{}}={}) {
  const slots=await catalogRequest(url,secret,`article_feature_slots?${new URLSearchParams({select:'article_id,slot,selected_at,expires_at,pickup_rank',expires_at:`gt.${new Date().toISOString()}`,order:'pickup_rank.asc.nullslast,selected_at.desc,article_id.desc',limit:'100'})}`);
  // 05:00 JST is 20:00 UTC; do not cache across the rotation boundary.
  const day=86400000,offset=4*3600000;
  onExpiry((Math.floor((Date.now()+offset)/day)+1)*day-offset);
  const ids=[...new Set(slots.map(s=>s.article_id).filter(id=>Number.isSafeInteger(id)&&id>0))];
  for(const slot of slots){
    if(Number.isFinite(Date.parse(slot.expires_at)))onExpiry(Date.parse(slot.expires_at));
    if(Date.parse(slot.selected_at)>Date.now())onExpiry(Date.parse(slot.selected_at));
  }
  if(!ids.length)return {breaking:null,pickup:[]};
  const params=new URLSearchParams({select:'id,title,summary,ilovegame_point,platforms,category,source_name,thumbnail_url,site_published_at,created_at,published_at,importance,game_title',id:`in.(${ids.join(',')})`});
  const response=await fetch(`${url}/rest/v1/published_articles?${params}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw Error('Articles unavailable');
  const articles=new Map((await response.json()).map(a=>[a.id,a]));
  settings=await settings;
  const now=Date.now(),maxAge=settings.breaking_max_age_hours*3600000;
  const breakingSlot=slots.find(s=>s.slot==='breaking'&&articles.has(s.article_id)&&Date.parse(s.selected_at)<=now&&now-Date.parse(s.selected_at)<=maxAge);
  const breaking=breakingSlot?articles.get(breakingSlot.article_id):null;
  if(breakingSlot)onExpiry(Date.parse(breakingSlot.selected_at)+maxAge);
  const pickupAge=settings.pickup_max_age_days*day;
  const cutoff=Math.floor((now+offset)/day)*day-offset;
  const eligible=slots.filter(s=>s.slot==='discovery'&&s.article_id!==breaking?.id&&articles.has(s.article_id)&&Date.parse(s.selected_at)<=now&&Date.parse(s.expires_at)>now&&Date.parse(s.selected_at)+pickupAge>now);
  for(const s of eligible)onExpiry(Date.parse(s.selected_at)+pickupAge);
  const urgent=s=>Number(articles.get(s.article_id)?.importance)>=90&&Date.parse(s.selected_at)>=cutoff;
  eligible.sort((a,b)=>Number(urgent(b))-Number(urgent(a))||(urgent(a)&&urgent(b)?Date.parse(b.selected_at)-Date.parse(a.selected_at):0)||(a.pickup_rank??Number.MAX_SAFE_INTEGER)-(b.pickup_rank??Number.MAX_SAFE_INTEGER));
  const titles=new Set(),pickup=[];
  for(const s of eligible){const {importance,game_title,...article}=articles.get(s.article_id);const title=game_title?.trim().toLowerCase();if(title&&titles.has(title))continue;if(title)titles.add(title);pickup.push(article);if(pickup.length>=settings.pickup_max_articles)break;}
  if(breaking){delete breaking.importance;delete breaking.game_title;}
  return {breaking,pickup};
}
