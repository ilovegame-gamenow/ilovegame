import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{},URLSearchParams});
vm.runInContext(readFileSync(new URL('../editor-game-selection.js',import.meta.url),'utf8'),context);
const {collect,view}=context.window.GameSelection;
test('selector includes titles beyond the first page while preserving following and article filters',async()=>{
 const calls=[];
 const result=await collect(async path=>{
  const q=new URL(path,'https://site.invalid').searchParams;calls.push(q);
  return {games:q.get('page')==='1'?Array.from({length:20},(_,i)=>({id:`g${i}`,title:`Game ${i}`})):[{id:'g20',title:'Last'}],linkedGames:[{id:'linked'}],hasMore:q.get('page')==='1'};
 },'favorites',42);
 assert.equal(result.games.length,21);assert.equal(result.games[20].title,'Last');
 assert.equal(result.linkedGames[0].id,'linked');assert.equal(calls.length,2);
 for(const q of calls){assert.equal(q.get('filter'),'favorites');assert.equal(q.get('q'),'');assert.equal(q.get('article_id'),'42');}
});
test('same-title games are selected by ID and choosing all resets valid pagination',()=>{
 const games=Array.from({length:21},(_,i)=>({id:`g${i}`,title:'Same title'}));
 let result=view(games,'g20',2);assert.equal(result.games.length,1);assert.equal(result.games[0].id,'g20');assert.equal(result.page,1);assert.equal(result.hasMore,false);
 result=view(games,'',2);assert.equal(result.games[0].id,'g20');assert.equal(result.page,2);
 result=view(games.filter(g=>g.id!=='g20'),'g20',2);assert.equal(result.selectedId,'');assert.equal(result.page,1);assert.equal(result.games.length,20);
});
test('expired sessions return without partial choices; changing pages cannot silently omit duplicate rows',async()=>{
 assert.equal(await collect(async()=>null,'managed'),null);
 await assert.rejects(collect(async()=>({games:[{id:'same'}],linkedGames:[],hasMore:true}),'managed'),/作品一覧が更新/);
});
