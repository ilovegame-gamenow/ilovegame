import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import editorNews from '../api/editor-news.js';
import login from '../api/editor-login.js';
import { createEditorToken, isEditorAuthenticated, SESSION_SECONDS } from '../lib/editor-auth.js';
const SECOND=1000,MINUTE=60*SECOND,HOUR=60*MINUTE;
const initialTime=Date.UTC(2026,10,1,0,0,0);
const secret='session-verification-only';
const clientScript=readFileSync(new URL('../editor-session.js',import.meta.url),'utf8');
const response=()=>({headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

// Drive the shipped browser script and API handlers together. No live credentials,
// database calls or real waiting are involved; both sides share the simulated clock.
async function sessionTest(run) {
 const realNow=Date.now,previousSecret=process.env.EDITOR_SECRET;
 let now=initialTime,nextId=0,cookie='',cookieExpires=0;
 let failure=null;
 const timers=new Map(),events=new Map(),calls=[],redirects=[];
 Date.now=()=>now;process.env.EDITOR_SECRET=secret;
 const applyCookie=value=>{
  cookie=value.split(';')[0];
  cookieExpires=now+Number(value.match(/Max-Age=(\d+)/)[1])*SECOND;
 };
 const dispatch=async(method,auth,extraHeaders={})=>{
  const res=response();
  await editorNews({method,query:{auth},headers:{cookie:now<cookieExpires?cookie:'',host:'site.invalid',origin:'https://site.invalid','x-editor-action':'renew',...extraHeaders}},res);
  if(res.headers['set-cookie'])applyCookie(res.headers['set-cookie']);
  return res;
 };
 const document={hidden:false,addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
 const context=vm.createContext({document,Date,console:{warn(){}},location:{replace:url=>redirects.push(url)},window:new EventTarget(),Event,
  setTimeout:(fn,delay)=>{const id=++nextId;timers.set(id,{fn,at:now+delay,interval:0});return id;},
  clearTimeout:id=>timers.delete(id),
  setInterval:(fn,delay)=>{const id=++nextId;timers.set(id,{fn,at:now+delay,interval:delay});return id;},
  fetch:async(url,options={})=>{
   assert.ok(url.startsWith('/api/editor-news?auth='),'session must not request article data');
   calls.push({auth:new URL(url,'https://site.invalid').searchParams.get('auth'),time:now,method:options.method||'GET'});
   if(failure==='offline')throw Error('offline');
   if(failure===503)return {status:503,ok:false};
   const res=await dispatch(options.method||'GET',new URL(url,'https://site.invalid').searchParams.get('auth'),options.headers?{'x-editor-action':options.headers['X-Editor-Action']}:{});
   return {status:res.code,ok:res.code===200,json:async()=>res.body};
  }
 });
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 const event=async name=>{for(const fn of events.get(name)||[])fn();await settle();};
 const advance=async duration=>{
  const target=now+duration;
  while(true){
   const next=[...timers.entries()].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
   if(!next)break;
   const [id,timer]=next;now=timer.at;
   if(timer.interval)timer.at+=timer.interval;else timers.delete(id);
   timer.fn();await settle();
  }
  now=target;await settle();
 };
 const suspend=duration=>{now+=duration;for(const timer of timers.values())if(timer.at<now)timer.at=now+(timer.interval||1);};
 try {
  const loggedIn=response();await login({method:'POST',headers:{host:'site.invalid',origin:'https://site.invalid'},body:{password:secret}},loggedIn);
  assert.equal(loggedIn.code,200);applyCookie(loggedIn.headers['set-cookie']);
  assert.match(loggedIn.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict; Path=\/api\/; Max-Age=10800/);
  vm.runInContext(clientScript,context);
  const start=async()=>{vm.runInContext('window.GameEditorSession.start()',context);await settle();};
  await run({start,event,advance,suspend,dispatch,calls,redirects,document,timers,context,now:()=>now,setFailure:value=>{failure=value;},cookie:()=>cookie});
 } finally {Date.now=realNow;if(previousSecret===undefined)delete process.env.EDITOR_SECRET;else process.env.EDITOR_SECRET=previousSecret;}
}

test('untouched session expires after three hours; periodic checks never renew it',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.advance(3*HOUR-SECOND);
  assert.deepEqual(s.redirects,[]);assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.advance(SECOND);assert.deepEqual(s.redirects,['/editor.html']);
 });
});
test('one minute of inactivity extends once, then expires three hours after that renewal',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.event('pointerdown');await s.advance(MINUTE-1);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.advance(1);assert.equal(s.calls.filter(c=>c.auth==='renew').length,1);
  await s.advance(3*HOUR-SECOND);assert.deepEqual(s.redirects,[]);
  await s.advance(SECOND);assert.deepEqual(s.redirects,['/editor.html']);
 });
});
test('continuous operation for five hours renews hourly and remains authenticated',async()=>{
 await sessionTest(async s=>{
  await s.start();
  for(let i=0;i<600;i++){await s.advance(30*SECOND);await s.event(i%2?'input':'keydown');}
  assert.deepEqual(s.redirects,[]);assert.equal(s.calls.filter(c=>c.auth==='renew').length,5);
  assert.equal((await s.dispatch('GET','check')).code,200);
 });
});
test('hidden page does not renew; wake before expiry can resume activity and renew',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.event('pointerdown');s.document.hidden=true;await s.event('visibilitychange');
  s.suspend(2*HOUR);s.document.hidden=false;await s.event('visibilitychange');
  assert.deepEqual(s.redirects,[]);assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.event('pointerdown');await s.advance(MINUTE);assert.equal((await s.dispatch('GET','check')).code,200);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,2);
 });
});
test('wake after expiry returns to login immediately and cannot revive expired credentials',async()=>{
 await sessionTest(async s=>{
  await s.start();s.document.hidden=true;await s.event('visibilitychange');s.suspend(4*HOUR);
  s.document.hidden=false;await s.event('visibilitychange');assert.deepEqual(s.redirects,['/editor.html']);
  const res=await s.dispatch('POST','renew');assert.equal(res.code,401);assert.equal(res.headers['set-cookie'],undefined);
 });
});
test('temporary network failures do not fake logout or keep the renewal lock stuck',async()=>{
 await sessionTest(async s=>{
  await s.start();s.setFailure('offline');await s.event('input');await s.advance(MINUTE);
  assert.deepEqual(s.redirects,[]);s.setFailure(null);await s.event('input');await s.advance(MINUTE);
  assert.equal((await s.dispatch('GET','check')).code,200);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,2);
 });
});
test('start is idempotent and failed server responses allow a subsequent renewal',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.start();assert.equal([...s.timers.values()].filter(t=>t.interval).length,1);
  s.setFailure(503);await s.event('input');await s.advance(MINUTE);s.setFailure(null);
  await s.event('input');await s.advance(MINUTE);assert.deepEqual(s.redirects,[]);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,2);
 });
});
test('renewal requires matching origin and action; check does not issue cookies',async()=>{
 await sessionTest(async s=>{
  for(const headers of [{origin:'https://other.invalid'},{'x-editor-action':'wrong'},{origin:''}]){
   const res=await s.dispatch('POST','renew',headers);assert.equal(res.code,403);assert.equal(res.headers['set-cookie'],undefined);
  }
  const check=await s.dispatch('GET','check');assert.equal(check.body.remainingSeconds,SESSION_SECONDS);assert.equal(check.headers['set-cookie'],undefined);
 });
});
test('token boundary and tampering are checked by the real server implementation',async()=>{
 await sessionTest(async s=>{
  const token=createEditorToken(secret);const request={headers:{cookie:`ilovegame_editor=${token}`}};
  assert.equal(isEditorAuthenticated(request),true);
  assert.equal(isEditorAuthenticated({headers:{cookie:`ilovegame_editor=${token}x`}}),false);
  s.suspend(3*HOUR-SECOND);assert.equal(isEditorAuthenticated(request),true);
  s.suspend(SECOND);assert.equal(isEditorAuthenticated(request),false);
 });
});
