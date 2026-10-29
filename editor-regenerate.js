window.GameEditorRegenerate = (() => {
  async function regenerate(id) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("記事IDが正しくありません");
    }

    const response = await fetch("/api/editor-save", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate", id })
    });

    if (response.status === 401) {
      location.replace("/editor.html");
      return null;
    }

    if (!response.ok) {
      throw new Error(`再生成失敗: ${response.status}`);
    }

    const data = await response.json();
    const article = data.article;

    for (const field of [
      "title",
      "summary",
      "article_body",
      "ilovegame_point"
    ]) {
      if (typeof article?.[field] !== "string") {
        throw new Error(`生成結果が不正です: ${field}`);
      }
    }

    return article;
  }

  return { regenerate };
})();
