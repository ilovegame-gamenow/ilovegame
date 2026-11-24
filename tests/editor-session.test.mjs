import crypto from 'node:crypto';
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
async function sessionTest(run, minutes=10) {
 const realNow=Date.now,previousSecret=process.env.EDITOR_SECRET;
 const originalFetch=globalThis.fetch, previousUrl=process.env.SUPABASE_URL, previousKey=process.env.SUPABASE_SECRET_KEY;
 process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test-only';
 globalThis.fetch=async url=>{assert.match(url,/select=editor_session_minutes$/);return Response.json([{editor_session_minutes:minutes}]);};
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
 const classes=new Set(),elements=new Map(),header={inert:false};
 const makeElement=()=>({hidden:false,textContent:'',children:new Map(),contains:()=>false,addEventListener(){},querySelector(tag){if(!this.children.has(tag))this.children.set(tag,makeElement());return this.children.get(tag);}});
 const document={hidden:false,activeElement:null,documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)}},head:{append(el){elements.set('cover-style',el);}},querySelector(selector){return selector==='body > header'?header:null;},body:{append(el){elements.set(el.id,el);}},createElement:makeElement,addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
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
  assert.ok(loggedIn.headers['set-cookie'].endsWith(`Max-Age=${minutes*60}`));
  vm.runInContext(clientScript,context);
  const start=async()=>{vm.runInContext('window.GameEditorSession.start()',context);await settle();};
  await run({start,event,advance,suspend,dispatch,calls,redirects,document,timers,context,header,coverStyle:()=>elements.get('cover-style')?.textContent,covered:()=>classes.has('editor-session-covered'),cover:()=>elements.get('editor-session-cover'),now:()=>now,setFailure:value=>{failure=value;},cookie:()=>cookie});
 } finally {Date.now=realNow;globalThis.fetch=originalFetch;for(const [key,value] of Object.entries({EDITOR_SECRET:previousSecret,SUPABASE_URL:previousUrl,SUPABASE_SECRET_KEY:previousKey})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}

for(const minutes of [5,10,30,60])test(`untouched session expires after ${minutes} minutes; periodic checks never renew it`,async()=>{
 await sessionTest(async s=>{
  await s.start();await s.advance(minutes*MINUTE-SECOND);
  assert.deepEqual(s.redirects,[]);assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.advance(SECOND);assert.deepEqual(s.redirects,['/editor.html']);
 },minutes);
});
test('activity renews once, then expires ten minutes after that renewal',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.event('pointerdown');await s.advance(SECOND-1);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.advance(1);assert.equal(s.calls.filter(c=>c.auth==='renew').length,1);
  await s.advance(10*MINUTE-SECOND);assert.deepEqual(s.redirects,[]);
  await s.advance(SECOND);assert.deepEqual(s.redirects,['/editor.html']);
 });
});
test('continuous operation for five hours remains authenticated even with five minute lock',async()=>{
 await sessionTest(async s=>{
  await s.start();
  for(let i=0;i<600;i++){await s.advance(30*SECOND);await s.event(i%2?'input':'keydown');}
  assert.deepEqual(s.redirects,[]);assert.ok(s.calls.filter(c=>c.auth==='renew').length>=590);
  assert.equal((await s.dispatch('GET','check')).code,200);
 },5);
});
test('hidden page does not renew; wake before expiry can resume activity and renew',async()=>{
 await sessionTest(async s=>{
  await s.start();await s.event('pointerdown');s.document.hidden=true;await s.event('visibilitychange');
  s.suspend(3*MINUTE);s.document.hidden=false;await s.event('visibilitychange');
  assert.deepEqual(s.redirects,[]);assert.equal(s.calls.filter(c=>c.auth==='renew').length,0);
  await s.event('pointerdown');await s.advance(MINUTE);assert.equal((await s.dispatch('GET','check')).code,200);
  assert.equal(s.calls.filter(c=>c.auth==='renew').length,1);
 });
});
test('wake after expiry returns to login immediately and cannot revive expired credentials',async()=>{
 await sessionTest(async s=>{
  await s.start();s.document.hidden=true;await s.event('visibilitychange');s.suspend(2*HOUR);
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
  s.suspend(10*MINUTE-SECOND);assert.equal(isEditorAuthenticated(request),true);
  s.suspend(SECOND);assert.equal(isEditorAuthenticated(request),false);
 });
});

test('existing three-hour cookie is shortened once; subsequent checks do not extend it',async()=>{
 await sessionTest(async s=>{
  const expiry=String(Math.floor(s.now()/1000)+3*60*60);
  const signature=crypto.createHmac('sha256',secret).update(expiry).digest('base64url');
  const res=await s.dispatch('GET','check',{cookie:`ilovegame_editor=${expiry}.${signature}`});
  assert.equal(res.code,200);assert.equal(res.body.remainingSeconds,3600);assert.match(res.headers['set-cookie'],/Max-Age=3600/);
  await s.advance(10*MINUTE);
  const check=await s.dispatch('GET','check');assert.equal(check.body.remainingSeconds,50*60);assert.equal(check.headers['set-cookie'],undefined);
 });
});


test('history restoration checks expired authentication immediately without fetching article data',async()=>{
 await sessionTest(async s=>{
  await s.start();s.suspend(HOUR+SECOND);
  const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});
  s.context.window.dispatchEvent(restored);
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.deepEqual(s.redirects,['/editor.html']);
 });
});

test('backgrounding conceals the old editor before restoration and expiry redirects while concealed',async()=>{
 await sessionTest(async s=>{
  await s.start();assert.equal(s.covered(),false);
  s.document.hidden=true;await s.event('visibilitychange');assert.equal(s.covered(),true);
  s.suspend(2*HOUR);s.document.hidden=false;await s.event('visibilitychange');
  assert.equal(s.covered(),true);assert.deepEqual(s.redirects,['/editor.html']);
 });
});
test('returning while authenticated reveals editor only after verification; offline stays covered',async()=>{
 await sessionTest(async s=>{
  await s.start();s.document.hidden=true;await s.event('visibilitychange');s.suspend(MINUTE);
  s.setFailure('offline');s.document.hidden=false;await s.event('visibilitychange');
  assert.equal(s.covered(),true);assert.equal(s.cover().querySelector('button').hidden,false);assert.deepEqual(s.redirects,[]);
  s.setFailure(null);s.context.window.dispatchEvent(new Event('focus'));for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(s.covered(),false);
 });
});
test('failed draft recovery keeps the original DOM concealed and offers re-login in a new tab',async()=>{
 await sessionTest(async s=>{
  await s.start();s.context.window.addEventListener('editor-session-expired',event=>event.preventDefault());
  s.document.hidden=true;await s.event('visibilitychange');s.suspend(2*HOUR);
  s.document.hidden=false;await s.event('visibilitychange');
  assert.equal(s.covered(),true);assert.deepEqual(s.redirects,[]);assert.equal(s.cover().querySelector('a').hidden,false);
 });
});

test('pagehide conceals before bfcache freeze even if visibility has not changed',async()=>{
 await sessionTest(async s=>{
  await s.start();s.context.window.dispatchEvent(new Event('pagehide'));
  assert.equal(s.covered(),true);
  await s.advance(MINUTE);assert.equal(s.covered(),true);
  const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});
  s.context.window.dispatchEvent(restored);for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(s.covered(),false);
 });
});


test('session cover keeps static branding visible but disables header interactions and conceals other content',async()=>{
 await sessionTest(async s=>{
  await s.start();assert.equal(s.header.inert,false);
  s.document.hidden=true;await s.event('visibilitychange');
  assert.equal(s.covered(),true);assert.equal(s.header.inert,true);
  const css=s.coverStyle();
  assert.match(css,/body > :not\(#editor-session-cover\) \* \{ visibility:hidden !important; pointer-events:none !important;/);
  assert.match(css,/body > header:not\(#editor-session-cover\) > \.header-inner > \.header-brand-group \* \{ visibility:visible !important;/);
  s.document.hidden=false;await s.event('visibilitychange');
  assert.equal(s.covered(),false);assert.equal(s.header.inert,false);
 });
});
