import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPendingArticle } from '../lib/article-queue-repository.js';

const item = { source_title:'テスト記事', source_name:'PlayStation', source_url:'https://example.com/article', thumbnail_url:'https://example.com/image.jpg' };
const options = {supabaseUrl:'https://db.invalid', supabaseKey:'server-key'};

test('registration uses one atomic insert and never updates existing articles', async () => {
  const original = globalThis.fetch;
  const stored = new Map();
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    const u = new URL(url);
    assert.equal(u.searchParams.get('on_conflict'), 'source_url');
    assert.equal(u.searchParams.get('select'), 'id');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
    assert.equal(init.headers.apikey, options.supabaseKey);
    const article = JSON.parse(init.body);
    if (stored.has(article.source_url)) return Response.json([]);
    assert.equal(article.status, 'pending');
    assert.equal(article.processing_status, 'pending');
    assert.equal(article.importance, 0);
    assert.equal(article.thumbnail_url, item.thumbnail_url);
    stored.set(article.source_url, article);
    return Response.json([{id:1}], {status:201});
  };
  try {
    assert.equal((await registerPendingArticle(item, options)).status, 'pending');
    const saved = stored.get(item.source_url);
    saved.title = '編集済み'; saved.status = 'published';
    const before = structuredClone(saved);
    assert.equal((await registerPendingArticle(item, options)).status, 'existing');
    assert.deepEqual(saved, before);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('registration reports failures instead of misclassifying all conflicts as duplicates', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [400,409,503]) {
      globalThis.fetch = async () => new Response('constraint or database failure', {status});
      const result = await registerPendingArticle(item, options);
      assert.equal(result.status, 'error');
      assert.match(result.error, /failure/);
    }
    globalThis.fetch = async () => Response.json({unexpected:true});
    await assert.rejects(registerPendingArticle(item, options), /Invalid registration response/);
    globalThis.fetch = () => { throw Error('must not fetch'); };
    await assert.rejects(registerPendingArticle({}, options), /Required article fields/);
  } finally { globalThis.fetch = original; }
});
