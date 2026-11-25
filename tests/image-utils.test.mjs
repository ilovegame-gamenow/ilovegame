import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("news image errors replace card thumbnails without affecting unrelated images", () => {
  let onError;
  const document = {
    addEventListener(type, handler, capture) {
      assert.equal(type, "error");
      assert.equal(capture, true);
      onError = handler;
    },
    createElement: () => ({})
  };
  const images = runInNewContext(
    readFileSync(new URL("../image-utils.js", import.meta.url), "utf8") + "\nGameImage",
    { document }
  );
  assert.equal(images.getUrl(" ", "nintendo"), "");
  assert.equal(images.getUrl("key", null), "");
  assert.equal(images.getUrl("https://example.com/game.jpg"), "https://example.com/game.jpg");
  assert.equal(images.getUrl(null,"Nintendo",579),"/assets/editorial-thumbnails/579-racing-illustration.webp");
  assert.equal(images.getUrl("https://example.com/game.jpg","Nintendo",579),"https://example.com/game.jpg");
  assert.equal(images.getUrl(null,"Nintendo",580),"");
  let replacement;
  onError({ target: {
    matches: selector => selector === "img[data-news-thumbnail]",
    classList: { contains: name => name === "thumb" },
    replaceWith: value => { replacement = value; }
  } });
  assert.equal(replacement.className, "thumb-placeholder");
  assert.equal(replacement.textContent, "I LOVE GAME♪");
  let removed = false;
  onError({ target: {
    matches: () => true, classList: { contains: () => false },
    remove: () => { removed = true; }
  } });
  assert.equal(removed, true);
  onError({ target: { matches: () => false } });
});
