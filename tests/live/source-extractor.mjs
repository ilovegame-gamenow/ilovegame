import assert from "node:assert/strict";
import { extractSourceText } from "../../lib/source-extractor.js";

const feeds = [
  {
    name: "Nintendo",
    url: "https://www.nintendo.com/jp/topics/article/a5ec42eb-efb3-4c90-95b0-618e143da7e2",

    direct: true
  },
  {
    name: "PlayStation",
    url: "https://blog.ja.playstation.com/feed/",
    direct: false
  }
];

for (const source of feeds) {
  let articleUrl = source.url;

  if (!source.direct) {
    const response = await fetch(source.url);
    assert.ok(response.ok, `${source.name} feed fetch failed`);

    const xml = await response.text();
    const item = xml.match(/<item>[\s\S]*?<\/item>/i);
    assert.ok(item, `${source.name} RSS item not found`);

    const link = item[0].match(/<link>([\s\S]*?)<\/link>/i);
    assert.ok(link, `${source.name} article URL not found`);

    articleUrl = link[1].trim();
  }

  const text = await extractSourceText(articleUrl);

  assert.ok(
    text.length > 200,
    `${source.name} extracted text is too short`
  );

  console.log(`${source.name}: PASS`);
  console.log(`URL: ${articleUrl}`);
  console.log(`Text length: ${text.length}`);
  console.log(`Preview: ${text.slice(0, 200)}`);
}

console.log("Source extraction tests passed.");
