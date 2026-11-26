// 記事の内容が公開できる状態か確認する
export function hasCompleteArticleContent(article) {
  return Boolean(
    article?.title?.trim() &&
    article?.summary?.trim() &&
    article?.article_body?.trim() &&
    article?.ilovegame_point?.trim()
  );
}

// 編集室でAI再生成した記事が保存済みか確認する
export function hasSavedRegeneratedArticle(article) {
  if (
    !article?.editor_regenerated_at ||
    !article?.editor_regenerated_saved_at
  ) {
    return false;
  }

  const regeneratedAt = Date.parse(article.editor_regenerated_at);
  const savedAt = Date.parse(article.editor_regenerated_saved_at);

  return (
    Number.isFinite(regeneratedAt) &&
    Number.isFinite(savedAt) &&
    savedAt >= regeneratedAt
  );
}

// 手動掲載を許可できるか判定する
export function canPublishArticle(article) {
  if (!hasCompleteArticleContent(article)) {
    return false;
  }

  const thumbnailWaiting = ["chatgpt_thumbnail_wait_1", "chatgpt_thumbnail_wait_2", "chatgpt_thumbnail_review"].includes(article.processing_status);
  if (thumbnailWaiting) {
    // 編集者が確認済みの画像を保存した後にのみ手動掲載できる。
    try { return new URL(article.thumbnail_url).protocol === "https:"; }
    catch { return false; }
  }
  if (["chatgpt_thumbnail_processing_1", "chatgpt_thumbnail_processing_2"].includes(article.processing_status)) return false;

  return (
    article.processing_status === "completed" ||
    hasSavedRegeneratedArticle(article)
  );
}
