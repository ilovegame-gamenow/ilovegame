import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../featured-news-client.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function start(fetch) {
  const container = { innerHTML: '', setAttribute(name, value) { this[name] = value; } };
  const button = { addEventListener(_, handler) { this.click = handler; } };
  const retry = { hidden: true, querySelector: () => button };
  const rendered = [];
  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'pickup' ? container : retry },
    fetch, AbortController, setTimeout, clearTimeout,
    GameFeatured: { render: data => rendered.push(data) },
  });
  return { container, button, retry, rendered };
}

test('a transient API failure retries and renders the selected games', async () => {
  let calls = 0;
  const state = start(async (_, options) => {
    assert.equal(options.cache, 'no-store');
    if (++calls === 1) throw new Error('Network error');
    return Response.json({ breaking: null, pickup: [{ id: 375 }] });
  });
  await settle();
  assert.equal(calls, 2);
  assert.equal(state.rendered[0].pickup[0].id, 375);
  assert.equal(state.retry.hidden, true);
  assert.equal(state.container['aria-busy'], 'false');
});

test('persistent failure shows retry rather than claiming no selections; manual retry recovers', async () => {
  let available = false;
  const state = start(async () => available
    ? Response.json({ breaking: null, pickup: [{ id: 375 }] })
    : new Response('Unavailable', { status: 502 }));
  await settle();
  assert.equal(state.rendered.length, 0);
  assert.match(state.container.innerHTML, /読み込めませんでした/);
  assert.equal(state.retry.hidden, false);
  available = true;
  await state.button.click();
  assert.equal(state.rendered.length, 1);
  assert.equal(state.retry.hidden, true);
});

test('a confirmed empty selection remains distinct from an invalid API response', async () => {
  const empty = start(async () => Response.json({ breaking: null, pickup: [] }));
  const invalid = start(async () => Response.json({ error: 'Unavailable' }));
  await settle();
  assert.equal(empty.rendered.length, 1);
  assert.equal(empty.rendered[0].pickup.length, 0);
  assert.equal(empty.retry.hidden, true);
  assert.equal(invalid.rendered.length, 0);
  assert.equal(invalid.retry.hidden, false);
});
