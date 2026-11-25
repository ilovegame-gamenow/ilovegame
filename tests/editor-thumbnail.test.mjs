import test from 'node:test';
import assert from 'node:assert/strict';
import {retryThumbnail,thumbnailCandidates} from '../lib/editor-thumbnail.js';
import {parseEditorNewsQuery} from '../lib/editor-news-repository.js';
const source='https://store.steampowered.com/app/123/';
const image='https://shared.fastly.steamstatic.com/example.jpg';
test('only supported HTTPS image candidates are accepted',()=>{
 assert.deepEqual(thumbnailCandidates('<meta property="og:image" content="'+image+'"><meta name="twitter:image" content="http://example.com/a.jpg">',source),[image]);
 assert.equal(parseEditorNewsQuery({thumbnail:'missing'}).thumbnail,'missing');
 assert.equal(parseEditorNewsQuery({thumbnail:'invalid'}),null);
});
test('verified image alone is saved; unsuccessful verification cannot write',async()=>{
 const original=globalThis.fetch;
 let valid=true,writes=0;
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(input);
  if(url.hostname==='db.invalid'){
   if(options.method==='PATCH'){
    writes++;
    assert.deepEqual(JSON.parse(options.body),{thumbnail_url:image});
    assert.equal(url.searchParams.get('processing_status'),'eq.completed');
    assert.equal(url.searchParams.get('thumbnail_url'),'is.null');
    return Response.json([{id:1}]);
   }
   if(url.pathname.endsWith('article_games'))return Response.json([]);
   return Response.json([{id:1,source_url:source,thumbnail_url:null,processing_status:'completed'}]);
  }
  assert.equal(options.redirect,'error');
  if(url.href===source)return new Response('<meta property="og:image" content="'+image+'">');
  assert.equal(url.href,image);
  return new Response('image',{headers:{'content-type':valid?'image/jpeg':'text/html'}});
 };
 try{
  assert.equal((await retryThumbnail('https://db.invalid','test',1)).status,200);
  valid=false;
  assert.equal((await retryThumbnail('https://db.invalid','test',1)).status,422);
  assert.equal(writes,1);
 }finally{globalThis.fetch=original;}
});
