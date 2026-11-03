import {node,releaseCard,requestCalendar} from './release-calendar-client.js';
import {sampleCalendar} from './release-calendar-sample.js';
import {tokyoMonth,tokyoDate,formatReleaseDate,monthRange,shiftMonth} from './release-calendar-model.js';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const demo=params.get('demo')==='1';
let month=monthRange(params.get('month'))?params.get('month'):tokyoMonth(), platform=params.get('platform')||'', region=params.get('region')==='WW'?'WW':'JP';
let data=null,selectedDay=null,requestId=0,controller;
function drawGrid(){
 const grid=$('calendarGrid');grid.replaceChildren();
 for(const name of ['日','月','火','水','木','金','土'])grid.append(node('div',name,'weekday'));
 const [year,m]=month.split('-').map(Number),count=new Date(Date.UTC(year,m,0)).getUTCDate(),start=new Date(Date.UTC(year,m-1,1)).getUTCDay();
 for(let i=0;i<start;i++)grid.append(node('div',undefined,'day-spacer'));
 const today=tokyoDate();
 for(let day=1;day<=count;day++){
  const date=`${month}-${String(day).padStart(2,'0')}`,releases=data.releases.filter(r=>r.precision==='day'&&r.date===date);
  const button=node('button',undefined,`month-day${releases.length?' has-releases':''}${date===today?' is-today':''}`);button.type='button';button.append(node('strong',String(day)));
  if(releases.length)button.append(node('small',`${releases.length}作品`));
  button.setAttribute('aria-label',`${m}月${day}日 発売予定${releases.length}作品`);button.setAttribute('aria-pressed',String(selectedDay===date));
  button.addEventListener('click',()=>{selectedDay=selectedDay===date?null:date;render();});grid.append(button);
 }
}
function render(){
 drawGrid();$('showAllDays').hidden=!selectedDay;
 const releases=data.releases.filter(r=>r.precision==='day'&&(!selectedDay||r.date===selectedDay));
 $('releaseHeading').textContent=selectedDay?`${Number(selectedDay.slice(5,7))}月${Number(selectedDay.slice(8))}日の発売予定`:'この月に遊べる新作';
 $('releaseCount').textContent=`発売予定 ${releases.length}件`;
 const list=$('releaseList');list.replaceChildren();const days=[...new Set(releases.map(r=>r.date))];
 for(const date of days){const section=node('section',undefined,'release-day'),time=node('time',formatReleaseDate(date),'release-date');time.dateTime=date;section.append(time);const cards=node('div');for(const r of releases.filter(r=>r.date===date))cards.append(releaseCard(r,{demo}));section.append(cards);list.append(section);}
 if(!days.length)list.append(node('p',selectedDay?'この日の発売情報はまだ掲載されていません。':'この月の発売情報はまだ掲載されていません。確認できた作品から順次追加します。','empty-calendar'));
 const uncertain=data.releases.filter(r=>r.precision==='month');$('monthOnlySection').hidden=!uncertain.length;$('monthOnlyList').replaceChildren(...uncertain.map(r=>releaseCard(r,{demo})));
}
async function load(){
 const id=++requestId;controller?.abort();controller=new AbortController();selectedDay=null;data=null;
 $('regionFilter').value=region;
 $('monthHeading').textContent=`${month.slice(0,4)}年${Number(month.slice(5))}月`;
 $('previousMonth').disabled=!monthRange(shiftMonth(month,-1));$('nextMonth').disabled=!monthRange(shiftMonth(month,1));
 $('calendarGrid').replaceChildren();$('releaseList').replaceChildren();$('releaseCount').textContent='';$('monthOnlySection').hidden=true;$('showAllDays').hidden=true;
 $('calendarMessage').textContent='発売情報を読み込んでいます…';$('calendarMessage').dataset.error='false';$('retryCalendar').hidden=true;$('regionNotice').hidden=region!=='WW';$('demoNotice').hidden=!demo;
 const query=new URLSearchParams({month,region});if(platform)query.set('platform',platform);const browserQuery=new URLSearchParams(query);if(demo)browserQuery.set('demo','1');history.replaceState(null,'',`?${browserQuery}`);
 try{
  let result;
  if(demo)result=sampleCalendar({month,platform,region});else result=await requestCalendar(query,controller.signal);
  if(id!==requestId)return;
  if(!Array.isArray(result.releases)||!Array.isArray(result.platforms))throw Error('発売情報の形式を確認できませんでした。');
  data=result;$('platformFilter').replaceChildren(new Option('すべての機種',''),...result.platforms.map(p=>new Option(p.name,p.code)));
  if(platform&&!result.platforms.some(p=>p.code===platform))$('platformFilter').append(new Option('指定した機種',platform));
  $('platformFilter').value=platform;$('regionFilter').value=region;
  $('calendarMessage').textContent=result.truncated?'情報が多いため一部を表示しています。機種で絞り込んでください。':'日付を選ぶと、その日の発売作品を表示します。';render();
 }catch(error){if(id!==requestId||error.name==='AbortError')return;$('calendarMessage').textContent=error.message;$('calendarMessage').dataset.error='true';$('retryCalendar').hidden=false;}
}
$('previousMonth').addEventListener('click',()=>{month=shiftMonth(month,-1);load();});$('nextMonth').addEventListener('click',()=>{month=shiftMonth(month,1);load();});$('currentMonth').addEventListener('click',()=>{month=tokyoMonth();load();});$('platformFilter').addEventListener('change',e=>{platform=e.target.value;load();});$('regionFilter').addEventListener('change',e=>{region=e.target.value;load();});$('retryCalendar').addEventListener('click',load);$('showAllDays').addEventListener('click',()=>{selectedDay=null;render();});load();
