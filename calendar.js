import {tokyoMonth,monthRange,shiftMonth,calendarGroups} from './release-calendar-model.js';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const demo=params.get('demo')==='1';
let month=monthRange(params.get('month'))?params.get('month'):tokyoMonth(), platform=params.get('platform')||'', region=params.get('region')==='WW'?'WW':'JP';
let data=null,selectedDay=null,requestId=0,controller;
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function sampleData(){
 const games=[['星めぐりの冒険','03',['switch-2','ps5']],['虹色パーティー','12',['windows','switch-2']],['空のアトリエ','12',['ps5']],['小さな島の暮らし','21',['switch-2']],['月夜の探検隊','28',['windows']],['まだ見ぬ旅へ','01',['ps5']]];
 const platforms=[{code:'switch-2',name:'Nintendo Switch 2'},{code:'ps5',name:'PlayStation 5'},{code:'windows',name:'Windows'}];
 const rows=games.flatMap(([title,day,codes],i)=>codes.map(code=>({game:{id:String(i),title:`サンプル：${title}`},date:`${month}-${day}`,precision:i===5?'month':'day',kind:i===4?'early_access':'full',region,platform:platforms.find(p=>p.code===code),source:{url:'https://example.com/'}}))).filter(r=>!platform||r.platform.code===platform);
 return {month,region,platforms,releases:calendarGroups(rows),truncated:false};
}
function drawGrid(){
 const grid=$('calendarGrid');grid.replaceChildren();
 for(const name of ['日','月','火','水','木','金','土'])grid.append(node('div',name,'weekday'));
 const [year,m]=month.split('-').map(Number),count=new Date(Date.UTC(year,m,0)).getUTCDate(),start=new Date(Date.UTC(year,m-1,1)).getUTCDay();
 for(let i=0;i<start;i++)grid.append(node('div',undefined,'day-spacer'));
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(let day=1;day<=count;day++){
  const date=`${month}-${String(day).padStart(2,'0')}`,releases=data.releases.filter(r=>r.precision==='day'&&r.date===date);
  const button=node('button',undefined,`month-day${releases.length?' has-releases':''}${date===today?' is-today':''}`);button.type='button';button.append(node('strong',String(day)));
  if(releases.length)button.append(node('small',`${releases.length}作品`));
  button.setAttribute('aria-label',`${m}月${day}日 発売予定${releases.length}作品`);button.setAttribute('aria-pressed',String(selectedDay===date));
  button.addEventListener('click',()=>{selectedDay=selectedDay===date?null:date;render();});grid.append(button);
 }
}
function releaseCard(release){
 const card=node('article',undefined,'release-card');
 if(release.kind==='early_access')card.append(node('span','早期アクセス開始','early-access'));
 card.append(node('h3',release.game.title));const tags=node('div',undefined,'release-platforms');
 for(const p of release.platforms)tags.append(node('span',p.name,'platform-tag'));card.append(tags);
 if(!demo){const links=node('p',undefined,'source-links');release.sources.forEach((s,i)=>{const a=node('a',release.sources.length>1?`公式情報 ${i+1} ↗`:'公式サイト・ストアで確認 ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);});card.append(links);}
 return card;
}
function render(){
 drawGrid();$('showAllDays').hidden=!selectedDay;
 const releases=data.releases.filter(r=>r.precision==='day'&&(!selectedDay||r.date===selectedDay));
 $('releaseHeading').textContent=selectedDay?`${Number(selectedDay.slice(5,7))}月${Number(selectedDay.slice(8))}日の発売予定`:'この月に遊べる新作';
 $('releaseCount').textContent=`発売予定 ${releases.length}件`;
 const list=$('releaseList');list.replaceChildren();const days=[...new Set(releases.map(r=>r.date))];
 for(const date of days){const section=node('section',undefined,'release-day'),time=node('time',String(Number(date.slice(8))),'release-date');time.dateTime=date;time.append(node('small',`${Number(date.slice(5,7))}月`));section.append(time);const cards=node('div');for(const r of releases.filter(r=>r.date===date))cards.append(releaseCard(r));section.append(cards);list.append(section);}
 if(!days.length)list.append(node('p',selectedDay?'この日の発売情報はまだ掲載されていません。':'この月の発売情報はまだ掲載されていません。確認できた作品から順次追加します。','empty-calendar'));
 const uncertain=data.releases.filter(r=>r.precision==='month');$('monthOnlySection').hidden=!uncertain.length;$('monthOnlyList').replaceChildren(...uncertain.map(releaseCard));
}
async function load(){
 const id=++requestId;controller?.abort();controller=new AbortController();selectedDay=null;data=null;
 $('monthHeading').textContent=`${month.slice(0,4)}年${Number(month.slice(5))}月`;$('heroMonth').textContent=String(Number(month.slice(5)));
 $('previousMonth').disabled=!monthRange(shiftMonth(month,-1));$('nextMonth').disabled=!monthRange(shiftMonth(month,1));
 $('calendarGrid').replaceChildren();$('releaseList').replaceChildren();$('releaseCount').textContent='';$('monthOnlySection').hidden=true;$('showAllDays').hidden=true;
 $('calendarMessage').textContent='発売情報を読み込んでいます…';$('calendarMessage').dataset.error='false';$('retryCalendar').hidden=true;$('regionNotice').hidden=region!=='WW';$('demoNotice').hidden=!demo;
 const query=new URLSearchParams({month,region});if(platform)query.set('platform',platform);const browserQuery=new URLSearchParams(query);if(demo)browserQuery.set('demo','1');history.replaceState(null,'',`?${browserQuery}`);
 try{
  let result;
  if(demo)result=sampleData();else{const response=await fetch(`/api/news?resource=calendar&${query}`,{signal:controller.signal,cache:'no-store'});result=await response.json();if(!response.ok)throw Error(result.error||'発売情報を読み込めませんでした。');}
  if(id!==requestId)return;
  if(!Array.isArray(result.releases)||!Array.isArray(result.platforms))throw Error('発売情報の形式を確認できませんでした。');
  data=result;$('platformFilter').replaceChildren(new Option('すべての機種',''),...result.platforms.map(p=>new Option(p.name,p.code)));
  if(platform&&!result.platforms.some(p=>p.code===platform))$('platformFilter').append(new Option('指定した機種',platform));
  $('platformFilter').value=platform;$('regionFilter').value=region;
  $('calendarMessage').textContent=result.truncated?'情報が多いため一部を表示しています。機種で絞り込んでください。':'発売日が確定した作品を表示しています。日付を選ぶと、その日の作品を確認できます。';render();
 }catch(error){if(id!==requestId||error.name==='AbortError')return;$('calendarMessage').textContent=error.message;$('calendarMessage').dataset.error='true';$('retryCalendar').hidden=false;}
}
$('previousMonth').addEventListener('click',()=>{month=shiftMonth(month,-1);load();});$('nextMonth').addEventListener('click',()=>{month=shiftMonth(month,1);load();});$('currentMonth').addEventListener('click',()=>{month=tokyoMonth();load();});$('platformFilter').addEventListener('change',e=>{platform=e.target.value;load();});$('regionFilter').addEventListener('change',e=>{region=e.target.value;load();});$('retryCalendar').addEventListener('click',load);$('showAllDays').addEventListener('click',()=>{selectedDay=null;render();});load();
