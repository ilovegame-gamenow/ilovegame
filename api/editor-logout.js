import { requireEditor } from "../lib/editor-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireEditor(req, res)) return;

  res.setHeader(
    "Set-Cookie",
    "ilovegame_editor=; HttpOnly; Secure; SameSite=Strict; Path=/api/; Max-Age=0"
  );

  return res.status(200).json({ ok: true });
}
