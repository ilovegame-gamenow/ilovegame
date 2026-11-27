import test from 'node:test';
import assert from 'node:assert/strict';
import { getEditorNews, parseEditorNewsQuery } from '../lib/editor-news-repository.js';

test('rights filter validated and applied before pagination to metadata and articles', async()=>{
  assert.equal(parseEditorNewsQuery({rights:'unexpected'}),null);
  assert.equal(parseEditorNewsQuery({rights:['blocked']}),null);
  assert.equal(parseEditorNewsQuery({rights:'blocked'}).rights,'blocked');
  const original=globalThis.fetch;
  const calls=[];
  const rows=[{id:1,status:'published',source_name:'Nintendo',image_rights_status:'pending'},{id:2,status:'pending',source_name:'Nintendo',image_rights_status:'blocked'},{id:3,status:'pending',source_name:'Nintendo',image_rights_status:'blocked'}];
  globalThis.fetch=async(url)=>{
    const u=new URL(url);
    if(u.pathname.endsWith('/publisher_directory')) return new Response(JSON.stringify([{version:1,groups:[]} ]));
    assert.ok(u.pathname.endsWith('/editor_article_image_rights'));
    const p=u.searchParams; calls.push(p);
    const filtered=rows.filter(r=>p.get('image_rights_status')===`eq.${r.image_rights_status}`&&(!p.has('status')||p.get('status')===`eq.${r.status}`));
    const offset=Number(p.get('offset')||0),limit=Number(p.get('limit'));
    return new Response(JSON.stringify(filtered.slice(offset,offset+limit)),{headers:{'content-range':`*/${filtered.length}`}});
  };
  try{
    const result=await getEditorNews({supabaseUrl:'https://db.invalid',supabaseKey:'test',status:'pending',source:'all',page:2,limit:1,rights:'blocked'});
    assert.equal(result.total,2);assert.equal(result.page,2);assert.equal(result.articles.length,1);assert.equal(result.articles[0].id,3);assert.equal(result.counts.pending,2);
    assert.ok(calls.every(p=>p.get('image_rights_status')==='eq.blocked'));
  }finally{globalThis.fetch=original;}
});
