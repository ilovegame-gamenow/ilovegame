import test from 'node:test';
import assert from 'node:assert/strict';
import { getEditorNews, parseEditorNewsQuery } from '../lib/editor-news-repository.js';
import editorNews from '../api/editor-news.js';
import { createEditorToken } from '../lib/editor-auth.js';
const rows = () => [
  ...['published','published','published','rejected'].map((status,i)=>({id:i+1,source_name:'Nintendo',status,platforms:['PS5']})),
  ...['published','published','rejected','pending'].map((status,i)=>({id:i+5,source_name:'PlayStation',status})),
  {id:9,source_name:null,status:'published'}
];
async function database(data, run) {
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  assert.equal(options.method,undefined,'listing is read-only');
  const params=new URL(url).searchParams;calls.push(params);
  let matched=data.filter(row=>!params.has('status')||`eq.${row.status}`===params.get('status'));
  if(params.has('source_name')) matched=matched.filter(row=>`eq.${row.source_name}`===params.get('source_name'));
  if(params.has('or')) {
   assert.equal(params.get('or'),'(source_name.is.null,source_name.not.in.("Nintendo","PlayStation"))');
   matched=matched.filter(row=>!['Nintendo','PlayStation'].includes(row.source_name));
  }
  const offset=Number(params.get('offset')||0),limit=Number(params.get('limit'));
  const status=offset>0&&offset>=matched.length?416:200;
  return new Response(JSON.stringify(status===416?{}:matched.sort((a,b)=>b.id-a.id).slice(offset,offset+limit)),{status,headers:{'content-range':`*/${matched.length}`}});
 };
 try { await run(calls); } finally { globalThis.fetch=original; }
}
const query = patch => ({supabaseUrl:'https://db.invalid',supabaseKey:'test',status:'all',source:'all',page:1,limit:2,...patch});

test('source and publication filters combine in list, counters and corrected pagination', async()=>{
 await database(rows(),async calls=>{
  const result=await getEditorNews(query({source:'playstation',status:'published',page:99,limit:1}));
  assert.equal(result.page,2);assert.equal(result.total,2);assert.equal(result.articles.length,1);
  assert.ok(result.articles.every(row=>row.source_name==='PlayStation'&&row.status==='published'));
  assert.deepEqual(result.counts,{all:4,pending:1,published:2,rejected:1});
  assert.deepEqual(Object.fromEntries(result.sources.map(s=>[s.id,s.count])),{all:6,nintendo:3,playstation:2,other:1});
  assert.deepEqual(result.filters,{status:'published',source:'playstation'});
  const pages=calls.filter(p=>p.has('offset'));
  assert.equal(pages.length,2);
  assert.ok(pages.every(p=>p.get('source_name')==='eq.PlayStation'&&p.get('status')==='eq.published'));
  assert.equal(pages[1].get('offset'),'1');
 });
});
test('all manufacturers includes unclassified articles and other remains selectable',async()=>{
 await database(rows(),async()=>{
  const all=await getEditorNews(query({limit:100}));
  assert.equal(all.total,9);assert.equal(all.articles.length,9);
  const other=await getEditorNews(query({source:'other',status:'published'}));
  assert.deepEqual(other.articles.map(a=>a.id),[9]);assert.equal(other.counts.all,1);
 });
});
test('source classification uses the collection source, not listed game platforms',async()=>{
 await database(rows(),async()=>{
  const result=await getEditorNews(query({source:'nintendo',limit:100}));
  assert.equal(result.total,4);assert.ok(result.articles.every(a=>a.source_name==='Nintendo'));
  assert.ok(result.articles.every(a=>a.platforms.includes('PS5')));
 });
});
test('empty combined filters and status changes refresh counters without hiding makers',async()=>{
 const data=rows();
 await database(data,async()=>{
  const before=await getEditorNews(query({source:'playstation',status:'pending'}));assert.equal(before.total,1);
  data.find(row=>row.id===8).status='published';
  const after=await getEditorNews(query({source:'playstation',status:'pending',page:10}));
  assert.equal(after.total,0);assert.equal(after.page,1);assert.deepEqual(after.articles,[]);
  assert.equal(after.counts.pending,0);assert.equal(after.counts.published,3);
  assert.deepEqual(after.sources.map(s=>[s.id,s.count]),[['all',0],['nintendo',0],['playstation',0]]);
 });
});
test('invalid filters and unauthenticated calls never reach the database',async()=>{
 for(const query of [{source:'xbox'},{source:'__proto__'},{source:['nintendo']},{source:'nintendo,status.eq.published'},{page:['2']},{status:'unknown'}])assert.equal(parseEditorNewsQuery(query),null);
 assert.deepEqual(parseEditorNewsQuery({}),{source:'all',status:'all',page:1});
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected database call');};
 process.env.EDITOR_SECRET='filters-test';
 const cookie=`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`;
 try{
  for(const [headers,query,expected] of [[{}, {source:'nintendo'},401],[{cookie},{source:'invalid'},400]]){
   const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
   await editorNews({method:'GET',headers,query},res);assert.equal(res.code,expected);
  }
 }finally{globalThis.fetch=original;}
});
