import { newsConfig } from "../lib/news-config.js";
import { generateArticle } from "../lib/article-generator.js";
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
      "id,source_title,source_name,source_url,source_published_at,site_published_at"
    );
    queueUrl.searchParams.set(
      "processing_status",
      "eq.pending"
    );
    queueUrl.searchParams.set(
  "manually_reviewed",
  "not.is.true"
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
        // STEP 1：AIで記事の重要度だけを事前評価する
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
${item.source_title}

公式記事本文:
${cleanText.slice(0, 6000)}`
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
const preScore = Math.max(
  0,
  Math.min(100, Math.round(Number(scoreArticle.importance) || 0))
);
        // 50点以下は記事を生成せず、自動非掲載にする
if (preScore <= newsConfig.noArticleThreshold) {
  await updateArticle(
    supabaseUrl,
    supabaseKey,
    item.id,
    {
      importance: preScore,
      status: "rejected",
      processing_status: "completed",
      article_body: null,
      site_published_at: null
    }
  );

  results.push({
    id: item.id,
    importance: preScore,
    status: "rejected"
  });

  continue;
}
        // AI記事生成（重要度の事前判定後に実行する）
        const aiArticle = await generateArticle({
          sourceTitle: item.source_title,
          sourceText: cleanText,
          openaiKey
        });
        
        const importance = preScore;

        // 51〜79点はAI記事を保存し、手動審査を待つ
if (importance < newsConfig.publishThreshold) {
  await updateArticle(
    supabaseUrl,
    supabaseKey,
    item.id,
    {
      title: aiArticle.title || item.source_title,
      summary: aiArticle.summary || "",
      article_body: aiArticle.article_body || "",
      ilovegame_point: aiArticle.ilovegame_point || "",
      importance,
      status: "pending",
      processing_status: "completed",
      published_at: null,
      site_published_at: null
    }
  );

  results.push({
    id: item.id,
    title: aiArticle.title || item.source_title,
    importance,
    status: "pending"
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
            site_published_at: item.site_published_at || new Date().toISOString(),
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
