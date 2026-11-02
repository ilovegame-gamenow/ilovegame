import {roundupPreview} from './weekly-roundup-preview-data.js';
import {weekRange,formatReleaseDate} from './release-calendar-model.js';
import {releaseCard,requestCalendar} from './release-calendar-client.js';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).get('demo')==='1';
// This widget has its own request and state. News pagination and calendar filters do not affect it.
let busy=false;
async function loadWeek(){
 if(busy)return;busy=true;
 const range=weekRange();$('weekRange').textContent=`${formatReleaseDate(range.start)}〜${formatReleaseDate(range.last)}`;
 $('retryWeek').hidden=true;$('weekList').replaceChildren();$('weekMessage').textContent='今週の発売情報を読み込んでいます…';
 $('weeklyDemo').hidden=!demo;
 if(demo){
  $('calendarLink').href='/calendar.html?demo=1';
  $('weekRange').textContent=`${formatReleaseDate(roundupPreview.start)}〜${formatReleaseDate(roundupPreview.last)}`;
  $('weeklyDemo').textContent='週まとめ記事の構成見本です。紹介例2作品で、全発売作品の一覧ではありません。';
  const link=document.createElement('a');link.className='roundup-preview-link';link.href='/weekly-roundup-preview.html?demo=1';
  link.innerHTML=GameNewsCard.render(roundupPreview.article,{clickable:false});$('weekList').replaceChildren(link);$('weekMessage').textContent='';busy=false;return;
 }
 try{
  const result=await requestCalendar(new URLSearchParams({view:'week',region:'JP'}));
  $('weekRange').textContent=`${formatReleaseDate(result.start)}〜${formatReleaseDate(result.last)}`;
  const releases=result.releases.filter(r=>r.precision==='day');
  $('weekMessage').textContent=result.truncated?'情報が多いため一部の作品を表示しています。':releases.length?'':'今週の発売情報はまだ掲載されていません。';
  $('weekList').replaceChildren(...releases.map(r=>releaseCard(r,{showDate:true,demo})));
 }catch(error){$('weekMessage').textContent=error.message;$('retryWeek').hidden=false;}
 finally{busy=false;}
}
$('retryWeek').addEventListener('click',loadWeek);loadWeek();
