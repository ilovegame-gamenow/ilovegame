import { readPublicText, readPublicJson } from './public-source-client.js';
import { parsePlayStationRss } from './collectors/playstation.js';
import { extractPlayStationArticleHtml } from './playstation-extractor.js';
import { cleanArticleHtml } from './html-text-cleaner.js';
import { extractVideoEvidence, normalizePublishedDate } from './source-video-evidence.js';

const sources = Object.freeze({nintendo:'Nintendo',playstation:'PlayStation',prtimes:'PR TIMES'});
const PR_LIST='https://prtimes.jp/main/html/searchbiscate/busi_cate_id/008/lv2/22/';
const PS_RSS='https://blog.ja.playstation.com/feed/';
const ARTICLE_LIMIT=2500000;
const IMAGE_HOSTS=new Set(['assets.topics.apps-jp.nintendo.com','topics-cdn.nintendo.co.jp','www.nintendo.com','blog.ja.playstation.com','live.staticflickr.com','prcdn.freetls.fastly.net','cdn.prtimes.jp']);
export const validSource = source => typeof source==='string' && Object.hasOwn(sources,source);
export function sourceArticleUrl(source,id){
  if(typeof id!=='string')return null;
  if(source==='nintendo'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return 'https://www.nintendo.com/jp/topics/article/'+id.toLowerCase();
  if(source==='playstation'&&/^\d{4}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/[a-z0-9-]{1,180}$/i.test(id))return 'https://blog.ja.playstation.com/'+id+'/';
  if(source==='prtimes'&&/^\d{9}\.\d{9}$/.test(id))return 'https://prtimes.jp/main/html/rd/p/'+id+'.html';
  return null;
}
function attr(tag,key){return tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i'))?.slice(1).find(x=>x!==undefined)||null;}
function decode(v){return String(v??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");}
function meta(html,key){for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){if([attr(tag,'property'),attr(tag,'name')].includes(key))return decode(attr(tag,'content'));}return null;}
function safeHttps(value,base){try{if(!value)return null;const u=new URL(decode(value),base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}}
function articleId(source,url){const u=safeHttps(url);if(!u)return null;
 let id;
 if(source==='nintendo'&&u.hostname==='www.nintendo.com')id=u.pathname.match(/^\/jp\/topics\/article\/([^/]+)\/?$/)?.[1];
 if(source==='playstation'&&u.hostname==='blog.ja.playstation.com')id=u.pathname.slice(1).replace(/\/$/,'');
 if(source==='prtimes'&&u.hostname==='prtimes.jp')id=u.pathname.match(/^\/main\/html\/rd\/p\/(\d{9}\.\d{9})\.html$/)?.[1];
 return sourceArticleUrl(source,id)?id:null;
}
export function parsePrTimesList(html){
 const results=new Map();
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
   const url=safeHttps(attr(m[1],'href'),PR_LIST);
   const id=url&&articleId('prtimes',url.href);
   if(!id)continue;
   const title=cleanArticleHtml(m[2]).slice(0,300)||null;
   if(!results.has(id)||(!results.get(id).source_title&&title))results.set(id,{id,source_title:title,source_url:sourceArticleUrl('prtimes',id),source_published_at:null,thumbnail_url:null});
 }
 return [...results.values()];
}
async function boundedRead(url,maxBytes,headers={}){
 // One retry only for timeout or temporary upstream failure. Never retry access denial.
 try{return await readPublicText(url,maxBytes,headers,18000);}
 catch(error){if(error.name!=='TimeoutError'&&![502,503,504].includes(error.status))throw error;}
 return readPublicText(url,maxBytes,headers,12000);
}
export async function listEvidence(source,page=1){
 if(!validSource(source)||!Number.isInteger(page)||page<1||page>5||(source!=='nintendo'&&page!==1))throw Error('Unsupported source or page');
 let rows;
 if(source==='nintendo'){
  const data=JSON.parse(await boundedRead('https://www.nintendo.com/jp/topics/c/_/v0/posts/search?page='+page,1000000,{Accept:'application/json'}));
  if(!Array.isArray(data))throw Error('Unexpected Nintendo response');
  rows=data.map(a=>({id:a.slug,source_title:a.title,source_url:sourceArticleUrl(source,a.slug),source_published_at:a.display_date,thumbnail_url:a.thumbnail?.url_key ? safeHttps(a.thumbnail.url_key,'https://assets.topics.apps-jp.nintendo.com/image/')?.href||null : null})).filter(a=>a.source_url);
 }else if(source==='playstation'){
  rows=parsePlayStationRss(await boundedRead(PS_RSS,1500000,{Accept:'application/rss+xml,application/xml,text/xml'})).map(a=>({...a,id:articleId(source,a.source_url)})).filter(a=>a.id);
 }else rows=parsePrTimesList(await boundedRead(PR_LIST,2500000));
 return {source,source_name:sources[source],page,items:rows.slice(0,40).map(a=>({id:a.id,source_title:a.source_title,source_url:a.source_url,published:normalizePublishedDate(a.source_published_at,sources[source]),thumbnail_candidate:a.thumbnail_url||null})),coverage:source==='playstation'?'current_rss_only':source==='prtimes'?'category_first_page_only':'requested_page_only',truncated:rows.length>40};
}
function articleBody(source,html){
 if(source==='playstation')return extractPlayStationArticleHtml(html);
 return html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]||html.match(/<main\b[\s\S]*?<\/main>/i)?.[0]||null;
}
async function imageCheck(value,base){
 const u=safeHttps(value,base);
 if(!u)return {verified:false,url:null,reason:'not_found'};
 if(!IMAGE_HOSTS.has(u.hostname))return {verified:false,url:u.href,reason:'unregistered_image_host'};
 try{
  const r=await fetch(u,{headers:{Range:'bytes=0-1023'},redirect:'error',signal:AbortSignal.timeout(8000)});
  const type=r.headers.get('content-type')||'';
  let bytes=0;
  if(r.ok&&r.body){const reader=r.body.getReader();const chunk=await reader.read();bytes=chunk.value?.length||0;await reader.cancel();}else await r.body?.cancel();
  return {url:u.href,verified:r.ok&&type.startsWith('image/')&&bytes>0,status:r.status,type};
 }catch(error){return {url:u.href,verified:false,reason:error.name};}
}
async function videoMetadata(candidate){
 try{
  const query='https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(candidate.url);
  const data=await readPublicJson(query,{maxBytes:64000,timeoutMs:8000,headers:{Accept:'application/json'}});
  const valid=data.type==='video'&&typeof data.html==='string'&&data.html.includes('/embed/'+candidate.id);
  return {...candidate,metadataVerified:valid,title:data.title||null,author:data.author_name||null,authorUrl:data.author_url||null,publicationApproval:'editor_check'};
 }catch(error){return {...candidate,metadataVerified:false,reason:error.status?'http_'+error.status:error.name,publicationApproval:'editor_check'};}
}
export async function getArticleEvidence(source,id,{includeText=false}={}){
 const url=sourceArticleUrl(source,id);if(!url)throw Error('Invalid article ID');
 const html=await boundedRead(url,ARTICLE_LIMIT);
 const body=articleBody(source,html);
 const bodyText=body?cleanArticleHtml(body):'';
 const evidence=extractVideoEvidence(body,url,sources[source]);
 const date=meta(html,'article:published_time')||html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]||null;
 const [image,videos]=await Promise.all([imageCheck(meta(html,'og:image'),url),Promise.all(evidence.youtubeCandidates.map(videoMetadata))]);
 return {source,source_name:sources[source],source_url:url,source_title:cleanArticleHtml(body?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').slice(0,300)||meta(html,'og:title')||cleanArticleHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,300)||null,
 published:normalizePublishedDate(date,sources[source]),body:{available:!!bodyText,characters:bodyText.length,...(includeText?{text:bodyText}:{}),reason:bodyText?null:'article_body_not_found'},
 image,video:{...evidence,youtubeCandidates:videos},fetched_at:new Date().toISOString()};
}
