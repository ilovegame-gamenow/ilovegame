
window.GameArticle = (() => {
  const esc = (value = "") =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function formatText(text, width) {
    const charsPerLine = Math.max(
      12,
      Math.floor((width - 64) / 17)
    );
    const target = Math.round(charsPerLine * 1.7);
    let count = 0;

    return String(text ?? "")
      .replace(/([。！？♪])(?=\S)/g, match => {
        count += 1;
        return match;
      })
      .split(/(?<=[。！？♪])/)
      .map(sentence => {
        count += sentence.length;
        if (count >= target) {
          count = 0;
          return sentence + "\n";
        }
        return sentence;
      })
      .join("")
      .trim();
  }

  function render(article, width = window.innerWidth) {
    const thumbnail = GameImage.getUrl(
      article.thumbnail_url,
      article.source_name
    );

    const updateTime =
      article.site_published_at ||
      article.created_at ||
      article.published_at;

    const originalText = (
      article.article_body ||
      article.summary ||
      ""
    ).trim();

    return `
      <article class="article-card">
        <h1>${esc(article.title)}</h1>

        ${GameDate.renderMeta(
          article.source_name,
          updateTime
        )}

        ${thumbnail ? `
          <img
            class="hero"
            src="${esc(thumbnail)}"
            alt="${esc(article.title)}"
          >
        ` : ""}

        ${article.summary ? `
          <div class="summary">
            ${esc(article.summary)}
          </div>
        ` : ""}

        <div class="body">${esc(
          formatText(originalText, width)
        )}</div>

        ${article.ilovegame_point ? `
          <div class="point">
            <div class="point-title">
              ここに注目♪
            </div>
            <div>${esc(article.ilovegame_point)}</div>
          </div>
        ` : ""}

        ${article.source_url ? `
          <div class="source">
            情報元：
            <a
              href="${esc(article.source_url)}"
              target="_blank"
              rel="noopener noreferrer"
            >${esc(article.source_name || "公式サイト")}</a>
          </div>
        ` : ""}
      </article>
    `;
  }

  function observeBody(container, article) {
    const bodyElement = container.querySelector(".body");
    if (!bodyElement) return null;

    const originalText = (
      article.article_body ||
      article.summary ||
      ""
    ).trim();

    let previousWidth = 0;

    const observer = new ResizeObserver(() => {
      const width = Math.round(bodyElement.clientWidth);
      if (width === previousWidth) return;

      previousWidth = width;
      bodyElement.textContent = formatText(
        originalText,
        width
      );
    });

    observer.observe(bodyElement);
    return observer;
  }

  return { render, observeBody };
})();
