
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

    const links = navigation.map(item =>
      `<a href="${item.href}">${item.label}</a>`
    ).join("");

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
        <nav>${links}</nav>
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHeader);
  } else {
    renderHeader();
  }
})();
