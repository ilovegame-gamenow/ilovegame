window.GameEditorSession = (() => {
  const IDLE_DELAY = 60 * 1000;
  // Renew well before the one-hour token expires during continuous activity.
  const SESSION_REFRESH = 15 * 60 * 1000;

  let lastEditorActivity = Date.now();
  let lastSessionRenewal = Date.now();
  let editorIdleTimer = null;
  let renewingEditorSession = false;
  let checkingEditorAuth = false;
  let started = false;
  let ending = false;

  function expire() {
    if (ending) return;
    ending = true;
    const event = new Event("editor-session-expired", { cancelable:true });
    if (!window.dispatchEvent(event)) { ending = false; return; }
    location.replace("/editor.html");
  }

  async function renewEditorSession() {
    if (renewingEditorSession || document.hidden) return false;

    renewingEditorSession = true;

    try {
      const response = await fetch("/api/editor-news?auth=renew", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "X-Editor-Action": "renew"
        }
      });

      if (response.status === 401) {
        expire();
        return false;
      }

      if (!response.ok) {
        console.warn("ログイン期限の延長に失敗:", response.status);
        return false;
      }

      lastSessionRenewal = Date.now();
      return true;
    } catch (error) {
      console.warn("ログイン期限の延長に失敗:", error);
      return false;
    } finally {
      renewingEditorSession = false;
    }
  }

  function recordEditorActivity() {
    if (document.hidden) return;

    lastEditorActivity = Date.now();
    clearTimeout(editorIdleTimer);

    editorIdleTimer = setTimeout(() => {
      renewEditorSession();
    }, IDLE_DELAY);

    if (Date.now() - lastSessionRenewal >= SESSION_REFRESH) {
      renewEditorSession();
    }
  }

  async function checkEditorAuth() {
    if (checkingEditorAuth) return;

    checkingEditorAuth = true;

    try {
      const response = await fetch("/api/editor-news?auth=check", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (response.status === 401) {
        expire();
      }
    } catch (error) {
      console.warn("ログイン状態の確認に失敗:", error);
    } finally {
      checkingEditorAuth = false;
    }
  }

  function start() {
    if (started) return;
    started = true;

    document.addEventListener("pointerdown", recordEditorActivity);
    document.addEventListener("keydown", recordEditorActivity);
    document.addEventListener("input", recordEditorActivity);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(editorIdleTimer);
      } else {
        if (Date.now() - lastEditorActivity < IDLE_DELAY) {
          editorIdleTimer = setTimeout(
            renewEditorSession,
            IDLE_DELAY
          );
        }
        checkEditorAuth();
      }
    });

    setInterval(checkEditorAuth, 60 * 1000);
    checkEditorAuth();
  }

  return { start, expire };
})();
