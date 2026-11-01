// A real PostgREST/PostgreSQL test. No fetch mocks, hosted credentials or dependencies.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import handler from '../../api/editor-games.js';
import { createEditorToken } from '../../lib/editor-auth.js';

const rest = new URL(process.env.CATALOG_TEST_REST_URL || 'http://127.0.0.1:3000');
// Guard against accidentally running the write tests against a deployed database.
assert.ok(['localhost','127.0.0.1','[::1]'].includes(rest.hostname) && rest.protocol==='http:', 'Only a local disposable PostgREST endpoint is allowed');
const jwtSecret='catalog-ci-only-jwt-secret-at-least-32-characters';
function jwt(role) {
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const data=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,exp:Math.floor(Date.now()/1000)+600})}`;
  return `${data}.${createHmac('sha256',jwtSecret).update(data).digest('base64url')}`;
}
const serviceToken=jwt('service_role');
const headers={host:'catalog-editor.test',origin:'https://catalog-editor.test'};
process.env.EDITOR_SECRET='catalog-ci-only-editor-secret';
headers.cookie=`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`;
let forwarded=0;
// Reproduce only the Supabase gateway's REST path prefix; all REST/SQL work is real.
const gateway=createServer(async(req,res)=>{
  if(!req.url.startsWith('/rest/v1/')) {res.writeHead(404).end();return;}
  forwarded++;
  try {
    const body=[];for await(const chunk of req)body.push(chunk);
    const outgoing={method:req.method,headers:{}};
    for(const name of ['authorization','apikey','content-type','prefer']) if(req.headers[name])outgoing.headers[name]=req.headers[name];
    if(!['GET','HEAD'].includes(req.method)) outgoing.body=Buffer.concat(body);
    const response=await fetch(new URL(req.url.slice('/rest/v1'.length),rest),outgoing);
    res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json'});
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(502).end();}
});
gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
process.env.SUPABASE_URL=`http://127.0.0.1:${gateway.address().port}`;
process.env.SUPABASE_SECRET_KEY=serviceToken;
process.env.GAME_CATALOG_ENABLED='true';
const response=()=>({setHeader(name,value){(this.headers??={})[name]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function call(method,body,query={},customHeaders=headers) {
  const res=response();await handler({method,body,query,headers:customHeaders},res);
  assert.equal(res.headers['Cache-Control'],'no-store');
  return res;
}
async function raw(path,token=serviceToken,options={}) {
  return fetch(new URL(path,rest),{...options,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),'Content-Type':'application/json',...options.headers}});
}
async function rows(path){const r=await raw(path);assert.equal(r.status,200);return r.json();}
async function create(game){const res=await call('POST',{action:'create',game});assert.equal(res.code,200,JSON.stringify(res.body));return res.body.game;}
const game={id:randomUUID(),title:'REST test %_* A&B',original_title:'Original REST Title',description:'Integration only',source_url:'https://example.org/integration',source_type:'official'};
try {
  // Await schema cache readiness (bounded), rather than assuming container startup means ready.
  let ready=false;
  for(let attempt=0;attempt<30;attempt++) {
    try{const r=await raw('/rpc/search_editor_games',serviceToken,{method:'POST',body:JSON.stringify({p_query:'',p_offset:0})});if(r.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(ready,'Local PostgREST did not become ready');

  const before=forwarded;
  assert.equal((await call('GET',null,{},{})).code,401);
  assert.equal((await call('POST',{action:'create',game},{},{...headers,origin:'https://other.invalid'})).code,403);
  process.env.GAME_CATALOG_ENABLED='false';
  assert.equal((await call('GET')).code,503);
  process.env.GAME_CATALOG_ENABLED='true';
  assert.equal(forwarded,before,'Rejected requests must not contact the database');
  console.log('PASS: editor auth, origin and disabled flag');

  for(const token of [null,jwt('authenticated')]) {
    for(const table of ['games','game_platforms','game_releases','game_sources','game_external_ids','article_games']) {
      const r=await raw(`/${table}?limit=1`,token);assert.ok([401,403].includes(r.status),`${table}: ${r.status}`);
    }
    const createResponse=await raw('/rpc/create_editor_game',token,{method:'POST',body:JSON.stringify(Object.fromEntries(Object.entries(game).map(([k,v])=>[`p_${k}`,v])))});
    assert.ok([401,403].includes(createResponse.status));
    const searchResponse=await raw('/rpc/search_editor_games',token,{method:'POST',body:JSON.stringify({p_query:'',p_offset:0})});
    assert.ok([401,403].includes(searchResponse.status));
  }
  console.log('PASS: browser roles cannot read catalog tables or execute editor RPCs');

  const saved=await create(game);
  assert.equal(saved.id,game.id);assert.equal(saved.status,'draft');assert.equal(saved.title,game.title);
  // Concurrent retries exercise unique-key waiting and the idempotent read path.
  const retries=await Promise.all([create(game),create(game),create(game)]);
  assert.ok(retries.every(row=>row.id===game.id));
  assert.equal((await rows(`/games?id=eq.${game.id}`)).length,1);
  const sources=await rows(`/game_sources?game_id=eq.${game.id}`);
  assert.equal(sources.length,1);assert.equal(sources[0].review_status,'pending');
  assert.equal((await call('POST',{action:'create',game:{...game,title:'Changed input'}})).code,409);
  console.log('PASS: real RPC object response, atomic creation and concurrent retry');

  const namesake=await create({...game,id:randomUUID(),original_title:'Different game'});
  let result=await call('GET',null,{q:'%_* A&B'});
  assert.equal(result.code,200);assert.equal(result.body.games.length,2);
  result=await call('GET',null,{q:'ORIGINAL REST'});assert.equal(result.body.games.length,1);
  result=await call('GET',null,{q:'%,(status.eq.published)'});assert.equal(result.body.games.length,0);
  console.log('PASS: namesakes, original titles and literal punctuation through REST');

  const link=(article,work)=>call('POST',{action:'link',article_id:article,game_id:work});
  for(const res of await Promise.all([link(7001,game.id),link(7001,game.id),link(7001,namesake.id),link(7002,game.id)]))assert.equal(res.code,200,JSON.stringify(res.body));
  result=await call('GET',null,{article_id:'7001'});
  assert.equal(result.code,200);assert.equal(result.body.linkedGames.length,2);assert.ok(result.body.linkedGames.some(row=>row.id===game.id));
  assert.equal((await call('POST',{action:'unlink',article_id:7001,game_id:game.id})).code,200);
  assert.equal((await call('POST',{action:'unlink',article_id:7001,game_id:game.id})).code,200);
  assert.deepEqual((await call('GET',null,{article_id:'7001'})).body.linkedGames.map(row=>row.id),[namesake.id]);
  assert.deepEqual((await call('GET',null,{article_id:'7002'})).body.linkedGames.map(row=>row.id),[game.id]);
  assert.equal((await link(999999,game.id)).code,409);
  assert.equal((await link(7001,randomUUID())).code,409);
  const article=await rows('/articles?id=eq.7001');assert.equal(article[0].title,'REST integration article');
  assert.equal((await rows(`/games?id=eq.${game.id}`)).length,1);
  console.log('PASS: actual FK embedding, concurrent links, scoped unlink and article preservation');

  for(let index=0;index<22;index++) await create({...game,id:randomUUID(),title:`REST paging ${index}`});
  const first=(await call('GET',null,{q:'REST paging',page:'1'})).body;
  const second=(await call('GET',null,{q:'REST paging',page:'2'})).body;
  assert.equal(first.games.length,20);assert.equal(first.hasMore,true);
  assert.equal(second.games.length,2);assert.equal(second.hasMore,false);
  assert.equal(new Set([...first.games,...second.games].map(row=>row.id)).size,22);
  console.log('PASS: real server pagination without duplicate or missing works');
  console.log('All catalog REST integration checks passed. Disposable test data stays in the CI DB.');
}finally{await new Promise(resolve=>gateway.close(resolve));}
