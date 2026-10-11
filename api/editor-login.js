
import crypto from "node:crypto";

const COOKIE_NAME = "ilovegame_editor";
const SESSION_SECONDS = 60 * 60 * 8;

function sign(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function isSame(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.EDITOR_SECRET;

  if (!secret) {
    return res.status(503).json({ error: "Editor login unavailable" });
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
    return res.status(400).json({ error: "Invalid request" });
  }

  if (!isSame(password, secret)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  const signature = sign(payload, secret);
  const token = `${payload}.${signature}`;

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/; Max-Age=${SESSION_SECONDS}`
  );

  return res.status(200).json({ ok: true });
}
