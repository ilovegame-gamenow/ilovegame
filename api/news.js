import { getNewsFeed } from '../lib/news-feed.js';
import { getFeaturedNews } from '../lib/featured-news.js';
import { getPublicDisplaySettings } from "../lib/site-settings.js";

export default async function handler(req, res) {
  if (req.query?.resource === 'calendar') {
    const {handleCalendar}=await import('../lib/release-calendar.js');
    return handleCalendar(req,res);
  }
  if (req.query?.resource !== undefined) return res.status(400).json({ error: 'Invalid resource' });
  res.setHeader("Cache-Control", "no-store");
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables are missing"
      });
    }
    let page = Math.max(1, parseInt(req.query.page, 10) || 1);
    if (!Number.isSafeInteger(page)) page = 1;
    const articleId = req.query.id;
    const homeView = !articleId && req.query.view === 'home';
    const timings=[];
    const measure=async(name,task)=>{const start=performance.now();try{return await task();}finally{timings.push(`${name};dur=${(performance.now()-start).toFixed(1)}`);}};
    const started=performance.now();
    const settingsTask=articleId?null:measure('settings',()=>getPublicDisplaySettings(supabaseUrl,process.env.SUPABASE_SECRET_KEY));
    if (homeView) {
      let expires=Infinity;
      // Slot/article reads overlap settings and search-index reads. A single response still
      // pairs displayed selections with the exact same feed exclusion.
      const featuredTask=measure('featured',()=>getFeaturedNews(supabaseUrl,supabaseKey,process.env.SUPABASE_SECRET_KEY,settingsTask,{
        onExpiry:time=>{expires=Math.min(expires,time);}
      })).catch(()=>null);
      const result=await measure('feed',()=>getNewsFeed(supabaseUrl,supabaseKey,process.env.SUPABASE_SECRET_KEY,settingsTask,req.query,featuredTask));
      timings.push(`home;dur=${(performance.now()-started).toFixed(1)}`);
      res.setHeader('Server-Timing',timings.join(', '));
      // No stale-while-revalidate: expired selections must not be served indefinitely.
      const ttl=Math.min(15,Math.floor((expires-Date.now())/1000));
      if(req.method==='GET' && result.featured && ttl>0){
        res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
        res.setHeader('Vercel-CDN-Cache-Control',`public, s-maxage=${ttl}`);
      }
      return res.status(200).json(result);
    }
    const settings=await settingsTask;
    const limit = articleId ? 1 : settings.public_page_size;
    const offset = (page - 1) * limit;
    const fields =
      "id,title,summary,article_body,ilovegame_point,platforms,category,thumbnail_url,source_name,source_url,source_published_at,importance,is_breaking,status,published_at,created_at,site_published_at";
    const url =
    
    `${supabaseUrl}/rest/v1/published_articles` +
    `?select=${encodeURIComponent(fields)}` +


    (articleId
        ? `&id=eq.${encodeURIComponent(articleId)}&limit=1`
        : `&order=site_published_at.desc.nullslast,id.desc&limit=${limit}&offset=${offset}`);

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "count=exact"
        }
    });

    let data = await response.json();

    if (!response.ok && !(response.status === 416 && !articleId)) {
      return res.status(response.status).json({
        error: "Supabase request failed",
        details: data
      });
    }
    if (articleId) {
      if (!data.length) {
          return res.status(404).json({ error: "記事が見つかりません" });
      }
    return res.status(200).json(data[0]);
    }
    const contentRange = response.headers.get("content-range");
    const total = Number(contentRange?.split("/")[1]);
    if (!contentRange || !Number.isSafeInteger(total) || total < 0) {
      throw new Error("Invalid article count");
    }

    const lastPage = Math.max(1, Math.ceil(total / limit));
    if (page > lastPage) {
      page = lastPage;
      const correctedUrl = new URL(url);
      correctedUrl.searchParams.set("offset", String((page - 1) * limit));
      const corrected = await fetch(correctedUrl, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (!corrected.ok) throw new Error("Failed to fetch corrected page");
      data = await corrected.json();
    }
    return res.status(200).json({
        articles: data,
        total,
        page,
        limit
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
