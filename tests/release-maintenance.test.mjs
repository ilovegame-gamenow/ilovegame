import test from 'node:test';
import assert from 'node:assert/strict';
import {handleReleaseMaintenance} from '../lib/release-maintenance.js';
import handler from '../api/editor-games.js';
import {releaseScheduleLabel} from '../release-maintenance-model.js';
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('schedule labels keep imprecise or delayed dates out of day labels',()=>{
 assert.equal(releaseScheduleLabel({status:'delayed',release_date:'2027-02-01',date_precision:'day'}),'延期・新日程は未定');
 assert.equal(releaseScheduleLabel({status:'cancelled'}),'発売中止');
 assert.equal(releaseScheduleLabel({status:'announced',release_date:'2027-02-01',date_precision:'month'}),'2027年2月予定');
 assert.equal(releaseScheduleLabel({status:'announced',release_date:'2027-02-03',date_precision:'day'}),'2027年2月3日');
});
test('maintenance stays off before migration and authenticated route rejects unsigned access',async()=>{
 const previous=process.env.GAME_RELEASE_MAINTENANCE_ENABLED;delete process.env.GAME_RELEASE_MAINTENANCE_ENABLED;
 try{
  const res=response();await handleReleaseMaintenance({method:'GET',query:{}},res,{});assert.equal(res.code,503);
  const unsigned=response();await handler({method:'POST',query:{resource:'release-maintenance'},headers:{},body:{action:'apply'}},unsigned);assert.equal(unsigned.code,401);
 }finally{if(previous===undefined)delete process.env.GAME_RELEASE_MAINTENANCE_ENABLED;else process.env.GAME_RELEASE_MAINTENANCE_ENABLED=previous;}
});
test('resolution passes exact microsecond token, uses a parameterized RPC and reports conflicts',async()=>{
 const original=globalThis.fetch,previous=process.env.GAME_RELEASE_MAINTENANCE_ENABLED;process.env.GAME_RELEASE_MAINTENANCE_ENABLED='true';
 const body={id:'00000000-0000-0000-0000-000000000001',action:'apply',expected_updated_at:'2026-11-04T15:00:00.123456+00:00'};
 let calls=0;globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://db.invalid/rest/v1/rpc/resolve_game_release_check');
  assert.deepEqual(JSON.parse(options.body),{p_id:body.id,p_expected_updated_at:body.expected_updated_at,p_decision:'apply'});
  return new Response('{}',{status:409});
 };
 try{
  for(const invalid of [{...body,source_url:'https://evil.invalid'}, {...body,expected_updated_at:'yesterday'}]){
   const res=response();await handleReleaseMaintenance({method:'POST',query:{},body:invalid},res,{url:'https://db.invalid',key:'test'});assert.equal(res.code,400);
  }
  assert.equal(calls,0);
  const res=response();await handleReleaseMaintenance({method:'POST',query:{},body},res,{url:'https://db.invalid',key:'test'});assert.equal(res.code,409);assert.equal(calls,1);
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.GAME_RELEASE_MAINTENANCE_ENABLED;else process.env.GAME_RELEASE_MAINTENANCE_ENABLED=previous;}
});
