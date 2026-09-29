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
const cutoffMarkers = [
  "関連リンク",
  "この記事のほかにも、こんな記事があります。"
];

let cleanText = text;

for (const marker of cutoffMarkers) {
  const index = cleanText.indexOf(marker);
  if (index !== -1) {
    cleanText = cleanText.slice(0, index).trim();
  }
}
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-5-mini",
    input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。

以下のNintendo公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

次の3項目をJSONだけで出力してください。
{
  "title": "分かりやすいニュースタイトル",
  "summary": "ニュースの重要点を2〜3文で簡潔にまとめた文章",
  "ilovegame_point": "読者が注目すべきポイントを1〜2文で紹介。過度な煽り表現は使わない"
}

公式タイトル:
${item.title}

公式記事本文:
${cleanText.slice(0, 6000)}`
  })
});

const openaiData = await openaiResponse.json();

if (!openaiResponse.ok) {
  return res.status(openaiResponse.status).json({
    success: false,
    error: "OpenAI request failed",
    details: openaiData
  });
}

const aiText =
  openaiData.output_text ||
  openaiData.output
    ?.flatMap(item => item.content || [])
    ?.find(part => part.type === "output_text")
    ?.text ||
  "";
    const aiArticle = JSON.parse(aiText);
    const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const saveResponse = await fetch(
  `${supabaseUrl}/rest/v1/articles?source_url=eq.${encodeURIComponent(sourceUrl)}`,
  {
    method: "PATCH",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      title: aiArticle.title,
      summary: aiArticle.summary,
      ilovegame_point: aiArticle.ilovegame_point
    })
  }
);

if (!saveResponse.ok) {
  return res.status(saveResponse.status).json({
    success: false,
    error: "Supabase save failed",
    details: await saveResponse.text()
  });
}
    return res.status(200).json({
      success: true,
      title: item.title,
      source_url: sourceUrl,
      html_length: html.length,
      text_preview: cleanText.slice(0, 3000),
      ai_result: aiText,
      ai_title: aiArticle.title,
      ai_summary: aiArticle.summary,
      ai_point: aiArticle.ilovegame_point
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
