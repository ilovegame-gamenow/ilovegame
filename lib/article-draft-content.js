export const DRAFT_FIELDS = { title: 300, summary: 3000, article_body: 50000, ilovegame_point: 3000 };

// 途中保存では未完成の空欄も許可し、反映時に完成状態を確認する。
export function readDraftContent(data) {
  const content = {};
  for (const [field, max] of Object.entries(DRAFT_FIELDS)) {
    if (typeof data?.[field] !== 'string' || data[field].length > max) return null;
    content[field] = data[field];
  }
  return content;
}
