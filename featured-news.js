/* Shared public and editor-preview rendering. Selection policy lives on the server. */
window.GameFeatured = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]);
  function render({ breaking = null, pickup = [] }, { clickable = true } = {}) {
    const box = document.getElementById('breaking');
    let heading = document.getElementById('breaking-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.id = 'breaking-heading';
      heading.className = 'section-title breaking-heading';
      heading.innerHTML = `<h2><svg class="section-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/></svg>BREAKING <span class="section-subtitle">速報</span></h2>`;
      box.before(heading);
    }
    heading.hidden = !breaking;
    box.hidden = !breaking;
    box.replaceChildren();
    if (breaking) {
      const image = GameImage.getUrl(breaking.thumbnail_url, breaking.source_name);
      box.innerHTML = `${image ? `<img id="breaking-image" src="${esc(image)}" alt="">` : ''}
        <h1>${esc(breaking.title)}</h1>
        ${GameNewsCard.renderFooter(breaking)}`;
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
    title.hidden = container.hidden = pickup.length === 0;
    container.innerHTML = pickup.map(article => {
      const image = GameImage.getUrl(article.thumbnail_url, article.source_name);
      const tag = clickable ? 'a' : 'article';
      const destination = clickable ? ` href="/article.html?id=${encodeURIComponent(article.id)}"` : '';
      return `<${tag} class="card news-card-link"${destination}>
        <div class="time">PICK UP</div>
        ${image ? `<img class="thumb" src="${esc(image)}" alt="">` : ''}
        <h3>${esc(article.title)}</h3><p class="meta">${esc(article.ilovegame_point || article.summary)}</p>
        ${GameNewsCard.renderFooter(article)}
      </${tag}>`;
    }).join('');
    window.GamePickupCarousel?.refresh();
  }
  return { render };
})();
