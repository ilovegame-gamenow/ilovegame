(() => {
  const params = new URLSearchParams(location.search);
  const articleIdText = params.get('article_id');
  const articleId = articleIdText === null ? null : Number(articleIdText);
  const validArticle = articleId === null || (/^[1-9]\d*$/.test(articleIdText) && Number.isSafeInteger(articleId));
  const form = document.getElementById('gameCreate');
  const fields = document.getElementById('gameFields');
  const query = document.getElementById('gameQuery');
  let preferredTitle=params.get('q')||'';
  const followingFilter=document.getElementById('followingFilter');
  if(['managed','favorites','removed','all'].includes(params.get('filter'))) followingFilter.value=params.get('filter');
  const message = document.getElementById('catalogMessage');
  const previous = document.getElementById('previousGames');
  const next = document.getElementById('nextGames');
  const storageKey = articleId===null?'ilovegame.catalog.create':`ilovegame.catalog.create.article.${articleId}`;
  const createPanel=document.getElementById('createPanel');
  let articleSource=null,baseline=null;
  const names = ['title','original_title','description','source_url','source_type'];
  let page=1, hasMore=false, ready=false, busy=false, ending=false, pendingRefresh=false;
  const {createId,node}=GameCatalogClient;
  let allGames=[], games=[], linkedGames=[], requestId=createId(), sent=false;
  const selectedTitle=()=>allGames.find(g=>g.id===query.value)?.title||'';
  const values = () => Object.fromEntries(names.map(name => [name,form.elements.namedItem(name).value]));
  function notify(text, error=false) { message.textContent=text; message.dataset.error=String(error); }
  function stash() {
    try { sessionStorage.setItem(storageKey,JSON.stringify({ id:requestId, game:values(), sent })); } catch { /* Current form remains usable. */ }
  }
  function clearDraft() { try { sessionStorage.removeItem(storageKey); } catch {} }
  function dirty() { return sent || (baseline!==null&&JSON.stringify(values())!==baseline); }
  function resetForm(){form.reset();if(articleSource){form.elements.namedItem('source_url').value=articleSource.url;form.elements.namedItem('source_type').value=articleSource.type;}baseline=JSON.stringify(values());}
  function openCreate(){if(busy||!ready)return;if(articleId===null){document.dispatchEvent(new CustomEvent('game-finder-open',{detail:{title:selectedTitle()}}));return;}createPanel.open=true;if(!form.elements.namedItem('title').value.trim()&&selectedTitle()){form.elements.namedItem('title').value=selectedTitle();stash();}createPanel.scrollIntoView({block:'start',behavior:'smooth'});form.elements.namedItem('title').focus();}
  document.getElementById('openGameCreate').addEventListener('click',openCreate);
  document.getElementById('createMissingGame').addEventListener('click',openCreate);
  function controls() {
    if(!busy&&pendingRefresh){pendingRefresh=false;queueMicrotask(()=>refresh(1));}
    fields.disabled=busy || !ready;
    document.getElementById('openGameCreate').disabled=busy||!ready;
    document.getElementById('createMissingGame').disabled=busy||!ready;
    query.disabled=busy || !ready;
    followingFilter.disabled=busy||!ready;
    previous.disabled=busy || !ready || page===1;
    next.disabled=busy || !ready || !hasMore;
    document.querySelectorAll('[data-game-action],[data-following]').forEach(button => button.disabled=busy || !ready);
  }
  const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{stash();ending=true;});
  function card(game, action) {
    const li=node('li');
    li.append(node('h3',game.title));
    if(articleId===null){
    const actions=node('div',undefined,'following-actions');
    const favorite=node('button',game.is_favorite?'★ お気に入り':'☆ お気に入り');favorite.type='button';favorite.dataset.following=game.is_favorite?'favorite_off':'favorite_on';favorite.dataset.gameId=game.id;favorite.setAttribute('aria-pressed',String(Boolean(game.is_favorite)));actions.append(favorite);
    const remove=node('button',game.is_managed===false?'管理リストに戻す':'管理リストから外す');remove.type='button';remove.dataset.following=game.is_managed===false?'restore':'remove';remove.dataset.gameId=game.id;actions.append(remove);li.append(actions);
    const outcomes={no_change:'新情報なし',news_found:'新情報あり',partial:'一部確認',failed:'確認できず'};
    li.append(node('p',game.last_checked_at?`最終確認：${GameDate.format(game.last_checked_at)} ／ ${outcomes[game.check_outcome]||'確認済み'}`:game.is_favorite?'定期確認待ち':'通常のニュース収集の対象','following-status'));
    if(game.check_note)li.append(node('p',game.check_note,'catalog-note'));
    }

    li.append(node('small',({draft:'未公開の作品',published:'公開用',archived:'保管中'})[game.status] || '未公開の作品'));
    const details=node('details'),summary=node('summary','資料・作品の詳細');details.append(summary);
    const why=node('details'),whyHeading=node('summary','AIのおすすめ理由'),whyBody=node('div');why.append(whyHeading,whyBody);li.append(why);
    let whyLoaded=false;
    why.addEventListener('toggle',async()=>{if(!why.open||whyLoaded)return;whyBody.textContent='読み込み中…';try{const data=await request(`/api/editor-games?resource=context&game_id=${game.id}`);if(data){GameArticleContext.reasons(whyBody,data);whyLoaded=true;}}catch(error){whyBody.textContent=error.message;}});
    if(game.original_title)details.append(node('small',game.original_title));
    if(game.description)details.append(node('p',game.description));
    details.append(node('small',`作品ID：${game.id}`,'catalog-id'));
    const sources=node('button','保存した資料を見る');sources.type='button';
    const evidence=node('div');evidence.hidden=true;details.append(sources,evidence);
    sources.addEventListener('click',async()=>{if(busy)return;sources.disabled=true;evidence.hidden=false;
      try{const data=await request(`/api/editor-games?resource=social-evidence&game_id=${game.id}`);if(data)GameSocialEvidence.render(evidence,data.sources);}
      catch(error){evidence.textContent=error.message;}finally{sources.disabled=false;}
    });
    if (action) {
      const button=node('button',action==='unlink'?'この記事から外す':'この作品を使う');
      button.type='button'; button.dataset.gameAction=action; button.dataset.gameId=game.id;
      li.append(button);
    } else if (articleId!==null) { li.append(node('small','関連づけ済み')); }
    li.append(details);
    return li;
  }
  function render() {
    const list=document.getElementById('gamesList'); list.replaceChildren();
    games.forEach(game => list.append(card(game,articleId===null || linkedGames.some(g=>g.id===game.id)?null:'link')));
    const links=document.getElementById('linkedGames'); links.replaceChildren();
    linkedGames.forEach(game => links.append(card(game,'unlink')));
    if (!linkedGames.length) links.append(node('li','まだ関連作品はありません。'));
    const empty=document.getElementById('gamesEmpty');
    empty.hidden=games.length>0;
    document.getElementById('createMissingGame').textContent=articleId===null?'ゲームを探して追加':'この作品を新しく登録';
    document.getElementById('gamesEmptyText').textContent=selectedTitle()?'選択したゲームは表示条件に含まれていません。':'まだ管理中の作品はありません。「ゲームを探す」から追加できます。';
    if(articleId===null&&!selectedTitle()&&followingFilter.value==='favorites')document.getElementById('gamesEmptyText').textContent='お気に入りはまだありません。作品の☆ボタンか「ゲームを探す」から追加できます。';
    if(articleId===null&&!selectedTitle()&&followingFilter.value==='removed')document.getElementById('gamesEmptyText').textContent='管理リストから外した作品はありません。';
    if (page>1 && !games.length) document.getElementById('gamesEmptyText').textContent='このページに作品はありません。「前へ」で戻ってください。';
    document.getElementById('gamePage').textContent=`${page}ページ`;
    controls();
  }
  function selectView(targetPage=page){
    const selected=GameSelection.view(allGames,query.value,targetPage);
    query.value=selected.selectedId;games=selected.games;page=selected.page;hasMore=selected.hasMore;
    render();
  }
  async function load() {
    const data=await GameSelection.collect(request,articleId!==null?'all':followingFilter.value,articleId);
    if(!data)return false;
    const previousSelection=query.value;
    allGames=data.games;linkedGames=data.linkedGames;
    query.replaceChildren();
    const all=node('option',`すべてのゲーム（${allGames.length}件）`);all.value='';query.append(all);
    const counts=new Map();for(const game of allGames)counts.set(game.title,(counts.get(game.title)||0)+1);
    const sorted=[...allGames].sort((a,b)=>a.title.localeCompare(b.title,'ja')||a.id.localeCompare(b.id));
    for(const game of sorted){const option=node('option',`${game.is_favorite?'★ ':''}${game.title}${counts.get(game.title)>1?`（${game.original_title||game.id}）`:''}`);option.value=game.id;query.append(option);}
    query.value=allGames.some(g=>g.id===previousSelection)?previousSelection:'';
    if(preferredTitle){query.value=allGames.find(g=>g.title===preferredTitle||g.original_title===preferredTitle)?.id||'';preferredTitle='';}
    ready=true;selectView();return true;
  }
  async function refresh(targetPage=page) {
    if (busy) return;
    const oldPage=page; page=targetPage; busy=true; controls();
    try { if (await load()) notify(''); } catch(error) { page=oldPage; notify(error.message,true); }
    finally { busy=false; controls(); }
  }
  query.addEventListener('change',()=>{selectView(1);notify('');});
  document.addEventListener('game-selection-request',event=>{preferredTitle=event.detail?.title||'';query.value='';if(busy){pendingRefresh=true;return;}refresh(1);});
  followingFilter.addEventListener('change',()=>refresh(1));
  document.addEventListener('game-following-changed',()=>{if(busy){pendingRefresh=true;return;}refresh(1);});
  previous.addEventListener('click',()=>selectView(page-1));
  next.addEventListener('click',()=>selectView(page+1));
  form.addEventListener('input',stash);
  form.addEventListener('change',stash);
  document.getElementById('clearGame').addEventListener('click',()=>{
    if (busy) return;
    resetForm(); clearDraft(); requestId=createId(); sent=false;
    notify('入力をクリアしました。');
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (busy || !ready || !form.reportValidity()) return;
    busy=true; sent=true; stash(); controls();
    try {
      const result=await GameCatalogWorkflow.register(request,{id:requestId,...values()},articleId);
      if (!result) return;
      resetForm(); clearDraft(); requestId=createId(); sent=false;
      query.value='';page=1;createPanel.open=false;
      notify(`「${result.game.title}」を登録しました。${articleId!==null?'この記事にも関連づけました。':''}`);
      try { await load(); } catch { notify('作品は登録されました。一覧を再読み込みして確認してください。',true); }
    } catch(error) { notify(error.message,true); }
    finally { busy=false; controls(); }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-following]');if(!button||busy||!ready)return;
    if(button.dataset.following==='remove'&&!confirm('管理リストから外し、お気に入りの個別確認を停止します。公開記事・発売情報は残ります。よろしいですか？'))return;
    busy=true;controls();
    try{const result=await request('/api/editor-games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'following',operation:button.dataset.following,game_id:button.dataset.gameId})});if(result){await load();notify('管理状態を保存しました。');}}
    catch(error){notify(error.message,true);}finally{busy=false;controls();}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-game-action]');
    if (!button || busy || !ready || articleId===null) return;
    busy=true; controls();
    try {
      const result=await request('/api/editor-games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:button.dataset.gameAction,article_id:articleId,game_id:button.dataset.gameId})});
      if (!result) return;
      try { await load(); notify(button.dataset.gameAction==='link'?'記事に関連づけました。':'関連を解除しました。'); }
      catch { ready=false; notify('操作を保存しました。一覧を再読み込みして確認してください。',true); }
    } catch(error) { notify(error.message,true); }
    finally { busy=false; controls(); }
  });
  document.addEventListener('click',async event=>{
    if (!event.target.closest('#logoutButton') || busy) return;
    stash();
    try {
      const response=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});
      if (!response.ok) throw new Error('ログアウトできませんでした。');
      ending=true; location.replace('/editor.html');
    } catch(error) { notify(error.message,true); }
  });
  window.addEventListener('beforeunload',event=>{
    if (!ending && (busy || dirty())) { stash(); event.preventDefault(); event.returnValue=''; }
  });
  window.addEventListener('editor-session-expired',()=>{ stash(); ending=true; });
  async function start() {
    if (!validArticle) { notify('記事IDが正しくありません。編集室から開き直してください。',true);return; }
    try {
      const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');
      if (saved && typeof saved.id==='string' && /^[0-9a-f-]{36}$/i.test(saved.id) && saved.game && names.every(name=>typeof saved.game[name]==='string')) {
        requestId=saved.id; sent=saved.sent===true;
        names.forEach(name=>{form.elements.namedItem(name).value=saved.game[name];});
      }
    } catch { /* Ignore unavailable storage or an invalid local draft. */ }
    baseline=JSON.stringify(values());
    const hasDraft=sent||names.filter(n=>n!=='source_type').some(n=>values()[n].trim());
    if(hasDraft){createPanel.open=true;document.getElementById('gameOptional').open=Boolean(values().original_title||values().description);}
    GameEditorSession.start();
    busy=true;
    try {
      if (articleId!==null) {
        createPanel.hidden=false;document.getElementById('openGameCreate').hidden=false;
        const detail=await request(`/api/editor-detail?id=${articleId}`);
        if (!detail) return;
        document.getElementById('contextTitle').textContent=detail.article.title;
        document.getElementById('catalogIntro').textContent='この記事が扱うゲームを選びます。登録済みなら「この作品を使う」、なければ新しく登録するだけで完了します。';
        document.getElementById('createGame').textContent='登録してこの記事に使う';
        document.getElementById('createNote').textContent='登録と記事への関連づけを続けて行います。記事や作品は公開されません。';
        try{const source=new URL(detail.article.source_url);if(['http:','https:'].includes(source.protocol)&&!source.username&&!source.password){articleSource={url:source.toString(),type:['Nintendo','PlayStation'].includes(detail.article.source_name)?'official':'media'};}}catch{}
        if(articleSource){document.getElementById('gameSourceHint').textContent='この記事の出典を入力済みです。作品の公式ページやストアが分かれば変更できます。';if(!hasDraft)resetForm();}

        document.getElementById('articleContext').hidden=false;
        const back=document.getElementById('catalogBack');
        const target=new URL(params.get('return') || `/editor-article.html?id=${articleId}`,location.origin);
        back.href=target.origin===location.origin && target.pathname==='/editor-article.html' && target.searchParams.get('id')===articleIdText
          ? target.pathname+target.search : `/editor-article.html?id=${articleId}`;
        back.textContent='← 記事に戻る';
        if (target.origin===location.origin && target.pathname==='/editor-article.html' && target.searchParams.get('id')===articleIdText) {
          GameEditorNavigation.prepareBack({targetPath:'/editor-article.html',selector:'#catalogBack'});
        }
      }
      if (await load()) notify(hasDraft?'入力途中の作品情報を復元しました。登録済みか不明な場合は、同じ入力のまま再試行できます。':'');
    } catch(error) { notify(error.message,true); }
    finally { busy=false; controls(); }
  }
  start();
})();
