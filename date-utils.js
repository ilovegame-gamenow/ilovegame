// I LOVE GAME♪ 共通日時表示ルール
const GameDate = {
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

    return elapsed >= 0 && elapsed <= 24 * 60 * 60 * 1000
      ? "#ff7a2f"
      : "#8a817a";
  }
};
// 情報元と掲載日時の共通表示
GameDate.renderMeta = function (sourceName, dateValue, { sourceLink } = {}) {
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

  const sourceMarkup = sourceLink
    ? `<a class="game-meta-source game-source-link" href="${escapeHtml(sourceLink.href)}" data-source="${escapeHtml(sourceLink.id)}" aria-label="${escapeHtml(`${sourceName}の記事に絞り込む`)}">${source}</a>`
    : `<span class="game-meta-source">${source}</span>`;

  return `
    <div class="game-meta">
      ${source ? sourceMarkup : ""}
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
