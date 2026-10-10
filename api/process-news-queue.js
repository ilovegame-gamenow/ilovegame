import { newsConfig } from "./news-config.js";
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const cronSecret = process.env.CRON_SECRET;

    const authHeader = req.headers.authorization;

    if (
      !cronSecret ||
      authHeader !== `Bearer ${cronSecret}`
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return res.status(500).json({
        success: false,
        error: "Environment variables are missing"
      });
    }

    // pendingの記事を古い順に最大3件取得
    const queueUrl = new URL(
      `${supabaseUrl}/rest/v1/articles`
    );

    queueUrl.searchParams.set(
      "select",
      "id,source_title,source_name,source_url,source_published_at"
    );
    queueUrl.searchParams.set(
      "processing_status",
      "eq.pending"
    );
    queueUrl.searchParams.set(
      "order",
      "source_published_at.asc"
    );
    queueUrl.searchParams.set("limit", "3");

    const queueResponse = await fetch(
      queueUrl.toString(),
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!queueResponse.ok) {
      throw new Error(
        `Queue fetch failed: ${await queueResponse.text()}`
      );
    }

    const pendingArticles =
      await queueResponse.json();

    if (
      !Array.isArray(pendingArticles) ||
      pendingArticles.length === 0
    ) {
      return res.status(200).json({
        success: true,
        processed: 0,
        message: "No pending articles"
      });
    }

    const results = [];

    for (const item of pendingArticles) {
      try {
        // 処理中に変更
        await updateArticle(
          supabaseUrl,
          supabaseKey,
          item.id,
          {
            processing_status: "processing"
          }
        );

        // 公式記事本文を取得
        const articleResponse = await fetch(
          item.source_url,
          {
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          }
        );

        if (!articleResponse.ok) {
          throw new Error(
            `Source article fetch failed: ${articleResponse.status}`
          );
        }

        const html = await articleResponse.text();

        const mainMatch =
          html.match(/<main[\s\S]*?<\/main>/i) ||
          html.match(/<article[\s\S]*?<\/article>/i);

        const articleHtml =
          mainMatch ? mainMatch[0] : html;

        let cleanText = articleHtml
          .replace(
            /<script[\s\S]*?<\/script>/gi,
            " "
          )
          .replace(
            /<style[\s\S]*?<\/style>/gi,
            " "
          )
          .replace(
            /<nav[\s\S]*?<\/nav>/gi,
            " "
          )
          .replace(
            /<footer[\s\S]*?<\/footer>/gi,
            " "
          )
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim();

        const cutoffMarkers = [
          "関連リンク",
          "この記事のほかにも、こんな記事があります。"
        ];

        for (const marker of cutoffMarkers) {
          const index =
            cleanText.indexOf(marker);

          if (index !== -1) {
            cleanText =
              cleanText.slice(0, index).trim();
          }
        }

        // AIで重要度判定＋記事生成
        const openaiResponse = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${openaiKey}`,
              "Content-Type":
                "application/json"
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
                importance: {
                    type: "integer",
                    description: "掲載価値を0〜100で評価"
                },
                title: { type: "string" },
                summary: { type: "string" },
                ilovegame_point: { type: "string" },
                article_body: { type: "string" }
            },
            required: [
                "importance",
                "title",
                "summary",
                "ilovegame_point",
                "article_body"
            ],
            additionalProperties: false
        }
    }
},

              input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。
以下の公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

「本日」「昨日」「明日」など、後から読んだときに日付が分からなくなる相対的な表現は原則使用しないでください。
日付を伝える必要がある場合は「10月4日」のように具体的な日付を使用してください。
記事本文やsummary内の日付は原則として年を省略し、「2026年9月30日」ではなく「9月30日」のように表記してください。
同じ日付を文章内で不必要に繰り返さないでください。
ただし、年を明記しないと意味が分かりにくい場合は年を付けても構いません。


次の5項目を作成してください。出力形式は指定されたJSONスキーマに従ってください。

importance：I LOVE GAME♪での掲載価値を0〜100の整数で評価してください。最優先の基準は「ゲームを遊ぶ人にとって知りたい情報か？」です。
評価の詳しい方針:
${newsConfig.evaluationGuidelines.map(rule => `・${rule}`).join("\n")}
title：分かりやすいニュースタイトルにしてください。
summary：一覧カード用の要約です。必ず1文、50〜70文字程度にしてください。タイトルの内容をそのまま繰り返さないでください。
ilovegame_point：「ここに注目♪」に表示する文章です。読者に伝えたいポイントを1〜2文で紹介してください。
article_body：詳細記事ページ用の本文です。300〜500文字程度を目安に、公式記事の情報だけで作成してください。summaryの単純なコピーは避けてください。


公式タイトル:
${item.source_title}

公式記事本文:
${cleanText.slice(0, 6000)}`
            })
          }
        );

        const openaiData =
          await openaiResponse.json();

        if (!openaiResponse.ok) {
          throw new Error(
            `OpenAI request failed: ${JSON.stringify(openaiData)}`
          );
        }
        
if (openaiData.status !== "completed") {
    throw new Error(
        `OpenAI response incomplete: ${openaiData.status}, reason: ${JSON.stringify(openaiData.incomplete_details)}`
    );
}

        const aiText =
          openaiData.output_text ||
          openaiData.output
            ?.flatMap(
              outputItem =>
                outputItem.content || []
            )
            ?.find(
              part =>
                part.type === "output_text"
            )
            ?.text ||
          "";

        if (!aiText) {
          throw new Error(
            "OpenAI returned empty text"
          );
        }

        let jsonText = aiText.trim();

        if (jsonText.startsWith("```")) {
          jsonText = jsonText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/, "")
            .replace(/\s*```$/, "")
            .trim();
        }

        
        
let aiArticle;

try {
    aiArticle = JSON.parse(jsonText);
} catch (error) {
    const firstChar = jsonText.charAt(0);
    const lastChar = jsonText.slice(-1);

    throw new Error(
        `AI JSON parse failed: ${error.message}; ` +
        `length=${jsonText.length}; ` +
        `startsWithBrace=${firstChar === "{"}; ` +
        `endsWithBrace=${lastChar === "}"}`
    );
}



        const importance = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              Number(aiArticle.importance) || 0
            )
          )
        );

        // 設定した掲載基準未満は非掲載
        if (importance < newsConfig.publishThreshold) {
          await updateArticle(
            supabaseUrl,
            supabaseKey,
            item.id,
            {
              importance,
              status: "rejected",
              processing_status: "completed",
              published_at: null
            }
          );

          results.push({
            id: item.id,
            title: item.source_title,
            importance,
            status: "rejected"
          });

          continue;
        }

        // 設定した掲載基準以上は記事として公開
        await updateArticle(
          supabaseUrl,
          supabaseKey,
          item.id,
          {
            title:
              aiArticle.title ||
              item.source_title,
            summary:
              aiArticle.summary || "",
            article_body:
              aiArticle.article_body || "",
            ilovegame_point:
              aiArticle.ilovegame_point || "",
            importance,
            status: "published",
            processing_status: "completed",
            published_at:
              item.source_published_at ||
              new Date().toISOString()
          }
        );

        results.push({
          id: item.id,
          title:
            aiArticle.title ||
            item.source_title,
          importance,
          status: "published"
        });

      } catch (error) {
        // 失敗した記事は次回やり直せるようpendingへ戻す
        try {
          await updateArticle(
            supabaseUrl,
            supabaseKey,
            item.id,
            {
              processing_status: "pending"
            }
          );
        } catch (_) {}

        results.push({
          id: item.id,
          title: item.source_title,
          status: "error",
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function updateArticle(
  supabaseUrl,
  supabaseKey,
  id,
  changes
) {
  const updateUrl = new URL(
    `${supabaseUrl}/rest/v1/articles`
  );

  updateUrl.searchParams.set(
    "id",
    `eq.${id}`
  );

  const response = await fetch(
    updateUrl.toString(),
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization:
          `Bearer ${supabaseKey}`,
        "Content-Type":
          "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(changes)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Supabase update failed: ${await response.text()}`
    );
  }
}
