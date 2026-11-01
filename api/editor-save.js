import { handleMediaArticleRegistration } from '../lib/editor-media-article.js';
import { requireEditor, requireEditorOrigin } from '../lib/editor-auth.js';
import { regenerateEditorArticle } from '../lib/editor-regenerator.js';
import { getArticleById } from '../lib/article-repository.js';
import { getArticleDraft, saveArticleDraft, applyArticleDraft, discardArticleDraft, recoverArticleDraft } from '../lib/article-draft-repository.js';
import { readDraftContent } from '../lib/article-draft-content.js';
import { hasCompleteArticleContent } from '../lib/article-publication.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireEditor(req, res)) return;
  if(req.body?.action==='create_from_media'){
    if(!requireEditorOrigin(req,res))return;
    return handleMediaArticleRegistration(req,res);
  }
  const { id, action = 'save' } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 || !['save', 'apply', 'regenerate', 'discard', 'recover'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const article = await getArticleById(url, key, id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (action === 'regenerate') {
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Service unavailable' });
      // 生成結果は入力欄へ返すだけ。下書き保存も公開反映も行わない。
      const generated = await regenerateEditorArticle({ id, supabaseUrl: url, supabaseKey: key, openaiKey: process.env.OPENAI_API_KEY });
      return res.status(200).json({ article: generated });
    }
    if (action === 'discard') {
      await discardArticleDraft(url, key, id);
      return res.status(200).json({ ok: true });
    }
    const draft = await getArticleDraft(url, key, id);
    if (action === 'apply') {
      if (!draft || !hasCompleteArticleContent(draft)) {
        return res.status(409).json({ error: '完成した下書きを保存してから反映してください' });
      }
      await applyArticleDraft(url, key, id);
      return res.status(200).json({ ok: true });
    }
    const content = readDraftContent(req.body);
    if (!content) return res.status(400).json({ error: 'Invalid draft data' });
    if (action === 'recover') {
      const expected = req.body.expectedDraftUpdatedAt;
      const base = readDraftContent(req.body.baseContent);
      if (!base || !(expected === null || (typeof expected === 'string' && expected.length <= 40 && Number.isFinite(Date.parse(expected))))) {
        return res.status(400).json({ error:'Invalid recovery baseline' });
      }
      const current = draft || article;
      if ((draft?.updated_at ?? null) !== expected || Object.keys(base).some(field => base[field] !== (current[field] || ''))) {
        return res.status(409).json({ error:'保存済み内容が変わっているため、自動保存できません' });
      }
      const saved = await recoverArticleDraft(url, key, id, {
        ...content, regenerated:req.body.regenerated === true || draft?.regenerated === true
      }, expected);
      if (!saved) return res.status(409).json({ error:'他の保存と競合したため、自動保存できません' });
      return res.status(200).json({ ok:true, draft:saved });
    }
    const saved = await saveArticleDraft(url, key, id, {
      ...content,
      regenerated: req.body.regenerated === true || draft?.regenerated === true
    });
    return res.status(200).json({ ok: true, draft: saved });
  } catch (error) {
    console.error('Editor draft operation failed:', error);
    return res.status(502).json({ error: '下書きの操作に失敗しました。再読み込みして保存状態を確認してください' });
  }
}
