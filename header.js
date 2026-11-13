/* I LOVE GAME♪ 共通ヘッダー */
(function () {
  const navigation = [
    { label: "発売カレンダー", href: "/calendar.html" }
  ];

  function renderHeader() {
    const header = document.querySelector("header");
    if (!header) return;

    const isEditor = document.body.dataset.page === "editor";
    const homeUrl = isEditor ? "/editor-dashboard.html" : "/";

    const links = navigation.map(item =>
      `<a href="${item.href}"${item.href === "/calendar.html" ? ' class="calendar-link"' : ''}>${item.label}</a>`
    ).join("");

    const rightContent = isEditor
      ? `<div class="editor-header-actions">
           <span class="editor-header-label">編集室</span>
           <button type="button" class="logout" id="logoutButton">ログアウト</button>
         </div>`
      : `<nav>${links}</nav>`;

    const mascot = header.dataset.mascot === "true"
      ? '<img class="header-mascot" src="/assets/site-astronaut-playful.webp" width="68" height="68" decoding="async" alt="">'
      : "";

    header.innerHTML = `
      <div class="header-inner">
        <div class="header-brand-group">
        <a class="brand" href="${homeUrl}">
          <div class="logo-mark">♥</div>
          <div>
            <div class="logo">
              I <span class="love">LOVE</span>
              GAME<span class="music">♪</span>
            </div>
            <div class="tagline">ゲームの「今」をお届け♪</div>
          </div>
        </a>
        ${mascot}
        </div>
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
