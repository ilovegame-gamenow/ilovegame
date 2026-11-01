(() => {
  const {node,request}=GameCatalogClient;
  const load=document.getElementById('loadMedia'),list=document.getElementById('mediaItems'),message=document.getElementById('catalogMessage');let busy=false,hasResult=false;
  const controls=()=>{load.disabled=busy;list.querySelectorAll('button').forEach(b=>b.disabled=busy);};
  function render(data){
      list.replaceChildren();for(const item of data.items){const row=node('li');row.append(node('h3',item.title),node('small',`記事公開：${GameDate.format(item.published_at)}（日本時間） ／ GAME Watch`));const link=node('a','元記事と、その中の公式情報・元投稿を確認する ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
        const register=node('button','未公開の記事として登録・編集');register.type='button';
        register.addEventListener('click',async()=>{
          if(busy)return;busy=true;controls();message.textContent='記事を登録しています…';message.dataset.error='false';
          try{const result=await request('/api/editor-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_from_media',source_url:item.url})});if(!result)return;
            GameEditorNavigation.markChanged();location.href=`/editor-article.html?${new URLSearchParams({id:String(result.article.id),edit:'1',return:'/editor-media.html'})}`;
          }catch(error){message.textContent=error.message;message.dataset.error='true';}finally{busy=false;controls();}
        });row.append(register);list.append(row);}
      document.getElementById('mediaObserved').textContent=`確認日時：${GameDate.format(data.observed_at)}（日本時間）`;
      document.getElementById('mediaEmpty').textContent=data.items.length?'':'取得範囲に条件を満たす見出しはありません。新作や話題が存在しないという意味ではありません。';
  }
  try{
    const cached=JSON.parse(sessionStorage.getItem('ilovegame.media.preview')||'null');
    const age=Date.now()-Date.parse(cached?.observed_at);
    if(cached&&age>=0&&age<1800000&&Array.isArray(cached.items)&&cached.items.length<=20&&cached.items.every(item=>typeof item.title==='string'&&item.title.length<=600&&/^https:\/\/game\.watch\.impress\.co\.jp\/docs\/(?:news|interview|preview|kikaku)\/\d+\.html$/.test(item.url)&&Number.isFinite(Date.parse(item.published_at)))){
      render(cached);hasResult=true;message.textContent='前回取得した一覧を表示しています。最新情報は「新着見出しを取得」で確認できます。';
    }
  }catch{}
  load.addEventListener('click',async()=>{
    if(busy)return;busy=true;controls();message.textContent='新着見出しを確認しています…';message.dataset.error='false';
    try{
      const data=await request('/api/editor-games?resource=media-preview');if(!data)return;
      render(data);
      try{sessionStorage.setItem('ilovegame.media.preview',JSON.stringify(data));}catch{}
      hasResult=true;message.textContent=`${data.items.length}件の見出しを取得しました。候補への自動登録はしていません。`;
    }catch(error){message.textContent=error.message+(hasResult?' 下の結果は前回の確認時点のものです。':'');message.dataset.error='true';}
    finally{busy=false;controls();}
  });
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;
    try{const result=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!result.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}catch(error){message.textContent=error.message;message.dataset.error='true';}
  });
  GameEditorSession.start();
})();
