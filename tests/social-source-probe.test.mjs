import test from 'node:test';import assert from 'node:assert/strict';
import { summarizeBlueskyProbe,probeBlueskyOfficialPosts,BLUESKY_PROBE } from '../lib/social-source-probe.js';
const post=(id='abc')=>({post:{uri:`at://did:plc:abc/app.bsky.feed.post/${id}`,author:{did:'did:plc:abc',handle:BLUESKY_PROBE.actor},record:{$type:'app.bsky.feed.post',createdAt:'2026-11-01T00:00:00Z',text:'Not copied into the report'},likeCount:0,repostCount:4}});
test('probe distinguishes missing statistics from zero and does not copy post text',()=>{
 const result=summarizeBlueskyProbe({feed:[post()]},'2026-11-01T01:00:00Z');
 assert.equal(result.posts[0].metrics.likes,0);assert.equal(result.posts[0].metrics.quotes,null);
 assert.equal(result.posts[0].metrics.reposts,4);assert.ok(!JSON.stringify(result).includes('Not copied'));
});
test('probe ignores reposts, replies, wrong authors, malformed identities and duplicate posts',()=>{
 const repost={...post(),reason:{$type:'app.bsky.feed.defs#reasonRepost'}};
 const reply=post();reply.post.record.reply={};
 const foreign=post();foreign.post.author.handle='another.example';
 const malformed=post();malformed.post.uri='https://evil.example';
 for(const entry of [repost,reply,foreign,malformed])assert.equal(summarizeBlueskyProbe({feed:[entry]}).posts.length,0);
 assert.equal(summarizeBlueskyProbe({feed:[post(),post()]}).posts.length,1);
 assert.equal(summarizeBlueskyProbe({feed:Array.from({length:20},(_,i)=>post(String(i)))}).posts.length,5);
 assert.throws(()=>summarizeBlueskyProbe({}));
});
test('probe uses exactly one fixed public request, no credentials and no retries',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;const parsed=new URL(url);assert.equal(parsed.origin,'https://public.api.bsky.app');
  assert.equal(parsed.pathname,'/xrpc/app.bsky.feed.getAuthorFeed');assert.equal(parsed.searchParams.get('limit'),'5');
  assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);
  return Response.json({feed:[post()]});
 };
 try{assert.equal((await probeBlueskyOfficialPosts()).posts.length,1);assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
