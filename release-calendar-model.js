import {compareFeaturedGames} from './weekly-featured-policy.js';

export function tokyoDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function formatReleaseDate(value) {
  return `${Number(value.slice(5,7))}月${Number(value.slice(8,10))}日`;
}
// Current week is Monday through Sunday in Japan, independently of the displayed month.
export function weekRange(now = new Date()) {
  const monday=new Date(`${tokyoDate(now)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  const date=offset=>new Date(monday.getTime()+offset*86400000).toISOString().slice(0,10);
  return {start:date(0),end:date(7),last:date(6)};
}
// Shared date-only rules for the browser and server. Never parse a release as a local timestamp.
export function tokyoMonth(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(now);
}
export function monthRange(month) {
  if (typeof month !== 'string' || !/^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(month) || month > '9998-12') return null;
  const [year,m] = month.split('-').map(Number);
  return {start:`${month}-01`,end:m===12?`${year+1}-01-01`:`${year}-${String(m+1).padStart(2,'0')}-01`};
}
export function shiftMonth(month, offset) {
  const [y,m] = month.split('-').map(Number), date = new Date(Date.UTC(y,m-1+offset,1));
  return date.toISOString().slice(0,7);
}
export function calendarGroups(releases) {
  const groups = new Map();
  for (const release of releases) {
    const key = JSON.stringify([release.game.id,release.date,release.precision,release.kind,release.region]);
    if (!groups.has(key)) groups.set(key,{...release,platforms:[],sources:[]});
    const group = groups.get(key);
    if (!group.platforms.some(p=>p.code===release.platform.code)) group.platforms.push(release.platform);
    if (!group.sources.some(s=>s.url===release.source.url)) group.sources.push(release.source);
  }
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.game.title.localeCompare(b.game.title,'ja'));
}

// A bounded home preview; keep the full schedule on the calendar page.
export function weeklyHighlights(releases) {
 const seen=new Set();
 return [...releases].filter(r=>r.precision==='day').sort((a,b)=>a.date.localeCompare(b.date)||a.game.title.localeCompare(b.game.title,'ja')).filter(r=>{if(seen.has(r.game.id))return false;seen.add(r.game.id);return true;}).slice(0,3);
}

// One editorial headline and a bounded image strip, independent of release count.
export function weeklyOverview(releases, range) {
 const seen=new Set();
 const games=[...releases].filter(r=>r.precision==='day').sort(compareFeaturedGames).filter(r=>{
  if(seen.has(r.game.id))return false;seen.add(r.game.id);return true;
 });
 const sameMonth=range.start.slice(0,7)===range.last.slice(0,7);
 const dates=`${formatReleaseDate(range.start)}～${sameMonth?`${Number(range.last.slice(8))}日`:formatReleaseDate(range.last)}`;
 const names=games.slice(0,2).map(r=>`『${r.game.title}』`).join('や');
 return {
  headline:`${names}${games.length>2?'などが登場！':names?'が登場！':''}今週発売のゲームまとめ【${dates}】`,
  images:games.filter(r=>r.image).slice(0,6),count:games.length
 };
}
