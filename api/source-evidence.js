import { timingSafeEqual } from 'node:crypto';
import { validSource, sourceArticleUrl, listEvidence, getArticleEvidence } from '../lib/source-evidence.js';
function authorized(req){const secret=process.env.SOURCE_EVIDENCE_SECRET;const actual=req.headers?.authorization;if(!secret||typeof actual!=='string')return false;const expected=Buffer.from('Bearer '+secret),received=Buffer.from(actual);return expected.length===received.length&&timingSafeEqual(expected,received);}
export default async function handler(req,res){
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Authorization');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 const q=req.query||{},source=q.source,id=q.id;
 if(Object.keys(q).some(k=>!['source','id','page','include_text'].includes(k))||!validSource(source)||[q.id,q.page,q.include_text].some(v=>v!==undefined&&typeof v!=='string'))return res.status(400).json({error:'Invalid source request'});
 if((id!==undefined&&(!sourceArticleUrl(source,id)||q.page!==undefined))||(id===undefined&&q.include_text!==undefined)||(q.include_text!==undefined&&q.include_text!=='1')||(q.page!==undefined&&(!/^[1-5]$/.test(q.page)||(source!=='nintendo'&&q.page!=='1'))))return res.status(400).json({error:'Invalid source request'});
 const includeText=q.include_text==='1';
 if(includeText&&!authorized(req))return res.status(401).json({error:'Authorized source evidence access required'});
 try{
  const result=id!==undefined?await getArticleEvidence(source,id,{includeText}):await listEvidence(source,q.page===undefined?1:Number(q.page));
  if(!includeText)res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=60');
  return res.status(200).json({schemaVersion:1,ok:true,...result});
 }catch(error){return res.status(502).json({schemaVersion:1,ok:false,source,error:error.name==='TimeoutError'?'source_timeout':error.status?'upstream_http_'+error.status:'source_unavailable'});}
}