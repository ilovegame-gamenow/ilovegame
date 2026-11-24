import test from 'node:test';
import assert from 'node:assert/strict';
import {createInternalSourceEvidenceHandler,isInternalDeployment} from '../lib/internal-source-evidence-handler.js';
const valid={VERCEL:'1',VERCEL_PROJECT_ID:'prj_YN8oB1rGiW2n7r1oOWXwvSGkbCMX',VERCEL_ENV:'production'};
const makeRes=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('fails closed outside dedicated production project',async()=>{
 for(const env of [{},{...valid,VERCEL_PROJECT_ID:'prj_other'},{...valid,VERCEL_ENV:'preview'}]){
  const res=makeRes();await createInternalSourceEvidenceHandler({env,article:()=>assert.fail('must not fetch')})({method:'GET',query:{source:'prtimes',id:'000000175.000147608',include_text:'1'}},res);
  assert.equal(res.code,403);assert.equal(res.headers['Cache-Control'],'private, no-store');
 }
 assert.ok(isInternalDeployment(valid));
});
test('internal text only with explicit request and no caching',async()=>{
 for(const includeText of [undefined,'1']){
  const res=makeRes();const q={source:'prtimes',id:'000000175.000147608'};if(includeText)q.include_text=includeText;
  await createInternalSourceEvidenceHandler({env:valid,article:async(s,id,opts)=>({body:{available:true,...(opts.includeText?{text:'test'}:{})}})})({method:'GET',query:q},res);
  assert.equal(res.code,200);assert.equal(res.body.body.text,includeText?'test':undefined);assert.equal(res.headers['Vercel-CDN-Cache-Control'],'no-store');
 }
});
test('invalid input never reaches upstream',async()=>{
 const handler=createInternalSourceEvidenceHandler({env:valid,article:()=>assert.fail('must not fetch'),list:()=>assert.fail('must not fetch')});
 for(const query of [{source:'prtimes',url:'https://example.com'},{source:'prtimes',id:'https://example.com'},{source:'prtimes',include_text:'1'},{source:['nintendo','prtimes']},{source:'playstation',page:'2'}]){
  const res=makeRes();await handler({method:'GET',query},res);assert.equal(res.code,400);
 }
});
test('parallel source lists preserve results when one fails',async()=>{
 const started=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const handler=createInternalSourceEvidenceHandler({env:valid,list:async source=>{started.push(source);if(started.length===3)release();await gate;if(source==='xbox')throw Error('Unavailable');return {source,items:[]};}});
 const res=makeRes();await handler({method:'GET',query:{sources:'nintendo,xbox,steam'}},res);
 assert.deepEqual(started,['nintendo','xbox','steam']);assert.equal(res.code,200);assert.deepEqual(res.body.results.map(r=>[r.source,r.ok]),[['nintendo',true],['xbox',false],['steam',true]]);
});
test('parallel source lists reject invalid and ambiguous inputs',async()=>{
 const handler=createInternalSourceEvidenceHandler({env:valid,list:()=>assert.fail('must not fetch')});
 for(const query of [{sources:'nintendo,nintendo'},{sources:'xbox,unknown'},{sources:'steam',id:'123'},{sources:'steam',source:'steam'},{sources:'steam',url:'https://example.com'},{sources:'steam',include_text:'1'},{sources:['steam']},{sources:''}]){const res=makeRes();await handler({method:'GET',query},res);assert.equal(res.code,400);}
});
