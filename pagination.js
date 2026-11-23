/* I LOVE GAME♪ 共通ページ送り */
(function () {
  "use strict";

  function render(currentPage, totalPages, onPageClick, options = {}) {
    const current = Math.max(1, Math.min(currentPage, totalPages));
    const total = Math.max(1, totalPages);

    const pages = new Set([1, total]);
    for (let i = current - 2; i <= current + 2; i++) {
      if (i >= 1 && i <= total) pages.add(i);
    }

    const ordered = [...pages].sort((a, b) => a - b);
    const container = document.createElement("div");
    container.className = "pagination pagination-control";
    container.setAttribute("role", "navigation");
    container.setAttribute("aria-label", options.ariaLabel || "記事のページ送り");
    const numberGroup = document.createElement("div");
    numberGroup.className = "pagination-numbers";

    function addButton(label, page, disabled = false, active = false) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      if (active) {
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
      }
      if (typeof label === "string" && /^\d+$/.test(label)) {
        button.classList.add("pagination-number");

      } else {
        button.classList.add("pagination-direction");
        button.setAttribute("aria-label", label);
        const full = document.createElement("span");
        full.className = "pagination-direction-label";
        full.textContent = label;
        const arrow = document.createElement("span");
        arrow.className = "pagination-direction-arrow";
        arrow.textContent = page < current ? "‹" : "›";
        arrow.setAttribute("aria-hidden", "true");
        button.replaceChildren(full, arrow);
      }
      button.addEventListener("click", () => onPageClick(page));
      (button.classList.contains("pagination-number") ? numberGroup : container).appendChild(button);
    }

    addButton(options.previousLabel || "‹ 新しい記事", current - 1, current === 1);

    container.appendChild(numberGroup);

    ordered.forEach((page, index) => {
      if (index > 0 && page - ordered[index - 1] > 1) {
        const dots = document.createElement("span");
        dots.textContent = "…";
        dots.className = "pagination-ellipsis";
        numberGroup.appendChild(dots);
      }
      addButton(String(page), page, false, page === current);
    });

    addButton(options.nextLabel || "古い記事 ›", current + 1, current === total);

    return container;
  }

  window.GamePagination = { render };
})();
