import crypto from "node:crypto";

const COOKIE_NAME = "ilovegame_editor";
export const SESSION_SECONDS = 60 * 60;

function sign(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function isSame(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

// 有効期限付きの認証トークンを生成
export function createEditorToken(secret) {
  const expires =
    Math.floor(Date.now() / 1000) + SESSION_SECONDS;

  const payload = String(expires);
  const signature = sign(payload, secret);

  return `${payload}.${signature}`;
}

// 認証Cookieを設定
export function setEditorCookie(res, secret) {
  const token = createEditorToken(secret);

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/; Max-Age=${SESSION_SECONDS}`
  );
}

// Cookieから認証トークンを取得
function getEditorToken(req) {
  const cookieHeader = req.headers.cookie || "";

  const cookie = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;

  return cookie.slice(COOKIE_NAME.length + 1);
}

// トークンの署名と有効期限を確認
export function isEditorAuthenticated(req) {
  const secret = process.env.EDITOR_SECRET;
  if (!secret) return false;

  const token = getEditorToken(req);
  if (!token) return false;

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

// 編集室APIの認証確認
export function requireEditor(req, res) {
  if (isEditorAuthenticated(req)) return true;

  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: "Unauthorized" });

  return false;
}

/**
 * 認証済みセッションの残り時間を秒単位で取得
 * 無効・期限切れの場合は 0 を返す
 */
export function getEditorSessionRemainingSeconds(req) {
  if (!isEditorAuthenticated(req)) return 0;

  const token = getEditorToken(req);
  if (!token) return 0;

  const [payload] = token.split(".");
  const expires = Number(payload);
  const now = Math.floor(Date.now() / 1000);

  return Math.max(0, expires - now);
}
