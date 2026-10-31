import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import handler from '../api/editor-save.js';
import { createEditorToken } from '../lib/editor-auth.js';
const baseline={title:'元タイトル',summary:'概要',article_body:'本文',ilovegame_point:'注目'};
const changed={...baseline,title:'編集中タイトル',article_body:'途中まで書いた本文♪'};
const article={id:7,...baseline,status:'published'};
const timestamp='2026-11-01T01:00:00.000Z';
function browser({draft=null,storageFails=false,fetch=async()=>{throw Error('Unexpected network request');}}={}){
 const values=new Map();let fail=storageFails;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key),get length(){return values.size;},key:index=>[...values.keys()][index]};
 const window=new EventTarget(),document=new EventTarget();document.hidden=false;
 const fields=Object.fromEntries(Object.entries(draft||baseline).filter(([key])=>Object.hasOwn(baseline,key)).map(([name,value])=>[name,{value}]));
 const form=new EventTarget();form.hidden=false;form.elements={namedItem:name=>fields[name]};
 const notice={hidden:true,textContent:'',parentElement:{hidden:true}},loginLink={hidden:true};
 const redirects=[];let ending=false;
 const context=vm.createContext({window,document,localStorage:storage,fetch,Date,Math,Event,console,location:{replace:url=>redirects.push(url)}});
 vm.runInContext(readFileSync(new URL('../editor-session.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../editor-recovery.js',import.meta.url),'utf8'),context);
 const api=window.GameEditorRecovery;
 const controller=api.attach({id:7,form,baseline:draft||baseline,draftUpdatedAt:draft?.updated_at,getRegenerated:()=>regenerated,notice,loginLink,onExpired:()=>{ending=true;}});
 let regenerated=false;
 const edit=(data=changed)=>{for(const [name,value] of Object.entries(data))fields[name].value=value;form.dispatchEvent(new Event('input'));};
 return {api,window,document,form,fields,notice,loginLink,redirects,controller,storage,values,context,edit,setRegenerated:value=>{regenerated=value;},setStorageFailure:value=>{fail=value;},ending:()=>ending};
}

test('typing and AI replacements survive session expiry and pagehide without server writes',()=>{
 const b=browser();b.edit();b.setRegenerated(true);b.controller.snapshot();
 b.window.GameEditorSession.expire();b.window.dispatchEvent(new Event('pagehide'));
 const record=b.api.read(7);assert.equal(record.content.article_body,changed.article_body);assert.equal(record.reason,'expired');assert.equal(record.regenerated,true);
 assert.deepEqual(b.redirects,['/editor.html']);assert.equal(b.ending(),true);
});
test('next authenticated visit restores and saves only a draft with the recorded baseline',async()=>{
 const calls=[];
 const b=browser({fetch:async(url,options)=>{
  calls.push({url,...options});const body=JSON.parse(options.body);
  assert.equal(body.action,'recover');assert.equal(body.expectedDraftUpdatedAt,null);assert.deepEqual(body.baseContent,baseline);
  return new Response(JSON.stringify({ok:true,draft:{article_id:7,...changed,updated_at:timestamp}}));
 }});
 b.edit();b.window.GameEditorSession.expire();const result=await b.api.restore(article,null);
 assert.equal(calls.length,1);assert.equal(result.savedDraft.title,changed.title);assert.equal(b.api.read(7),null);assert.match(result.message,/ログイン期限切れ/);assert.match(result.message,/下書きとして自動保存/);
});
test('a newer server draft is never overwritten by automatic recovery',async()=>{
 const b=browser();b.edit();const newer={...baseline,title:'別画面で保存した下書き',updated_at:timestamp};
 const result=await b.api.restore(article,newer);
 assert.equal(result.requiresReview,true);assert.equal(result.item.content.title,changed.title);assert.ok(b.api.read(7));
});
test('recovery request conflict and network failure retain the device copy',async()=>{
 for(const status of [409,503]){
  const b=browser({fetch:async()=>new Response('{}',{status})});b.edit();
  const result=await b.api.restore(article,null);assert.ok(b.api.read(7));assert.equal(result.savedDraft,undefined);
  if(status===409)assert.equal(result.requiresReview,true);
 }
});
test('storage failure blocks redirect and gives a separate-tab login path',()=>{
 const b=browser({storageFails:true});b.edit();b.window.GameEditorSession.expire();
 assert.deepEqual(b.redirects,[]);assert.equal(b.notice.parentElement.hidden,false);assert.equal(b.loginLink.hidden,false);assert.equal(b.ending(),false);
 b.setStorageFailure(false);b.window.GameEditorSession.expire();assert.deepEqual(b.redirects,['/editor.html']);assert.ok(b.api.read(7));
});
test('save API expiry captures current input before redirecting',async()=>{
 const b=browser({fetch:async()=>new Response('{}',{status:401})});b.edit();
 vm.runInContext(readFileSync(new URL('../editor-save.js',import.meta.url),'utf8'),b.context);
 assert.equal(await b.window.GameEditorSave.save({id:7,...changed}),false);
 assert.equal(b.api.read(7).reason,'expired');assert.deepEqual(b.redirects,['/editor.html']);
});
test('clearing an older copy does not remove newer input saved by another tab',()=>{
 const b=browser();b.edit();const key=[...b.values.keys()][0];const newer=JSON.parse(b.values.get(key));newer.token='newer-token';newer.content.title='別タブの編集';b.values.set(key,JSON.stringify(newer));
 b.controller.clear();assert.equal(b.api.read(7).content.title,'別タブの編集');
});
test('explicit cancellation or saving can clear a copy without pagehide recreating it',()=>{
 const b=browser();b.edit();b.controller.clear();b.form.hidden=true;b.window.dispatchEvent(new Event('pagehide'));assert.equal(b.api.read(7),null);
});
test('already saved draft is acknowledged without an unnecessary write',async()=>{
 const draft={...baseline,updated_at:timestamp};const b=browser({draft});b.edit();
 const result=await b.api.restore(article,{...draft,...changed});assert.equal(result.item,null);assert.match(result.message,/下書きに保存済み/);assert.equal(b.api.read(7),null);
});
test('matching public content is not described as a saved draft',async()=>{
 const b=browser();b.edit();const result=await b.api.restore({...article,...changed},null);
 assert.match(result.message,/公開版と一致/);assert.doesNotMatch(result.message,/下書きに保存済み/);
});
test('malformed local records are ignored',async()=>{
 const b=browser();b.edit();const key=[...b.values.keys()][0];b.values.set(key,'{bad');assert.equal(b.api.read(7),null);assert.equal(await b.api.restore(article,null),null);
});

process.env.EDITOR_SECRET='recovery-test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test-key';
async function recover(body,responses,authenticated=true){
 const calls=[],original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),...options});assert.ok(responses.length);return new Response(JSON.stringify(responses.shift()));};
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 try{
  await handler({method:'POST',headers:{cookie:authenticated?`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`:''},body:{id:7,action:'recover',...changed,baseContent:baseline,expectedDraftUpdatedAt:null,...body}},res);return {res,calls};
 }finally{globalThis.fetch=original;}
}
test('new recovery inserts only a draft and never replaces a competing insert',async()=>{
 const {res,calls}=await recover({},[[article],[],[{...changed,article_id:7}]]);
 assert.equal(res.code,200);assert.match(calls[2].url,/article_drafts\?on_conflict/);assert.equal(calls[2].headers.Prefer,'resolution=ignore-duplicates,return=representation');
 assert.equal(calls[2].method,'POST');assert.equal(JSON.parse(calls[2].body).article_id,7);assert.ok(calls.every(c=>!c.url.includes('/rpc/')));
});
test('existing recovery uses a conditional timestamp patch and preserves regenerated metadata',async()=>{
 const draft={...baseline,updated_at:timestamp,regenerated:true};
 const {res,calls}=await recover({expectedDraftUpdatedAt:timestamp},[[article],[draft],[changed]]);
 assert.equal(res.code,200);assert.equal(calls[2].method,'PATCH');assert.match(calls[2].url,/updated_at=eq\./);assert.equal(JSON.parse(calls[2].body).regenerated,true);
});
test('stale baseline or timestamps return conflict before writing',async()=>{
 for(const draft of [{...baseline,updated_at:timestamp},{...baseline,title:'別の編集',updated_at:timestamp}]){
  const {res,calls}=await recover({},[[article],[draft]]);assert.equal(res.code,409);assert.equal(calls.length,2);
 }
 const {res,calls}=await recover({},[[{...article,title:'公開版が変更済み'}],[]]);assert.equal(res.code,409);assert.equal(calls.length,2);
});
test('a race during insert or update returns conflict without changing public content',async()=>{
 for(const draft of [null,{...baseline,updated_at:timestamp}]){
  const {res,calls}=await recover({expectedDraftUpdatedAt:draft?.updated_at??null},[[article],draft?[draft]:[],[]]);
  assert.equal(res.code,409);assert.ok(calls.filter(c=>c.method).every(c=>c.url.includes('/article_drafts?')));
 }
});
test('recovery permits incomplete drafts and rejects unauthenticated access',async()=>{
 const {res}=await recover({title:'',article_body:''},[[article],[],[{title:'',article_body:''}]]);assert.equal(res.code,200);
 const denied=await recover({},[],false);assert.equal(denied.res.code,401);assert.equal(denied.calls.length,0);
});
