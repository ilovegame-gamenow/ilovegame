import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../editor-news-loader.js',import.meta.url),'utf8');
const data={articles:[],page:1,limit:30,total:0,counts:{all:0,pending:0,published:0,rejected:0},sources:[{id:'all',label:'すべて',count:0}],filters:{status:'all',source:'all'}};
function loader(responses,{realTimers=false}={}){
 const calls=[];
 const context=vm.createContext({window:{},URLSearchParams,DOMException,TypeError,SyntaxError,setTimeout:realTimers?setTimeout:fn=>setTimeout(fn,0),clearTimeout,fetch:async(url,options)=>{
  calls.push({url,options});const result=responses.shift();if(result instanceof Error)throw result;if(!result)throw Error('Unexpected request');return result;
 }});
 vm.runInContext(script,context);
 return {load:options=>context.window.GameEditorNewsLoader.load({page:1,status:'all',source:'all',...options}),calls};
}
test('first-load server failure recovers automatically with the same authenticated read',async()=>{
 const l=loader([new Response('{}',{status:503}),new Response(JSON.stringify(data))]);let retried=0;
 const result=await l.load({onRetry:()=>retried++});assert.equal(result.total,0);assert.equal(retried,1);assert.equal(l.calls.length,2);
 assert.equal(l.calls[0].url,l.calls[1].url);
 for(const {options} of l.calls){assert.equal(options.method,'GET');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');}
});
test('initial network error and incomplete JSON can recover without reloading the page',async()=>{
 for(const initial of [new TypeError('fetch failed'),new Response('{broken')]){
  const l=loader([initial,new Response(JSON.stringify(data))]);assert.equal((await l.load()).page,1);assert.equal(l.calls.length,2);
 }
});
test('incomplete list response is not rendered and is retried',async()=>{
 const l=loader([new Response('{"articles":[]}'),new Response(JSON.stringify(data))]);assert.equal((await l.load()).limit,30);assert.equal(l.calls.length,2);
});
test('expired authentication and invalid filters are not retried',async()=>{
 for(const status of [401,400,403]){
  const l=loader([new Response('{}',{status})]);await assert.rejects(l.load(),error=>error.status===status);assert.equal(l.calls.length,1);
 }
});
test('persistent failures stop after three requests',async()=>{
 const l=loader(Array.from({length:3},()=>new Response('{}',{status:502})));let retries=0;
 await assert.rejects(l.load({onRetry:()=>retries++}),error=>error.status===502);assert.equal(l.calls.length,3);assert.equal(retries,2);
});
test('changing filters aborts an old retry before sending another request',async()=>{
 const controller=new AbortController();
 const l=loader([new Response('{}',{status:503})],{realTimers:true});
 await assert.rejects(l.load({signal:controller.signal,onRetry:()=>controller.abort()}),error=>error.name==='AbortError');assert.equal(l.calls.length,1);
});

test('dashboard displays initial articles after a transient failure without page reload',async()=>{
 class Node {
  constructor(){this.children=[];this.dataset={};this.listeners={};this.classList={toggle(){},add(){}};this.hidden=false;this.textContent='';}
  setAttribute(){} addEventListener(name,fn){this.listeners[name]=fn;}
  append(...nodes){this.children.push(...nodes);} appendChild(node){this.append(node);}
  replaceChildren(...nodes){this.children=[...nodes];} querySelector(){return null;} focus(){}
 }
 const ids=Object.fromEntries(['articlesList','message','retryArticles','pagination','paginationTop','allCount','pendingCount','publishedCount','rejectedCount','sourceFilters','sourceCountNote','statusCountNote','pendingRecovery'].map(id=>[id,new Node()]));
 const statusButtons=['all','pending','published','rejected'].map(value=>{const node=new Node();node.dataset.filter=value;return node;});
 const document={activeElement:null,getElementById:id=>ids[id],createElement:()=>new Node(),addEventListener(){},querySelectorAll:selector=>selector==='[data-filter]'?statusButtons:ids.sourceFilters.children};
 let calls=0;
 const initial={...data,total:1,counts:{all:1,pending:0,published:1,rejected:0},articles:[{id:1,title:'記事',status:'published',processing_status:'completed'}],sources:[{id:'all',label:'すべて',count:1},{id:'nintendo',label:'Nintendo',count:1}]};
 const context=vm.createContext({document,window:{location:{search:'',href:'https://site.invalid/editor-dashboard.html'},history:{replaceState(){}}},location:{search:'',pathname:'/editor-dashboard.html',href:'https://site.invalid/editor-dashboard.html'},history:{replaceState(){}},GameEditorSession:{start(){},expire(){throw Error('Unexpected login redirect');}},GameEditorRecovery:{renderPending(){}},GameNewsCard:{render:()=>'<article></article>'},GamePagination:{render:()=>new Node()},URL,URLSearchParams,AbortController,DOMException,TypeError,SyntaxError,console,sessionStorage:{getItem:()=>null,removeItem(){}},setTimeout:fn=>setTimeout(fn,0),clearTimeout,fetch:async()=>++calls===1?new Response('{}',{status:503}):new Response(JSON.stringify(initial))});
 vm.runInContext(script,context);context.GameEditorNewsLoader=context.window.GameEditorNewsLoader;
 const html=readFileSync(new URL('../editor-dashboard.html',import.meta.url),'utf8');
 vm.runInContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'),context);
 for(let i=0;i<20&&ids.allCount.textContent!==1;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(calls,2);assert.equal(ids.allCount.textContent,1);assert.equal(ids.publishedCount.textContent,1);assert.equal(ids.articlesList.children.length,1);assert.equal(ids.retryArticles.hidden,true);
});
