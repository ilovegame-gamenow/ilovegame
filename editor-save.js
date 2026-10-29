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
      location.replace("/editor.html");
      return false;
    }

    if (!response.ok) {
      throw new Error("記事の保存に失敗しました");
    }

    return true;
  }

  return { save };
})();
