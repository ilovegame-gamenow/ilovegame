/* I LOVE GAME♪ 共通ヘッダー */
(function () {
  const navigation = [
    { label: "発売カレンダー", href: "/calendar.html" }
  ];

  const defaultMascot = "/assets/cosmochi_welcome_mitten.png";
  // Recurring Japanese seasonal dates, inclusive (MMDD).
  const seasonalMascots = [
    { start: 101, end: 107, image: "/assets/cosmochi_new_year.webp" },
    { start: 315, end: 415, image: "/assets/cosmochi_spring.webp" },
    { start: 701, end: 831, image: "/assets/cosmochi_summer.webp" },
    { start: 1001, end: 1031, image: "/assets/cosmochi_halloween.webp" },
    { start: 1201, end: 1225, image: "/assets/cosmochi_christmas.webp" }
  ];
  // Add confirmed game event dates here (YYYY-MM-DD, inclusive).
  // Example format: { start: "2027-09-01", end: "2027-09-03" }
  const gameEventDates = [];
  const tokyoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  });

  function publicMascot(date = new Date()) {
    const parts = Object.fromEntries(tokyoDate.formatToParts(date).map(({type, value}) => [type, value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (gameEventDates.some(event => event.start <= day && day <= event.end)) {
      return "/assets/cosmochi_game_event.webp";
    }
    const monthDay = Number(parts.month + parts.day);
    return seasonalMascots.find(season => season.start <= monthDay && monthDay <= season.end)?.image || defaultMascot;
  }

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
        footer.innerHTML = `<nav class="footer-nav" aria-label="サイト情報"><a href="/">公開サイト</a><a href="/about.html">サイトについて</a><a href="/privacy.html">プライバシーポリシー</a><a href="/contact.html">お問い合わせ</a></nav><small class="footer-copyright">© 2026 I LOVE GAME♪</small>`;
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

    const mascot = isEditor
      ? '<img class="header-mascot editor-mascot" src="/assets/cosmochi_editor_laptop.webp" width="100" height="68" decoding="async" alt="編集室">'
      : `<img class="header-mascot" src="${isEditorLogin ? defaultMascot : publicMascot()}" width="68" height="68" decoding="async" alt="">`;

    const editorArea=location.pathname==='/editor-games.html'?'games':/editor-(settings|data-management|preview)\.html$/.test(location.pathname)?'settings':'articles';
    const editorNav=isEditor?`<nav class="editor-area-nav" aria-label="編集室メニュー">${[{key:'articles',label:'記事管理',href:'/editor-dashboard.html'},{key:'games',label:'作品リスト',href:'/editor-games.html'},{key:'settings',label:'運用管理',href:'/editor-settings.html'}].map(item=>`<a href="${item.href}"${item.key===editorArea?' aria-current="page"':''}>${item.label}</a>`).join('')}</nav>`:'';
    header.innerHTML = `
      <div class="site-topbar" aria-label="SNS（準備中）"><div class="site-topbar-inner"><span>X</span><span>Instagram</span><span>Bluesky</span><span>YouTube</span></div></div>
      <div class="header-inner">
        <div class="header-brand-group">
        <a class="brand" href="${homeUrl}">
          <div class="logo-mark">♥</div>
          <div class="brand-wordmark">
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
    if (!isEditor && !isEditorLogin) {
      const image = header.querySelector(".header-mascot");
      let selected = image.getAttribute("src");
      image.addEventListener("error", () => {
        if (image.getAttribute("src") !== defaultMascot) image.src = defaultMascot;
      });
      const refreshMascot = () => {
        const next = publicMascot();
        if (next !== selected) {
          selected = next;
          image.src = next;
        }
      };
      window.addEventListener("pageshow", refreshMascot);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshMascot();
      });
      window.setInterval(refreshMascot, 60_000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHeader);
  } else {
    renderHeader();
  }
})();
