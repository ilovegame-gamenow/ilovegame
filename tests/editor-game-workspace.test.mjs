import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function workspace(hash='',search=''){
 const eventTarget=extra=>({events:{},addEventListener(name,fn){this.events[name]=fn;},...extra});
 const buttons=['manage','find'].map(workspace=>eventTarget({dataset:{workspace},setAttribute(k,v){this[k]=v;}}));
 const tabs=eventTarget({querySelectorAll:()=>buttons}),finder={},managed={},findTitle={focus(){this.focused=true;}},followingFilter={};
 const nodes={workspaceTabs:tabs,finderPanel:finder,managedPanel:managed,findTitle,followingFilter};
 const location={hash,search},window=eventTarget(),document=eventTarget({getElementById:id=>nodes[id],dispatchEvent(){}});
 vm.runInNewContext(readFileSync(new URL('../editor-game-workspace.js',import.meta.url),'utf8'),{location,window,document,URLSearchParams,CustomEvent:class {}});
 return {tabs,buttons,finder,managed,location,window,document,findTitle};
}
test('active workspace and visible panel stay in sync on clicks and history navigation',()=>{
 const s=workspace();
 function check(find){assert.equal(s.buttons[0]['aria-pressed'],String(!find));assert.equal(s.buttons[1]['aria-pressed'],String(find));assert.equal(s.finder.hidden,!find);assert.equal(s.managed.hidden,find);}
 check(false);s.buttons[1].events.click();check(true);
 s.location.hash='#manage';s.window.events.hashchange();check(false);
 s.document.events['game-finder-open']({detail:{title:'テスト'}});check(true);assert.equal(s.findTitle.value,'テスト');
 s.document.events['game-management-open']({detail:{title:'テスト'}});check(false);
});
test('article-linking mode does not switch workspace',()=>{const s=workspace('#find','?article_id=1');assert.equal(s.tabs.hidden,true);assert.equal(s.managed.hidden,undefined);});
