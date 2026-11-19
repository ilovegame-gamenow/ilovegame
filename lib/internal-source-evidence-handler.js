import {validSource,sourceArticleUrl,listEvidence,getArticleEvidence} from './source-evidence.js';

// This adapter is deployed ONLY in the dedicated information-acquisition project.
// Vercel Authentication (All Deployments) must remain enabled there. The project
// guard prevents exposing full text if this file is accidentally used elsewhere.
const INTERNAL_PROJECT='prj_YN8oB1rGiW2n7r1oOWXwvSGkbCMX';
export function isInternalDeployment(env){
 return env.VERCEL==='1'&&env.VERCEL_PROJECT_ID===INTERNAL_PROJECT&&env.VERCEL_ENV==='production';
}
export function createInternalSourceEvidenceHandler({env=process.env,list=listEvidence,article=getArticleEvidence}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(!isInternalDeployment(env))return res.status(403).json({error:'Internal source evidence unavailable'});
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const q=req.query||{},source=q.source,id=q.id;
  if(Object.hasOwn(q,'url')||!validSource(source)||[id,q.page,q.include_text].some(v=>v!==undefined&&typeof v!=='string')||(id!==undefined&&(!sourceArticleUrl(source,id)||q.page!==undefined))||(id===undefined&&q.include_text!==undefined)||(q.include_text!==undefined&&q.include_text!=='1')||(q.page!==undefined&&(!/^[1-5]$/.test(q.page)||(source!=='nintendo'&&q.page!=='1'))))return res.status(400).json({error:'Invalid source request'});
  try{
   const result=id!==undefined?await article(source,id,{includeText:q.include_text==='1'}):await list(source,q.page===undefined?1:Number(q.page));
   return res.status(200).json({schemaVersion:1,ok:true,access:'internal',...result});
  }catch(error){return res.status(502).json({schemaVersion:1,ok:false,source,error:error.name==='TimeoutError'?'source_timeout':error.status?'upstream_http_'+error.status:'source_unavailable'});}
 };
}
export default createInternalSourceEvidenceHandler();