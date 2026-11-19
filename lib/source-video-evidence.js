// Mechanical evidence only. Publication and rights checks remain with the editor.
const ID=/^[A-Za-z0-9_-]{11}$/;
function attr(tag,key){return tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i'))?.slice(1).find(x=>x!==undefined)||null;}
export function extractVideoEvidence(body,sourceUrl,sourceName){
 if(!body)return {status:'unconfirmed',youtubeCandidates:[],officialPage:sourceUrl,reason:'body_unavailable'};
 const clean=body.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\\\//g,'/');
 const candidates=new Map();
 const add=(id,evidence)=>{if(ID.test(id)&&!candidates.has(id))candidates.set(id,{id,url:'https://www.youtube.com/watch?v='+id,evidence});};
 for(const m of clean.matchAll(/(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/g))add(m[1],'article_youtube_link');
 for(const m of clean.matchAll(/\bdata-youtube-id\s*=\s*["']([A-Za-z0-9_-]{11})["']/gi))add(m[1],'article_youtube_player');
 // Nintendo's observed player ID begins with the video ID and has an instance suffix.
 // It is only a candidate until checked against official video metadata; never treat it as proof.
 if(sourceName==='Nintendo')for(const m of clean.matchAll(/<div\b[^>]*class=["'][^"']*\bokra-youtube-inner\b[^"']*["'][^>]*>\s*<div\b[^>]*>/gi)){
   const tag=m[0].slice(m[0].lastIndexOf('<div'));const id=attr(tag,'id');
   if(id&&/^[A-Za-z0-9_-]{11}[A-Za-z0-9_-]{1,40}$/.test(id))add(id.slice(0,11),'nintendo_dynamic_player_candidate');
 }
 const native=/<video\b|<source\b[^>]*\btype\s*=\s*["']video\/|wp-block-video|<iframe\b[^>]*(?:mux\.com|vimeo\.com)|\bokra-youtube-inner\b/i.test(clean);
 const hint=/動画を(?:ご覧|見る|公開)|映像を(?:ご覧|見る|公開)|トレーラー(?:を公開|はこちら)|PV公開/i.test(clean.replace(/<[^>]+>/g,' '));
 const youtubeCandidates=[...candidates.values()].slice(0,12);
 const status=youtubeCandidates.length?'youtube_candidate':native?'official_page_link':hint?'unconfirmed':'no_video_detected';
 return {status,youtubeCandidates,officialPage:sourceUrl,videoMarker:native,reason:status==='unconfirmed'?'video_mentioned_without_player':null};
}
export function normalizePublishedDate(raw,sourceName){
 if(typeof raw!=='string'||!raw.trim())return {value:null,precision:'unknown'};
 raw=raw.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return {value:raw,precision:'date'};
 let value=raw;let basis='explicit_offset';
 if(sourceName==='PR TIMES'&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)){value=raw.replace(' ','T')+'+09:00';basis='prtimes_japan_time_policy';}
 else if(!/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(raw))return {value:null,raw,precision:'timezone_unconfirmed'};
 const d=new Date(value);return Number.isFinite(d.getTime())?{value:d.toISOString(),raw,precision:'timestamp',basis}:{value:null,raw,precision:'invalid'};
}