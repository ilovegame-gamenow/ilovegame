import {node} from './release-calendar-client.js';
import {releaseScheduleLabel} from './release-maintenance-model.js';
function heading(text){return node('h3',text);}
function sourceLink(url){
  try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;
    const a=node('a','根拠の公式情報を見る ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;
  }catch{return null;}
}
export function renderReleaseMaintenance(list,data,onDecision){
  list.replaceChildren();
    list.append(heading('変更の確認待ち'));
    if(!data.pending.length)list.append(node('p','確認待ちの変更はありません。','catalog-note'));
    for(const c of data.pending){
      const card=node('section',undefined,'catalog-panel');
      card.append(node('h4',`${c.release.game.title}／${c.release.platform_code}・${c.release.region_code}`),
        node('p',`${releaseScheduleLabel(c.before_values)} → ${releaseScheduleLabel(c.proposed)}`),node('p',c.reason),node('p',c.evidence,'catalog-note'));
      const link=sourceLink(c.source_values?.url??c.source.url);if(link)card.append(link);
      for(const [action,label] of [['apply','確認して反映する'],['reject','この変更は採用しない']]){
        const button=node('button',label);button.type='button';button.addEventListener('click',async()=>{
          button.disabled=true;
          try{await onDecision(action,c);}finally{button.disabled=false;}
        });card.append(button);
      }list.append(card);
    }
    if(data.hasMorePending)list.append(node('p','確認待ちはほかにもあります。反映後に読み直してください。','catalog-note'));
    list.append(heading('次に再確認する作品'));
    if(!data.due.length)list.append(node('p','現在、再確認の対象はありません。','catalog-note'));
    for(const r of data.due)list.append(node('p',`${r.title}／${r.platform_code}：${releaseScheduleLabel(r)}`));
    list.append(heading('最近の再確認結果'));
    if(!data.recentChecks.length)list.append(node('p','再確認の記録はまだありません。','catalog-note'));
    const outcomes={unchanged:'変更なし',change_candidate:'変更案あり',ambiguous:'判断に必要な情報が不足',unavailable:'情報を取得できませんでした'};
    for(const c of data.recentChecks)list.append(node('p',`${c.release.game.title}／${c.release.platform_code}：${outcomes[c.outcome]}。${c.reason}`));
    list.append(heading('最近の変更履歴'));
    if(!data.history.length)list.append(node('p','変更履歴はまだありません。','catalog-note'));
    for(const h of data.history)list.append(node('p',`${h.release.game.title}／${h.release.platform_code}：${releaseScheduleLabel(h.before_values)} → ${releaseScheduleLabel(h.after_values)}`));
}
