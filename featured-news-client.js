/* Load featured slots independently: an unavailable API is not an empty selection. */
(() => {
  const container = document.getElementById('pickup');
  const retry = document.getElementById('featured-retry');
  const button = retry.querySelector('button');
  let loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    retry.hidden = true;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<p class="meta featured-status">注目のゲームを読み込み中…</p>';
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
          const response = await fetch('/api/featured-news', { cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error('Featured news unavailable');
          const result = await response.json();
          if (!result || !Array.isArray(result.pickup) || !Object.hasOwn(result, 'breaking')) {
            throw new Error('Invalid featured news response');
          }
          GameFeatured.render(result);
          return;
        } catch (error) {
          if (attempt === 1) throw error;
        } finally {
          clearTimeout(timer);
        }
      }
    } catch {
      container.innerHTML = '<p class="meta featured-status">注目のゲームを読み込めませんでした。再読み込みをお試しください。</p>';
      retry.hidden = false;
    } finally {
      container.setAttribute('aria-busy', 'false');
      loading = false;
    }
  }
  button.addEventListener('click', load);
  load();
})();
