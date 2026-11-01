import { isGameId } from './game-catalog-input.js';
import { CatalogError } from './catalog-database.js';
import { getResearchRun } from './game-research-repository.js';
import { prepareSteamResearch,executeSteamResearch } from './game-researcher.js';
import { RESEARCH_MODEL,ESTIMATED_MAX_USD } from './game-research-ai.js';
export async function handleResearch(req,res,{url,key}) {
  if(process.env.GAME_DISCOVERIES_ENABLED!=='true'||process.env.GAME_RESEARCH_ENABLED!=='true')return res.status(503).json({error:'AIリサーチは現在準備中です。'});
  const config={source:'Steamの近日登場',maxItems:3,model:RESEARCH_MODEL,estimatedMaxUsd:ESTIMATED_MAX_USD,dailyLimit:3};
  try{
    if(req.method==='GET'){
      if(Object.keys(req.query).some(k=>k!=='id')||(req.query.id!==undefined&&!isGameId(req.query.id)))return res.status(400).json({error:'Invalid research ID'});
      const run=req.query.id?await getResearchRun(url,key,req.query.id):null;
      return res.status(200).json({config,run});
    }
    const b=req.body;
    if(!b||!isGameId(b.id)||!['prepare','execute'].includes(b.action)||Object.keys(b).some(k=>!['id','action','confirm_cost'].includes(k)))return res.status(400).json({error:'Invalid research request'});
    if(b.action==='execute'&&b.confirm_cost!==true)return res.status(400).json({error:'対象と概算費用を確認してから実行してください。'});
    if(b.action==='prepare'&&b.confirm_cost!==undefined)return res.status(400).json({error:'Invalid preparation request'});
    if(b.action==='execute'&&!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AIに接続できません。'});
    const run=b.action==='prepare'?await prepareSteamResearch(url,key,b.id):await executeSteamResearch(url,key,b.id,process.env.OPENAI_API_KEY);
    return res.status(200).json({config,run});
  }catch(error){
    const status=error instanceof CatalogError&&[400,404,409].includes(error.status)?error.status:502;
    const message=req.body?.action==='prepare'?'新しいSteam作品の説明文を取得できませんでした。AIは実行していません。':'調査結果を確認できませんでした。状態を読み直してください。AI実行後は料金が発生している場合があり、自動再実行しません。';
    return res.status(status).json({error:status===409?'実行済み・実行中・期限切れ、または1日3回の上限に達しています。状態を再確認してください。':message});
  }
}
