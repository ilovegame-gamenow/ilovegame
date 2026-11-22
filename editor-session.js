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
  let covered = false;
  let suspended = false;
  let recoveryBlocked = false;
  let checkGeneration = 0;
  let cover = null;

  // Hide the previous editor view before Safari can restore its snapshot.
  function showCover(message = "ログイン状態を確認しています…", retry = false, recovery = false) {
    covered = true;
    if (!cover) {
      const style = document.createElement('style');
      style.textContent = `html.editor-session-covered body > :not(#editor-session-cover), html.editor-session-covered body > :not(#editor-session-cover) * { visibility:hidden !important; pointer-events:none !important; } #editor-session-cover { position:fixed; inset:0; z-index:2147483647; background:#fff8f1; color:#333; display:grid; place-items:center; padding:24px; font:inherit; } #editor-session-cover[hidden] { display:none !important; } #editor-session-cover div { max-width:420px; width:100%; padding:28px; border-radius:18px; background:white; text-align:center; box-shadow:0 4px 20px #0000000d; } #editor-session-cover button, #editor-session-cover a { display:block; margin:16px auto 0; font:inherit; color:#a14a10; } #editor-session-cover [hidden] { display:none !important; }`;
      document.head.append(style);
      cover = document.createElement('section');
      cover.id = 'editor-session-cover';
      cover.hidden = true;
      cover.innerHTML = '<div><h2>編集室</h2><p role="status" aria-live="polite"></p><button type="button" hidden>ログイン状態を再確認</button><a href="/editor.html" target="_blank" rel="noopener" hidden>別タブでログイン</a></div>';
      cover.querySelector('button').addEventListener('click', () => resume());
      document.body.append(cover);
    }
    document.documentElement.classList.add('editor-session-covered');
    cover.querySelector('p').textContent = message;
    cover.querySelector('button').hidden = !retry;
    cover.querySelector('a').hidden = !recovery;
    cover.hidden = false;
    if (!cover.contains(document.activeElement)) document.activeElement?.blur();
  }

  function hideCover() {
    if (cover) cover.hidden = true;
    document.documentElement.classList.remove('editor-session-covered');
    covered = false;
  }

  function resume() {
    if (ending || document.hidden) return;
    suspended = false;
    ++checkGeneration;
    showCover();
    checkEditorAuth();
  }

  function expire() {
    if (ending || recoveryBlocked) return;
    ending = true;
    showCover("ログイン期限が切れました。ログイン画面に移動しています…");
    const event = new Event("editor-session-expired", { cancelable:true });
    if (!window.dispatchEvent(event)) {
      ending = false;
      recoveryBlocked = true;
      showCover("ログイン期限が切れました。未保存の入力をこの画面に保持しています。別タブでログインし、戻って再確認してください。", true, true);
      return;
    }
    location.replace("/editor.html");
  }

  async function renewEditorSession() {
    if (renewingEditorSession || document.hidden || suspended || covered || ending) return false;

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
    if (document.hidden || covered || ending) return;

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
    if (checkingEditorAuth || ending || document.hidden || suspended) return;

    checkingEditorAuth = true;
    const generation = checkGeneration;

    try {
      const response = await fetch("/api/editor-news?auth=check", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (generation !== checkGeneration || document.hidden || suspended || ending) return;
      if (response.status === 401) {
        expire();
        if (recoveryBlocked) showCover("ログイン期限が切れました。未保存の入力を保護しています。別タブでログインし、戻って再確認してください。", true, true);
      } else if (response.ok) {
        recoveryBlocked = false;
        hideCover();
      } else if (covered) {
        showCover("ログイン状態を確認できません。通信状態を確認して再試行してください。", true, recoveryBlocked);
      }
    } catch (error) {
      console.warn("ログイン状態の確認に失敗:", error);
      if (generation === checkGeneration && covered && !ending && !document.hidden && !suspended) showCover("ログイン状態を確認できません。通信状態を確認して再試行してください。", true, recoveryBlocked);
    } finally {
      checkingEditorAuth = false;
      if (generation !== checkGeneration && !document.hidden && !suspended && !ending) checkEditorAuth();
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
        suspended = true;
        ++checkGeneration;
        showCover();
      } else {
        if (Date.now() - lastEditorActivity < IDLE_DELAY) {
          editorIdleTimer = setTimeout(
            renewEditorSession,
            IDLE_DELAY
          );
        }
        resume();
      }
    });

    window.addEventListener("pagehide", () => {
      clearTimeout(editorIdleTimer);
      suspended = true;
      ++checkGeneration;
      showCover();
    });
    window.addEventListener("pageshow", event => {
      if (event.persisted) resume();
    });
    window.addEventListener("focus", resume);
    setInterval(checkEditorAuth, 60 * 1000);
    if (document.hidden) { suspended = true; showCover(); } else resume();
  }

  return { start, expire };
})();
