import { getInformationSources } from '../lib/information-sources.js';
import { requireEditor, requireEditorOrigin, setEditorCookie } from '../lib/editor-auth.js';
import { getSiteSettings, saveSiteSettings, validateSettings, settingRules, validateRetentionSettings, saveRetentionSettings, isSettingsGroup } from '../lib/site-settings.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireEditor(req, res)) return;
  const retention=req.query?.resource==='retention';
  const group=req.query?.resource;
  if(group!==undefined&&!retention&&!isSettingsGroup(group))return res.status(400).json({error:'Invalid resource'});
  if (req.method === 'POST') {
    if (!requireEditorOrigin(req, res)) return;
    if (!(retention ? validateRetentionSettings(req.body) : validateSettings(req.body, { allowOmittedCollectionLimits: true, group }))) return res.status(400).json({ error: '設定値の範囲・しきい値の大小関係・評価方針を確認してください' });
  }
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    const settings = req.method === 'POST'
      ? await (retention?saveRetentionSettings(url,key,req.body):saveSiteSettings(url, key, req.body, group))
      : await getSiteSettings(url, key);
    if (req.method === 'POST' && !retention && Object.hasOwn(req.body,'editor_session_minutes')) {
      setEditorCookie(res, process.env.EDITOR_SECRET, settings.editor_session_minutes*60);
    }
    return res.status(200).json({ settings, rules: settingRules, sources:getInformationSources(settings,process.env) });
  } catch (error) {
    console.error('Editor settings request failed:', error);
    return res.status(503).json({ error: '設定を取得・保存できませんでした。時間をおいて再確認してください。' });
  }
}
