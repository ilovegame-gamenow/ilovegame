import test from 'node:test';
import assert from 'node:assert/strict';
import collect from '../api/collect-game-news.js';
import {settingRules} from '../lib/site-settings.js';
const defaults = Object.fromEntries(Object.entries(settingRules).map(([key,rule])=>[key,rule.defaultValue]));
process.env.CRON_SECRET='test-cron';
process.env.SUPABASE_URL='https://db.invalid';
process.env.SUPABASE_SECRET_KEY='test-key';
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('collector rejects unauthorized and unknown sources before accessing any service',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('unexpected request');};
 try {
  for(const [headers,query,expected] of [[{}, {},401],[{authorization:'Bearer test-cron'},{source:'unknown'},400]]) {
   const res=response(); await collect({method:'GET',headers,query},res); assert.equal(res.code,expected);
  }
 } finally {globalThis.fetch=original;}
});

for(const source of ['nintendo','playstation']) test(`${source}: unified collector preserves mapping, settings limit and single-article test mode`,async()=>{
 const original=globalThis.fetch;
 const saved=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/site_settings')) return Response.json([{...defaults,[`${source}_limit`]:2}]);
  if(u.hostname==='db.invalid') {
   assert.equal(options.method,'POST'); saved.push(JSON.parse(options.body));return Response.json([{id:saved.length}],{status:201});
  }
  if(u.hostname==='www.nintendo.com') return Response.json([1,2,3].map(id=>({slug:`test-${id}`,title:`記事${id}`,display_date:'2026-10-24T09:00:00Z',thumbnail:{url_key:'thumbnail'}})));
  if(u.pathname==='/feed/') return new Response(`<rss><channel>${[1,2,3].map(id=>`<item><title>記事${id}</title><link>https://blog.ja.playstation.com/test-${id}/</link><pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`);
  if(u.hostname==='blog.ja.playstation.com') return new Response('<meta property="og:image" content="https://example.com/og.jpg">');
  throw Error(`Unexpected request ${url}`);
 };
 try {
  for(const mode of [undefined,'1']) {
   saved.length=0; const res=response();
   await collect({method:'GET',headers:{authorization:'Bearer test-cron'},query:{source,test:mode}},res);
   assert.equal(res.code,200); assert.equal(res.body.checked,2); assert.equal(res.body.pending,mode?1:2);
   assert.equal(saved.length,mode?1:2);
   const article=saved[0];
   assert.equal(article.source_name,source==='nintendo'?'Nintendo':'PlayStation');
   assert.equal(article.source_title,'記事1'); assert.equal(article.status,'pending'); assert.equal(article.processing_status,'pending');
   assert.equal(article.thumbnail_url,source==='nintendo'?'thumbnail':'https://example.com/og.jpg');
   assert.equal(article.source_url,source==='nintendo'?'https://www.nintendo.com/jp/topics/article/test-1':'https://blog.ja.playstation.com/test-1/');
  }
 } finally {globalThis.fetch=original;}
});
