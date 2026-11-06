import test from 'node:test';
import assert from 'node:assert/strict';
import news from '../api/news.js';
import { settingRules } from '../lib/site-settings.js';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const settings = {...Object.fromEntries(Object.entries(settingRules).map(([k,v])=>[k,v.defaultValue])), pickup_max_articles:2, public_page_size:2};
const res = () => ({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
process.env.SUPABASE_URL='https://db.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='public';
process.env.SUPABASE_SECRET_KEY='secret';

test('home excludes only displayed discovery cards before count/pagination; expired cards return and details stay available', async () => {
  const previous=globalThis.fetch;
  let selected=true, fail=false;
  const all=[1,2,3,4,5].map(id=>({id,title:String(id)}));
  const queries=[];
  globalThis.fetch=async url=>{
    const u=new URL(url);
    if(u.pathname.endsWith('/site_settings'))return Response.json([settings]);
    if(u.pathname.endsWith('/article_feature_slots')){
      assert.match(u.searchParams.get('expires_at'),/^gt\./);
      if(fail)return new Response('Unavailable',{status:502});
      return Response.json(selected?[
        {article_id:1,slot:'breaking',selected_at:new Date().toISOString()},
        ...[1,2,3,4].map(article_id=>({article_id,slot:'discovery',selected_at:new Date().toISOString()})),
        {article_id:5,slot:'discovery',selected_at:'2099-01-01T00:00:00Z'}
      ]:[]);
    }
    const filter=u.searchParams.get('id');
    if(filter?.startsWith('in.'))return Response.json(all);
    if(filter?.startsWith('eq.'))return Response.json(all.filter(a=>a.id===Number(filter.slice(3))));
    queries.push(u);
    const rows=filter==='not.in.(2,3)'?all.filter(a=>![2,3].includes(a.id)):all;
    const offset=Number(u.searchParams.get('offset'));
    return Response.json(rows.slice(offset,offset+2),{status:offset>=rows.length?416:200,headers:{'content-range':`*/${rows.length}`}});
  };
  try {
    let r=res();await news({query:{view:'home',page:'99'}},r);
    assert.equal(r.code,200);assert.equal(r.body.total,3);assert.equal(r.body.page,2);
    assert.deepEqual(r.body.featured.pickup.map(a=>a.id),[2,3]);
    assert.deepEqual(r.body.articles.map(a=>a.id),[5]);
    assert.ok(queries.every(u=>u.searchParams.get('id')==='not.in.(2,3)'));
    r=res();await news({query:{view:'home',page:'1'}},r);
    assert.deepEqual(r.body.articles.map(a=>a.id),[1,4]);
    r=res();await news({query:{id:'2'}},r);assert.equal(r.body.id,2);
    selected=false;r=res();await news({query:{view:'home',page:'1'}},r);
    assert.equal(r.body.total,5);assert.deepEqual(r.body.articles.map(a=>a.id),[1,2]);
    fail=true;r=res();await news({query:{view:'home'}},r);
    assert.equal(r.code,200);assert.equal(r.body.featured,null);assert.equal(r.body.total,5);
    assert.deepEqual(r.body.articles.map(a=>a.id),[1,2]);
  } finally {globalThis.fetch=previous;}
});

test('homepage pairs cards and latest from one response and retries transient failures', async () => {
  const node=()=>({innerHTML:'',children:[],setAttribute(k,v){this[k]=v;},replaceChildren(...v){this.children=v;},addEventListener(k,fn){this[k]=fn;}});
  const nodes=Object.fromEntries(['pickup','latest','featured-retry','pagination'].map(id=>[id,node()]));
  const button=node();nodes['featured-retry'].querySelector=()=>button;
  const selections=[];let calls=0;
  const context=vm.createContext({document:{getElementById:id=>nodes[id],querySelector:()=>nodes.latest},
    location:{search:'',href:'https://site.invalid/'},history:{replaceState(){}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
    GameFeatured:{render:r=>selections.push(r)},GameNewsCard:{render:a=>`article-${a.id}`},GamePagination:{render:()=>({})},
    fetch:async url=>{
      assert.equal(url,'/api/news?view=home&page=1');
      if(++calls===1)throw Error('Transient failure');
      return Response.json({featured:{breaking:null,pickup:[{id:2}]},articles:[{id:1}],total:1,limit:2,page:1});
    }});
  vm.runInContext(readFileSync(new URL('../home-news.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,2);assert.equal(selections[0].pickup[0].id,2);
  assert.equal(nodes.latest.innerHTML,'article-1');assert.equal(nodes['featured-retry'].hidden,true);
  assert.equal(nodes.pickup['aria-busy'],'false');
});
