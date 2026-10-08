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
// 更新日時の共通デザイン
const dateStyle = document.createElement("style");
dateStyle.textContent = `
  .game-date {
    font-size: 11px;
    font-weight: 900;
  }
`;
document.head.appendChild(dateStyle);
