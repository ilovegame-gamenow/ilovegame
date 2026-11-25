import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('the shared detail renderer puts hardware above publication time and image',()=>{
  const context=vm.createContext({window:{innerWidth:800},GameImage:{getUrl:()=>'/image.png'},GameDate:{renderMeta:()=>'<div class="game-meta">2026/11/25 07:45 UP</div>'}});
  vm.runInContext(read('platform-display.js'),context);
  vm.runInContext(read('article-renderer.js'),context);
  const article={title:'記事',platforms:['PS5','Steam']};
  const html=context.window.GameArticle.render(article);
  assert.ok(html.indexOf('class="platform-badges"')>0);
  assert.ok(html.indexOf('class="platform-badges"')<html.indexOf('class="game-meta"'));
  assert.ok(html.indexOf('class="game-meta"')<html.indexOf('class="hero"'));
  assert.doesNotMatch(context.window.GameArticle.render({...article,platforms:[]}),/class="platform-badges"/);
  for(const file of ['article.html','editor-article.html'])assert.match(read(file),/GameArticle\.render\(/);
});
