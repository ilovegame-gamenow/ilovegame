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

  // 表示だけを整え、保存された対応機種名は変更しない。
  function platformLabel(name) {
    const original = String(name ?? "").trim();
    const key = original.normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "");
    const labels = {
      nintendoswitch2: "Switch 2", switch2: "Switch 2",
      nintendoswitch: "Switch", switch: "Switch",
      playstation5: "PS5", ps5: "PS5", playstation4: "PS4", ps4: "PS4",
      'xboxseriesx|s': "Xbox X|S", 'xboxseriesx/s': "Xbox X|S",
      xboxseriesxs: "Xbox X|S", xboxseries: "Xbox X|S", 'xboxx|s': "Xbox X|S",
      xboxseriesx: "Xbox X", xboxseriess: "Xbox S", xboxone: "Xbox One",
      steam: "Steam", epicgamesstore: "Epic", epicgames: "Epic", epic: "Epic",
      pc: "PC", windows: "PC", ios: "iOS", iphone: "iOS", ipad: "iOS",
      android: "Android", browser: "ブラウザ", web: "ブラウザ", ブラウザ: "ブラウザ",
      macos: "Mac", mac: "Mac", linux: "Linux", mobile: "スマホ", スマートフォン: "スマホ"
    };
    return labels[key] || original;
  }

  function platformClass(name) {
    if (name === "Switch 2") return "switch2";
    if (name === "Switch") return "switch";
    if (/^PS[45]$/.test(name)) return "ps5";
    if (name.startsWith("Xbox")) return "xbox";
    if (["PC", "Steam", "Epic", "Mac", "Linux"].includes(name)) return "pc";
    if (["iOS", "Android", "スマホ"].includes(name)) return "mobile";
    return "other";
  }

  function platformLabels(values) {
    const labels = [...new Set(values.map(platformLabel).filter(Boolean))];
    // ストア名だけではOSを特定できないため、Mac・Linuxは残す。
    return labels.filter(label => label !== "PC" || !labels.some(value => ["Steam", "Epic"].includes(value)));
  }

  function render(article, options = {}) {
    const a = article || {};
    const platforms = Array.isArray(a.platforms) ? a.platforms : [];

    const badges = platformLabels(platforms).map(platform =>
      `<span class="platform ${platformClass(platform)}">${escapeHtml(platform)}</span>`
    ).join("");

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
      ${GameDate.renderMeta(a.source_name, updateTime, { sourceLink: options.clickable === false ? options.sourceLink : null, showSource: options.clickable === false && Boolean(options.sourceLink) })}
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
