window.GameEditorStatus = (() => {
  async function update(id, status) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error("記事IDが正しくありません");
    }

    if (!["published", "rejected"].includes(status)) {
      throw new Error("掲載状態が正しくありません");
    }

    const response = await fetch("/api/editor-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, status })
    });

    if (response.status === 401) {
      window.GameEditorSession.expire();
      return false;
    }

    if (!response.ok) {
      throw new Error("掲載状態の変更に失敗しました");
    }

    window.GameEditorNavigation?.markChanged();
    return true;
  }

  return { update };
})();
