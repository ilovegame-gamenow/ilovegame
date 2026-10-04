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
    title: "完全新作ゲームを発表。発売日は来年春を予定。"
  },
  {
    title: "人気ゲームの大型無料アップデートを配信。新ステージと新モードを追加。"
  },
  {
    title: "人気ゲームの追加DLCを発表。新エリアや新ストーリーを収録。"
  },
  {
    title: "発売予定の新作ゲームの無料体験版を配信開始。"
  },
  {
    title: "ニンテンドーeショップ新作ソフト情報。今週発売のタイトルを紹介。"
  },
  {
    title: "「ゼルダの伝説40周年コンサート」を全国5都市で開催。"
  },
  {
    title: "人気ゲームシリーズの映画化を正式発表。"
  },
  {
    title: "全国のアニメイトで「ゼルダの伝説」オリジナルグッズを発売。"
  },
  {
    title: "ゲーム会社が最新の決算情報を発表。"
  },
  {
    title: "人気ゲームの期間限定セールを開始。ダウンロード版が30％OFF。"
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
