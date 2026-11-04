import {catalogRequest} from './catalog-database.js';
import {articleContentSegments} from '../game-source-utils.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
};

// Only explicitly linked articles visible through the public view can supply copy/media.
export async function addWeeklyEditorial(url, key, calendar, publicKey = key) {
  const gameIds = [...new Set(calendar.releases.map(r => r.game.id))].filter(id => uuid.test(id));
  const links = [];
  for (let offset = 0; offset < gameIds.length; offset += 100) {
    const ids = gameIds.slice(offset, offset + 100);
    for (let page = 0; ; page += 500) {
      const query = new URLSearchParams({select:'game_id,article_id',game_id:`in.(${ids.join(',')})`,order:'game_id.asc,article_id.asc',limit:'500',offset:String(page)});
      const rows = await catalogRequest(url, key, `article_games?${query}`);
      if (!Array.isArray(rows)) throw Error('Invalid article links');
      links.push(...rows.filter(r => ids.includes(r.game_id) && Number.isSafeInteger(r.article_id) && r.article_id > 0));
      if (rows.length < 500) break;
      if (page >= 4500) throw Error('Too many article links');
    }
  }
  const articleIds = [...new Set(links.map(r => r.article_id))], articles = [];
  for (let offset = 0; offset < articleIds.length; offset += 100) {
    const ids = articleIds.slice(offset, offset + 100);
    const query = new URLSearchParams({select:'id,summary,ilovegame_point,thumbnail_url,article_body,source_url,site_published_at',id:`in.(${ids.join(',')})`,limit:'100'});
    const rows = await catalogRequest(url, publicKey, `published_articles?${query}`);
    if (!Array.isArray(rows)) throw Error('Invalid public articles');
    articles.push(...rows.filter(a => ids.includes(a.id)));
  }
  articles.sort((a,b) => String(b.site_published_at ?? '').localeCompare(String(a.site_published_at ?? '')) || b.id-a.id);
  return {...calendar, releases:calendar.releases.map(release => {
    const ids = new Set(links.filter(l => l.game_id === release.game.id).map(l => l.article_id));
    const article = articles.find(a => ids.has(a.id));
    if (!article) return release;
    return {...release, image:imageUrl(article.thumbnail_url), editorial:{
      articleId:article.id, summary:String(article.summary ?? ''), point:String(article.ilovegame_point ?? ''),
      videos:articleContentSegments(article).filter(p => p.type === 'video').map(p => p.url)
    }};
  })};
}
