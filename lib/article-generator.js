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
        input: `あなたはゲームニュースサイト「I LOVE GAME♪」の編集者です。
以下の公式記事だけを情報源として、日本語のゲームニュースを作成してください。
公式記事に書かれていない情報は追加しないでください。

「本日」「昨日」「明日」など、後から読んだときに日付が分からなくなる相対的な表現は原則使用しないでください。
日付を伝える必要がある場合は「10月4日」のように具体的な日付を使用してください。
記事本文やsummary内の日付は原則として年を省略し、「2026年9月30日」ではなく「9月30日」のように表記してください。
同じ日付を文章内で不必要に繰り返さないでください。
ただし、年を明記しないと意味が分かりにくい場合は年を付けても構いません。

次の4項目を作成してください。出力形式は指定されたJSONスキーマに従ってください。
title：分かりやすいニュースタイトルにしてください。
summary：一覧カード用の要約です。必ず1文、50〜70文字程度にしてください。タイトルの内容をそのまま繰り返さないでください。
ilovegame_point：「ここに注目♪」に表示する文章です。ゲーム好きの友達に「この辺が楽しそうだよ」と説明する感覚で、具体的な注目ポイントを1〜2文で紹介してください。
・堅い解説調や宣伝文句を避け、「〜できるよ」「〜なのがうれしいね」「〜を確認しておこう」など、自然で親しみのある言葉にしてください。同じ語尾を毎回繰り返す必要はありません。
・summaryを言い換えるだけでなく、公式記事で確認できる特徴が、遊ぶ人にどう関係するかをやさしく伝えてください。
・「必見」「絶対に楽しめる」などのあおり、読者への押しつけ、過度な馴れ馴れしさ・幼い言葉・ネットスラングは避けてください。絵文字や「♪」「！」を無理に付けないでください。
・親しみやすくするために、未確認の遊び方・性能・品質・体験談を付け加えないでください。自分が実際に遊んだかのような表現や、根拠のない人気・評判の断定もしないでください。
・サービス終了や不具合などの話題では、楽しげな口調や茶化す表現にせず、気を付けたい点を落ち着いて伝えてください。
・この親しみやすい口調はilovegame_pointだけに適用し、title・summary・article_bodyは通常の分かりやすいニュース文体を維持してください。
article_body：詳細記事ページ用の本文です。300〜500文字程度を目安に、公式記事の情報だけで作成してください。summaryの単純なコピーは避けてください。

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

  const aiText =
    data.output_text ||
    data.output
      ?.flatMap(item => item.content || [])
      ?.find(part => part.type === "output_text")
      ?.text ||
    "";

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
