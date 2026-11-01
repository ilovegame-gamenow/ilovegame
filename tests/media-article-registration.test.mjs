import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/editor-save.js';import {createEditorToken} from '../lib/editor-auth.js';
import {canPublishArticle} from '../lib/article-publication.js';
const secret='media-registration-test',source='https://game.watch.impress.co.jp/docs/news/2152919.html';
Object.assign(process.env,{EDITOR_SECRET:secret,MEDIA_DISCOVERY_ENABLED:'true',SUPABASE_URL:'https://db.invalid',SUPABASE_SECRET_KEY:'fake'});
const headers={cookie:`ilovegame_editor=${createEditorToken(secret)}`,host:'site.invalid',origin:'https://site.invalid'};
const request={method:'POST',headers,body:{action:'create_from_media',source_url:source}};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const xml=()=>`<rdf:RDF><item><title>元情報の見出し</title><link>${source}</link><dc:date>${new Date(Date.now()-1000).toISOString()}</dc:date></item></rdf:RDF>`;
async function run(req,answers){const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),...options});assert.ok(answers.length,'unexpected request');const answer=answers.shift();return typeof answer==='string'?new Response(answer):Response.json(answer);};try{const res=response();await handler(req,res);return {res,calls};}finally{globalThis.fetch=old;}}
test('registration requires auth, same origin and a canonical fixed-publisher link',async()=>{
 for(const [req,code] of [[{...request,headers:{}},401],[{...request,headers:{...headers,origin:'https://evil.invalid'}},403],[{...request,body:{...request.body,source_url:'https://evil.invalid/'}},400],[{...request,body:{...request.body,title:'caller title'}},400]])assert.equal((await run(req,[])).res.code,code);
 process.env.MEDIA_DISCOVERY_ENABLED='false';try{assert.equal((await run(request,[])).res.code,503);}finally{process.env.MEDIA_DISCOVERY_ENABLED='true';}
});
test('creates an unpublished shell from server-verified feed fields, outside the automatic AI queue',async()=>{
 const {res,calls}=await run(request,[[],xml(),[{id:801,status:'pending'}]]);assert.equal(res.code,200);assert.equal(res.body.article.created,true);assert.equal(calls.length,3);assert.equal(calls[1].url,'https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf');
 const saved=JSON.parse(calls[2].body);assert.equal(saved.title,'元情報の見出し');assert.equal(saved.source_name,'GAME Watch');assert.equal(saved.source_url,source);assert.equal(saved.status,'pending');assert.equal(saved.processing_status,'completed');assert.equal(saved.manually_reviewed,true);assert.equal(saved.importance,0);assert.equal(saved.summary,'');assert.equal(saved.article_body,'');assert.equal(saved.published_at,null);assert.equal(saved.site_published_at,null);assert.equal(saved.is_breaking,false);assert.equal(canPublishArticle(saved),false);
 assert.equal(calls[2].headers.Prefer,'resolution=ignore-duplicates,return=representation');assert.ok(calls.every(c=>c.method!=='PATCH'));
});
test('retries and already published articles open the existing record without modifying content or status',async()=>{
 for(const status of ['pending','published','rejected']){const {res,calls}=await run(request,[[{id:802,status}]]);assert.equal(res.body.article.id,802);assert.equal(res.body.article.created,false);assert.equal(calls.length,1);assert.equal(calls[0].method,undefined);}
});
test('concurrent insert conflict fetches the existing article and never overwrites its draft',async()=>{
 const {res,calls}=await run(request,[[],xml(),[],[{id:803,status:'published'}]]);assert.equal(res.code,200);assert.equal(res.body.article.created,false);assert.equal(res.body.article.status,'published');assert.equal(calls.length,4);assert.ok(calls.every(c=>!c.url.includes('article_drafts')));
});
test('a link outside the current feed is rejected without creating an article',async()=>{
 const {res,calls}=await run(request,[[],'<rdf:RDF></rdf:RDF>']);assert.equal(res.code,409);assert.equal(calls.length,2);
});
