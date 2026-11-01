import crypto from 'node:crypto';
import { isGameId } from './game-catalog-input.js';
import { catalogRequest, CatalogError } from './catalog-database.js';
const signature=(payload,secret)=>crypto.createHmac('sha256',secret).update(`social-evidence-v1:${payload}`).digest('base64url');
export function signSocialPreview(result,secret,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({expires:now+3600000,result})).toString('base64url');
  return `${payload}.${signature(payload,secret)}`;
}
export function readSocialEvidence(body,secret,now=Date.now()) {
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['game_id','post_url','preview_token'].includes(k))||!isGameId(body.game_id)||typeof body.post_url!=='string'||typeof body.preview_token!=='string'||body.preview_token.length>20000)return null;
  const [payload,sig,...extra]=body.preview_token.split('.');
  if(extra.length||!payload||!sig||!(/^[A-Za-z0-9_-]{43}$/).test(sig)||!secret)return null;
  const expected=signature(payload,secret);
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
  try{
    const {expires,result}=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(!Number.isFinite(expires)||expires<=now||expires>now+3600000||result.platform!=='bluesky')return null;
    const post=result.posts.find(p=>p.url===body.post_url);if(!post)return null;
    return {game_id:body.game_id,post_url:post.url,platform:result.platform,actor:result.actor,verified_by:result.verified_by,observed_at:result.observed_at,published_at:post.published_at,...post.metrics};
  }catch{return null;}
}
export async function handleSocialEvidence(req,res,{url,key}) {
  if(process.env.SOCIAL_EVIDENCE_ENABLED!=='true')return res.status(503).json({error:'SNS資料の保存は準備中です。'});
  try{
    if(req.method==='GET'){
      if(Object.keys(req.query).some(k=>k!=='game_id')||!isGameId(req.query.game_id))return res.status(400).json({error:'作品を指定してください。'});
      const params=new URLSearchParams({select:'id,url,source_type,review_status,game_social_observations(*)',game_id:`eq.${req.query.game_id}`,order:'observed_at.desc,id.desc',limit:'100','game_social_observations.limit':'20','game_social_observations.order':'observed_at.desc'});
      return res.status(200).json({sources:await catalogRequest(url,key,`game_sources?${params}`)});
    }
    const input=readSocialEvidence(req.body,process.env.EDITOR_SECRET);
    if(Object.keys(req.query).length||!input)return res.status(400).json({error:'取得結果を再取得し、作品と投稿を選び直してください。取得結果は1時間で期限切れになります。'});
    const saved=await catalogRequest(url,key,'rpc/save_game_social_evidence',{method:'POST',body:JSON.stringify({p_input:input})});
    return res.status(200).json({saved});
  }catch(error){return res.status(error instanceof CatalogError&&error.status===409?409:502).json({error:'資料を保存・取得できませんでした。作品の登録状態を確認し、同じ取得結果のまま再試行できます。'});}
}
