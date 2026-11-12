import {node,releaseCard,requestCalendar} from './release-calendar-client.js';
import {sampleCalendar} from './release-calendar-sample.js';
import {tokyoMonth,tokyoDate,formatReleaseDate,monthRange,shiftMonth,calendarWindow,calendarMainMonth} from './release-calendar-model.js';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const demo=params.get('demo')==='1';
const demoDate=demo&&/^\d{4}-\d{2}-\d{2}$/.test(params.get('demo_date')||'')?new Date(`${params.get('demo_date')}T03:00:00Z`):null;
const now=()=>demoDate&&!Number.isNaN(demoDate.getTime())?demoDate:new Date();
let month=monthRange(params.get('month'))?params.get('month'):calendarMainMonth(now()), platform=params.get('platform')||'', region=params.get('region')==='WW'?'WW':'JP';
let data=null,selectedDay=null,requestId=0,controller;
function drawGrid(){
 const grid=$('calendarGrid');grid.replaceChildren();
 for(const name of ['日','月','火','水','木','金','土'])grid.append(node('div',name,'weekday'));
 const window=calendarWindow(month);
 for(let i=0;i<window.leading;i++)grid.append(node('div',undefined,'day-spacer'));
 const today=tokyoDate(now());
 for(const date of window.days){
  const m=Number(date.slice(5,7)),day=Number(date.slice(8)),first=day===1;
  const releases=data.releases.filter(r=>r.precision==='day'&&r.date===date);
  const button=node('button',undefined,`month-day${date.slice(0,7)!==month?' outside-month':''}${first?' month-start':''}${releases.length?' has-releases':''}${date===today?' is-today':''}`);button.type='button';
  button.append(node('strong',first||date===window.start?`${m}/${day}`:String(day)));
  if(releases.length)button.append(node('small',String(releases.length),'release-count-badge'));
  if(date===today){button.setAttribute('aria-current','date');button.append(node('span','今日','today-label'));}
  button.setAttribute('aria-label',`${date.slice(0,4)}年${m}月${day}日 発売予定${releases.length}作品`);button.setAttribute('aria-pressed',String(selectedDay===date));
  button.addEventListener('click',()=>{selectedDay=selectedDay===date?null:date;render();});grid.append(button);
 }
}
function render(){
 drawGrid();$('showAllDays').hidden=!selectedDay;
 const releases=data.releases.filter(r=>r.precision==='day'&&r.date>=calendarWindow(month).start&&r.date<calendarWindow(month).end&&(!selectedDay||r.date===selectedDay));
 $('releaseHeading').textContent=selectedDay?`${Number(selectedDay.slice(5,7))}月${Number(selectedDay.slice(8))}日の発売予定`:'この期間に遊べる新作';
 $('releaseCount').textContent=`発売予定 ${releases.length}件`;
 const list=$('releaseList');list.replaceChildren();const days=[...new Set(releases.map(r=>r.date))];
 for(const date of days){const section=node('section',undefined,'release-day'),time=node('time',formatReleaseDate(date),'release-date');time.dateTime=date;section.append(time);const cards=node('div');for(const r of releases.filter(r=>r.date===date))cards.append(releaseCard(r,{demo,showImage:true}));section.append(cards);list.append(section);}
 if(!days.length)list.append(node('p',selectedDay?'この日の発売情報はまだ掲載されていません。':'この期間の発売情報はまだ掲載されていません。確認できた作品から順次追加します。','empty-calendar'));
 const uncertain=data.releases.filter(r=>r.precision==='month'&&r.date.slice(0,7)===month);$('monthOnlySection').hidden=!uncertain.length;$('monthOnlyList').replaceChildren(...uncertain.map(r=>{const card=releaseCard(r,{demo,showImage:true});card.prepend(node('p',`${r.date.slice(0,4)}年${Number(r.date.slice(5,7))}月 発売予定`,'month-only-date'));return card;}));
}
async function load(){
 const id=++requestId;controller?.abort();controller=new AbortController();selectedDay=null;data=null;
 $('regionFilter').value=region;
 const window=calendarWindow(month);
 $('monthHeading').textContent=`${month.slice(0,4)}年${Number(month.slice(5))}月`;$('heroMonth').textContent=String(Number(month.slice(5)));
 $('previousMonth').disabled=!monthRange(shiftMonth(month,-1));$('nextMonth').disabled=!monthRange(shiftMonth(month,1));
 $('calendarGrid').replaceChildren();$('releaseList').replaceChildren();$('releaseCount').textContent='';$('monthOnlySection').hidden=true;$('showAllDays').hidden=true;
 $('calendarMessage').textContent='発売情報を読み込んでいます…';$('calendarMessage').dataset.error='false';$('retryCalendar').hidden=true;$('regionNotice').hidden=region!=='WW';$('demoNotice').hidden=!demo;
 const query=new URLSearchParams({month,region});if(platform)query.set('platform',platform);const browserQuery=new URLSearchParams(query);if(demo){browserQuery.set('demo','1');if(demoDate)browserQuery.set('demo_date',params.get('demo_date'));}history.replaceState(null,'',`?${browserQuery}`);
 try{
  let result;
  const results=await Promise.all(window.months.map(m=>{const q=new URLSearchParams(query);q.set('month',m);return demo?sampleCalendar({month:m,platform,region}):requestCalendar(q,controller.signal);}));
  result={...results[0],releases:results.flatMap(r=>r.releases),truncated:results.some(r=>r.truncated),detailsUnavailable:results.some(r=>r.detailsUnavailable)};
  if(id!==requestId)return;
  if(!Array.isArray(result.releases)||!Array.isArray(result.platforms))throw Error('発売情報の形式を確認できませんでした。');
  data=result;$('platformFilter').replaceChildren(new Option('すべての機種',''),...result.platforms.map(p=>new Option(globalThis.GamePlatforms.describe(p.name).label,p.code)));
  if(platform&&!result.platforms.some(p=>p.code===platform))$('platformFilter').append(new Option('指定した機種',platform));
  $('platformFilter').value=platform;$('regionFilter').value=region;
  $('calendarMessage').textContent=result.truncated?'情報が多いため一部を表示しています。機種で絞り込んでください。':result.detailsUnavailable?'発売予定を表示しています。関連記事を取得できませんでした。':'6週間を連続表示しています。日付を選ぶと、その日の発売作品を表示します。';render();
 }catch(error){if(id!==requestId||error.name==='AbortError')return;$('calendarMessage').textContent=error.message;$('calendarMessage').dataset.error='true';$('retryCalendar').hidden=false;}
}
$('previousMonth').addEventListener('click',()=>{month=shiftMonth(month,-1);load();});$('nextMonth').addEventListener('click',()=>{month=shiftMonth(month,1);load();});$('currentMonth').addEventListener('click',()=>{month=calendarMainMonth(now());load();});$('platformFilter').addEventListener('change',e=>{platform=e.target.value;load();});$('regionFilter').addEventListener('change',e=>{region=e.target.value;load();});$('retryCalendar').addEventListener('click',load);$('showAllDays').addEventListener('click',()=>{selectedDay=null;render();});load();
