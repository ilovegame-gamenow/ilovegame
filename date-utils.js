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
  .game-date {
    font-size: 11px;
    font-weight: 400;
  }
`;
document.head.appendChild(dateStyle);
