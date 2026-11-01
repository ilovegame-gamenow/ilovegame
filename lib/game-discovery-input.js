import { isGameId, readGameInput } from './game-catalog-input.js';
export function readDiscovery(input) {
  if(!input || Array.isArray(input) || typeof input!=='object')return null;
  const {reason,...game}=input;
  if(typeof reason!=='string'||!reason.trim()||reason.length>2000)return null;
  const validated=readGameInput(game);
  return validated?{...validated,reason:reason.trim()}:null;
}
export function readDiscoveryQuery(query={}) {
  if(Object.keys(query).some(k=>!['status','page'].includes(k)))return null;
  const status=query.status??'pending',page=query.page??'1';
  if(!['pending','held','adopted'].includes(status)||typeof page!=='string'||!/^[1-9]\d{0,4}$/.test(page)||Number(page)>10001)return null;
  return {status,page:Number(page)};
}
export function readDiscoveryReview(body) {
  if(!body || Array.isArray(body)||!isGameId(body.id)||!['hold','reopen','adopt_new','adopt_existing'].includes(body.action))return null;
  if(Object.keys(body).some(k=>!['id','action','game_id'].includes(k)))return null;
  if(body.action==='adopt_existing'?!isGameId(body.game_id):body.game_id!==undefined)return null;
  return {id:body.id,action:body.action,...(body.game_id?{game_id:body.game_id}:{})};
}
