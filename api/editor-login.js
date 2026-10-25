import { setEditorCookie } from "../lib/editor-auth.js";
import crypto from "node:crypto";

function isSame(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.EDITOR_SECRET;

  if (!secret) {
    return res.status(503).json({
      error: "Editor login unavailable"
    });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;

  if (origin) {
    let originHost;

    try {
      const url = new URL(origin);

      if (url.protocol !== "https:") {
        return res.status(403).json({ error: "Forbidden" });
      }

      originHost = url.host;
    } catch {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (originHost !== host) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const password = req.body?.password;

  if (typeof password !== "string" || password.length > 1024) {
    return res.status(400).json({
      error: "Invalid request"
    });
  }

  if (!isSame(password, secret)) {
    return res.status(401).json({
      error: "Incorrect password"
    });
  }

  // 共通処理で認証Cookieを発行
  setEditorCookie(res, secret);

  return res.status(200).json({ ok: true });
}
