import { catalogRequest } from './catalog-database.js';
import { monthRange, tokyoMonth, weekRange, calendarGroups } from '../release-calendar-model.js';
import { addWeeklyEditorial } from './weekly-roundup.js';

export function readCalendarQuery(query = {}, now = new Date()) {
  if (Object.keys(query).some(k=>!['month','platform','region','view'].includes(k))) return null;
  const month = query.month ?? tokyoMonth(now), platform = query.platform ?? '', region = query.region ?? 'JP';
  const view=query.view??'month';
  if(!['month','week','roundup'].includes(view)||(view!=='month'&&query.month!==undefined))return null;
  const range = view!=='month'?weekRange(now):monthRange(month);
  if (!range || typeof platform !== 'string' || platform.length>40 || (platform && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(platform)) || !['JP','WW'].includes(region)) return null;
  return {month,view,platform,region,...range};
}
function safeUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null; } catch {return null;}
}
export async function loadCalendar(url,key,query) {
  // Server-only access; existing private catalog tables and their RLS stay unchanged.
  const params = new URLSearchParams({
    select:'id,release_date,date_precision,release_kind,region_code,status,verified_at,game:games!inner(id,title,status),platform:game_platforms!inner(code,name),source:game_sources!inner(url,source_type,review_status,verified_at)',
    'game.status':'eq.published','source.review_status':'eq.verified','source.verified_at':'not.is.null',
    'source.source_type':'in.(official,store)',verified_at:'not.is.null',status:'in.(announced,released)',
    region_code:`eq.${query.region}`,date_precision:query.view!=='month'?'eq.day':'in.(day,month)',
    and:`(release_date.gte.${query.start},release_date.lt.${query.end})`,order:'release_date.asc,id.asc',limit:'500'
  });
  if(query.platform)params.set('platform_code',`eq.${query.platform}`);
  // Fetch one extra page to detect truncation, rather than claiming the month is complete.
  const rows=[];
  for(let offset=0;offset<=2000;offset+=500){
    params.set('offset',String(offset));
    const page=await catalogRequest(url,key,`game_releases?${params}`);
    if(!Array.isArray(page))throw Error('Invalid calendar response');
    rows.push(...page);
    if(page.length<500)break;
  }
  const truncated=rows.length>2000;
  const releases=rows.slice(0,2000).filter(r=>r.game?.status==='published'&&r.source?.review_status==='verified'&&r.source.verified_at&&['official','store'].includes(r.source.source_type)&&r.verified_at&&['announced','released'].includes(r.status)&&r.region_code===query.region&&(query.view!=='month'?r.date_precision==='day':['day','month'].includes(r.date_precision))&&/^\d{4}-\d{2}-\d{2}$/.test(r.release_date)&&r.release_date>=query.start&&r.release_date<query.end&&r.platform?.code&&(!query.platform||r.platform.code===query.platform)&&safeUrl(r.source.url)).map(r=>({
    game:{id:r.game.id,title:r.game.title},date:r.release_date,precision:r.date_precision,kind:r.release_kind,region:r.region_code,
    platform:{code:r.platform.code,name:r.platform.name},source:{url:safeUrl(r.source.url)}
  }));
  const platforms=await catalogRequest(url,key,'game_platforms?select=code,name&order=name.asc&limit=100');
  return {month:query.month,view:query.view,start:query.start,end:query.end,last:query.last,region:query.region,platforms,releases:calendarGroups(releases),truncated};
}
export async function handleCalendar(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const {resource,...input}=req.query??{}, query=readCalendarQuery(input);
  if(!query)return res.status(400).json({error:'月・機種・地域の指定を確認してください。'});
  if(process.env.GAME_CATALOG_ENABLED!=='true')return res.status(503).json({error:'発売日カレンダーは準備中です。'});
  try{
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
    if(!url||!key)throw Error('Database unavailable');
    const calendar = await loadCalendar(url,key,query);
    if (query.view !== 'roundup') return res.status(200).json(calendar);
    try {
      const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
      if(!publicKey)throw Error('Public article access unavailable');
      return res.status(200).json(await addWeeklyEditorial(url,key,calendar,publicKey));
    }
    catch { return res.status(200).json({...calendar,detailsUnavailable:true}); }
  }catch{return res.status(503).json({error:'発売情報を読み込めませんでした。時間をおいて再度お試しください。'});}
}
