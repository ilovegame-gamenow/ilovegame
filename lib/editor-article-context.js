import { catalogRequest as request } from './catalog-database.js';
import { isArticleId, isGameId } from './game-catalog-input.js';
import { getArticleGames } from './game-catalog-repository.js';

export async function handleArticleContext(req,res,{url,key}) {
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const q=req.query||{},articleId=Number(q.article_id);
 const article=typeof q.article_id==='string'&&/^[1-9]\d*$/.test(q.article_id)&&isArticleId(articleId);
 const game=isGameId(q.game_id);
 if(Object.keys(q).length!==1||(!article&&!game))return res.status(400).json({error:'対象が正しくありません。'});
 try{
  if(article){
   const [games,contexts]=await Promise.all([
    getArticleGames(url,key,articleId),
    request(url,key,`article_discovery_context?${new URLSearchParams({select:'channel,trigger_reason,selection_reason,evidence_url,observed_at',article_id:`eq.${articleId}`,limit:'1'})}`)
   ]);
   const ids=games.map(g=>g.id).filter(isGameId);
   const following=ids.length?await request(url,key,`game_following?${new URLSearchParams({select:'game_id,is_favorite',game_id:`in.(${ids.join(',')})`})}`):[];
   const discoveries=ids.length?await request(url,key,`game_discoveries?${new URLSearchParams({select:'adopted_game_id,reason,source_url,observed_at',adopted_game_id:`in.(${ids.join(',')})`,order:'observed_at.desc',limit:'50'})}`):[];
   return res.status(200).json({games:games.map(g=>({...g,is_favorite:following.some(f=>f.game_id===g.id&&f.is_favorite)})),contexts,discoveries:discoveries.map(d=>({...d,game_title:games.find(g=>g.id===d.adopted_game_id)?.title||''}))});
  }
  const links=await request(url,key,`article_games?${new URLSearchParams({select:'article_id',game_id:`eq.${q.game_id}`,order:'created_at.desc',limit:'20'})}`);
  const ids=links.map(r=>r.article_id).filter(isArticleId);
  const contexts=ids.length?await request(url,key,`article_discovery_context?${new URLSearchParams({select:'article_id,channel,trigger_reason,selection_reason,evidence_url,observed_at',article_id:`in.(${ids.join(',')})`,order:'observed_at.desc',limit:'20'})}`):[];
  const discoveries=await request(url,key,`game_discoveries?${new URLSearchParams({select:'reason,source_url,observed_at',adopted_game_id:`eq.${q.game_id}`,order:'observed_at.desc',limit:'10'})}`);
  return res.status(200).json({contexts,discoveries});
 }catch{return res.status(502).json({error:'作品・発見理由を読み込めませんでした。再読み込みしてください。'});}
}
