import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('public article and editor share the same width and horizontal gutters',()=>{
  assert.match(read('article.html'),/<body class="public-site-page article-detail-page">/);
  assert.match(read('editor-article.html'),/<body data-page="editor">/);
  const css=read('header.css');
  assert.match(css,/:is\(body\[data-page="editor"\],body\.public-site-page\.article-detail-page\)>main\{[^}]*max-width:1200px;[^}]*width:100%;[^}]*padding-inline:20px;/);
});

test('editor article starts with the preview and keeps a single return link below',()=>{
  const html=read('editor-article.html');
  assert.doesNotMatch(html,/data-back-mirror="editorBackLink"/);
  assert.match(html,/id="editorBackLink"[^>]*>\s*← 一覧に戻る/);
  assert.match(read('article.html'),/← 一覧に戻る/);
  assert.match(html,/GameArticle\.render\([\s\S]*?id="editorBackLink"/);
});
