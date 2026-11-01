(() => {
  const {node,request}=GameCatalogClient;
  const load=document.getElementById('loadSocial'),list=document.getElementById('socialPosts'),message=document.getElementById('catalogMessage');
  let busy=false,hasResult=false,selected=null,page=1,hasMore=false,searchBusy=false;
  const searchForm=document.getElementById('socialGameSearch'),gameQuery=document.getElementById('socialGameQuery'),gameStatus=document.getElementById('socialGameStatus');
  const previous=document.getElementById('socialPrevious'),next=document.getElementById('socialNext');
  const controls=()=>{document.querySelectorAll('[data-save-social]').forEach(b=>b.disabled=busy||!selected);previous.disabled=searchBusy||page===1;next.disabled=searchBusy||!hasMore;};
  async function searchGames(target=1){
    if(searchBusy)return;searchBusy=true;controls();
    try{const data=await request(`/api/editor-games?${new URLSearchParams({q:gameQuery.value.trim(),page:String(target)})}`);if(!data)return;page=target;hasMore=data.hasMore;const games=document.getElementById('socialGames');games.replaceChildren();
      for(const game of data.games){const row=node('li'),choose=node('button',`「${game.title}」を選ぶ`);choose.type='button';row.append(node('h3',game.title),node('small',`作品ID：${game.id}`),choose);choose.addEventListener('click',()=>{if(busy)return;selected=game;document.getElementById('selectedSocialGame').textContent=`保存先：${game.title}（${game.id}）`;controls();});games.append(row);}
      gameStatus.textContent=data.games.length?`${page}ページ：元投稿と一致する作品を選んでください。`:'該当作品がありません。作品管理で先に登録してください。';
    }catch(error){gameStatus.textContent=error.message;}finally{searchBusy=false;controls();}
  }
  searchForm.addEventListener('submit',event=>{event.preventDefault();searchGames();});previous.addEventListener('click',()=>searchGames(page-1));next.addEventListener('click',()=>searchGames(page+1));
  const number=value=>value===null?'取得できませんでした':value.toLocaleString('ja-JP');
  load.addEventListener('click',async()=>{
    if(busy)return;busy=true;load.disabled=true;message.textContent='公開情報を確認しています…';message.dataset.error='false';
    try{
      const result=await request('/api/editor-games?resource=bluesky-preview');if(!result)return;
      list.replaceChildren();
      document.getElementById('socialSummary').textContent=`Bluesky ／ @${result.actor}：${result.returned}件を確認し、${result.posts.length}件を表示しました（除外${result.skipped}件）。`;
      document.getElementById('socialObserved').textContent=`確認日時：${GameDate.format(result.observed_at)}（日本時間）`;
      const verified=node('a','アカウントの案内元（開発元公式サイト）');verified.href=result.verified_by;verified.target='_blank';verified.rel='noopener noreferrer';
      const origin=node('li');origin.append(verified);list.append(origin);
      for(const post of result.posts){
        const item=node('li');item.append(node('h3',`公式投稿 ／ ${GameDate.format(post.published_at)}`));
        item.append(node('p',`いいね：${number(post.metrics.likes)} ／ 再投稿：${number(post.metrics.reposts)} ／ 返信：${number(post.metrics.replies)} ／ 引用：${number(post.metrics.quotes)}`));
        const link=node('a','Blueskyで元投稿を確認する ↗');link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
        if(result.save_enabled){
          const save=node('button','選択した作品に資料を保存');save.type='button';save.dataset.saveSocial='true';
          save.addEventListener('click',async()=>{
            if(busy||!selected)return;const target=selected;busy=true;load.disabled=true;controls();
            try{const saved=await request('/api/editor-games?resource=social-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game_id:target.id,post_url:post.url,preview_token:result.preview_token})});if(!saved)return;message.textContent=`「${target.title}」に資料を保存しました。同じ取得結果の再保存では記録は増えません。`;message.dataset.error='false';}
            catch(error){message.textContent=error.message;message.dataset.error='true';}finally{busy=false;load.disabled=false;controls();}
          });item.append(save);
        }
        list.append(item);
      }
      if(!result.posts.length)list.append(node('li','表示条件に合う投稿がありませんでした。反応が少ない・作品の評価が低いという意味ではありません。'));
      hasResult=true;message.textContent='公式資料を取得しました。AIは使用していません。';
    }catch(error){message.textContent=error.message+(hasResult?' 下の結果は前回の確認時点のものです。':'');message.dataset.error='true';}
    finally{busy=false;load.disabled=false;controls();}
  });
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;
    try{const result=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!result.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}
    catch(error){message.textContent=error.message;message.dataset.error='true';}
  });
  GameEditorSession.start();
})();
