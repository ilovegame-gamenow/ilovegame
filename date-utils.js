// I LOVE GAME♪ 共通日時表示ルール
const GameDate = {
  highlightHours: 24,
  format(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("sv-SE", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(/-/g, "/");
  },

  color(value) {
    if (!value) return "#8a817a";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "#8a817a";

    const elapsed = Date.now() - date.getTime();

    return elapsed >= 0 && this.highlightHours > 0 && elapsed <= this.highlightHours * 60 * 60 * 1000
      ? "#ff7a2f"
      : "#8a817a";
  }
};
// 情報元と掲載日時の共通表示
GameDate.renderMeta = function (sourceName, dateValue) {
  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const source = escapeHtml(sourceName);
  const date = this.format(dateValue);
  const color = this.color(dateValue);

  return `
    <div class="game-meta">
      ${source ? `<span class="game-meta-source">${source}</span>` : ""}
      ${source && date ? `<span class="game-meta-separator">｜</span>` : ""}
      ${date ? `<span class="game-date" style="color:${color}">${escapeHtml(date)} UP</span>` : ""}
    </div>
  `;
};
// 更新日時の共通デザイン
const dateStyle = document.createElement("style");
dateStyle.textContent = `
  .game-meta {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    column-gap: 6px;
    row-gap: 2px;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.2;
  }

  .game-meta-source {
    color: #77706a;
  }

  .game-meta-separator {
    color: #8a817a;
  }

  .game-date {
    font-size: inherit;
    font-weight: 400;
  }
`;
document.head.appendChild(dateStyle);

// One request per page. Callers await ready before rendering article dates.
GameDate.ready = fetch('/api/site-config', { cache:'no-store' })
  .then(response => { if (!response.ok) throw new Error('Display settings unavailable'); return response.json(); })
  .then(config => {
    if (!Number.isSafeInteger(config.dateHighlightHours) || config.dateHighlightHours < 0 || config.dateHighlightHours > 8760) throw new Error('Invalid highlight duration');
    GameDate.highlightHours = config.dateHighlightHours;
  })
  .catch(error => { console.warn('日時表示の設定を取得できませんでした。初期値を使用します。', error); });
