import assert from "node:assert/strict";
import {
  collectPlayStationArticles,
  fetchPlayStationOgImage
} from "../../lib/collectors/playstation.js";

const articles = await collectPlayStationArticles();

assert.ok(articles.length > 0, "No articles found");

let successCount = 0;

for (const article of articles.slice(0, 5)) {
  const ogImage = await fetchPlayStationOgImage(
    article.source_url
  );

  console.log("---");
  console.log(`Title: ${article.source_title}`);
  console.log(`RSS image: ${article.thumbnail_url}`);
  console.log(`OG image: ${ogImage}`);

  assert.ok(
    ogImage && ogImage.startsWith("https://"),
    "Valid OG image not found"
  );

  successCount++;
}

console.log(`OG images found: ${successCount}`);
console.log("PlayStation OG extractor: PASS");
