import {requestCalendar} from './release-calendar-client.js';
import {formatReleaseDate,weeklyOverview} from './release-calendar-model.js';
import {renderWeeklyRoundup} from './weekly-roundup-view.js';
const $ = id => document.getElementById(id);
let busy = false;
async function load() {
  if (busy) return;
  busy = true; $('retryRoundup').hidden = true;
  $('roundupMessage').textContent = '発売情報を読み込んでいます…';
  try {
    const result = await requestCalendar(new URLSearchParams({view:'roundup',region:'JP'}));
    const dates = `${formatReleaseDate(result.start)}〜${formatReleaseDate(result.last)}`;
    $('roundupRange').textContent = `${result.start.slice(0,4)}年 ${dates}（日本時間）`;
    const headline=weeklyOverview(result.releases,result).headline;
    $('roundupTitle').textContent=headline;
    document.title = `${headline} | I LOVE GAME♪`;
    renderWeeklyRoundup(result,$('roundupEntries'),$('roundupToc'));
    const count = new Set(result.releases.map(r => r.game.id)).size;
    $('roundupMessage').textContent = `登録済み ${count}作品${result.truncated ? '以上（一部を表示しています）' : ''}${result.detailsUnavailable ? '。紹介情報を取得できなかったため、発売情報のみ表示しています。' : ''}`;
    $('retryRoundup').hidden = !result.detailsUnavailable;
  } catch {
    $('roundupMessage').textContent = '発売情報を読み込めませんでした。時間をおいて再度お試しください。';
    $('retryRoundup').hidden = false;
  } finally { busy = false; }
}
$('retryRoundup').addEventListener('click',load); load();
