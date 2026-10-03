export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return res.status(500).json({
        success: false,
        error: "Supabase environment variables are missing"
      });
    }

    // Nintendo Topics の最新記事を取得
    const nintendoResponse = await fetch(
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!nintendoResponse.ok) {
      return res.status(nintendoResponse.status).json({
        success: false,
        error: "Nintendo API request failed"
      });
    }

    const data = await nintendoResponse.json();
    const latest = data.slice(0, 10);

    const results = [];

    // 最新10件を順番に処理
    for (const item of latest) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      const article = {
        source_title: item.title,
        title: item.title,
        category: "NEWS",
        thumbnail_url: item.thumbnail?.url_key || null,
        source_name: "Nintendo",
        source_url: sourceUrl,
        source_published_at: item.display_date,
        importance: 50,
        is_breaking: false,
        status: "published",
        published_at: item.display_date
      };

      // Supabaseに同じ記事が存在するか確認
      const checkUrl = new URL(
        `${supabaseUrl}/rest/v1/articles`
      );

      checkUrl.searchParams.set("select", "id");
      checkUrl.searchParams.set(
        "source_url",
        `eq.${sourceUrl}`
      );

      const existingResponse = await fetch(
        checkUrl.toString(),
        {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        }
      );

      const existingArticles =
        await existingResponse.json();

      const alreadyExists =
        existingResponse.ok &&
        Array.isArray(existingArticles) &&
        existingArticles.length > 0;

      // 新規記事だけAI記事生成を行う
       if (!alreadyExists || (alreadyExists && existingArticles[0]?.id === 113)) {
        const articleResponse = await fetch(
          sourceUrl,
          {
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          }
        );

        if (!articleResponse.ok) {
          throw new Error(
            "Nintendo article fetch failed"
          );
        }

        const html =
          await articleResponse.text();

        // 記事本文部分を抽出
        const mainMatch =
          html.match(/<main[\s\S]*?<\/main>/i) ||
          html.match(/<article[\s\S]*?<\/article>/i);

        const articleHtml =
          mainMatch ? mainMatch[0] : html;

        // HTMLから本文テキストを生成
        const cleanText = articleHtml
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
          .replace(/\s+/g, " ")
          .trim();

        // OpenAIでI LOVE GAME♪用の記事を生成
        const openaiResponse = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              model: "gpt-5-mini",

              input: `
              
あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。

以下のNintendo公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

「本日」「昨日」「明日」など、後から読んだときに日付が分からなくなる相対的な表現は原則使用しないでください。
日付を伝える必要がある場合は「10月4日」のように具体的な日付を使用してください。
記事本文やsummary内の日付は原則として年を省略し、「2026年9月30日」ではなく「9月30日」のように表記してください。同じ日付を文章内で不必要に繰り返さないでください。ただし、年を明記しないと意味が分かりにくい場合は年を付けても構いません。

JSONだけで次の形式で出力してください。

{
  "title": "分かりやすいニュースタイトル",
  "summary": "一覧カード用の要約。必ず1文、50～70文字程度で、最も重要な情報だけを簡潔にまとめる",
  "ilovegame_point": "「ここに注目♪」に表示する文章。記事の中で特に読者に伝えたいポイントを1～2文で紹介する。ニュース本文の要約を繰り返さず、ゲーム好きの友だちに話しかけるような、親しみのある柔らかい口調にする。「～だね♪」「～も楽しみ♪」「～なのもうれしいところ♪」など自然な表現を使ってよい。ただし毎回同じ語尾にしない。文章が長くなる場合は「。」「♪」「！」「？」で文が一区切りするごとに改行する。必要な場合のみ「、」の自然な位置でも改行する",
  "article_body": "詳細記事ページ用の本文。300～500文字程度を目安に作成する。summaryの文章をコピーしたり言い換えただけの本文にはせず、summaryでは省略した具体的な内容を公式記事から拾って詳しく説明する。公式記事に書かれている事実だけを使用する。本文は3～5段落に分け、内容の流れが自然になるよう整理する。各段落の間には空行を1つ入れる。1文は長くしすぎず、基本的に「。」「！」「？」で文が完結したところで改行する。単語や文節の途中では意図的に改行しない。同じ内容や同じ表現を繰り返さない"
}

公式タイトル:
${item.title}

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

        // Responses APIから生成テキストを取得
        const aiText =
          openaiData.output_text ||
          openaiData.output
            ?.flatMap(
              item => item.content || []
            )
            ?.find(
              part => part.type === "output_text"
            )
            ?.text ||
          "";

        let aiArticle;

        try {
          // Markdownコードブロックが付いた場合にも対応
          const jsonText = aiText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

          aiArticle =
            JSON.parse(jsonText);

          console.log("AI DEBUG", {
            title: aiArticle.title,
            summaryLength: aiArticle.summary?.length,
            articleBodyLength: aiArticle.article_body?.length,
            articleBody: aiArticle.article_body
          });
        } catch (error) {
          throw new Error(
            `AI JSON parse failed: ${aiText}`
          );
        }

        article.title =
          aiArticle.title;

        article.summary =
          aiArticle.summary;

        article.ilovegame_point =
          aiArticle.ilovegame_point;

        article.article_body =
          aiArticle.article_body;
      }

      let saveResponse;

      if (alreadyExists) {
        // 既存記事はタイトルを変更せず、
        // Nintendo側の情報だけ更新
        const updateArticle = {
          ...article
        };

        delete updateArticle.title;

        saveResponse = await fetch(
          `${supabaseUrl}/rest/v1/articles?source_url=eq.${encodeURIComponent(sourceUrl)}`,
          {
            method: "PATCH",

            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },

            body: JSON.stringify(
              updateArticle
            )
          }
        );

      } else {
        // 新規記事をSupabaseへ保存
        saveResponse = await fetch(
          `${supabaseUrl}/rest/v1/articles`,
          {
            method: "POST",

            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },

            body: JSON.stringify(
              article
            )
          }
        );
      }

      // 保存結果を記録
      if (saveResponse.ok) {
        results.push({
          title: item.title,
          success: true
        });

      } else {
        results.push({
          title: item.title,
          success: false,
          error: await saveResponse.text()
        });
      }
    }

    return res.status(200).json({
      success: true,
      checked: latest.length,
      results
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
