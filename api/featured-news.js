import { getSiteSettings } from '../lib/site-settings.js';
import { getFeaturedNews } from '../lib/featured-news.js';

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key||!secret)return res.status(503).json({error:'Featured news unavailable'});
  const settings=await getSiteSettings(url,secret);
  return res.status(200).json(await getFeaturedNews(url,key,secret,settings));
 }catch{return res.status(502).json({error:'Featured news unavailable'});}
}
