import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImageRights,saveImageRights} from '../lib/editor-image-rights.js';
import handler from '../api/editor-save.js';
import {createEditorToken} from '../lib/editor-auth.js';

const valid={decision:'confirmed',thumbnail_url:'https://example.com/image.png',source_url:'https://example.com/press',rights_url:'https://example.com/terms',usage_scope:{thumbnail:true,advertising:false}};
test('confirmation requires source, evidence and thumbnail permission',()=>{
  assert.ok(parseImageRights(valid));
  for(const changes of [{rights_url:''},{source_url:''},{usage_scope:{}},{usage_scope:{thumbnail:true,website_republication:false}},{rights_url:'javascript:alert(1)'},{usage_scope:{thumbnail:'true'}},{expires_at:'2000-01-01'}]) assert.equal(parseImageRights({...valid,...changes}),null);
  assert.ok(parseImageRights({...valid,decision:'pending',rights_url:'',usage_scope:{}}));
});
test('rights writes require editor authentication and same origin',async()=>{
  process.env.EDITOR_SECRET='test-only-secret';
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  const req={method:'POST',body:{...valid,id:1,action:'image_rights'},headers:{host:'example.com'}};
  const unauthorized=response(); await handler(req,unauthorized);assert.equal(unauthorized.code,401);
  const foreign=response(); await handler({...req,headers:{...req.headers,cookie:'ilovegame_editor='+createEditorToken(process.env.EDITOR_SECRET),origin:'https://other.example'}},foreign);assert.equal(foreign.code,403);
});
test('changed thumbnail is rejected; save targets only rights table',async()=>{
  const previous=globalThis.fetch; const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(null,{status:201});};
  try{
    const record=parseImageRights(valid);
    assert.equal(await saveImageRights('https://db.invalid','key',1,record,{thumbnail_url:'https://example.com/other.png'}),false);
    assert.equal(calls.length,0);
    assert.equal(await saveImageRights('https://db.invalid','key',1,record,{thumbnail_url:valid.thumbnail_url}),true);
    assert.match(calls[0].url,/\/article_image_rights\?on_conflict=article_id$/);
    const data=JSON.parse(calls[0].options.body);
    assert.equal(data.article_id,1);assert.equal(data.thumbnail_url,valid.thumbnail_url);assert.ok(data.verified_at);assert.equal(data.usage_scope.advertising,false);
    assert.equal('status' in data,false);
  }finally{globalThis.fetch=previous;}
});
