/* Shared public and editor-preview rendering. Selection policy lives on the server. */
window.GameFeatured = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]);
  function render({ breaking = null, pickup = [] }, { clickable = true } = {}) {
    const box = document.getElementById('breaking');
    box.hidden = !breaking;
    box.replaceChildren();
    if (breaking) {
      const image = GameImage.getUrl(breaking.thumbnail_url, breaking.source_name);
      box.innerHTML = `<div class="breaking-label">● BREAKING / 速報</div>
        ${image ? `<img id="breaking-image" src="${esc(image)}" alt="">` : ''}
        <h1>${esc(breaking.title)}</h1>
        <div class="meta">${esc(breaking.source_name || 'I LOVE GAME♪')} ｜ 注目度 ${esc(breaking.importance || 0)}</div>`;
      if (clickable) {
        const link = document.createElement('a');
        link.href = `/article.html?id=${encodeURIComponent(breaking.id)}`;
        link.className = 'breaking-link';
        link.append(...box.childNodes);
        box.append(link);
      }
    }
    const container = document.getElementById('pickup');
    const title = document.getElementById('pickup-heading');
    title.hidden = pickup.length === 0;
    container.innerHTML = pickup.map(article => {
      const image = GameImage.getUrl(article.thumbnail_url, article.source_name);
      const tag = clickable ? 'a' : 'article';
      const destination = clickable ? ` href="/article.html?id=${encodeURIComponent(article.id)}"` : '';
      return `<${tag} class="card news-card-link"${destination}>
        <div class="time">PICK UP</div>
        ${image ? `<img class="thumb" src="${esc(image)}" alt="">` : ''}
        <h3>${esc(article.title)}</h3><p class="meta">${esc(article.summary)}</p>
        <span class="tag">注目度 ${esc(article.importance || 0)}</span>
      </${tag}>`;
    }).join('');
  }
  return { render };
})();
