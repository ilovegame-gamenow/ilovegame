export default async function handler(req, res) {
  try {
    const listResponse = await fetch(
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({
        success: false,
        error: "Nintendo article list request failed"
      });
    }

    const articles = await listResponse.json();
    const item = articles[0];

    const sourceUrl =
      `https://www.nintendo.com/jp/topics/article/${item.slug}`;

    const articleResponse = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!articleResponse.ok) {
      return res.status(articleResponse.status).json({
        success: false,
        error: "Nintendo article request failed"
      });
    }

    const html = await articleResponse.text();
    const mainMatch =
  html.match(/<main[\s\S]*?<\/main>/i) ||
  html.match(/<article[\s\S]*?<\/article>/i);

const articleHtml = mainMatch ? mainMatch[0] : html;

const text = articleHtml
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
  .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

    return res.status(200).json({
      success: true,
      title: item.title,
      source_url: sourceUrl,
      html_length: html.length,
      text_preview: text.slice(0, 3000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
