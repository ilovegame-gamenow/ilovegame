import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { settingRules, validateSettings, toNewsConfig } from '../lib/site-settings.js';
import { determinePublicationPolicy } from '../lib/publication-policy.js';
import featured from '../api/featured-news.js';
import { processNewsQueue } from '../lib/news-processor.js';
const defaults = Object.fromEntries(Object.entries(settingRules).map(([key,rule]) => [key,rule.defaultValue]));
const response = () => ({ headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;} });
async function mockFetch(fn, run) { const previous=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=previous;} }
process.env.SUPABASE_URL='https://db.invalid';
process.env.SUPABASE_SECRET_KEY='server-key';
process.env.SUPABASE_PUBLISHABLE_KEY='public-key';

test('news settings validate bounds, editorial text, and publication thresholds together', () => {
 assert.ok(validateSettings(defaults));
 for (const patch of [
  {publish_threshold:50,no_article_threshold:50}, {breaking_threshold:101},
  {breaking_max_age_hours:0}, {pickup_max_articles:13}, {date_highlight_hours:24},
  {evaluation_guidelines:'  '}, {evaluation_guidelines:'a'.repeat(6001)}, {evaluation_guidelines:['rule']}
 ]) assert.equal(validateSettings({...defaults,...patch}),null);
 assert.ok(validateSettings({...defaults,pickup_threshold:0}));
});
test('publication thresholds follow saved settings at exact boundaries', () => {
 const config=toNewsConfig({...defaults,publish_threshold:65,no_article_threshold:30});
 for(const [score,expected] of [[0,'rejected'],[30,'rejected'],[31,'review'],[64,'review'],[65,'published'],[100,'published']]) assert.equal(determinePublicationPolicy(score,config),expected);
});
test('featured selection uses saved score, age, count and excludes breaking duplicates without writes', async () => {
 const settings={...defaults,breaking_threshold:75,breaking_max_age_hours:72,pickup_threshold:60,pickup_max_articles:2};
 await mockFetch(async(url,options={})=>{
  assert.equal(options.method,undefined);
  const u=new URL(url);
  if(u.pathname.endsWith('/site_settings')) {
   assert.equal(options.headers.apikey,'server-key');return new Response(JSON.stringify([settings]));
  }
  assert.equal(options.headers.apikey,'public-key');assert.equal(u.searchParams.get('status'),'eq.published');
  if(u.searchParams.has('site_published_at')) {
   assert.equal(u.searchParams.get('importance'),'gte.75');
   assert.ok(Math.abs(Date.now()-Date.parse(u.searchParams.get('site_published_at').slice(4))-72*3600000)<2000);
   return new Response('[{"id":1}]');
  }
  assert.equal(u.searchParams.get('importance'),'gte.60');assert.equal(u.searchParams.get('limit'),'3');
  return new Response('[{"id":1},{"id":2},{"id":3}]');
 },async()=>{const res=response();await featured({},res);assert.equal(res.code,200);assert.equal(res.body.breaking.id,1);assert.deepEqual(res.body.pickup.map(a=>a.id),[2,3]);assert.equal(res.headers['Cache-Control'],'no-store');});
});
test('date highlight remains fixed at 24 hours without a settings request', () => {
 const context=vm.createContext({document:{createElement:()=>({}),head:{appendChild(){}}},fetch:()=>{throw Error('Unexpected settings request');},console});
 vm.runInContext(readFileSync(new URL('../date-utils.js',import.meta.url),'utf8'),context);
 assert.equal(vm.runInContext('GameDate.color(new Date(Date.now()-23*3600000))',context),'#ff7a2f');
 assert.equal(vm.runInContext('GameDate.color(new Date(Date.now()-25*3600000))',context),'#8a817a');
 assert.equal(vm.runInContext('GameDate.color(new Date(Date.now()+3600000))',context),'#8a817a');
});
test('queue uses saved editorial guidelines and publication policy only for pending work', async () => {
 const patches=[];let scoringCalls=0;
 const settings={...defaults,publish_threshold:65,no_article_threshold:30,evaluation_guidelines:'体験版を特に重視する\n映画は低めに評価する'};
 await mockFetch(async(url,options={})=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/site_settings'))return new Response(JSON.stringify([settings]));
  if(u.pathname.endsWith('/articles')){
   if(options.method==='PATCH'){assert.equal(u.searchParams.get('id'),'eq.42');patches.push(JSON.parse(options.body));return new Response('');}
   assert.equal(u.searchParams.get('processing_status'),'eq.pending');assert.equal(u.searchParams.get('manually_reviewed'),'not.is.true');
   return new Response('[{"id":42,"source_title":"体験版が登場","source_url":"https://source.invalid/news"}]');
  }
  if(u.hostname==='source.invalid')return new Response('<main>新しいゲームの体験版が登場しました。</main>');
  if(u.hostname==='api.openai.com'){
   const data=JSON.parse(options.body);
   if(data.text.format.name==='game_news_score'){
    scoringCalls++;assert.match(data.instructions,/体験版を特に重視する/);assert.match(data.instructions,/映画は低め/);
    return new Response(JSON.stringify({status:'completed',output_text:'{"importance":70}'}));
   }
   return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({title:'体験版が登場',summary:'概要',article_body:'記事本文',ilovegame_point:'注目ポイント'})}));
  }
  throw Error('Unexpected request '+url);
 },async()=>{
  const result=await processNewsQueue({supabaseUrl:process.env.SUPABASE_URL,supabaseKey:'server-key',openaiKey:'test-key'});
  assert.equal(result.results[0].status,'published');assert.equal(scoringCalls,1);assert.equal(patches.at(-1).importance,70);
 });
});
