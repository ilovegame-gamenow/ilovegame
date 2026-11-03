import {roundupPreview} from './weekly-roundup-preview-data.js';
import {weekRange,formatReleaseDate} from './release-calendar-model.js';
import {requestCalendar} from './release-calendar-client.js';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).get('demo')==='1';
// This widget has its own request and state. News pagination and calendar filters do not affect it.
let busy=false;
async function loadWeek(){
 if(busy)return;busy=true;
 const range=weekRange();$('weekRange').textContent=`${formatReleaseDate(range.start)}〜${formatReleaseDate(range.last)}`;
 $('retryWeek').hidden=true;$('weekMessage').textContent='発売情報を確認中…';
 $('weeklyDemo').hidden=!demo;
 if(demo){
  $('calendarLink').href='/weekly-roundup-preview.html?demo=1';
  $('weekRange').textContent=`${formatReleaseDate(roundupPreview.start)}〜${formatReleaseDate(roundupPreview.last)}`;
  $('weeklyDemo').textContent='週まとめ記事の構成見本です。紹介例2作品で、全発売作品の一覧ではありません。';
  $('weekMessage').textContent='紹介例：2作品（全発売作品の一覧ではありません）';busy=false;return;
 }
 try{
  const result=await requestCalendar(new URLSearchParams({view:'week',region:'JP'}));
  $('weekRange').textContent=`${formatReleaseDate(result.start)}〜${formatReleaseDate(result.last)}`;
  const releases=result.releases.filter(r=>r.precision==='day');
  const count=new Set(releases.map(r=>r.game.id)).size;
  $('weekMessage').textContent=result.truncated?`登録済み ${count}作品以上・カレンダーで確認できます` : count?`登録済み ${count}作品・カレンダーで確認できます`:'発売情報は確認できた作品から追加します。';
 }catch(error){$('weekMessage').textContent='発売情報を取得できませんでした。';$('retryWeek').hidden=false;}
 finally{busy=false;}
}
$('retryWeek').addEventListener('click',loadWeek);loadWeek();
