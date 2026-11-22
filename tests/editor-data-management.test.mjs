import test from 'node:test';
import assert from 'node:assert/strict';
import {listDataArticles,deleteDataArticles} from '../lib/editor-data-management.js';
const row={id:1,status:'rejected',processing_status:'completed',updated_at:'2026-11-22T04:19:04.709027+00:00'};
const input=(articles=[row],includePublished=false)=>({articles,includePublished,confirmation:'完全削除 '+articles.length+'件'});
test('default list excludes published and in-flight rows',async()=>{
 const result=await listDataArticles('','',{},async(u,k,path)=>{
  const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('status'),'in.(pending,rejected)');assert.equal(q.get('processing_status'),'eq.completed');return [row];
 });assert.equal(result.body.articles.length,1);
});
test('published list requires explicit filter',async()=>{
 await listDataArticles('','',{status:'published'},async(u,k,path)=>{assert.equal(new URLSearchParams(path.split('?')[1]).get('status'),'eq.published');return [];});
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