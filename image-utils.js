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

    // 完全な画像URLはそのまま使用する
    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    // 任天堂の記事は画像配信サーバーのURLを補完する
    if (sourceName.toLowerCase() === "nintendo") {
      return `https://assets.topics.apps-jp.nintendo.com/image/${value.replace(/^\/+/, "")}`;
    }

    // 不明な形式の画像キーは表示しない
    return "";
  }
};
