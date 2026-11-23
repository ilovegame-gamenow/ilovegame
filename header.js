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
           <button type="button" class="logout" id="logoutButton">ログアウト</button>
         </div>`
      : isEditorLogin
        ? `<div class="editor-header-actions"><span class="editor-header-label">編集室</span></div>`
        : `<nav>${links}</nav>`;

    const mascot = '<img class="header-mascot" src="/assets/cosmochi_welcome_mitten.png" width="68" height="68" decoding="async" alt="">';

    const editorArea=location.pathname==='/editor-games.html'?'games':/editor-(settings|data-management|preview)\.html$/.test(location.pathname)?'settings':'articles';
    const editorNav=isEditor?`<nav class="editor-area-nav" aria-label="編集室メニュー">${[{key:'articles',label:'記事管理',href:'/editor-dashboard.html'},{key:'games',label:'作品リスト',href:'/editor-games.html'},{key:'settings',label:'運用管理',href:'/editor-settings.html'}].map(item=>`<a href="${item.href}"${item.key===editorArea?' aria-current="page"':''}>${item.label}</a>`).join('')}</nav>`:'';
    header.innerHTML = `
      <div class="header-inner">
        <div class="header-brand-group">
        <a class="brand" href="${homeUrl}">
          <div class="logo-mark">♥</div>
          <div class="brand-wordmark">
            ${isEditor ? '<span class="editor-brand-label">編集室</span>' : ''}
            <div class="logo">
              <span class="logo-wordmark-text">I <span class="love">LOVE</span> GAME</span><span class="music">♪</span>
            </div>
            <div class="tagline">ゲームの「今」をお届け♪</div>
          </div>
        </a>
        ${mascot}
        </div>
        ${editorNav}
        ${rightContent}
      </div>
    `;
    if (isEditor) {
      const wordmark = header.querySelector(".brand-wordmark");
      const text = wordmark.querySelector(".logo-wordmark-text");
      const badge = wordmark.querySelector(".editor-brand-label");
      const tagline = wordmark.querySelector(".tagline");
      const alignBadge = () => {
        const bounds = wordmark.getBoundingClientRect();
        const edge = text.getBoundingClientRect().right;
        badge.style.setProperty("--editor-badge-right", Math.max(0, bounds.right - edge) + "px");
        // Keep the badge at GAME's right edge and the tagline's bottom at every width.
        // Fit the caption into the remaining space without changing the logo's layout.
        tagline.style.setProperty("--editor-tagline-scale", "1");
        const range = document.createRange();
        range.selectNodeContents(tagline);
        const caption = range.getBoundingClientRect();
        const available = Math.max(1, edge - badge.offsetWidth - 4 - caption.left);
        const scale = caption.width > 0 ? Math.min(1, available / caption.width) : 1;
        tagline.style.setProperty("--editor-tagline-scale", String(scale));
      };
      alignBadge();
      if (typeof ResizeObserver === "function") {
        const observer = new ResizeObserver(alignBadge);
        observer.observe(wordmark);
      }
      window.addEventListener("resize", alignBadge);
      document.fonts?.ready.then(alignBadge);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHeader);
  } else {
    renderHeader();
  }
})();
