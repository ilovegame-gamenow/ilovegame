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

  // ここから下は既存のGET処理

  // 編集室のログイン状態だけを確認する
  // 記事データやSupabaseにはアクセスしない
  
if (req.query.auth === "check") {
  return res.status(200).json({
    authenticated: true,
    remainingSeconds: getEditorSessionRemainingSeconds(req)
  });
}

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const status = req.query.status || "all";
  const allowedStatuses = ["all", "published", "pending", "rejected"];

  if (typeof status !== "string" || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  let page = Number(req.query.page || 1);

  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
    return res.status(400).json({ error: "Invalid page" });
  }

  let limit;
  try {
    limit = (await getSiteSettings(supabaseUrl, supabaseKey)).editor_page_size;
  } catch {
    return res.status(503).json({ error: "Settings unavailable" });
  }
  const offset = (page - 1) * limit;

  const params = new URLSearchParams({
    select: "id,title,summary,thumbnail_url,source_name,platforms,created_at,published_at,status,importance,processing_status,manually_reviewed,site_published_at,source_url",
    order: "id.desc",
    limit: String(limit),
    offset: String(offset)
  });

  if (status !== "all") {
    params.set("status", `eq.${status}`);
  }

  try {
    const countStatuses = ["pending", "published", "rejected"];

const counts = Object.fromEntries(
  await Promise.all(countStatuses.map(async (item) => {
    const countParams = new URLSearchParams({
      select: "id",
      status: `eq.${item}`,
      limit: "0"
    });

    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/articles?${countParams.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact"
        }
      }
    );

    if (!countResponse.ok) throw new Error("Count request failed");

    const range = countResponse.headers.get("content-range");
    const count = range ? Number(range.split("/")[1]) : NaN;

    if (!Number.isFinite(count)) throw new Error("Invalid count");

    return [item, count];
  }))
);
    let response = await fetch(
      `${supabaseUrl}/rest/v1/articles?${params.toString()}`,
      {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "count=exact"
      }
    }
    );

    if (!response.ok && response.status !== 416) throw new Error("Article request failed");
    const range = response.headers.get("content-range");
    const total = range ? Number(range.split("/")[1]) : NaN;
    if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid article count");
    const lastPage = Math.max(1, Math.ceil(total / limit));
    if (page > lastPage) {
      page = lastPage;
      params.set("offset", String((page - 1) * limit));
      response = await fetch(`${supabaseUrl}/rest/v1/articles?${params}`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
    }
    if (!response.ok) throw new Error("Article request failed");
    const articles = await response.json();

    return res.status(200).json({
  articles,
  page,
  limit,
  total,
  counts
});

  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
