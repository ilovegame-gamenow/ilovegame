import { readPublicJson } from './public-source-client.js';
// The account is linked by this developer's official website. No arbitrary account/search input.
export const BLUESKY_PROBE={actor:'amongusstory.bsky.social',limit:5,verifiedBy:'https://www.innersloth.com/among-us-story-on-guard-demo-available-now/'};
const metric=value=>Number.isSafeInteger(value)&&value>=0?value:null;
export function summarizeBlueskyProbe(data,observedAt=new Date().toISOString()) {
  if(!Array.isArray(data?.feed))throw Error('Bluesky response format changed');
  const posts=[];const seen=new Set();let skipped=0;
  for(const entry of data.feed.slice(0,BLUESKY_PROBE.limit)){
    const post=entry?.post,record=post?.record;
    const match=typeof post?.uri==='string'?post.uri.match(/^at:\/\/(did:plc:[a-z0-9]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9]+)$/):null;
    if(entry?.reason||record?.reply||post?.author?.handle!==BLUESKY_PROBE.actor||record?.$type!=='app.bsky.feed.post'||!match||match[1]!==post.author.did||seen.has(post.uri)||typeof record.createdAt!=='string'||!Number.isFinite(Date.parse(record.createdAt))){skipped++;continue;}
    seen.add(post.uri);
    posts.push({url:`https://bsky.app/profile/${BLUESKY_PROBE.actor}/post/${match[2]}`,published_at:record.createdAt,metrics:{likes:metric(post.likeCount),reposts:metric(post.repostCount),replies:metric(post.replyCount),quotes:metric(post.quoteCount)}});
  }
  // No full post text, profile details, scoring or inferred game identity in this feasibility report.
  return {platform:'bluesky',scope:'one-official-account',actor:BLUESKY_PROBE.actor,verified_by:BLUESKY_PROBE.verifiedBy,observed_at:observedAt,requested_limit:BLUESKY_PROBE.limit,returned:Math.min(data.feed.length,BLUESKY_PROBE.limit),skipped,posts};
}
export async function probeBlueskyOfficialPosts() {
  const query=new URLSearchParams({actor:BLUESKY_PROBE.actor,limit:String(BLUESKY_PROBE.limit),filter:'posts_no_replies',includePins:'false'});
  const data=await readPublicJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${query}`);
  return summarizeBlueskyProbe(data);
}
