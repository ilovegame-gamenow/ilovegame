// Shared rendering for saved source evidence. All content is text, never HTML.
window.GameSocialEvidence={render(container,sources){
  const {node}=GameCatalogClient;container.replaceChildren();
  if(!sources.length){container.append(node('p','保存された資料はありません。'));return;}
  container.append(node('p','保存した出典（最大100件、各投稿は直近20回分）。反応数は確認時点の資料です。'));
  for(const source of sources){
    const row=node('div'),link=node('a',source.url);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
    row.append(node('small',`出典の確認：${({pending:'確認待ち',verified:'確認済み',rejected:'不採用'})[source.review_status]||'確認待ち'}`));
    const observations=[...(source.game_social_observations||[])].sort((a,b)=>b.observed_at.localeCompare(a.observed_at));
    for(const item of observations){
      row.append(node('p',`Bluesky ／ @${item.actor} ／ 投稿日時：${GameDate.format(item.published_at)} ／ 確認日時：${GameDate.format(item.observed_at)}（日本時間）`));
      row.append(node('p',[['likes','いいね'],['reposts','再投稿'],['replies','返信'],['quotes','引用']].map(([key,label])=>`${label}：${item[key]===null?'取得できませんでした':Number(item[key]).toLocaleString('ja-JP')}`).join(' ／ ')));
    }
    container.append(row);
  }
}};
