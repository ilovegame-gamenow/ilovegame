(() => {
  GameEditorSession.start();
  document.addEventListener('click', async event => {
    if (!event.target.closest('#logoutButton')) return;
    if (busy || (dirty() && !confirm('保存していない設定変更があります。ログアウトしますか？'))) return;
    try {
      const response = await fetch('/api/editor-logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('ログアウトできませんでした');
      original = null;
      location.replace('/editor.html');
    } catch (error) { notify(error.message, true); }
  });
  const form = document.getElementById('settingsForm');
  const fields = document.getElementById('settingsFields');
  const message = document.getElementById('settingsMessage');
  const button = document.getElementById('saveSettings');
  let original = null;
  let busy = false;
  const values = () => Object.fromEntries([...form.querySelectorAll('input[name]')].map(input => [input.name, input.value === '' ? null : Number(input.value)]));
  const dirty = () => original && JSON.stringify(values()) !== JSON.stringify(original);
  function notify(text, error = false) { message.textContent = text; message.dataset.error = String(error); }
  async function request(options = {}) {
    const response = await fetch('/api/editor-settings', { credentials: 'same-origin', cache: 'no-store', ...options });
    if (response.status === 401) { location.replace('/editor.html'); return null; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '設定を保存できませんでした');
    return result;
  }
  function fill(settings) {
    for (const input of form.querySelectorAll('input[name]')) input.value = settings[input.name];
    original = values();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const data = values();
    busy = true; fields.disabled = true; button.textContent = '保存中…';
    try {
      const result = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!result) return;
      fill(result.settings);
      notify('設定を保存しました。');
    } catch (error) { notify(error.message, true); }
    finally { busy = false; fields.disabled = false; button.textContent = '設定を保存'; }
  });
  window.addEventListener('beforeunload', event => {
    if (busy || dirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  request().then(result => {
    if (!result) return;
    fill(result.settings); fields.disabled = false; notify('');
  }).catch(error => notify(error.message, true));
})();
