import { collectMediaPreview,mediaArticleUrl,MEDIA_SOURCE } from './media-discovery-preview.js';
import { findArticleBySource,createMediaArticle } from './article-draft-repository.js';
// Authentication, POST-only and same-origin checks are owned by editor-save.
export async function handleMediaArticleRegistration(req,res){
  if(process.env.MEDIA_DISCOVERY_ENABLED!=='true')return res.status(503).json({error:'メディアからの記事登録は準備中です。'});
  const body=req.body;
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','source_url'].includes(k))||typeof body.source_url!=='string'||body.source_url.length>2000||mediaArticleUrl(body.source_url)!==body.source_url)return res.status(400).json({error:'見出し一覧から記事を選び直してください。'});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return res.status(503).json({error:'Database unavailable'});
  try{
    const existing=await findArticleBySource(url,key,body.source_url);
    if(existing)return res.status(200).json({article:{...existing,created:false}});
    const data=await collectMediaPreview();
    const item=data.items.find(item=>item.url===body.source_url);
    if(!item)return res.status(409).json({error:'この記事は現在の取得範囲にありません。一覧を取得し直して確認してください。'});
    return res.status(200).json({article:await createMediaArticle(url,key,item,MEDIA_SOURCE.name)});
  }catch{return res.status(502).json({error:'記事を登録できませんでした。同じボタンから再試行できます。登録済みの場合は既存の記事を開きます。'});}
}
