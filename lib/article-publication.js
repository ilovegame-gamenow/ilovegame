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

  return (
    article.processing_status === "completed" ||
    hasSavedRegeneratedArticle(article)
  );
}
