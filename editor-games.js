(() => {
  const params = new URLSearchParams(location.search);
  const articleIdText = params.get('article_id');
  const articleId = articleIdText === null ? null : Number(articleIdText);
  const validArticle = articleId === null || (/^[1-9]\d*$/.test(articleIdText) && Number.isSafeInteger(articleId));
  const search = document.getElementById('gameSearch');
  const form = document.getElementById('gameCreate');
  const fields = document.getElementById('gameFields');
  const query = document.getElementById('gameQuery');
  const message = document.getElementById('catalogMessage');
  const previous = document.getElementById('previousGames');
  const next = document.getElementById('nextGames');
  const storageKey = 'ilovegame.catalog.create';
  const names = ['title','original_title','description','source_url','source_type'];
  let page=1, hasMore=false, ready=false, busy=false, ending=false;
  function createId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  let games=[], linkedGames=[], requestId=createId(), sent=false;
  const values = () => Object.fromEntries(names.map(name => [name,form.elements.namedItem(name).value]));
  function notify(text, error=false) { message.textContent=text; message.dataset.error=String(error); }
  function stash() {
    try { sessionStorage.setItem(storageKey,JSON.stringify({ id:requestId, game:values(), sent })); } catch { /* Current form remains usable. */ }
  }
  function clearDraft() { try { sessionStorage.removeItem(storageKey); } catch {} }
  function dirty() { const data=values(); return sent || names.filter(n=>n!=='source_type').some(n=>data[n].trim()); }
  function controls() {
    fields.disabled=busy || !ready;
    query.disabled=busy || !ready;
    search.querySelector('button').disabled=busy || !ready;
    previous.disabled=busy || !ready || page===1;
    next.disabled=busy || !ready || !hasMore;
    document.querySelectorAll('[data-game-action]').forEach(button => button.disabled=busy || !ready);
  }
  async function request(path, options={}) {
    const response = await fetch(path,{ credentials:'same-origin', cache:'no-store', ...options });
    if (response.status===401) { stash(); ending=true; GameEditorSession.expire(); return null; }
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || '作品情報を取得できませんでした。');
    return data;
  }
  function node(tag,text,className) {
    const result=document.createElement(tag);
    if (text!==undefined) result.textContent=text;
    if (className) result.className=className;
    return result;
  }
  function card(game, action) {
    const li=node('li');
    li.append(node('h3',game.title));
    if (game.original_title) li.append(node('small',game.original_title));
    li.append(node('small',({draft:'確認待ち',published:'公開用',archived:'保管中'})[game.status] || '確認待ち'));
    if (game.description) li.append(node('p',game.description));
    // IDs distinguish namesakes without treating a title as a unique identifier.
    li.append(node('small',`作品ID：${game.id}`,'catalog-id'));
    if (action) {
      const button=node('button',action==='unlink'?'関連を解除':'この記事に関連づける');
      button.type='button'; button.dataset.gameAction=action; button.dataset.gameId=game.id;
      li.append(button);
    } else if (articleId!==null) { li.append(node('small','関連づけ済み')); }
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
    empty.textContent=query.value.trim()?'該当する作品がありません。作品名や原題を変えて検索してください。':'登録済みの作品はありません。';
    if (page>1 && !games.length) empty.textContent='このページに作品はありません。「前へ」で戻ってください。';
    document.getElementById('gamePage').textContent=`${page}ページ`;
    controls();
  }
  async function load() {
    const filters=new URLSearchParams({ q:query.value.trim(), page:String(page) });
    if (articleId!==null) filters.set('article_id',String(articleId));
    const data=await request(`/api/editor-games?${filters}`);
    if (!data) return false;
    games=data.games; linkedGames=data.linkedGames; hasMore=data.hasMore; ready=true;
    render(); return true;
  }
  async function refresh(targetPage=page) {
    if (busy) return;
    const oldPage=page; page=targetPage; busy=true; controls();
    try { if (await load()) notify(''); } catch(error) { page=oldPage; notify(error.message,true); }
    finally { busy=false; controls(); }
  }
  search.addEventListener('submit',event=>{event.preventDefault();refresh(1);});
  previous.addEventListener('click',()=>refresh(page-1));
  next.addEventListener('click',()=>refresh(page+1));
  form.addEventListener('input',stash);
  form.addEventListener('change',stash);
  document.getElementById('clearGame').addEventListener('click',()=>{
    if (busy) return;
    form.reset(); clearDraft(); requestId=createId(); sent=false;
    notify('入力をクリアしました。');
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (busy || !ready || !form.reportValidity()) return;
    busy=true; sent=true; stash(); controls();
    try {
      const result=await request('/api/editor-games',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',game:{id:requestId,...values()}}) });
      if (!result) return;
      form.reset(); clearDraft(); requestId=createId(); sent=false;
      query.value='';page=1;
      notify(`「${result.game.title}」を登録しました。${articleId!==null?'一覧からこの記事に関連づけてください。':''}`);
      try { await load(); } catch { notify('作品は登録されました。一覧を再読み込みして確認してください。',true); }
    } catch(error) { notify(error.message,true); }
    finally { busy=false; controls(); }
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
    GameEditorSession.start();
    busy=true;
    try {
      if (articleId!==null) {
        const detail=await request(`/api/editor-detail?id=${articleId}`);
        if (!detail) return;
        document.getElementById('contextTitle').textContent=detail.article.title;
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
      if (await load()) notify(dirty()?'入力途中の作品情報を復元しました。登録済みか不明な場合は、同じ入力のまま再試行できます。':'');
    } catch(error) { notify(error.message,true); }
    finally { busy=false; controls(); }
  }
  start();
})();
