/* One response pairs featured games with the paginated, non-duplicated latest list. */
(() => {
  const rail = document.getElementById('pickup');
  const latest = document.querySelector('.grid');
  const retry = document.getElementById('featured-retry');
  const button = retry.querySelector('button');
  const pagination = document.getElementById('pagination');
  let loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    retry.hidden = true;
    rail.setAttribute('aria-busy', 'true');
    latest.setAttribute('aria-busy', 'true');
    const params = new URLSearchParams(location.search);
    const requestedPage = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    try {
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(`/api/news?view=home&page=${requestedPage}`, {
            cache: 'no-store', signal: controller.signal
          });
          if (!response.ok) throw new Error('News unavailable');
          result = await response.json();
          if (!Array.isArray(result.articles) || !Object.hasOwn(result, 'featured')) throw new Error('Invalid news response');
          break;
        } catch (error) {
          if (attempt === 1) throw error;
        } finally { clearTimeout(timer); }
      }
      // Reset the previous selection before rendering a fresh response.
      GameFeatured.render(result.featured || { breaking: null, pickup: [] });
      if (!result.featured) {
        rail.innerHTML = '<p class="meta featured-status">注目を読み込めませんでした。再読み込みをお試しください。</p>';
        retry.hidden = false;
      }
      latest.innerHTML = result.articles.map(article => GameNewsCard.render(article)).join('') ||
        (result.featured?.pickup.length ? '<p class="meta featured-status">最新の記事は上の「注目」で紹介しています♪</p>' : '<p class="meta">公開中のニュースはありません。</p>');
      const currentPage = result.page || requestedPage;
      const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || 20)));
      if (currentPage !== requestedPage) {
        const url = new URL(location.href);
        url.searchParams.set('page', String(currentPage));
        history.replaceState(null, '', url);
      }
      pagination.replaceChildren(GamePagination.render(currentPage, totalPages, page => {
        location.href = `?page=${page}#latest`;
      }));
    } catch {
      // Never leave featured cards from a different snapshot beside a new list.
      GameFeatured.render({ breaking: null, pickup: [] });
      rail.innerHTML = '<p class="meta featured-status">ニュースを読み込めませんでした。再読み込みをお試しください。</p>';
      latest.innerHTML = '<p class="meta">ニュースを読み込めませんでした。</p>';
      pagination.replaceChildren();
      retry.hidden = false;
    } finally {
      rail.setAttribute('aria-busy', 'false');
      latest.setAttribute('aria-busy', 'false');
      loading = false;
    }
  }
  button.addEventListener('click', load);
  load();
})();
