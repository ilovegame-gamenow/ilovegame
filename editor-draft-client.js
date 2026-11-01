window.GameEditorSave = (() => {
  async function save(data) {
    if (!Number.isSafeInteger(data.id) || data.id <= 0) {
      throw new Error("記事IDが正しくありません");
    }

    const response = await fetch("/api/editor-save", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (response.status === 401) {
      window.GameEditorSession.expire();
      return false;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "下書きの操作に失敗しました");
    }

    window.GameEditorNavigation?.markChanged();
    return true;
  }

  return { save };
})();
