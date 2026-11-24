/**
 * ニュース記事の画像情報を、表示可能なURLに変換する。
 * 任天堂の画像キーと、各社の完全な画像URLに対応。
 */
const GameImage = {
  getUrl(thumbnailUrl, sourceName = "") {
    if (!thumbnailUrl || typeof thumbnailUrl !== "string") {
      return "";
    }

    const value = thumbnailUrl.trim();
    if (!value) return "";

    // 完全な画像URLはそのまま使用する
    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    // 任天堂の記事は画像配信サーバーのURLを補完する
    if (String(sourceName ?? "").toLowerCase() === "nintendo") {
      return `https://assets.topics.apps-jp.nintendo.com/image/${value.replace(/^\/+/, "")}`;
    }

    // 不明な形式の画像キーは表示しない
    return "";
  }
};

// Image requests may fail after a URL has been saved. Keep news cards intact.
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("error", event => {
    const image = event.target;
    if (!image?.matches?.("img[data-news-thumbnail]")) return;
    if (image.classList.contains("thumb")) {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb-placeholder";
      placeholder.textContent = "I LOVE GAME♪";
      image.replaceWith(placeholder);
    } else {
      image.remove();
    }
  }, true);
}
