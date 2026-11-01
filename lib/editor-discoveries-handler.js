import { CatalogError } from './catalog-database.js';
import { readDiscovery, readDiscoveryQuery, readDiscoveryReview } from './game-discovery-input.js';
import { listDiscoveries, registerDiscovery, reviewDiscovery } from './game-discovery-repository.js';
// Authentication, origin and catalog feature checks are owned by the shared API entry point.
export async function handleDiscoveries(req,res,{url,key}) {
  if(process.env.GAME_DISCOVERIES_ENABLED!=='true')return res.status(503).json({error:'発見候補は現在準備中です。'});
  try {
    if(req.method==='GET') {
      const query=readDiscoveryQuery(req.query);
      if(!query)return res.status(400).json({error:'候補の表示条件が正しくありません。'});
      return res.status(200).json(await listDiscoveries(url,key,query));
    }
    if(req.body?.action==='register') {
      if(Object.keys(req.body).some(k=>!['action','candidate'].includes(k)))return res.status(400).json({error:'Invalid request'});
      const input=readDiscovery(req.body.candidate);
      if(!input)return res.status(400).json({error:'作品名・面白そうな点・出典URLを確認してください。'});
      return res.status(200).json({candidate:await registerDiscovery(url,key,input)});
    }
    const review=readDiscoveryReview(req.body);
    if(!review)return res.status(400).json({error:'候補の操作が正しくありません。'});
    return res.status(200).json({candidate:await reviewDiscovery(url,key,review)});
  }catch(error) {
    const code=error instanceof CatalogError && [400,404,409].includes(error.status)?error.status:502;
    return res.status(code).json({error:code===409?'候補の状態が変わったか、対象作品が見つかりません。再読み込みして確認してください。':'候補を取得・保存できませんでした。登録中の場合は同じ入力で再試行できます。'});
  }
}
