import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceArticleUrl,parsePrTimesList} from '../lib/source-evidence.js';
import {extractVideoEvidence,normalizePublishedDate} from '../lib/source-video-evidence.js';
import {handleSourceEvidence as handler} from '../lib/source-evidence-handler.js';
test('article source IDs are strictly scoped',()=>{
 assert.equal(sourceArticleUrl('nintendo','d053fb5f-e501-4da3-9a8c-609922c8c895'),'https://www.nintendo.com/jp/topics/article/d053fb5f-e501-4da3-9a8c-609922c8c895');
 for(const id of ['https://example.com/foo','../../api','2026/11/19/x?redirect=evil','2026/11/19/x%2f..'])assert.equal(sourceArticleUrl('playstation',id),null);
 assert.equal(sourceArticleUrl('prtimes','000000175.000147608'),'https://prtimes.jp/main/html/rd/p/000000175.000147608.html');
});
test('picture source is not a video',()=>assert.equal(extractVideoEvidence('<picture><source srcset="x.webp"><img src="x.jpg"></picture>','https://www.nintendo.com','Nintendo').status,'no_video_detected'));
test('Nintendo dynamic player and duplicate video ID',()=>{
 const result=extractVideoEvidence('<div class="okra-youtube-inner"><div id="EpMQe14sTWMwvdaql0s"></div></div><a href="https://youtu.be/EpMQe14sTWM">video</a>','https://www.nintendo.com','Nintendo');
 assert.equal(result.youtubeCandidates.length,1);assert.equal(result.youtubeCandidates[0].id,'EpMQe14sTWM');
});
test('native video links to article, never video URL',()=>{
 const result=extractVideoEvidence('<video data-src="https://stream.mux.com/example.mp4?token=demo"></video>','https://blog.ja.playstation.com/','PlayStation');
 assert.equal(result.status,'official_page_link');assert.equal(result.youtubeCandidates.length,0);assert.ok(!JSON.stringify(result).includes('token='));
});
test('PR TIMES local timestamp converts to JST basis',()=>assert.equal(normalizePublishedDate('2026-11-19 12:00:02','PR TIMES').value,'2026-11-19T03:00:02.000Z'));
test('unknown timezone is not guessed',()=>assert.equal(normalizePublishedDate('2026-11-19 12:00:02','Nintendo').precision,'timezone_unconfirmed'));
test('PR TIMES list ignores external lookalikes and duplicates',()=>{
 const a=parsePrTimesList('<a href="https://evil.example/main/html/rd/p/000000175.000147608.html">Ignore</a><a href="/main/html/rd/p/000000175.000147608.html">Title</a><a href="https://prtimes.jp/main/html/rd/p/000000175.000147608.html">Same</a>');
 assert.equal(a.length,1);assert.equal(a[0].source_title,'Title');
});
test('API rejects unsupported URL parameters and unauthenticated full text',async()=>{
 const makeRes=()=>({headers:{},code:null,setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 for(const [query,status] of [[{source:'prtimes',id:'https://example.com'},400],[{source:'prtimes',id:''},400],[{source:'nintendo',url:'https://example.com'},400],[{source:'prtimes',id:'000000175.000147608',include_text:'1'},401]]){
  const res=makeRes();await handler({method:'GET',query,headers:{}},res);assert.equal(res.code,status);assert.equal(res.headers['Cache-Control'],'private, no-store');
 }
});

