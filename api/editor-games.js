import { handleSocialEvidence } from '../lib/social-evidence.js';
import { handleSourcePreviews } from '../lib/editor-source-previews-handler.js';
import { requireEditor, requireEditorOrigin } from '../lib/editor-auth.js';
import { readGameInput, readGameQuery, isGameId, isArticleId } from '../lib/game-catalog-input.js';
import { CatalogError, searchGames, createGame, getArticleGames, changeArticleGame } from '../lib/game-catalog-repository.js';
import { handleDiscoveries } from '../lib/editor-discoveries-handler.js';
import { handleResearch } from '../lib/editor-research-handler.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ error:'Method not allowed' });
  }
  if (!requireEditor(req,res)) return;
  if (req.method === 'POST' && !requireEditorOrigin(req,res)) return;
  if (process.env.GAME_CATALOG_ENABLED !== 'true') return res.status(503).json({ error:'作品管理は現在準備中です。記事管理は引き続き利用できます。' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ error:'作品データベースに接続できません。' });
  const {resource,...query}=req.query || {};
  if(resource==='social-evidence') return handleSocialEvidence({...req,query},res,{url,key});
  if(resource==='discoveries') return handleDiscoveries({...req,query},res,{url,key});
  if(['steam-media','showcase','bluesky-preview'].includes(resource))return handleSourcePreviews({...req,query},res,{url,key},resource);
  if(resource==='research') return handleResearch({...req,query},res,{url,key});
  if(resource!==undefined) return res.status(400).json({error:'Invalid resource'});
  try {
    if (req.method === 'GET') {
      const query = readGameQuery(req.query);
      if (!query) return res.status(400).json({ error:'検索条件が正しくありません。' });
      const catalog = await searchGames(url,key,query);
      const linkedGames = query.articleId === null ? [] : await getArticleGames(url,key,query.articleId);
      return res.status(200).json({ ...catalog, linkedGames });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error:'Invalid request' });
    if (body.action === 'create') {
      if (Object.keys(body).some(k => !['action','game'].includes(k))) return res.status(400).json({ error:'Invalid request' });
      const input = readGameInput(body.game);
      if (!input) return res.status(400).json({ error:'作品名・出典URL・入力文字数を確認してください。' });
      const game = await createGame(url,key,input);
      return res.status(200).json({ game });
    }
    if (!['link','unlink'].includes(body.action) || !isArticleId(body.article_id) || !isGameId(body.game_id)
        || Object.keys(body).some(k => !['action','article_id','game_id'].includes(k))) {
      return res.status(400).json({ error:'関連づけの指定が正しくありません。' });
    }
    await changeArticleGame(url,key,body.article_id,body.game_id,body.action);
    return res.status(200).json({ ok:true });
  } catch (error) {
    if (error instanceof CatalogError && error.status === 409) {
      return res.status(409).json({ error:'登録内容が競合したか、記事・作品が削除されています。保存状態を再確認してください。' });
    }
    return res.status(502).json({ error:'作品情報を取得・保存できませんでした。保存操作の場合は同じ入力のまま再試行するか、一覧で登録状態を確認してください。' });
  }
}
