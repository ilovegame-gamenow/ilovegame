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
              input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。
以下の公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

「本日」「昨日」「明日」など、後から読んだときに日付が分からなくなる相対的な表現は原則使用しないでください。
日付を伝える必要がある場合は「10月4日」のように具体的な日付を使用してください。
記事本文やsummary内の日付は原則として年を省略し、「2026年9月30日」ではなく「9月30日」のように表記してください。
同じ日付を文章内で不必要に繰り返さないでください。
ただし、年を明記しないと意味が分かりにくい場合は年を付けても構いません。

JSONだけで次の形式で出力してください。

{
  "importance": "I LOVE GAME♪での掲載価値を0～100の整数で評価する。ゲームそのものに直接関係する新作発表・発売日・大型アップデート・DLC・体験版などを高く評価する。ニュースの大きさ、タイトルやIPの注目度、プレイヤーにとっての有用性も考慮する。グッズや映画などゲーム外の情報は基本的に低めにするが、人気IPや大きな話題なら加点してよい。決算・人事など企業情報はゲームへの直接的な影響が大きい場合を除き低く評価する",
  "title": "分かりやすいニュースタイトル",
  "summary": "一覧カード用の要約。必ず1文、50～70文字程度で、最も重要な情報だけを簡潔にまとめる",
  "ilovegame_point": "「ここに注目♪」に表示する文章。記事の中で特に読者に伝えたいポイントを1～2文で紹介する。ニュース本文の要約を繰り返さず、ゲーム好きの友だちに話しかけるような、親しみのある柔らかい口調にする。「～だね♪」「～も楽しみ♪」「～なのもうれしいところ♪」など自然な表現を使ってよい。ただし毎回同じ語尾にしない。文章が長くなる場合は「。」「♪」「！」「？」で文が一区切りするごとに改行する。必要な場合のみ「、」の自然な位置でも改行する",
  "article_body": "詳細記事ページ用の本文。300～500文字程度を目安に作成する。summaryの文章をコピーしたり言い換えただけの本文にはせず、summaryでは省略した具体的な内容を公式記事から拾って詳しく説明する。公式記事に書かれている事実だけを使用する。本文は3～5段落に分け、内容の流れが自然になるよう整理する。各段落の間には空行を1つ入れる。1文は長くしすぎず、基本的に「。」「！」「？」で文が完結したところで改行する。単語や文節の途中では意図的に改行しない。同じ内容や同じ表現を繰り返さない"
}

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

        const aiArticle =
          JSON.parse(jsonText);

        const importance = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              Number(aiArticle.importance) || 0
            )
          )
        );

        // 70点未満は非掲載
        if (importance < 70) {
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

        // 70点以上は記事として公開
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
