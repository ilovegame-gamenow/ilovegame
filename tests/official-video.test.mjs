import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId} from '../game-source-utils.js';
import {officialVideo} from '../official-video.js';
import {roundupPreview} from '../weekly-roundup-preview-data.js';
test('official video parser accepts exact YouTube hosts and rejects injected or ambiguous embed URLs',()=>{
 for(const url of ['https://youtu.be/Tb7mUhUhNlA','https://www.youtube.com/watch?v=Tb7mUhUhNlA','https://www.youtube-nocookie.com/embed/Tb7mUhUhNlA'])assert.equal(youtubeVideoId(url),'Tb7mUhUhNlA');
 for(const url of ['javascript:alert(1)','http://youtu.be/Tb7mUhUhNlA','https://youtube.com.evil.invalid/watch?v=Tb7mUhUhNlA','https://www.youtube.com@evil.invalid/watch?v=Tb7mUhUhNlA','https://user@www.youtube.com/watch?v=Tb7mUhUhNlA','https://www.youtube.com/watch?v=short','https://youtu.be/Tb7mUhUhNlA/extra'])assert.equal(youtubeVideoId(url),null);
});
test('player does not load a third-party iframe until requested and keeps a direct video link',()=>{
 const original=globalThis.document;
 class Element{constructor(tag){this.tag=tag;this.children=[];this.listeners={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}addEventListener(type,handler){this.listeners[type]=handler;}}
 globalThis.document={createElement:tag=>new Element(tag)};
 try{
  assert.equal(officialVideo('Title','https://evil.invalid/watch?v=Tb7mUhUhNlA'),null);
  const section=officialVideo('<Title>','https://youtu.be/Tb7mUhUhNlA');
  const [player,link]=section.children;
  assert.equal(player.children[0].tag,'button');assert.equal(link.href,'https://www.youtube.com/watch?v=Tb7mUhUhNlA');
  player.children[0].listeners.click();
  const frame=player.children[0];assert.equal(frame.tag,'iframe');assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/Tb7mUhUhNlA?rel=0');assert.equal(frame.title,'<Title> 公式トレーラー');
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
test('roundup sample has sourced examples within the stated fixed week, not a generated published record',()=>{
 assert.equal(roundupPreview.article.id,undefined);
 assert.equal(roundupPreview.games.length,2);
 assert.deepEqual(roundupPreview.games.map(g=>g.date),['2026-11-05','2026-11-06']);
 for(const g of roundupPreview.games){assert.ok(g.date>=roundupPreview.start&&g.date<=roundupPreview.last);assert.ok(g.sources[0].url.startsWith('https://'));assert.ok(youtubeVideoId(g.video));assert.ok(g.platforms.length>0);}
});
