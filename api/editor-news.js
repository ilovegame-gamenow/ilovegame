import { getEditorNews, parseEditorNewsQuery } from "../lib/editor-news-repository.js";
import { listDataArticles, deleteDataArticles, listRetention, setRetentionProtection } from "../lib/editor-data-management.js";
import { savePublisherDirectory } from "../lib/publisher-directory.js";
import { getSiteSettings, getEditorSessionSeconds } from "../lib/site-settings.js";
import {
  requireEditor,
  requireEditorOrigin,
  setEditorCookie,
  getEditorSessionRemainingSeconds
} from "../lib/editor-auth.js";


export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;


  if (["retention-overview","retention-protection"].includes(req.query.action)) {
    const writing=req.query.action==="retention-protection";
    if(req.method!==(writing?"POST":"GET"))return res.status(405).json({error:"Method not allowed"});
    if(writing&&!requireEditorOrigin(req,res))return;
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
    if(!url||!key)return res.status(503).json({error:"自動整理の情報を取得できません。"});
    try{const result=writing?await setRetentionProtection(url,key,req.body):await listRetention(url,key,req.query);return res.status(result.status).json(result.body);}
    catch{return res.status(503).json({error:"自動整理の情報を確認できませんでした。"});}
  }

  if (req.query.action === "article-data" || req.query.action === "delete-articles") {
    const deleting = req.query.action === "delete-articles";
    if (req.method !== (deleting ? "POST" : "GET")) return res.status(405).json({ error:"Method not allowed" });
    if (deleting && !requireEditorOrigin(req,res)) return;
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return res.status(503).json({error:"データ管理を利用できません。"});
    try {
      const result=deleting?await deleteDataArticles(url,key,req.body):await listDataArticles(url,key,req.query);
      return res.status(result.status).json(result.body);
    } catch {
      return res.status(503).json({error:deleting?"削除結果を確認できません。再検索して状態を確認してください。":"記事一覧を取得できませんでした。"});
    }
  }

  if (req.method === 'POST' && req.query.action === 'publisher') {
    if (!requireEditorOrigin(req,res)) return;
    try {
      const result=await savePublisherDirectory(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,req.body);
      return res.status(result.status).json(result);
    } catch {
      return res.status(503).json({error:'情報元設定を保存できませんでした。'});
    }
  }

  // 操作中のログイン期限を延長する
  if (req.method === "POST") {
    if (req.query.auth !== "renew") {
      return res.status(400).json({ error: "Invalid action" });
    }

    // 同一オリジンからのリクエストだけ許可
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (
      !origin ||
      !host ||
      origin !== `https://${host}` ||
      req.headers["x-editor-action"] !== "renew"
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const remaining = getEditorSessionRemainingSeconds(req);

    
    // 認証が有効ならログイン期限を更新
    if (remaining > 0) {

      const secret = process.env.EDITOR_SECRET;
      if (!secret) {
        return res.status(503).json({ error: "Session unavailable" });
      }

      try {
        const remainingSeconds = await getEditorSessionSeconds();
        if (!requireEditor(req, res)) return;
        setEditorCookie(res, secret, remainingSeconds);
        return res.status(200).json({ renewed: true, remainingSeconds });
      } catch { return res.status(503).json({error:'Session settings unavailable'}); }
    }

    return res.status(200).json({ renewed: false });
  }

  // Session checks must remain independent of filters and database availability.
  if (req.query.auth === "check") {
    let remainingSeconds = getEditorSessionRemainingSeconds(req);
    if (remainingSeconds > 3600) {
      remainingSeconds=3600;
      setEditorCookie(res, process.env.EDITOR_SECRET, remainingSeconds);
    }
    return res.status(200).json({ authenticated:true, remainingSeconds });
  }

  const filters = parseEditorNewsQuery(req.query);
  if (!filters) return res.status(400).json({ error: "Invalid list filters" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }
  let settings;
  try {
    settings = await getSiteSettings(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error("Editor news settings read failed:", error);
    return res.status(503).json({ error: "Settings unavailable" });
  }
  try {
    const result = await getEditorNews({ supabaseUrl, supabaseKey, ...filters, limit:settings.editor_page_size });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Editor news list read failed:", error);
    return res.status(502).json({ error: "Database request failed" });
  }
}
