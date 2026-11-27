window.GameEditorImageRights = (() => {
  const scopes = { thumbnail:'一覧のサムネイル', article:'記事本文', hotlink:'直リンク', local_save:'自サイトへの保存', advertising:'広告併設', modification:'加工・改変', website_republication:'ウェブサイトへの転載' };
  const fields = { source_url:'素材の出典ページ', original_image_url:'元画像URL', rights_url:'利用条件・許諾の根拠URL', rights_holder:'権利者', credit:'必要なクレジット', notes:'確認メモ' };
  const labels = {pending:'確認待ち',confirmed:'確認済み',blocked:'利用不可'};
  function mount(root, article) {
    if (!root) return;
    root.innerHTML = `<h3>画像の権利確認 <span data-rights-badge></span></h3><p>現在の保存済みサムネイルに対する記録です。掲載状態・記事本文は変更しません。</p><details><summary>確認内容を記録・編集する</summary><form class="rights-form"><p data-rights-image></p><label>判定<select name="decision"><option value="pending">確認待ち</option><option value="confirmed">確認済み</option><option value="blocked">利用不可</option></select></label><div class="rights-fields"></div><fieldset><legend>利用範囲（確認できた用途のみ選択）</legend><div class="rights-scopes"></div></fieldset><label>利用期限（任意・日本時間）<input type="date" name="expires_at"></label><p data-rights-verified></p><div class="editor-form-actions"><button type="submit">画像の権利記録を保存</button><span role="status" data-rights-result></span></div></form></details>`;
    const form = root.querySelector('form');
    const badge = root.querySelector('[data-rights-badge]');
    const result = root.querySelector('[data-rights-result]');
    const verified = root.querySelector('[data-rights-verified]');
    const status = article.image_rights_status || 'pending';
    badge.textContent = labels[status] || labels.pending;
    badge.dataset.state = status;
    form.elements.decision.value = status;
    root.querySelector('[data-rights-image]').textContent = article.thumbnail_url || '保存済み画像なし';
    const mapping = {source_url:'source_url',original_image_url:'original_url',rights_url:'evidence_url',rights_holder:'holder',credit:'credit',notes:'note'};
    Object.entries(fields).forEach(([key,label]) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement(key === 'notes' ? 'textarea' : 'input');
      if (key.endsWith('_url')) input.type = 'url';
      input.name = key; input.maxLength = 8192;
      input.value = article['image_rights_'+mapping[key]] || '';
      wrapper.append(input); form.querySelector('.rights-fields').append(wrapper);
    });
    Object.entries(scopes).forEach(([key,label]) => {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const select = document.createElement('select'); select.name = 'scope_'+key;
      select.innerHTML = '<option value="">未確認</option><option value="true">利用可</option><option value="false">利用不可</option>';
      const value = article.image_rights_scope?.[key]; select.value = typeof value === 'boolean' ? String(value) : '';
      wrapper.append(select); form.querySelector('.rights-scopes').append(wrapper);
    });
    if (article.image_rights_expires_at) form.elements.expires_at.value = new Date(article.image_rights_expires_at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
    verified.textContent = '確認日時：'+(article.image_rights_verified_at ? new Date(article.image_rights_verified_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}) : '未確認');
    if (!article.thumbnail_url) { form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true); return; }
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button = form.querySelector('button[type=submit]'); if (button.disabled) return;
      const payload = {id:Number(article.id),action:'image_rights',thumbnail_url:article.thumbnail_url,decision:form.elements.decision.value,expires_at:form.elements.expires_at.value,usage_scope:{}};
      for (const key of Object.keys(fields)) payload[key] = form.elements[key].value;
      for (const key of Object.keys(scopes)) { const v=form.elements['scope_'+key].value; if(v) payload.usage_scope[key]=v==='true'; }
      const controls=[...form.querySelectorAll('input,select,textarea,button')];
      controls.forEach(el=>el.disabled=true); result.textContent='保存中…';
      try {
        const res=await fetch('/api/editor-save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(res.status===401){GameEditorSession.expire(); return;}
        const data=await res.json(); if(!res.ok) throw new Error(data.error || '保存できませんでした');
        badge.textContent=labels[payload.decision]; badge.dataset.state=payload.decision;
        verified.textContent='確認日時：'+(payload.decision==='pending'?'未確認':new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}));
        result.textContent='保存しました';
      } catch(error){result.textContent=error.message || '保存に失敗しました';} finally {controls.forEach(el=>el.disabled=false);}
    });
  }
  return {mount};
})();
