import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/editor-save.js';
import { createEditorToken } from '../lib/editor-auth.js';
import { readDraftContent } from '../lib/article-draft-content.js';

const content = { title: '編集中', summary: '概要', article_body: '本文', ilovegame_point: '注目' };
process.env.EDITOR_SECRET = 'test-only-secret';
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
const article = { id: 1, ...content, status: 'published' };
async function run(body, responses, authenticated = true) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), ...options });
    assert.ok(responses.length, 'unexpected database request');
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  try {
    await handler({ method: 'POST', headers: { cookie: authenticated ? `ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}` : '' }, body }, res);
    return { res, calls };
  } finally { globalThis.fetch = original; }
}

test('incomplete drafts are valid but malformed/oversized fields are not', () => {
  assert.deepEqual(readDraftContent({ ...content, title: '', article_body: '' }), { ...content, title: '', article_body: '' });
  assert.equal(readDraftContent({ ...content, title: 'a'.repeat(301) }), null);
  assert.equal(readDraftContent({ ...content, summary: null }), null);
});
test('saving a draft never updates articles and preserves regenerated metadata', async () => {
  const { res, calls } = await run({ id: 1, ...content }, [[article], [{ regenerated: true }], [content]]);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 3);
  assert.ok(calls[2].url.includes('/article_drafts?'));
  assert.equal(calls[2].method, 'POST');
  assert.equal(JSON.parse(calls[2].body).regenerated, true);
  assert.ok(calls.every(c => c.method !== 'PATCH'));
});
test('applying uses only the atomic RPC and does not change publication status', async () => {
  const { res, calls } = await run({ id: 1, action: 'apply' }, [[article], [content], null]);
  assert.equal(res.code, 200);
  assert.ok(calls[2].url.endsWith('/rpc/apply_article_draft'));
  assert.deepEqual(JSON.parse(calls[2].body), { p_article_id: 1 });
});
test('incomplete/missing drafts cannot be applied', async () => {
  for (const draft of [[], [{ ...content, article_body: '' }]]) {
    const { res, calls } = await run({ id: 1, action: 'apply' }, [[article], draft]);
    assert.equal(res.code, 409);
    assert.equal(calls.length, 2);
  }
});
test('unauthenticated and invalid requests never access the database', async () => {
  assert.equal((await run({ id: 1 }, [], false)).res.code, 401);
  assert.equal((await run({ id: -1 }, [])).res.code, 400);
  assert.equal((await run({ id: 1, action: 'unknown' }, [])).res.code, 400);
});
test('missing article cannot create a draft', async () => {
  assert.equal((await run({ id: 1, ...content }, [[]])).res.code, 404);
});

test('AI regeneration returns text without writing either drafts or articles', async () => {
  process.env.OPENAI_API_KEY = 'test-only-openai-key';
  const source = { ...article, source_title: '公式記事', source_url: 'https://www.nintendo.com/jp/topics/test' };
  const { res, calls } = await run({ id: 1, action: 'regenerate' }, [
    [source], [source], '<main>公式記事本文</main>',
    { status: 'completed', output_text: JSON.stringify(content) }
  ]);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.article, content);
  const generation = calls.find(c => c.url === 'https://api.openai.com/v1/responses');
  const prompt = JSON.parse(generation.body).input;
  assert.match(prompt, /ゲーム好きの友達/);
  assert.match(prompt, /この親しみやすい口調はilovegame_pointだけ/);
  assert.match(prompt, /サービス終了や不具合/);
  assert.ok(calls.filter(c => c.url.includes('/rest/v1/')).every(c => !c.method));
});

test('discard deletes only the specified draft and never updates the public article', async () => {
  const { res, calls } = await run({ id: 1, action: 'discard' }, [[article], null]);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.endsWith('/article_drafts?article_id=eq.1'));
  assert.equal(calls[1].method, 'DELETE');
  assert.equal(calls[1].headers.Prefer, 'return=minimal');
  assert.ok(calls.every(c => c.method !== 'PATCH'));
});
test('discard requires authentication and an existing valid article', async () => {
  assert.equal((await run({ id: 1, action: 'discard' }, [], false)).res.code, 401);
  assert.equal((await run({ id: -1, action: 'discard' }, [])).res.code, 400);
  const { res, calls } = await run({ id: 1, action: 'discard' }, [[]]);
  assert.equal(res.code, 404);
  assert.equal(calls.length, 1);
});
