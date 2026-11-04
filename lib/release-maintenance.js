import {catalogRequest,CatalogError} from './catalog-database.js';
import {isGameId} from './game-catalog-input.js';

export async function releaseMaintenanceOverview(url,key){
  const [due,pending,history,recentChecks]=await Promise.all([
    catalogRequest(url,key,'rpc/list_game_release_rechecks',{method:'POST',body:JSON.stringify({p_limit:20})}),
    catalogRequest(url,key,'game_release_checks?select=id,release_id,source_values,before_values,proposed,reason,evidence,checked_at,source:game_sources(url,review_status),release:game_releases(updated_at,platform_code,region_code,game:games(title))&resolution=eq.pending&order=checked_at.asc,id.asc&limit=21'),
    catalogRequest(url,key,'game_release_history?select=id,before_values,after_values,changed_at,release:game_releases(platform_code,region_code,game:games(title))&order=changed_at.desc,id.desc&limit=10'),
    catalogRequest(url,key,'game_release_checks?select=id,outcome,resolution,reason,evidence,checked_at,release:game_releases(platform_code,region_code,game:games(title))&order=checked_at.desc,id.desc&limit=10')
  ]);
  return {due,pending:pending.slice(0,20),hasMorePending:pending.length>20,history,recentChecks};
}

export async function handleReleaseMaintenance(req,res,{url,key}){
  if(process.env.GAME_RELEASE_MAINTENANCE_ENABLED!=='true')return res.status(503).json({error:'発売日の再確認機能は準備中です。'});
  if(Object.keys(req.query??{}).length)return res.status(400).json({error:'検索条件を確認してください。'});
  try{
    if(req.method==='GET')return res.status(200).json(await releaseMaintenanceOverview(url,key));
    const b=req.body;
    if(!b||Array.isArray(b)||Object.keys(b).some(k=>!['action','id','expected_updated_at'].includes(k))
      ||!['apply','reject'].includes(b.action)||!isGameId(b.id)||typeof b.expected_updated_at!=='string'
      ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(b.expected_updated_at)
      ||!Number.isFinite(Date.parse(b.expected_updated_at)))return res.status(400).json({error:'変更内容を読み直してください。'});
    const check=await catalogRequest(url,key,'rpc/resolve_game_release_check',{
      method:'POST',body:JSON.stringify({p_id:b.id,p_expected_updated_at:b.expected_updated_at,p_decision:b.action})
    });
    return res.status(200).json({check});
  }catch(error){
    const status=error instanceof CatalogError&&[400,404,409].includes(error.status)?error.status:502;
    return res.status(status).json({error:status===409?'発売情報か確認状態が変わりました。一覧を読み直してください。':'発売日の確認情報を取得・保存できませんでした。'});
  }
}
