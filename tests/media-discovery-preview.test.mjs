import test from 'node:test';import assert from 'node:assert/strict';
import {parseMediaFeed,MEDIA_SOURCE,collectMediaPreview} from '../lib/media-discovery-preview.js';
import handler from '../api/editor-games.js';import {createEditorToken} from '../lib/editor-auth.js';
import {getInformationSources} from '../lib/information-sources.js';import {settingRules} from '../lib/site-settings.js';
const now=Date.parse('2026-11-02T00:00:00Z');
const item=(title='新作&amp;冒険',url='https://game.watch.impress.co.jp/docs/news/2152919.html',date='2026-11-01T20:46:14+09:00')=>`<item><title>${title}</title><link>${url}</link><dc:date>${date}</dc:date><description>本文を返さない</description></item>`;
const feed=items=>`<rdf:RDF>${items}</rdf:RDF>`;
test('RSS preview normalizes links, decodes text, sorts and deduplicates without copying body',()=>{
 const rows=parseMediaFeed(feed(item()+item('重複','https://game.watch.impress.co.jp/docs/news/2152919.html?ref=rss')+item('<![CDATA[別の記事]]>','https://game.watch.impress.co.jp/docs/preview/2152920.html','2026-11-02T01:00:00+09:00')),now);
 assert.equal(rows.length,2);assert.equal(rows[0].title,'別の記事');assert.equal(rows[1].title,'新作&冒険');assert.equal(rows[1].published_at,'2026-11-01T11:46:14.000Z');assert.deepEqual(Object.keys(rows[0]).sort(),['published_at','title','url']);
});
test('rejects unsafe links, markup, invalid or stale dates, future dates and unsupported XML',()=>{
 for(const url of ['javascript:alert(1)','https://evil.invalid/docs/news/1.html','https://game.watch.impress.co.jp.evil.invalid/docs/news/1.html','https://user:pass@game.watch.impress.co.jp/docs/news/1.html','https://game.watch.impress.co.jp/other/1.html'])assert.equal(parseMediaFeed(feed(item('title',url)),now).length,0);
 for(const date of ['bad','2026-10-01T00:00:00Z','2026-11-03T00:00:00Z'])assert.equal(parseMediaFeed(feed(item('title',undefined,date)),now).length,0);
 assert.equal(parseMediaFeed(feed(item('<img src=x>')),now).length,0);
 assert.throws(()=>parseMediaFeed('<!DOCTYPE x>'+feed(item()),now));assert.throws(()=>parseMediaFeed('<html>changed</html>',now));
});
test('inspects at most 100 entries and returns at most 20',()=>{
 const xml=feed(Array.from({length:120},(_,i)=>item(String(i),`https://game.watch.impress.co.jp/docs/news/${i+1}.html`)).join(''));assert.equal(parseMediaFeed(xml,now).length,20);
});
const secret='media-test';Object.assign(process.env,{EDITOR_SECRET:secret,GAME_CATALOG_ENABLED:'true',GAME_DISCOVERIES_ENABLED:'true',MEDIA_DISCOVERY_ENABLED:'true',SUPABASE_URL:'https://db.invalid',SUPABASE_SECRET_KEY:'fake'});
const headers={cookie:`ilovegame_editor=${createEditorToken(secret)}`,host:'site.invalid',origin:'https://site.invalid'};
const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('manual API rejects anonymous, POST, disabled gates and caller-supplied URLs before fetch',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected fetch');};try{
 for(const [req,code] of [[{method:'GET',headers:{}},401],[{method:'POST',headers},405],[{method:'GET',headers,query:{url:'https://evil.invalid'}},400]]){const response=res();await handler({...req,query:{resource:'media-preview',...req.query}},response);assert.equal(response.code,code);}
 process.env.MEDIA_DISCOVERY_ENABLED='false';const response=res();await handler({method:'GET',headers,query:{resource:'media-preview'}},response);assert.equal(response.code,503);
 }finally{globalThis.fetch=old;process.env.MEDIA_DISCOVERY_ENABLED='true';}
});
test('one fixed public request, no database write or paid API; failed fetch is sanitized',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,MEDIA_SOURCE.feed);assert.equal(options.redirect,'error');return new Response(feed(item('新作',undefined,new Date(Date.now()-1000).toISOString())));};
 try{const data=await collectMediaPreview();assert.equal(data.items.length,1);assert.equal(calls,1);globalThis.fetch=async()=>{throw Error('internal details');};const response=res();await handler({method:'GET',headers,query:{resource:'media-preview'}},response);assert.equal(response.code,502);assert.ok(!response.body.error.includes('internal'));}finally{globalThis.fetch=old;}
});
test('single source setting entry has no duplicate controls and follows feature gates',()=>{
 const settings=Object.fromEntries(Object.entries(settingRules).map(([key,rule])=>[key,rule.defaultValue]));const flags={GAME_CATALOG_ENABLED:'true',GAME_DISCOVERIES_ENABLED:'true',MEDIA_DISCOVERY_ENABLED:'true'};
 const sources=getInformationSources(settings,flags).filter(s=>s.id===MEDIA_SOURCE.id);assert.equal(sources.length,1);assert.equal(sources[0].action.href,'/editor-media.html');assert.equal(sources[0].settingKey,undefined);
 for(const key of Object.keys(flags))assert.equal(getInformationSources(settings,{...flags,[key]:'false'}).find(s=>s.id===MEDIA_SOURCE.id).action,null);
});
