import { probeBlueskyOfficialPosts } from './social-source-probe.js';
import { getSteamMedia,collectShowcasePreview } from './game-source-previews.js';
import { knownSteamIds } from './game-research-repository.js';
export async function handleSourcePreviews(req,res,{url,key},resource) {
  if(process.env.GAME_DISCOVERIES_ENABLED!=='true')return res.status(503).json({error:'発見候補は現在準備中です。'});
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  if(resource==='bluesky-preview'&&process.env.BLUESKY_PREVIEW_ENABLED!=='true')return res.status(503).json({error:'Blueskyの読み取りプレビューは準備中です。'});
  const q=req.query||{};
  if(resource==='steam-media'&&(Object.keys(q).some(k=>k!=='appid')||typeof q.appid!=='string'||!(/^[1-9][0-9]{0,9}$/).test(q.appid)))return res.status(400).json({error:'Invalid Steam app ID'});
  if(['showcase','bluesky-preview'].includes(resource)&&Object.keys(q).length)return res.status(400).json({error:'Invalid source request'});
  try{
    if(resource==='bluesky-preview')return res.status(200).json(await probeBlueskyOfficialPosts());
    if(resource==='steam-media')return res.status(200).json({images:await getSteamMedia(Number(q.appid))});
    return res.status(200).json(await collectShowcasePreview(ids=>knownSteamIds(url,key,ids)));
  }catch{return res.status(502).json({error:'出典を取得できませんでした。時間をおいて確認してください。'});}
}
