import {roundupPreview} from './weekly-roundup-preview-data.js';
import {weekRange,formatReleaseDate,weeklyHighlights} from './release-calendar-model.js';
import {node,requestCalendar} from './release-calendar-client.js';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).get('demo')==='1';
// This widget has its own request and state. News pagination and calendar filters do not affect it.
function showHighlights(releases){
 const highlights=weeklyHighlights(releases);
 $('weeklyEmpty').hidden=highlights.length>0;
 $('weekHighlights').replaceChildren(...highlights.map(release=>{
  const row=node('span',undefined,'weekly-highlight');
  if(release.image){const image=node('img');image.src=release.image;image.alt='';image.loading='lazy';image.addEventListener('error',()=>{image.hidden=true;},{once:true});row.append(image);}
  const copy=node('span',undefined,'weekly-highlight-copy');copy.append(node('strong',release.game.title));
  const platforms=release.platforms.map(p=>p.name).join('・');
  copy.append(node('span',`${formatReleaseDate(release.date)}${release.kind==='early_access'?' 早期アクセス開始':''}　${platforms}`));row.append(copy);return row;
 }));
}
let busy=false;
async function loadWeek(){
 if(busy)return;busy=true;
 const range=weekRange();$('weekRange').textContent=`${formatReleaseDate(range.start)}〜${formatReleaseDate(range.last)}`;
 $('retryWeek').hidden=true;$('weekMessage').textContent='発売情報を確認中…';showHighlights([]);
 $('weeklyDemo').hidden=!demo;
 if(demo){
  $('calendarLink').href='/weekly-roundup-preview.html?demo=1';
  $('weekRange').textContent=`${formatReleaseDate(roundupPreview.start)}〜${formatReleaseDate(roundupPreview.last)}`;
  $('weeklyDemo').textContent='週まとめ記事の構成見本です。紹介例2作品で、全発売作品の一覧ではありません。';
  showHighlights(roundupPreview.games);
  $('weekMessage').textContent='紹介例：2作品（全発売作品の一覧ではありません）';busy=false;return;
 }
 try{
  const result=await requestCalendar(new URLSearchParams({view:'week',region:'JP'}));
  $('weekRange').textContent=`${formatReleaseDate(result.start)}〜${formatReleaseDate(result.last)}`;
  const releases=result.releases.filter(r=>r.precision==='day');
  const count=new Set(releases.map(r=>r.game.id)).size;showHighlights(releases);
  $('weekMessage').textContent=result.truncated?`登録済み ${count}作品以上・発売日順に最大3作品を紹介` : count?`登録済み ${count}作品・発売日順に最大3作品を紹介`:'発売情報は確認できた作品から追加します。';
 }catch(error){$('weekMessage').textContent='発売情報を取得できませんでした。';$('retryWeek').hidden=false;}
 finally{busy=false;}
}
$('retryWeek').addEventListener('click',loadWeek);loadWeek();
