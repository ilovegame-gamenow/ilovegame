
import crypto from "node:crypto";

const COOKIE_NAME = "ilovegame_editor";

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

export function isEditorAuthenticated(req) {
  const secret = process.env.EDITOR_SECRET;
  if (!secret) return false;

  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return false;

  const token = cookie.slice(COOKIE_NAME.length + 1);
  const parts = token.split(".");

  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

  if (!/^\d{10}$/.test(payload)) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;

  const expires = Number(payload);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isSafeInteger(expires) || expires <= now) {
    return false;
  }

  const expected = sign(payload, secret);
  return isSame(signature, expected);
}

export function requireEditor(req, res) {
  if (isEditorAuthenticated(req)) return true;

  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: "Unauthorized" });
  return false;
}
