import assert from "node:assert/strict";
import {
  collectPlayStationArticles,
  parsePlayStationRss
} from "../../lib/collectors/playstation.js";

// まずは固定データで基本動作を確認
const sampleRss = `
  <rss>
    <channel>
      <item>
        <title><![CDATA[ゲーム & ニュース]]></title>
        <link>https://blog.ja.playstation.com/test/</link>
        <pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate>
        <media:thumbnail url="https://example.com/image.jpg"/>
      </item>
    </channel>
  </rss>
`;

const sample = parsePlayStationRss(sampleRss);

assert.equal(sample.length, 1);
assert.equal(sample[0].source_title, "ゲーム & ニュース");
assert.equal(sample[0].source_name, "PlayStation");
assert.equal(
  sample[0].source_url,
  "https://blog.ja.playstation.com/test/"
);
assert.equal(
  sample[0].thumbnail_url,
  "https://example.com/image.jpg"
);

console.log("RSS parser sample: PASS");

// 次に公式RSSを実際に取得して確認
const articles = await collectPlayStationArticles();

assert.ok(
  articles.length > 0,
  "No PlayStation articles found"
);

console.log(`Articles found: ${articles.length}`);

for (const article of articles.slice(0, 5)) {
  assert.ok(article.source_title);
  assert.ok(article.source_url);
  assert.equal(article.source_name, "PlayStation");

  console.log("---");
  console.log(`Title: ${article.source_title}`);
  console.log(`URL: ${article.source_url}`);
  console.log(`Published: ${article.source_published_at}`);
  console.log(`Thumbnail: ${article.thumbnail_url}`);
}

console.log("PlayStation RSS collector: PASS");
