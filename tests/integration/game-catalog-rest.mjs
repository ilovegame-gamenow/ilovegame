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
  process.env.GAME_DISCOVERIES_ENABLED='true';
  const discoveryQuery={resource:'discoveries'};
  const discovery={...game,id:randomUUID(),title:`Discovered ${randomUUID()}`,reason:'An unusual game mechanic',source_url:'https://example.org/new-discovery'};
  const ingest=input=>call('POST',{action:'register',candidate:input},discoveryQuery);
  let discoveryResponse=await ingest(discovery);
  assert.equal(discoveryResponse.code,200,JSON.stringify(discoveryResponse.body));
  assert.equal(discoveryResponse.body.candidate.status,'pending');
  assert.equal(discoveryResponse.body.candidate.discovered_by,'manual');
  const duplicates=await Promise.all([ingest(discovery),ingest({...discovery,id:randomUUID()})]);
  assert.ok(duplicates.every(r=>r.code===200&&r.body.candidate.id===discovery.id));
  assert.equal((await rows(`/game_discoveries?id=eq.${discovery.id}`)).length,1);
  assert.equal((await rows(`/games?id=eq.${discovery.id}`)).length,0);
  const review=(id,action,game_id)=>call('POST',{id,action,...(game_id?{game_id}:{})},discoveryQuery);
  assert.equal((await review(discovery.id,'hold')).code,200);
  discoveryResponse=await call('GET',null,{...discoveryQuery,status:'held'});
  assert.ok(discoveryResponse.body.candidates.some(c=>c.id===discovery.id));
  assert.equal((await review(discovery.id,'reopen')).code,200);
  const adopted=await Promise.all([review(discovery.id,'adopt_new'),review(discovery.id,'adopt_new')]);
  assert.ok(adopted.every(r=>r.code===200&&r.body.candidate.adopted_game_id===discovery.id));
  assert.equal((await rows(`/games?id=eq.${discovery.id}`)).length,1);
  assert.equal((await rows(`/game_sources?game_id=eq.${discovery.id}`)).length,1);
  assert.equal((await review(discovery.id,'hold')).code,409);
  assert.equal((await review(discovery.id,'adopt_existing',game.id)).code,409);
  const secondCandidate={...discovery,id:randomUUID(),source_url:'https://example.org/new-discovery-2',description:'Must not replace known work'};
  assert.equal((await ingest(secondCandidate)).code,200);
  discoveryResponse=await call('GET',null,discoveryQuery);
  const pending=discoveryResponse.body.candidates.find(c=>c.id===secondCandidate.id);
  assert.ok(pending.matches.some(m=>m.id===discovery.id&&m.match_type==='title'));
  assert.equal((await review(secondCandidate.id,'adopt_existing',discovery.id)).code,200);
  assert.equal((await rows(`/games?id=eq.${discovery.id}`))[0].description,discovery.description);
  assert.equal((await rows(`/game_sources?game_id=eq.${discovery.id}`)).length,2);
  assert.equal((await rows(`/article_games?game_id=eq.${discovery.id}`)).length,0);
  for(const token of [null,jwt('authenticated')]) {
    assert.ok([401,403].includes((await raw('/game_discoveries?limit=1',token)).status));
    assert.ok([401,403].includes((await raw('/rpc/list_game_discoveries',token,{method:'POST',body:JSON.stringify({p_status:'pending',p_offset:0})})).status));
    assert.ok([401,403].includes((await raw('/rpc/review_game_discovery',token,{method:'POST',body:JSON.stringify({p_id:discovery.id,p_action:'adopt_new',p_game_id:null})})).status));
  }
  console.log('PASS: real discovery ingestion, deduplication, hold/reopen, concurrent adoption, matching and browser access denial');
  process.env.GAME_RESEARCH_ENABLED='true';
  const runId=randomUUID(),candidateId=randomUUID();
  const snapshots=[{appid:7654321,candidate_id:candidateId,title:'REST research snapshot',url:'https://store.steampowered.com/app/7654321/',description:'Cooperative puzzles with changing terrain and voice communication between two players.'}];
  let research=await raw('/rpc/prepare_game_research',serviceToken,{method:'POST',body:JSON.stringify({p_id:runId,p_sources:snapshots})});
  assert.equal(research.status,200);assert.equal((await research.json()).status,'prepared');
  const overview=await call('GET',null,{resource:'research',id:runId});assert.equal(overview.code,200);assert.equal(overview.body.run.sources[0].appid,7654321);
  const claims=await Promise.all([0,1].map(()=>raw('/rpc/claim_game_research',serviceToken,{method:'POST',body:JSON.stringify({p_id:runId})})));
  assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
  research=await raw('/rpc/complete_game_research',serviceToken,{method:'POST',body:JSON.stringify({p_id:runId,p_result:{items:[{appid:7654321,selected:true,description:'協力パズルの紹介。',reason:'音声で協力する仕組み。',evidence:'Cooperative puzzles'}],usage:{input_tokens:100,output_tokens:50},model:'gpt-5-mini'}})});
  assert.equal(research.status,200);assert.equal((await research.json()).status,'completed');
  const recorded=await rows(`/game_discoveries?id=eq.${candidateId}`);assert.equal(recorded[0].discovered_by,'ai');assert.equal(recorded[0].research_metadata.run_id,runId);
  assert.equal((await rows(`/games?id=eq.${candidateId}`)).length,0);
  for(const token of [null,jwt('authenticated')]) {
    assert.ok([401,403].includes((await raw('/game_research_runs?limit=1',token)).status));
    assert.ok([401,403].includes((await raw('/rpc/claim_game_research',token,{method:'POST',body:JSON.stringify({p_id:runId})})).status));
  }
  console.log('PASS: real research snapshot, exclusive claim, atomic AI-candidate completion and role denial (no OpenAI calls)');
  console.log('All catalog REST integration checks passed. Disposable test data stays in the CI DB.');
}finally{await new Promise(resolve=>gateway.close(resolve));}
