import test from 'node:test';
import assert from 'node:assert/strict';
import {listDataArticles,deleteDataArticles,listRetention,setRetentionProtection} from '../lib/editor-data-management.js';
const row={id:1,status:'rejected',processing_status:'completed',updated_at:'2026-11-22T04:19:04.709027+00:00'};
const input=(articles=[row],includePublished=false)=>({articles,includePublished,confirmation:'完全削除 '+articles.length+'件'});
test('default list excludes published and in-flight rows',async()=>{
 const result=await listDataArticles('','',{},async(u,k,path)=>{
  const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('status'),'in.(pending,rejected)');assert.equal(q.get('processing_status'),'eq.completed');return {rows:[row],total:1};
 });assert.equal(result.body.articles.length,1);
});
test('published list requires explicit filter',async()=>{
 await listDataArticles('','',{status:'published'},async(u,k,path)=>{assert.equal(new URLSearchParams(path.split('?')[1]).get('status'),'eq.published');return {rows:[],total:0};});
});
test('delete validation rejects absent confirmation, repeated IDs, invalid versions and unconfirmed published selections without requests',async()=>{
 const never=()=>assert.fail('unexpected database request');
 for(const body of [{...input(),confirmation:''},input([row,row]),input([{...row,updated_at:'bad'}]),input([{...row,status:'published'}])]){
  assert.equal((await deleteDataArticles('','',body,never)).status,400);
 }
});
test('stale version, missing row, or processing status prevents delete',async()=>{
 for(const actual of [[],[{...row,updated_at:'2026-11-22T04:19:05+00:00'}],[{...row,processing_status:'chatgpt_queue_probe_processing_v1'}]]){
  let count=0;const result=await deleteDataArticles('','',input(),async()=>{assert.equal(++count,1);return actual;});
  assert.equal(result.status,409);
 }
});
test('delete uses exact versions and status; partial results identify both sets',async()=>{
 const other={...row,id:2};let count=0;
 const result=await deleteDataArticles('','',input([row,other]),async(u,k,path,options)=>{
  if(++count===1)return [row,other];
  assert.equal(options.method,'DELETE');assert.equal(options.headers.Prefer,'return=representation');
  const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('processing_status'),'eq.completed');
  assert.equal(q.get('or'),'(and(id.eq.1,status.eq.rejected,updated_at.eq.'+row.updated_at+'),and(id.eq.2,status.eq.rejected,updated_at.eq.'+row.updated_at+'))');
  return [{id:1}];
 });
 assert.deepEqual(result.body,{deletedIds:[1],remainingIds:[2]});
});
test('explicit published deletion remains subject to exact version and state',async()=>{
 const published={...row,status:'published'};let count=0;
 const result=await deleteDataArticles('','',input([published],true),async(u,k,path,options)=>{
  if(++count===1)return [published];assert.match(new URLSearchParams(path.split('?')[1]).get('or'),/status\.eq\.published/);return [{id:1}];
 });assert.deepEqual(result.body.deletedIds,[1]);
});
test('pagination uses exact filtered total and corrects an empty last page',async()=>{let calls=0;const result=await listDataArticles('','',{page:4},async(u,k,path,opts)=>{assert.equal(opts.countExact,true);const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('offset'),calls++===0?'60':'20');return {rows:calls===1?[]:[row],total:21};});assert.equal(result.body.page,2);assert.equal(result.body.total,21);assert.equal(result.body.limit,20);assert.equal(result.body.hasMore,false);});

test('retention overview uses the read-only RPC',async()=>{const r=await listRetention('','',{},async(u,k,path,opts)=>{assert.equal(path,'rpc/editor_retention_overview');assert.deepEqual(JSON.parse(opts.body),{p_page:1});return {total:0,articles:[],enabled:true,overdue:false};});assert.equal(r.body.page,1);});
test('protection changes only the selected current completed article',async()=>{const r=await setRetentionProtection('','',{id:1,status:'rejected',updated_at:row.updated_at,protected:true},async(u,k,path,opts)=>{const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('id'),'eq.1');assert.equal(q.get('updated_at'),'eq.'+row.updated_at);assert.equal(q.get('retention_protected'),'eq.false');assert.equal(opts.method,'PATCH');assert.equal(JSON.parse(opts.body).retention_protected,true);return [{id:1,retention_protected:true}];});assert.equal(r.status,200);});
