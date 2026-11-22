/* I LOVE GAME♪ 共通ヘッダー */
(function () {
  const navigation = [
    { label: "発売カレンダー", href: "/calendar.html" }
  ];

  function renderHeader() {
    const header = document.querySelector("header");
    if (!header) return;

    const isEditor = document.body.dataset.page === "editor";
    const isEditorLogin = document.body.classList.contains("editor-login-page");
    const homeUrl = isEditor ? "/editor-dashboard.html" : "/";
    if (isEditor || isEditorLogin) {
      document.documentElement.classList.add("public-site-frame");
      if (!document.querySelector("body > footer")) {
        const footer = document.createElement("footer");
        footer.className = "public-site-footer";
        footer.innerHTML = `<nav class="footer-nav" aria-label="サイト情報"><a href="/">公開サイト</a><a href="/about.html">サイトについて</a><a href="/editorial-policy.html">編集方針</a><a href="/privacy.html">プライバシーポリシー</a></nav><small class="footer-copyright">© 2026 I LOVE GAME♪</small>`;
        document.body.append(footer);
      }
    }

    const links = navigation.map(item =>
      `<a href="${item.href}"${item.href === "/calendar.html" ? ' class="calendar-link"' : ''}>${item.label}</a>`
    ).join("");

    const rightContent = isEditor
      ? `<div class="editor-header-actions">
           <span class="editor-header-label">編集室</span>
           <button type="button" class="logout" id="logoutButton">ログアウト</button>
         </div>`
      : isEditorLogin
        ? `<div class="editor-header-actions"><span class="editor-header-label">編集室</span></div>`
        : `<nav>${links}</nav>`;

    const mascot = '<img class="header-mascot" src="/assets/cosmochi_welcome_mitten.png" width="68" height="68" decoding="async" alt="">';

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
