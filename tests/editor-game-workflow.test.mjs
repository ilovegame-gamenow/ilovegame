import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const context={window:{}};vm.runInNewContext(await readFile(new URL('../editor-game-workflow.js',import.meta.url),'utf8'),context);const {register}=context.window.GameCatalogWorkflow;
const game={id:'00000000-0000-0000-0000-000000000099',title:'Test',source_url:'https://example.org',source_type:'media',original_title:'',description:''};
test('article workflow creates and links using the returned work ID, while standalone only creates',async()=>{
 for(const articleId of [null,303]){const calls=[];const request=async(path,options)=>{calls.push(JSON.parse(options.body));return calls.length===1?{game:{...game,id:'00000000-0000-0000-0000-000000000098'}}:{ok:true};};const result=await register(request,game,articleId);assert.equal(result.game.title,'Test');assert.equal(calls.length,articleId===null?1:2);assert.equal(calls[0].game.id,game.id);if(articleId!==null)assert.deepEqual(calls[1],{action:'link',article_id:303,game_id:result.game.id});}
});
test('partial failure tells the editor to retry and reuses the creation ID without compensating deletes',async()=>{
 const requests=[];let fail=true;const request=async(path,options)=>{const body=JSON.parse(options.body);requests.push(body);if(body.action==='create')return {game};if(fail)throw Error('lost response');return {ok:true};};
 await assert.rejects(()=>register(request,game,303),/作品の登録は完了.*同じ入力/);fail=false;await register(request,game,303);
 assert.equal(requests.filter(x=>x.action==='create').length,2);assert.ok(requests.filter(x=>x.action==='create').every(x=>x.game.id===game.id));assert.ok(requests.every(x=>['create','link'].includes(x.action)));
});
test('expired session during either step stops the workflow without reporting success',async()=>{
 assert.equal(await register(async()=>null,game,303),null);let count=0;assert.equal(await register(async()=>++count===1?{game}:null,game,303),null);assert.equal(count,2);
});
