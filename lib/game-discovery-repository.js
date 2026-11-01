import { catalogRequest } from './catalog-database.js';
import { GAME_PAGE_SIZE } from './game-catalog-input.js';
export async function listDiscoveries(url,key,{status,page}) {
  const rows=await catalogRequest(url,key,'rpc/list_game_discoveries',{method:'POST',body:JSON.stringify({p_status:status,p_offset:(page-1)*GAME_PAGE_SIZE})});
  return {candidates:rows.slice(0,GAME_PAGE_SIZE),hasMore:rows.length>GAME_PAGE_SIZE,page};
}
export function registerDiscovery(url,key,candidate) {
  return catalogRequest(url,key,'rpc/register_game_discovery',{method:'POST',body:JSON.stringify(Object.fromEntries(Object.entries(candidate).map(([k,v])=>[`p_${k}`,v])))});
}
export function reviewDiscovery(url,key,{id,action,game_id}) {
  return catalogRequest(url,key,'rpc/review_game_discovery',{method:'POST',body:JSON.stringify({p_id:id,p_action:action,p_game_id:game_id??null})});
}
