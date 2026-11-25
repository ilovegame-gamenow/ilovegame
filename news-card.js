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

  function renderDate(article) {
    return GameDate.renderMeta(article.source_name, article.site_published_at || article.created_at || article.published_at, { showSource: false });
  }

  function renderFooter(article) {
    return `<div class="news-card-footer">${GamePlatforms.renderCategories(article)}${renderDate(article)}</div>`;
  }

  function renderVideoPreview(article) {
    const id=article.video_preview_id;
    if(article.thumbnail_url || typeof id!=='string' || !/^[A-Za-z0-9_-]{11}$/.test(id))return '';
    return `<a class="news-video-preview" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(article.title)} 公式動画をYouTubeで再生"><img class="thumb" data-news-thumbnail src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="${escapeHtml(article.title)} 公式動画プレビュー" loading="lazy"><span class="news-video-label">▶ YouTube 公式動画</span></a>`;
  }

  function render(article, options = {}) {
    const a = article || {};
    const platforms = Array.isArray(a.platforms) ? a.platforms : [];

    const badges = options.compact ? "" : GamePlatforms.render(platforms);

    const imageUrl = a.thumbnail_url
  ? GameImage.getUrl(a.thumbnail_url, a.source_name)
  : "";

    const destination = options.clickable === false
      ? ""
      : `href="/article.html?id=${encodeURIComponent(a.id)}"`;

    const meta = options.compact ? "" : renderDate(a);
    const videoPreview=renderVideoPreview(a);
    const content = `
      ${videoPreview || (imageUrl
        ? `<img class="thumb" data-news-thumbnail src="${escapeHtml(imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy">`
        : `<div class="thumb-placeholder">I LOVE GAME♪</div>`)}
      ${options.compact ? "" : meta}
      <h3>${videoPreview && options.clickable!==false ? `<a class="news-video-article-link" ${destination}>${escapeHtml(a.title || "")}</a>` : escapeHtml(a.title || "")}</h3>
      ${options.compact ? '' : `<p>${escapeHtml(a.summary || "")}</p>`}
      ${options.compact ? renderFooter(a) : badges}
    `;

    return options.clickable === false || videoPreview
      ? `<article class="card${options.compact ? ' card--compact' : ''}">${content}</article>`
      : `<a class="card news-card-link${options.compact ? ' card--compact' : ''}" ${destination}>${content}</a>`;
  }

  window.GameNewsCard = { render, renderFooter, renderVideoPreview };
})();
