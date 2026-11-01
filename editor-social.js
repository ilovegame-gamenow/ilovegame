(() => {
  const {node,request}=GameCatalogClient;
  const load=document.getElementById('loadSocial'),list=document.getElementById('socialPosts'),message=document.getElementById('catalogMessage');
  let busy=false,hasResult=false;
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
        const link=node('a','Blueskyで元投稿を確認する ↗');link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';item.append(link);list.append(item);
      }
      if(!result.posts.length)list.append(node('li','表示条件に合う投稿がありませんでした。反応が少ない・作品の評価が低いという意味ではありません。'));
      hasResult=true;message.textContent='公式資料を取得しました。AIは使用していません。';
    }catch(error){message.textContent=error.message+(hasResult?' 下の結果は前回の確認時点のものです。':'');message.dataset.error='true';}
    finally{busy=false;load.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;
    try{const result=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!result.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}
    catch(error){message.textContent=error.message;message.dataset.error='true';}
  });
  GameEditorSession.start();
})();
