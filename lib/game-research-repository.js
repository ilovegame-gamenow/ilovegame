import { catalogRequest as request } from './catalog-database.js';
export async function getResearchRun(url,key,id) {
  const q=new URLSearchParams({select:'*',id:`eq.${id}`,limit:'1'});
  const rows=await request(url,key,`game_research_runs?${q}`);return rows[0]||null;
}
export function knownSteamIds(url,key,ids){return request(url,key,'rpc/known_steam_research_ids',{method:'POST',body:JSON.stringify({p_ids:ids})}).then(ids=>ids.map(Number));}
export function prepareResearchRun(url,key,id,sources){return request(url,key,'rpc/prepare_game_research',{method:'POST',body:JSON.stringify({p_id:id,p_sources:sources})});}
export function claimResearchRun(url,key,id){return request(url,key,'rpc/claim_game_research',{method:'POST',body:JSON.stringify({p_id:id})});}
export function completeResearchRun(url,key,id,result){return request(url,key,'rpc/complete_game_research',{method:'POST',body:JSON.stringify({p_id:id,p_result:result})});}
export function failResearchRun(url,key,id){return request(url,key,'rpc/fail_game_research',{method:'POST',body:JSON.stringify({p_id:id})});}
