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
      if (!alreadyExists) {
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

              input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。

以下のNintendo公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

JSONだけで次の形式で出力してください。

{
  "title": "分かりやすいニュースタイトル",
  "summary": "一覧カード用の短い要約。1～2文で簡潔に",
  "ilovegame_point": "読者が注目すべきポイントを1～2文で紹介"
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
