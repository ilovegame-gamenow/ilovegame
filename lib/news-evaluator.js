
import { newsConfig } from "./news-config.js";

// 公式記事のタイトルと本文をもとに、AIが掲載価値を0〜100点で評価する
export async function evaluateNewsImportance({
  sourceTitle,
  sourceText,
  openaiKey
}) {
  const scoreResponse = await fetch(
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
            name: "game_news_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                importance: { type: "integer" }
              },
              required: ["importance"],
              additionalProperties: false
            }
          }
        },
        input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。
以下の公式記事の掲載価値を0〜100の整数で評価してください。
評価方針:
${newsConfig.evaluationGuidelines.map(rule => `・${rule}`).join("\n")}

公式タイトル:
${sourceTitle}

公式記事本文:
${sourceText.slice(0, 6000)}`
      })
    }
  );

  const scoreData = await scoreResponse.json();

  if (!scoreResponse.ok || scoreData.status !== "completed") {
    throw new Error(
      `AI scoring failed: ${JSON.stringify(scoreData)}`
    );
  }

  const scoreText =
    scoreData.output_text ||
    scoreData.output
      ?.flatMap(item => item.content || [])
      ?.find(part => part.type === "output_text")
      ?.text ||
    "";

  if (!scoreText) {
    throw new Error("AI scoring returned empty text");
  }

  const scoreArticle = JSON.parse(scoreText);

  return Math.max(
    0,
    Math.min(100, Math.round(Number(scoreArticle.importance) || 0))
  );
}
