(() => {
  const {node,request}=GameCatalogClient;
  const load=document.getElementById('loadMedia'),list=document.getElementById('mediaItems'),message=document.getElementById('catalogMessage');let busy=false,hasResult=false;
  load.addEventListener('click',async()=>{
    if(busy)return;busy=true;load.disabled=true;message.textContent='新着見出しを確認しています…';message.dataset.error='false';
    try{
      const data=await request('/api/editor-games?resource=media-preview');if(!data)return;
      list.replaceChildren();for(const item of data.items){const row=node('li');row.append(node('h3',item.title),node('small',`記事公開：${GameDate.format(item.published_at)}（日本時間） ／ GAME Watch`));const link=node('a','元記事と、その中の公式情報・元投稿を確認する ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);list.append(row);}
      document.getElementById('mediaObserved').textContent=`確認日時：${GameDate.format(data.observed_at)}（日本時間）`;
      document.getElementById('mediaEmpty').textContent=data.items.length?'':'取得範囲に条件を満たす見出しはありません。新作や話題が存在しないという意味ではありません。';
      hasResult=true;message.textContent=`${data.items.length}件の見出しを取得しました。候補への自動登録はしていません。`;
    }catch(error){message.textContent=error.message+(hasResult?' 下の結果は前回の確認時点のものです。':'');message.dataset.error='true';}
    finally{busy=false;load.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;
    try{const result=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!result.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}catch(error){message.textContent=error.message;message.dataset.error='true';}
  });
  GameEditorSession.start();
})();
