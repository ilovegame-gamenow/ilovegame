
window.GameArticle = (() => {
  const esc = (value = "") =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");


  // Turn plain editorial URLs into safe anchors without interpreting supplied HTML.
  function linkText(text) {
    const pattern = /\[([^\]\r\n]+)\]\((https?:\/\/[^\s<>"'（）「」『』【】]+?)\)|https?:\/\/[^\s<>"'`（）「」『』【】、。！？♪]+/gi;
    let html = "", last = 0;
    for (const match of String(text).matchAll(pattern)) {
      html += esc(text.slice(last, match.index));
      let raw = match[2] || match[0], tail = "";
      if (!match[2]) {
        while (/[.,;:!?]$/.test(raw) || (raw.endsWith(")") && (raw.match(/\)/g)||[]).length > (raw.match(/\(/g)||[]).length) || (raw.endsWith("]") && (raw.match(/\]/g)||[]).length > (raw.match(/\[/g)||[]).length)) {
          tail = raw.slice(-1) + tail;
          raw = raw.slice(0,-1);
        }
      }
      try {
        const url = new URL(raw);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid URL");
        html += '<a href="' + esc(url.href) + '" target="_blank" rel="noopener noreferrer">' + esc(match[1] || raw) + '</a>' + esc(tail);
      } catch {
        html += esc(match[0]);
      }
      last = match.index + match[0].length;
    }
    return html + esc(text.slice(last));
  }

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
          updateTime,
          { showSource: false }
        )}

        ${GamePlatforms.render(article.platforms)}

        ${thumbnail ? `
          <img
            class="hero"
            src="${esc(thumbnail)}"
            alt="${esc(article.title)}"
          >
        ` : ""}

        ${article.summary ? `
          <div class="summary">
            ${linkText(article.summary)}
          </div>
        ` : ""}

        <div class="body">${linkText(formatText(originalText, width))}</div>

        ${article.ilovegame_point ? `
          <div class="point">
            <div class="point-title">
              ここに注目♪
            </div>
            <div>${linkText(article.ilovegame_point)}</div>
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

    let contentParts = null;
    const draw = width => {
      if (!contentParts) {
        bodyElement.innerHTML = linkText(formatText(originalText, width));
        return;
      }
      for (const part of contentParts) {
        if (part.type === 'text') part.element.innerHTML = linkText(formatText(part.text, width));
      }
    };
    Promise.all([import('./official-video.js'), import('./game-source-utils.js')])
      .then(([{officialVideo}, {articleContentSegments}]) => {
        if (!bodyElement.isConnected) return;
        contentParts = articleContentSegments(article).map(part => {
          let element;
          if (part.type === 'video') {
            element = officialVideo(article.title, part.url);
          } else if (part.type === 'video-link') {
            element = document.createElement('div');
            element.className = 'official-video';
            const link = document.createElement('a');
            link.href = part.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'YouTubeで公式動画を見る ↗';
            element.append(link);
          } else {
            element = document.createElement('div');
          }
          if (part.type === 'text') element.className = 'article-text';
          return {...part, element};
        });
        bodyElement.replaceChildren(...contentParts.map(part => part.element));
        draw(bodyElement.clientWidth);
      }).catch(() => {});
    let previousWidth = 0;

    const observer = new ResizeObserver(() => {
      const width = Math.round(bodyElement.clientWidth);
      if (width === previousWidth) return;

      previousWidth = width;
      draw(width);
    });

    observer.observe(bodyElement);
    return observer;
  }

  return { render, observeBody };
})();
