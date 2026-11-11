import {roundupPreview} from './weekly-roundup-preview-data.js';
import {weekRange,formatReleaseDate,weeklyOverview} from './release-calendar-model.js';
import {node,requestCalendar} from './release-calendar-client.js';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).get('demo')==='1';
// This widget has its own request and state. News pagination and calendar filters do not affect it.
function showHighlights(releases,range=weekRange()){
 const overview=weeklyOverview(releases,range);
 $('weekTitle').textContent=overview.headline;
 $('weeklyEmpty').hidden=overview.count>0;
 $('weekHighlights').replaceChildren(...overview.images.map(release=>{
  const image=node('img');image.src=release.image;image.alt=release.game.title;image.loading='lazy';
  image.addEventListener('error',()=>{image.hidden=true;},{once:true});return image;
 }));
}
let busy=false;
async function loadWeek(){
 if(busy)return;busy=true;
 const range=weekRange();$('weekRange').textContent=`${formatReleaseDate(range.start)}〜${formatReleaseDate(range.last)}`;
 $('retryWeek').hidden=true;$('weekMessage').hidden=false;$('weekMessage').textContent='発売情報を確認中…';showHighlights([]);
 $('weeklyDemo').hidden=!demo;
 if(demo){
  $('calendarLink').href='/weekly-roundup-preview.html?demo=1';
  $('weekRange').textContent=`${formatReleaseDate(roundupPreview.start)}〜${formatReleaseDate(roundupPreview.last)}`;
  $('weeklyDemo').textContent='週まとめ記事の構成見本です。紹介例2作品で、全発売作品の一覧ではありません。';
  showHighlights(roundupPreview.games,roundupPreview);
  $('weekMessage').textContent='紹介例：2作品（全発売作品の一覧ではありません）';busy=false;return;
 }
 try{
  const result=await requestCalendar(new URLSearchParams({view:'roundup',region:'JP'}));
  $('weekRange').textContent=`${formatReleaseDate(result.start)}〜${formatReleaseDate(result.last)}`;
  const releases=result.releases.filter(r=>r.precision==='day');
  showHighlights(releases,result);
  $('weekMessage').textContent=result.truncated?'掲載内容は一部です。今週のラインアップを見る →':releases.length?'今週のラインアップを見る →':'発売情報は確認できた作品から追加します。';
 }catch(error){$('weekMessage').textContent='発売情報を取得できませんでした。';$('retryWeek').hidden=false;}
 finally{busy=false;}
}
$('retryWeek').addEventListener('click',loadWeek);loadWeek();
