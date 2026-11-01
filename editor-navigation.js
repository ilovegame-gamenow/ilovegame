// 編集室内の移動と、履歴から復元した一覧の鮮度を管理する。
window.GameEditorNavigation = (() => {
  const dashboardPath = '/editor-dashboard.html';
  const revisionKey = 'ilovegame.editor-list-revision';
  const maxAge = 60 * 1000;
  function revision() {
    try { return sessionStorage.getItem(revisionKey) || ''; }
    catch { return null; }
  }
  function markChanged() {
    try { sessionStorage.setItem(revisionKey, `${Date.now()}-${Math.random()}`); }
    catch { /* ストレージが使えない場合、復帰時に一覧を再取得する。 */ }
  }
  function openArticle(id) {
    try { sessionStorage.setItem('editorScrollY', String(window.scrollY)); } catch {}
    const params = new URLSearchParams({ id:String(id), return:location.pathname + location.search });
    location.href = `/editor-article.html?${params}`;
  }
  function prepareBack({ targetPath=dashboardPath, selector='a[data-editor-back]' } = {}) {
    const target = new URLSearchParams(location.search).get('return');
    if (!target || !(target === targetPath || target.startsWith(targetPath + '?'))) return;
    const expected = new URL(target, location.origin);
    // 直接表示・別タブ表示では、通常のリンクを使う。再読み込み後は履歴上の印を維持する。
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation?.type === 'navigate' && history.length > 1 && document.referrer === expected.href) {
      history.replaceState({...history.state, editorReturn:target}, '');
    }
    document.addEventListener('click', event => {
      const link = event.target.closest(selector);
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      if (link.href !== expected.href || history.state?.editorReturn !== target || history.length <= 1) return;
      event.preventDefault();
      history.back();
    });
  }
  function createListState() {
    let loaded = null;
    return {
      capture: () => ({revision:revision()}),
      loaded(snapshot) { loaded = {...snapshot, time:Date.now()}; },
      needsReload() {
        const current = revision();
        return !loaded || current === null || loaded.revision !== current || Date.now() - loaded.time >= maxAge;
      }
    };
  }
  return {openArticle, prepareBack, markChanged, createListState};
})();
