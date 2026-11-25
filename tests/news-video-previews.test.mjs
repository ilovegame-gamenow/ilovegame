import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {addNewsVideoPreviews} from '../lib/news-video-previews.js';

test('only missing still images request saved official video markers',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{
   const params=new URL(url).searchParams;
   assert.equal(params.get('id'),'in.(579,580)');
   return Response.json([{id:579,article_body:'公式動画：https://www.youtube.com/watch?v=6_YfdUZTnxE'},{id:580,article_body:'公式動画リンク：https://www.youtube.com/watch?v=6_YfdUZTnxE'}]);
  };
  const rows=await addNewsVideoPreviews([{id:579,thumbnail_url:null},{id:580,thumbnail_url:''},{id:581,thumbnail_url:'https://example.com/image.jpg'}],'https://db.invalid','key');
  assert.equal(rows[0].video_preview_id,'6_YfdUZTnxE');
  assert.equal(rows[1].video_preview_id,undefined);
  assert.equal(rows[2].video_preview_id,undefined);
  assert.equal(rows[0].article_body,undefined);
 }finally{globalThis.fetch=original;}
});
test('video preview links directly to playback, separate from the article title',()=>{
 const c=vm.createContext({window:{},GameImage:{getUrl:u=>u},GameDate:{renderMeta:()=>''},GamePlatforms:{render:()=>'',renderCategories:()=>''}});
 vm.runInContext(readFileSync(new URL('../news-card.js',import.meta.url),'utf8'),c);
 const a={id:579,title:'マリオカート',thumbnail_url:null,video_preview_id:'6_YfdUZTnxE'};
 const html=c.window.GameNewsCard.render(a,{compact:true});
 assert.match(html,/^<article/);
 assert.match(html,/href="https:\/\/www.youtube.com\/watch\?v=6_YfdUZTnxE"/);
 assert.match(html,/href="\/article.html\?id=579"/);
 assert.doesNotMatch(c.window.GameNewsCard.render({...a,thumbnail_url:'https://example.com/card.jpg'},{compact:true}),/news-video-preview/);
 assert.doesNotMatch(c.window.GameNewsCard.render({...a,video_preview_id:'"><script>'},{compact:true}),/news-video-preview/);
});
