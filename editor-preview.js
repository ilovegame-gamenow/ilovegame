(async () => {
  GameEditorSession.start();
  const byId = id => document.getElementById(id);
  const message = byId('previewMessage');
  document.addEventListener('click', async event => {
    if (!event.target.closest('#logoutButton')) return;
    try {
      const response = await fetch('/api/editor-logout', { method:'POST', credentials:'same-origin' });
      if (!response.ok) throw new Error('ログアウトできませんでした');
      location.replace('/editor.html');
    } catch (error) { message.textContent = error.message; }
  });
  const source = byId('previewSource');
  const selectors = [byId('breakingSelect'), ...document.querySelectorAll('.pickup-select')];
  const saved = [];
  let nextPage = 1;
  let totalPages = 1;
  const sample = [
    ['新作アクションの発売日が決定！冒険の舞台を公開', 96, 1],
    ['人気シリーズの大型アップデート、新しい遊びをチェック', 88, 12],
    ['気になる新作の体験版が登場。ひと足先に遊んでみよう', 85, 48],
    ['週末に楽しみたいゲーム特集、新しいお気に入りを探そう', 82, 72]
  ].map(([title, importance, age], i) => ({
    id: `sample-${i}`, title, importance, source_name: '表示確認サンプル',
    summary: 'これは表示確認用のサンプル記事です。画像や見出し、カードの余白を確認できます。',
    thumbnail_url: new URL('/preview-sample.svg', location.origin).href,
    site_published_at: new Date(Date.now() - age * 3600000).toISOString(), platforms: ['Switch 2', 'PS5']
  }));
  const candidates = () => source.value === 'sample' ? sample : saved;
  async function read(url) {
    const response = await fetch(url, { credentials:'same-origin', cache:'no-store' });
    if (response.status === 401) { location.replace('/editor.html'); throw new Error('ログインが必要です'); }
    if (!response.ok) throw new Error('記事を取得できませんでした');
    return response.json();
  }
  function fillSelectors() {
    for (const select of selectors) {
      const previous = select.value;
      select.replaceChildren(new Option('表示しない', ''));
      for (const article of candidates()) select.add(new Option(article.title || '見出しなし', String(article.id)));
      select.value = previous;
    }
  }
  function defaults() {
    selectors.forEach((select, index) => { select.value = String(candidates()[index]?.id ?? ''); });
    render();
  }
  function render() {
    const articleFor = select => {
      const article = candidates().find(a => String(a.id) === select.value);
      return article ? { ...article, thumbnail_url:byId('showImages').checked ? article.thumbnail_url : null } : null;
    };
    const breaking = articleFor(selectors[0]);
    const pickup = selectors.slice(1).map(articleFor).filter(Boolean).filter((a,i,all) => a.id !== breaking?.id && all.findIndex(b=>b.id===a.id)===i);
    GameFeatured.render({ breaking, pickup }, { clickable:false });
    byId('emptyNotice').hidden = Boolean(breaking || pickup.length);
    byId('previewNews').innerHTML = candidates().slice(0,4).map(a => GameNewsCard.render({ ...a, thumbnail_url:byId('showImages').checked ? a.thumbnail_url : null }, { clickable:false })).join('');
  }
  async function loadSaved() {
    byId('loadMore').disabled = true;
    try {
      const data = await read(`/api/editor-news?status=published&page=${nextPage}`);
      for (const article of data.articles) if (!saved.some(a=>a.id===article.id)) saved.push(article);
      nextPage = data.page + 1;
      totalPages = Math.max(1, Math.ceil(data.total / data.limit));
      message.textContent = saved.length ? '掲載済みの記事を選んで表示できます。' : '掲載済みの記事がありません。サンプル記事で確認できます。';
      fillSelectors();
    } finally {
      byId('loadMore').disabled = false;
      byId('loadMore').hidden = source.value !== 'saved' || nextPage > totalPages;
    }
  }
  try {
    await Promise.all([read('/api/editor-news?auth=check'), GameDate.ready]);
    fillSelectors(); defaults(); byId('previewFields').disabled = false;
    message.textContent = 'サンプル記事で表示しています。';
    source.addEventListener('change', async () => {
      try {
        if (source.value === 'saved' && !saved.length) await loadSaved();
        fillSelectors(); defaults();
        byId('loadMore').hidden = source.value !== 'saved' || nextPage > totalPages;
        if (source.value === 'sample') message.textContent = 'サンプル記事で表示しています。';
      } catch (error) { message.textContent = error.message; }
    });
    byId('loadMore').addEventListener('click', () => loadSaved().catch(error=>{message.textContent=error.message;}));
    selectors.forEach(select => select.addEventListener('change', render));
    byId('showImages').addEventListener('change', render);
    byId('showEmpty').addEventListener('click', () => { selectors.forEach(s=>{s.value='';}); render(); });
    byId('showDefault').addEventListener('click', defaults);
  } catch (error) { message.textContent = error.message; }
})();
