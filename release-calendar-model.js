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
