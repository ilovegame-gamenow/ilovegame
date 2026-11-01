import { requireEditor, requireEditorOrigin } from '../lib/editor-auth.js';
import { getSiteSettings, saveSiteSettings, validateSettings, settingRules } from '../lib/site-settings.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireEditor(req, res)) return;
  if (req.method === 'POST') {
    if (!requireEditorOrigin(req, res)) return;
    if (!validateSettings(req.body)) return res.status(400).json({ error: '設定値の範囲・しきい値の大小関係・評価方針を確認してください' });
  }
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    const settings = req.method === 'POST'
      ? await saveSiteSettings(url, key, req.body)
      : await getSiteSettings(url, key);
    return res.status(200).json({ settings, rules: settingRules });
  } catch (error) {
    console.error('Editor settings request failed:', error);
    return res.status(503).json({ error: '設定を取得・保存できませんでした。時間をおいて再確認してください。' });
  }
}
