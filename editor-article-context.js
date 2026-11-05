/* Editorial-only game and provenance panel; article rendering stays independent. */
(() => {
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const channels={news:'通常のニュース収集',discovery:'未知のゲーム探索',favorite:'お気に入り作品の追跡',manual:'手動検索・登録'};
 function reasons(container,data){
  container.replaceChildren();
  const entries=[...(data.contexts||[]),...(data.discoveries||[]).map(d=>({selection_reason:d.reason,evidence_url:d.source_url,observed_at:d.observed_at,game_title:d.game_title,scope:'game'}))];
  if(!entries.length){container.append(node('p','AIのおすすめ理由はまだ記録されていません。'));return;}
  for(const entry of entries){
   const block=node('div');block.className='discovery-context-entry';
   if(entry.scope==='game')block.append(node('strong',entry.game_title?`作品のおすすめ理由：${entry.game_title}`:'作品のおすすめ理由（過去の記録）'));
   block.append(node('p',entry.selection_reason||'AIのおすすめ理由はまだ記録されていません。'));
   if(entry.channel||entry.trigger_reason){
    const details=node('details');details.append(node('summary','見つけた経緯'));
    if(entry.channel)details.append(node('p',`発見経路：${channels[entry.channel]||'未記録'}`));
    if(entry.trigger_reason)details.append(node('p',entry.trigger_reason));
    block.append(details);
   }
   try{const url=new URL(entry.evidence_url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password){const a=node('a','判断の根拠を見る ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';block.append(a);}}catch{}
   container.append(block);
  }
 }
 async function request(url,options){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  if(response.status===401){GameEditorSession.expire();return null;}
  if(!response.ok)throw Error('読み込めませんでした。再読み込みしてください。');
  return response.json();
 }
 async function mount(container,articleId){
  const games=node('div'),reason=node('div'),status=node('p');status.setAttribute('role','status');
  const heading=node('h3','この記事のゲーム');
  const change=node('a','作品を登録・変更');change.href=`/editor-games.html?article_id=${articleId}&return=${encodeURIComponent(location.pathname+location.search)}`;
  const reload=node('button','再試行');reload.type='button';reload.hidden=true;
  container.replaceChildren(heading,games,change,node('h3','AIのおすすめ理由'),node('p','編集室専用：この記事を取り上げたいと判断した理由です。'),reason,status,reload);
  async function load(){reload.hidden=true;reload.disabled=true;status.textContent='読み込み中…';
   try{const data=await request(`/api/editor-games?resource=context&article_id=${articleId}`);if(!data)return;
    games.replaceChildren();
    if(!data.games.length)games.append(node('p','作品がまだ登録されていません。'));
    for(const game of data.games){
     const row=node('p'),link=node('a',game.title);link.href=`/editor-games.html?q=${encodeURIComponent(game.title)}&filter=all`;
     const star=node('button',game.is_favorite?'★ お気に入り':'☆ お気に入り');star.type='button';star.setAttribute('aria-pressed',String(Boolean(game.is_favorite)));
     star.addEventListener('click',async()=>{star.disabled=true;status.textContent='保存中…';try{const saved=await request('/api/editor-games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'following',operation:game.is_favorite?'favorite_off':'favorite_on',game_id:game.id})});if(saved)await load();}catch(error){status.textContent=error.message;}finally{star.disabled=false;}});
     row.append(link,document.createTextNode('　'),star);games.append(row);
    }
    reasons(reason,data);status.textContent='';
   }catch(error){status.textContent=error.message;reload.hidden=false;}finally{reload.disabled=false;}
  }
  reload.addEventListener('click',load);await load();
 }
 window.GameArticleContext={mount,reasons,request};
})();
