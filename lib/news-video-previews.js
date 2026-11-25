import { articleVideoUrl, youtubeVideoId } from '../game-source-utils.js';
import { catalogRequest } from './catalog-database.js';

// Only fetch article bodies for cards which genuinely lack a still image.
// Do not send the bodies to the list client or turn a video into thumbnail_url.
export async function addNewsVideoPreviews(rows,url,key,table='published_articles') {
  const ids=rows.filter(a=>(a.thumbnail_url===null||a.thumbnail_url==='')&&Number.isSafeInteger(a.id)&&a.id>0).map(a=>a.id);
  if(!ids.length)return rows;
  try {
    const params=new URLSearchParams({select:'id,article_body',id:'in.('+ids.join(',')+')'});
    const details=await catalogRequest(url,key,table+'?'+params);
    const previews=new Map(details.map(a=>[a.id,youtubeVideoId(articleVideoUrl({article_body:a.article_body}))]));
    return rows.map(a=>previews.get(a.id)?{...a,video_preview_id:previews.get(a.id)}:a);
  } catch { return rows; }
}
