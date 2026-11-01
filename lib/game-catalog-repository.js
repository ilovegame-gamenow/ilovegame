import { GAME_PAGE_SIZE } from './game-catalog-input.js';

export class CatalogError extends Error {
  constructor(status) { super('Catalog database request failed'); this.status = status; }
}
// All catalog persistence lives here; no collectors, AI calls or article-content writes.
async function request(url, key, path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...options.headers }
  });
  if (!response.ok) throw new CatalogError(response.status);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
export async function searchGames(url, key, { q, page }) {
  const rows = await request(url, key, 'rpc/search_editor_games', {
    method:'POST', body:JSON.stringify({ p_query:q, p_offset:(page-1)*GAME_PAGE_SIZE })
  });
  return { games:rows.slice(0,GAME_PAGE_SIZE), hasMore:rows.length>GAME_PAGE_SIZE, page };
}
export async function createGame(url, key, input) {
  return request(url, key, 'rpc/create_editor_game', {
    method:'POST', body:JSON.stringify(Object.fromEntries(Object.entries(input).map(([k,v])=>[`p_${k}`,v])))
  });
}
export async function getArticleGames(url, key, articleId) {
  const params = new URLSearchParams({ select:'game:games(id,title,original_title,description,status)', article_id:`eq.${articleId}`, order:'created_at.asc,game_id.asc' });
  const rows = await request(url,key,`article_games?${params}`);
  return rows.map(row => row.game);
}
export async function changeArticleGame(url, key, articleId, gameId, action) {
  if (action === 'link') {
    // Atomic insert, with duplicate clicks/retries treated as a successful no-op.
    await request(url,key,'article_games?on_conflict=article_id,game_id', {
      method:'POST', headers:{ Prefer:'resolution=ignore-duplicates,return=minimal' },
      body:JSON.stringify({ article_id:articleId, game_id:gameId })
    });
  } else {
    const params = new URLSearchParams({ article_id:`eq.${articleId}`, game_id:`eq.${gameId}` });
    await request(url,key,`article_games?${params}`, { method:'DELETE' });
  }
}
