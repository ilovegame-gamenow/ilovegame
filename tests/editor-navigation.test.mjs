import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../editor-navigation.js',import.meta.url),'utf8');
const target='/editor-dashboard.html?source=nintendo&status=all&page=3';
function harness({referrer=`https://site.invalid${target}`,type='navigate',length=2,state=null,blocked=false}={}) {
 let now=1000,backs=0;
 const events={},storage=new Map();
 const history={length,state,replaceState(value){this.state=value;},back(){backs++;}};
 const context=vm.createContext({URL,URLSearchParams,Math,Date:{now:()=>now},window:{scrollY:480},location:{origin:'https://site.invalid',pathname:'/editor-article.html',search:`?id=1&return=${encodeURIComponent(target)}`},history,performance:{getEntriesByType:()=>[{type}]},document:{referrer,addEventListener:(name,fn)=>{events[name]=fn;}},sessionStorage:{getItem(key){if(blocked)throw Error('blocked');return storage.get(key)??null;},setItem(key,value){if(blocked)throw Error('blocked');storage.set(key,value);}}});
 vm.runInContext(script,context);
 function click(patch={}) {
  let prevented=false;
  const link={href:`https://site.invalid${target}`,target:'',hasAttribute:()=>false};
  events.click?.({target:{closest:()=>link},button:0,preventDefault(){prevented=true;},...patch});
  return prevented;
 }
 return {api:context.window.GameEditorNavigation,context,history,events,storage,click,advance:ms=>now+=ms,get backs(){return backs;}};
}
test('return link uses browser history for the matching dashboard entry and survives detail reload',()=>{
 const h=harness();h.api.prepareBack();assert.equal(h.click(),true);assert.equal(h.backs,1);
 const reload=harness({type:'reload',referrer:'https://site.invalid/editor-article.html',state:h.history.state});
 reload.api.prepareBack();assert.equal(reload.click(),true);assert.equal(reload.backs,1);
});
test('direct visits, unrelated referrers and new tabs use the normal safe link',()=>{
 for(const options of [{referrer:''},{referrer:'https://external.invalid'},{referrer:'https://site.invalid/editor-dashboard.html?status=rejected'},{length:1},{type:'reload'}]){
  const h=harness(options);h.api.prepareBack();assert.equal(h.click(),false);assert.equal(h.backs,0);
 }
 const h=harness();h.context.location.search='?return=https://external.invalid';h.api.prepareBack();assert.equal(h.events.click,undefined);
});
test('modified clicks preserve open-in-new-tab behavior',()=>{
 const h=harness();h.api.prepareBack();
 for(const patch of [{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}])assert.equal(h.click(patch),false);
 assert.equal(h.backs,0);
});
test('unchanged recent list is reused, writes and old lists trigger refresh',()=>{
 const h=harness(),list=h.api.createListState();
 assert.equal(list.needsReload(),true);
 const initial=list.capture();list.loaded(initial);assert.equal(list.needsReload(),false);
 h.api.markChanged();assert.equal(list.needsReload(),true);
 list.loaded(list.capture());assert.equal(list.needsReload(),false);
 h.advance(60000);assert.equal(list.needsReload(),true);
});
test('a write during loading cannot be hidden by the completed response',()=>{
 const h=harness(),list=h.api.createListState(),snapshot=list.capture();
 h.api.markChanged();list.loaded(snapshot);assert.equal(list.needsReload(),true);
});
test('unavailable storage falls back to refresh without breaking article navigation',()=>{
 const h=harness({blocked:true}),list=h.api.createListState();
 list.loaded(list.capture());assert.equal(list.needsReload(),true);
 assert.doesNotThrow(()=>h.api.markChanged());assert.doesNotThrow(()=>h.api.openArticle(7));
 assert.match(h.context.location.href,/editor-article.html\?id=7&return=/);
});
test('both save and status helpers invalidate only after a successful mutation',async()=>{
 for(const [file,api,args] of [['editor-draft-client.js','GameEditorSave',{id:1,action:'apply'}],['editor-status.js','GameEditorStatus',1]]) {
  let changes=0,status=200,expired=0;
  const context=vm.createContext({window:{GameEditorNavigation:{markChanged(){changes++;}},GameEditorSession:{expire(){expired++;}}},fetch:async()=>({ok:status===200,status,json:async()=>({})})});
  vm.runInContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
  const run=()=>file==='editor-draft-client.js'?context.window[api].save(args):context.window[api].update(args,'published');
  assert.equal(await run(),true);assert.equal(changes,1);
  status=503;await assert.rejects(run());assert.equal(changes,1);
  status=401;assert.equal(await run(),false);assert.equal(expired,1);assert.equal(changes,1);
 }
});

test('catalog returns to its original article history entry with the dashboard return intact',()=>{
 const article='/editor-article.html?id=42&return=%2Feditor-dashboard.html%3Fpage%3D3';
 const h=harness({referrer:`https://site.invalid${article}`});
 h.context.location.pathname='/editor-games.html';
 h.context.location.search=`?article_id=42&return=${encodeURIComponent(article)}`;
 h.api.prepareBack({targetPath:'/editor-article.html',selector:'#catalogBack'});
 let prevented=false;
 h.events.click({button:0,target:{closest(selector){assert.equal(selector,'#catalogBack');return {href:`https://site.invalid${article}`,target:'',hasAttribute:()=>false};}},preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(h.backs,1);
});
