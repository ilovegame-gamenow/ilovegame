(() => {
  GameEditorSession.start();
  document.addEventListener('click', async event => {
    if (!event.target.closest('#logoutButton')) return;
    if (busy || window.GameEditorDataManagement?.isBusy() || window.GameRetentionSettings?.isBusy() || (window.GameRetentionSettings?.isDirty() && !confirm('自動整理の設定が保存されていません。ログアウトしますか？')) || (dirty() && !confirm('保存していない設定変更があります。ログアウトしますか？'))) return;
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
  const panels = [...form.querySelectorAll('[data-settings-group]')];
  const inputs = (scope=form) => [...scope.querySelectorAll('input[name], textarea[name], select[name]')];
  let defaultGuidelines = '';
  let original = null;
  let busy = false;
  const values = (scope=form) => Object.fromEntries(inputs(scope).map(input => [input.name, (input.type === 'number' || input.type === 'select-one') ? (input.value === '' ? null : Number(input.value)) : input.value]));
  const dirty = () => original && JSON.stringify(values()) !== JSON.stringify(original);
  function notify(text, error = false) { message.textContent = text; message.dataset.error = String(error); }
  async function request(options = {}, group) {
    const response = await fetch('/api/editor-settings'+(group?'?resource='+encodeURIComponent(group):''), { credentials: 'same-origin', cache: 'no-store', ...options });
    if (response.status === 401) { location.replace('/editor.html'); return null; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '設定を保存できませんでした');
    if (options.method === 'POST') window.GameEditorNavigation?.markChanged();
    return result;
  }
  function updatePolicySummary() {
    const publish = Number(form.elements.publish_threshold.value);
    const reject = Number(form.elements.no_article_threshold.value);
    const valid = reject < publish;
    form.elements.no_article_threshold.setCustomValidity(valid ? '' : '記事を生成しない点数は、自動掲載の点数より小さくしてください。');
    document.getElementById('publicationSummary').textContent = valid
      ? `0〜${reject}点：生成しない\n${reject + 1 < publish ? `${reject + 1}〜${publish - 1}点：手動審査\n` : ''}${publish}〜100点：自動掲載`
      : 'しきい値の大小関係を確認してください。';
  }
  function fill(settings) {
    for (const input of inputs()) input.value = settings[input.name];
    updatePolicySummary();
    original = values();
  }
  // Prevent implicit submission while editing; keep keyboard activation of the save button.
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input')) event.preventDefault();
  });
  form.addEventListener('submit', event => event.preventDefault());
  for (const panel of panels) {
    const group=panel.dataset.settingsGroup,button=panel.querySelector('[data-save-group]'),saveResult=panel.querySelector('.group-save-result'),label=button.textContent;
    button.addEventListener('click', async () => {
    if (busy || !original || inputs(panel).some(input=>!input.reportValidity())) return;
    const data = values(panel);
    busy = true; fields.disabled = true; button.textContent = '保存中…';
    button.dataset.saved = 'false'; saveResult.hidden = true;
    try {
      const result = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },group);
      if (!result) return;
      for(const input of inputs(panel))input.value=result.settings[input.name];
      Object.assign(original,values(panel));
      updatePolicySummary();
      if(group==='basic')GameEditorSession.refresh();
      notify('');
      button.dataset.saved = 'true';
      saveResult.dataset.error = 'false';
      saveResult.textContent = '✓ 設定を保存しました。';
      saveResult.hidden = false;
    } catch (error) {
      saveResult.dataset.error = 'true';
      saveResult.textContent = error.message;
      saveResult.hidden = false;
    }
    finally {
      busy = false; fields.disabled = false;
      button.textContent = button.dataset.saved === 'true' ? '✓ 保存しました' : label;
    }
  });
  panel.addEventListener('input', () => {
    updatePolicySummary();
    button.dataset.saved = 'false';
    button.textContent = label;
    saveResult.hidden = true;
  });
  }
  document.getElementById('resetGuidelines').addEventListener('click', () => {
    form.elements.evaluation_guidelines.value = defaultGuidelines;
    form.elements.evaluation_guidelines.dispatchEvent(new Event('input', { bubbles:true }));
  });
  window.addEventListener('beforeunload', event => {
    if (busy || dirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  request().then(result => {
    if (!result) return;
    defaultGuidelines = result.rules.evaluation_guidelines.defaultValue;
    fill(result.settings); fields.disabled = false; notify('');
  }).catch(error => notify(error.message, true));
})();
