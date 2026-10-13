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

  function platformClass(name) {
    const value = String(name ?? "").toLowerCase();

    if (value.includes("switch 2")) return "switch2";
    if (value.includes("switch")) return "switch";
    if (value.includes("ps5") || value.includes("playstation")) return "ps5";
    if (value.includes("xbox")) return "xbox";
    if (value.includes("pc") || value.includes("steam")) return "pc";
    if (
      value.includes("ios") ||
      value.includes("android") ||
      value.includes("スマホ") ||
      value.includes("mobile")
    ) return "mobile";

    return "other";
  }

  function render(article, options = {}) {
    const a = article || {};
    const platforms = Array.isArray(a.platforms) ? a.platforms : [];

    const badges = platforms.map(platform =>
      `<span class="platform ${platformClass(platform)}">${escapeHtml(platform)}</span>`
    ).join("");

    const updateTime =
      a.site_published_at || a.created_at || a.published_at;

    const updateLabel = window.GameDate
      ? GameDate.format(updateTime)
      : "";

    const timeColor = window.GameDate
      ? GameDate.color(updateTime)
      : "";

    const imageUrl = a.thumbnail_url
  ? (window.GameImage
      ? GameImage.getUrl(a.thumbnail_url, a.source_name)
      : a.thumbnail_url)
  : "";

    const destination = options.clickable === false
      ? ""
      : `href="/article.html?id=${encodeURIComponent(a.id)}"`;

    const content = `
      ${imageUrl
        ? `<img class="thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy">`
        : `<div class="thumb-placeholder">I LOVE GAME♪</div>`}
      <div class="meta">${escapeHtml(a.source_name || "")}</div>
      <div class="time game-date" style="color:${escapeHtml(timeColor)}">${escapeHtml(updateLabel)} UP</div>
      <h3>${escapeHtml(a.title || "")}</h3>
      <p>${escapeHtml(a.summary || "")}</p>
      <div class="platforms">${badges}</div>
    `;

    return options.clickable === false
      ? `<article class="card">${content}</article>`
      : `<a class="card news-card-link" ${destination}>${content}</a>`;
  }

  window.GameNewsCard = { render };
})();
