import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId,articleVideoUrl,articleContentSegments} from '../game-source-utils.js';
import {officialVideo} from '../official-video.js';
import {roundupPreview} from '../weekly-roundup-preview-data.js';
test('official video parser accepts exact YouTube hosts and rejects injected or ambiguous embed URLs',()=>{
 for(const url of ['https://youtu.be/Tb7mUhUhNlA','https://www.youtube.com/watch?v=Tb7mUhUhNlA','https://www.youtube-nocookie.com/embed/Tb7mUhUhNlA'])assert.equal(youtubeVideoId(url),'Tb7mUhUhNlA');
 for(const url of ['javascript:alert(1)','http://youtu.be/Tb7mUhUhNlA','https://youtube.com.evil.invalid/watch?v=Tb7mUhUhNlA','https://www.youtube.com@evil.invalid/watch?v=Tb7mUhUhNlA','https://user@www.youtube.com/watch?v=Tb7mUhUhNlA','https://www.youtube.com/watch?v=short','https://youtu.be/Tb7mUhUhNlA/extra'])assert.equal(youtubeVideoId(url),null);
});
test('player displays its iframe immediately without autoplay and keeps a direct video link',()=>{
 const original=globalThis.document;
 class Element{constructor(tag){this.tag=tag;this.children=[];this.listeners={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}addEventListener(type,handler){this.listeners[type]=handler;}}
 globalThis.document={createElement:tag=>new Element(tag)};
 try{
  assert.equal(officialVideo('Title','https://evil.invalid/watch?v=Tb7mUhUhNlA'),null);
  const section=officialVideo('<Title>','https://youtu.be/Tb7mUhUhNlA');
  const [player,link]=section.children;
  assert.equal(player.children[0].tag,'iframe');assert.equal(link.href,'https://www.youtube.com/watch?v=Tb7mUhUhNlA');
  const frame=player.children[0];assert.equal(frame.tag,'iframe');assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/Tb7mUhUhNlA?rel=0');assert.equal(frame.title,'<Title> 公式動画');assert.equal(frame.loading,'lazy');assert.equal(frame.src.includes('autoplay'),false);
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
test('roundup sample has sourced examples within the stated fixed week, not a generated published record',()=>{
 assert.equal(roundupPreview.article.id,undefined);
 assert.equal(roundupPreview.games.length,2);
 assert.deepEqual(roundupPreview.games.map(g=>g.date),['2026-11-05','2026-11-06']);
 for(const g of roundupPreview.games){assert.ok(g.date>=roundupPreview.start&&g.date<=roundupPreview.last);assert.ok(g.sources[0].url.startsWith('https://'));assert.ok(youtubeVideoId(g.video));assert.ok(g.platforms.length>0);}
});

test('ordinary article videos require an explicit editorial marker or a YouTube primary source',()=>{
 assert.equal(articleVideoUrl({article_body:'本文。\n公式動画：https://youtu.be/Tb7mUhUhNlA'}),'https://www.youtube.com/watch?v=Tb7mUhUhNlA');
 assert.equal(articleVideoUrl({article_body:'参考 https://youtu.be/Tb7mUhUhNlA'}),null);
 assert.equal(articleVideoUrl({article_body:'公式動画：https://youtube.com.evil.invalid/watch?v=Tb7mUhUhNlA'}),null);
 assert.equal(articleVideoUrl({source_url:'https://youtu.be/Tb7mUhUhNlA'}),'https://www.youtube.com/watch?v=Tb7mUhUhNlA');
 assert.equal(articleVideoUrl({article_body:'通常のニュース本文'}),null);
});

test('multiple official videos preserve their places between paragraphs and deduplicate URL variants',()=>{
 const first='https://www.youtube.com/watch?v=Tb7mUhUhNlA';
 const second='https://www.youtube.com/watch?v=19xi1Td52T0';
 assert.deepEqual(articleContentSegments({article_body:`冒頭。\n公式動画：${first}\n遊びの説明。\n公式動画：${second}\n公式動画：https://youtu.be/Tb7mUhUhNlA\n結び。`,source_url:first}),[
  {type:'text',text:'冒頭。'}, {type:'video',url:first},
  {type:'text',text:'遊びの説明。'}, {type:'video',url:second},
  {type:'text',text:'結び。'}
 ]);
});

test('invalid markers and ordinary links stay text; source fallback is still available',()=>{
 const text='説明。\n公式動画：https://youtube.com.evil.invalid/watch?v=Tb7mUhUhNlA\n参考 https://youtu.be/19xi1Td52T0';
 assert.deepEqual(articleContentSegments({article_body:text}),[{type:'text',text}]);
 assert.deepEqual(articleContentSegments({summary:'要約。',source_url:'https://youtu.be/Tb7mUhUhNlA'}),[
  {type:'text',text:'要約。'},{type:'video',url:'https://www.youtube.com/watch?v=Tb7mUhUhNlA'}
 ]);
});

test('video markers have no fixed count limit and do not consume the next paragraph',()=>{
 const markers=Array.from({length:12},(_,i)=>`公式動画：https://youtu.be/${String(i).padStart(11,'0')}`);
 const segments=articleContentSegments({article_body:markers.join('\n\n')+'\n最後の文章。'});
 assert.equal(segments.filter(p=>p.type==='video').length,12);
 assert.deepEqual(segments.at(-1),{type:'text',text:'最後の文章。'});
});
