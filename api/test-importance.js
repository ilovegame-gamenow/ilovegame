export default async function handler(req, res) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing"
      });
    }

    const testArticles = [
      {
        title: "「ゼルダの伝説40周年コンサート」は、2027年1月より全国5都市で開催。チケットの先行申込（抽選）も受付中。"
      },
      {
        title: "ニンテンドーeショップ新作ソフト情報 10/2（金）号。"
      },
      {
        title: "全国のアニメイトにて「ゼルダの伝説」オリジナル商品を発売。"
      }
    ];

    const results = [];

    for (const article of testArticles) {
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

次のニュースのI LOVE GAME♪での掲載価値を0～100の整数で評価してください。

評価基準：
・ゲームそのものに直接関係する新作発表、発売日、アップデート、DLC、体験版などを高く評価する
・ニュースとしての大きさを考慮する
・タイトルやIPの注目度を考慮する
・ゲームを遊ぶ人にとって知りたい情報かを重視する
・グッズや映画などゲーム外の情報は基本的に低め。ただし人気IPや大きな話題なら加点してよい
・決算、人事など企業情報はゲームへの直接的な影響が大きい場合を除き低く評価する

数字だけを出力してください。

ニュース：
${article.title}
`
          })
        }
      );

      const data = await openaiResponse.json();

      if (!openaiResponse.ok) {
        throw new Error(JSON.stringify(data));
      }

      const text =
        data.output_text ??
        data.output?.flatMap(item => item.content ?? [])
          .find(item => item.type === "output_text")?.text ??
        "";

      const importance = Math.max(
        0,
        Math.min(100, Math.round(Number(text.trim()) || 0))
      );

      results.push({
        title: article.title,
        importance
      });
    }

    return res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
