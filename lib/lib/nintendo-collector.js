/**
 * Nintendo Topicsの記事を取得し、
 * 共通の記事データ形式に変換する。
 *
 * Supabaseへの登録はここでは行わない。
 */
export async function collectNintendoArticles() {
  const articles = [];

  for (let page = 1; page <= 4; page++) {
    const response = await fetch(
      `https://www.nintendo.com/jp/topics/c/_/v0/posts/search?page=${page}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Nintendo API failed on page ${page}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    for (const item of data) {
      articles.push({
        source_title: item.title,
        source_name: "Nintendo",
        source_url:
          `https://www.nintendo.com/jp/topics/article/${item.slug}`,
        source_published_at: item.display_date,
        thumbnail_url: item.thumbnail?.url_key || null
      });
    }
  }

  return articles;
}
