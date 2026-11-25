import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/editor-detail.js';
import {createEditorToken} from '../lib/editor-auth.js';

test('editor details return the same original timestamp fields as article lists',async()=>{
  process.env.EDITOR_SECRET='test-only-secret';
  process.env.SUPABASE_URL='https://database.invalid';
  process.env.SUPABASE_SECRET_KEY='test-only-key';
  const original=globalThis.fetch;
  const article={id:1,title:'記事',source_name:'Nintendo',created_at:'2026-11-25T00:02:00Z',published_at:null,site_published_at:null};
  globalThis.fetch=async(input,options={})=>{
    assert.equal(options.method,undefined);
    const url=new URL(input);
    if(url.pathname.endsWith('/articles')){
      const fields=url.searchParams.get('select').split(',');
      for(const field of ['site_published_at','created_at','published_at'])assert.ok(fields.includes(field));
      return Response.json([article]);
    }
    if(url.pathname.endsWith('/publisher_directory'))return Response.json([{version:1,groups:[]}]);
    if(url.pathname.endsWith('/article_drafts'))return Response.json([{title:'下書き',updated_at:'2026-11-25T01:00:00Z'}]);
    throw Error('Unexpected request');
  };
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  try{
    await handler({method:'GET',query:{id:'1'},headers:{cookie:'ilovegame_editor='+createEditorToken(process.env.EDITOR_SECRET)}},res);
    assert.equal(res.code,200);
    for(const field of ['site_published_at','created_at','published_at'])assert.equal(res.body.article[field],article[field]);
    assert.equal(res.body.draft.updated_at,'2026-11-25T01:00:00Z');
  }finally{globalThis.fetch=original;}
});
