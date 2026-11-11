/* I LOVE GAME♪ 共通ニュースカード */
(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function render(article, options = {}) {
    const a = article || {};
    const platforms = Array.isArray(a.platforms) ? a.platforms : [];

    const badges = GamePlatforms.render(platforms);

    const updateTime =
      a.site_published_at || a.created_at || a.published_at;
    const imageUrl = a.thumbnail_url
  ? GameImage.getUrl(a.thumbnail_url, a.source_name)
  : "";

    const destination = options.clickable === false
      ? ""
      : `href="/article.html?id=${encodeURIComponent(a.id)}"`;

    const content = `
      ${imageUrl
        ? `<img class="thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy">`
        : `<div class="thumb-placeholder">I LOVE GAME♪</div>`}
      ${GameDate.renderMeta(a.source_name, updateTime, { showSource: false })}
      <h3>${escapeHtml(a.title || "")}</h3>
      ${options.compact ? '' : `<p>${escapeHtml(a.summary || "")}</p>`}
      ${badges}
    `;

    return options.clickable === false
      ? `<article class="card${options.compact ? ' card--compact' : ''}">${content}</article>`
      : `<a class="card news-card-link${options.compact ? ' card--compact' : ''}" ${destination}>${content}</a>`;
  }

  window.GameNewsCard = { render };
})();
