import { getEditorNews, parseEditorNewsQuery } from "../lib/editor-news-repository.js";
import { getSiteSettings } from "../lib/site-settings.js";
import {
  requireEditor,
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

      setEditorCookie(res, secret);
      return res.status(200).json({ renewed: true });
    }

    return res.status(200).json({ renewed: false });
  }

  // Session checks must remain independent of filters and database availability.
  if (req.query.auth === "check") {
    return res.status(200).json({
      authenticated: true,
      remainingSeconds: getEditorSessionRemainingSeconds(req)
    });
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
  } catch {
    return res.status(503).json({ error: "Settings unavailable" });
  }
  try {
    const result = await getEditorNews({ supabaseUrl, supabaseKey, ...filters, limit:settings.editor_page_size });
    return res.status(200).json(result);
  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
