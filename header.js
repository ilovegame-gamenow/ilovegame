/* I LOVE GAME♪ 共通ヘッダー */
(function () {
  const navigation = [
    { label: "速報", href: "/#breaking" },
    { label: "最新", href: "/#latest" },
    { label: "ニュース", href: "/#latest" },
    { label: "PICK UP", href: "/#pickup" }
  ];

  function renderHeader() {
    const header = document.querySelector("header");
    if (!header) return;

    const isEditor = document.body.dataset.page === "editor";

    const links = navigation.map(item =>
      `<a href="${item.href}">${item.label}</a>`
    ).join("");

    const rightContent = isEditor
      ? `<div class="editor-header-actions">
           <span class="editor-header-label">編集室</span>
           <button type="button" class="logout" id="logoutButton">ログアウト</button>
         </div>`
      : `<nav>${links}</nav>`;

    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="/">
          <div class="logo-mark">♥</div>
          <div>
            <div class="logo">
              I <span class="love">LOVE</span>
              GAME<span class="music">♪</span>
            </div>
            <div class="tagline">ゲームの「今」をお届け♪</div>
          </div>
        </a>
        ${rightContent}
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHeader);
  } else {
    renderHeader();
  }
})();
