import { getResponseText } from './openai-response-text.js';
import { ARTICLE_WRITING_RULES } from './article-writing-rules.js';
export async function generateArticle({
  sourceTitle,
  sourceText,
  openaiKey = process.env.OPENAI_API_KEY
}) {
  if (!openaiKey) {
    throw new Error("OpenAI API key is missing");
  }

  if (!sourceTitle || !sourceText?.trim()) {
    throw new Error("Article source is missing");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        text: {
          format: {
            type: "json_schema",
            name: "game_news_article",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                ilovegame_point: { type: "string" },
                article_body: { type: "string" }
              },
              required: [
                "title",
                "summary",
                "ilovegame_point",
                "article_body"
              ],
              additionalProperties: false
            }
          }
        },
        input: `${ARTICLE_WRITING_RULES}

公式タイトル:
${sourceTitle}

公式記事本文:
${sourceText.slice(0, 6000)}`
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed: ${JSON.stringify(data)}`
    );
  }

  if (data.status !== "completed") {
    throw new Error(
      `OpenAI response incomplete: ${data.status}, reason: ${JSON.stringify(data.incomplete_details)}`
    );
  }

  const aiText = getResponseText(data);

  if (!aiText) {
    throw new Error("OpenAI returned empty text");
  }

  const jsonText = aiText.trim();

  let article;

  try {
    article = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `AI JSON parse failed: ${error.message}; ` +
      `length=${jsonText.length}; ` +
      `startsWithBrace=${jsonText.startsWith("{")}; ` +
      `endsWithBrace=${jsonText.endsWith("}")}`
    );
  }

  for (const field of [
    "title",
    "summary",
    "ilovegame_point",
    "article_body"
  ]) {
    if (
      typeof article[field] !== "string" ||
      !article[field].trim()
    ) {
      throw new Error(`AI article field is missing: ${field}`);
    }
  }

  return article;
}
