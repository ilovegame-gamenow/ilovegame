import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationRequest,applyResearchVerification,verifyResearchResult } from '../lib/game-research-verifier.js';
import { researchPassages } from '../lib/game-research-ai.js';
import { executeSteamResearch } from '../lib/game-researcher.js';
const source={appid:123,description:'Ordinary clover can be sold. Rare finds are protected for the display cabinet instead of being sold.'};
const item={appid:123,selected:true,description:'クローバーを集めるゲーム。',reason:'希少種を売るか展示するか選べそう。',evidence:source.description};
const draft={items:[item],usage:{input_tokens:100,output_tokens:50}};
const check={appid:123,description:'supported',reason:'unsupported',note:'希少種を売る選択肢は出典にありません。'};
async function withFetch(fetch,run){const old=globalThis.fetch;globalThis.fetch=fetch;try{await run();}finally{globalThis.fetch=old;}}

test('fact check includes the full source and checks factual claims inside opinions',()=>{
 const request=buildVerificationRequest([source],[item]);
 assert.equal(request.store,false);assert.equal(request.tools,undefined);assert.equal(request.max_output_tokens,1500);
 assert.equal(JSON.parse(request.input)[0].source,source.description);
 assert.equal(JSON.parse(request.input)[0].reason,item.reason);
 assert.ok(request.instructions.includes('否定の反転'));assert.ok(request.instructions.includes('短い引用が一致するだけ'));
 assert.equal(buildVerificationRequest([source],[{...item,selected:false}]),null);
});
test('unsupported or uncertain text is excluded without inventing a replacement',()=>{
 for(const verdict of ['unsupported','uncertain']){
  const items=applyResearchVerification([item],{checks:[{...check,reason:verdict}]});
  assert.equal(items[0].selected,false);assert.equal(items[0].reason,item.reason);
 }
 assert.equal(applyResearchVerification([item],{checks:[{...check,reason:'supported'}]})[0].selected,true);
 const ignored={...item,appid:124,selected:false};
 assert.equal(applyResearchVerification([item,ignored],{checks:[check]})[1],ignored);
});
test('incomplete, duplicate, foreign and malformed verdicts fail closed',()=>{
 for(const checks of [[],[check,check],[{...check,appid:999}],[{...check,reason:'probably'}],[{...check,note:'x'.repeat(201)}]]){
  assert.throws(()=>applyResearchVerification([item],{checks}));
 }
 assert.throws(()=>applyResearchVerification([item,{...item,appid:124}],{checks:[check,check]}));
});
test('verification records its verdict, sums both usages and makes only one checking call',async()=>{
 let calls=0;
 await withFetch(async()=>{calls++;return Response.json({id:'verify-test',status:'completed',output_text:JSON.stringify({checks:[check]}),usage:{input_tokens:120,output_tokens:30}});},async()=>{
  const result=await verifyResearchResult([source],draft,'fake-key');
  assert.equal(result.items[0].selected,false);assert.deepEqual(result.verification.checks,[check]);
  assert.deepEqual(result.usage,{input_tokens:220,output_tokens:80});assert.deepEqual(result.generation_usage,draft.usage);
 });assert.equal(calls,1);
 await withFetch(()=>{throw Error('Must not call AI');},async()=>{
  const result=await verifyResearchResult([source],{...draft,items:[{...item,selected:false}]},'fake-key');
  assert.deepEqual(result.verification.checks,[]);
 });
});
test('a failed verification request never saves any candidate and never retries',async()=>{
 const calls=[];
 await withFetch(async(url,options={})=>{
  calls.push(url);
  if(url.includes('/game_research_runs?'))return Response.json([{status:'prepared',sources:[source]}]);
  if(url.endsWith('/claim_game_research'))return Response.json({sources:[source]});
  if(url.includes('openai.com')){
   if(JSON.parse(options.body).text.format.name==='steam_fact_check')return new Response('{}',{status:503});
   return Response.json({status:'completed',output_text:JSON.stringify({items:[{...item,evidence_index:0}]})});
  }
  assert.ok(url.endsWith('/fail_game_research'));return new Response(null,{status:204});
 },async()=>{await assert.rejects(()=>executeSteamResearch('https://db.invalid','fake-db','run-test','fake-ai'));});
 assert.equal(calls.filter(url=>url.includes('openai.com')).length,2);
 assert.ok(!calls.some(url=>url.endsWith('/complete_game_research')));
});
test('source passages retain context and preserve all text including multilingual punctuation',()=>{
 const text='Two cells. One wall. Two people must cooperate using voice. '+ '声で伝え合い、別々の情報を組み合わせる。'.repeat(25)+'𠮷';
 const passages=researchPassages(text);
 assert.notEqual(passages[0],'Two cells.');assert.ok(passages[0].includes('cooperate'));
 assert.equal(passages.join(''),text);assert.ok(passages.every(p=>p.length<=500));
});
