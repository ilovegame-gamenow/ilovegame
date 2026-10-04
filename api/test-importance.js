export default async function handler(req, res) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY is missing"
      });
    }

    // Nintendo Topics の最新記事を取得
    const nintendoResponse = await fetch(
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search?page=4",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!nintendoResponse.ok) {
      throw new Error("Nintendo API request failed");
    }

    const data = await nintendoResponse.json();
    const start = Math.max(0, Number(req.query.start) || 0);
    const latest = data.slice(start, start + 10);
    const results = [];

    // 最新10件を本文まで取得してAI採点
    for (const item of latest) {
      const sourceUrl =
        `https://www.nintendo.com/jp/topics/article/${item.slug}`;

      const articleResponse = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      if (!articleResponse.ok) {
        results.push({
          title: item.title,
          success: false,
          error: "Nintendo article fetch failed"
        });
        continue;
      }

      const html = await articleResponse.text();

      const mainMatch =
        html.match(/<main[\s\S]*?<\/main>/i) ||
        html.match(/<article[\s\S]*?<\/article>/i);

      const articleHtml =
        mainMatch ? mainMatch[0] : html;

      const cleanText = articleHtml
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            input: `
あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。

以下のNintendo公式記事のタイトルと本文を読んで、
I LOVE GAME♪での掲載価値を0～100の整数で評価してください。

評価では特に次の点を重視してください。

・ゲームそのものに直接関係する情報か
・新作発表、発売日、新情報、大型アップデート、DLC、体験版などは高く評価する
・ゲームを実際に遊ぶ人にとって知りたい情報か
・ニュースとしての大きさを考慮する
・ゲームタイトルやIPの注目度を考慮する
・同じアップデートでも、小さな修正と大型コンテンツ追加を区別する
・映画、イベント、グッズなどゲーム外の情報は基本的に低めにする
・ただし非常に人気の高いIPや大きな話題なら加点してよい
・決算、人事など企業情報は、ゲームへの直接的な影響が大きい場合を除き低く評価する

記事の種類だけで機械的に点数を決めず、
記事本文の具体的な内容を読んで総合的に判断してください。

数字だけを出力してください。

公式タイトル:
${item.title}

公式記事本文:
${cleanText.slice(0, 6000)}
`
          })
        }
      );

      const openaiData = await openaiResponse.json();

      if (!openaiResponse.ok) {
        results.push({
          title: item.title,
          success: false,
          error: "OpenAI request failed"
        });
        continue;
      }

      const text =
        openaiData.output_text ??
        openaiData.output
          ?.flatMap(item => item.content ?? [])
          .find(item => item.type === "output_text")?.text ??
        "";

      const importance = Math.max(
        0,
        Math.min(
          100,
          Math.round(Number(text.trim()) || 0)
        )
      );

      results.push({
        title: item.title,
        importance,
        source_url: sourceUrl
      });
    }

    return res.status(200).json({
      success: true,
      totalReceived: data.length,
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
