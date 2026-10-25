/**
 * Nintendo Topicsの記事を取得し、
 * 共通の記事データ形式に変換する。
 *
 * Supabaseへの登録はここでは行わない。
 *
 * maxArticles:
 *   1回の収集で取得する最大記事数
 */
export async function collectNintendoArticles(maxArticles = 40) {
  const articles = [];
  const limit = Math.max(0, Math.floor(maxArticles));

  if (limit === 0) {
    return articles;
  }

  for (let page = 1; articles.length < limit; page++) {
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
      if (articles.length >= limit) {
        break;
      }

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
