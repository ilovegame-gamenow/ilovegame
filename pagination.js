/* I LOVE GAME♪ 共通ページ送り */
(function () {
  "use strict";

  function render(currentPage, totalPages, onPageClick) {
    const current = Math.max(1, Math.min(currentPage, totalPages));
    const total = Math.max(1, totalPages);

    const pages = new Set([1, total]);
    for (let i = current - 2; i <= current + 2; i++) {
      if (i >= 1 && i <= total) pages.add(i);
    }

    const ordered = [...pages].sort((a, b) => a - b);
    const container = document.createElement("div");
    container.className = "pagination";

    function addButton(label, page, disabled = false, active = false) {
      const button = document.createElement("button");
      button.textContent = label;
      button.disabled = disabled;
      if (active) button.className = "active";
      button.addEventListener("click", () => onPageClick(page));
      container.appendChild(button);
    }

    addButton("‹ 新しい記事", current - 1, current === 1);

    ordered.forEach((page, index) => {
      if (index > 0 && page - ordered[index - 1] > 1) {
        const dots = document.createElement("span");
        dots.textContent = "…";
        container.appendChild(dots);
      }
      addButton(String(page), page, false, page === current);
    });

    addButton("古い記事 ›", current + 1, current === total);

    return container;
  }

  window.GamePagination = { render };
})();
