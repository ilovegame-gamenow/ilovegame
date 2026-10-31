/* Device recovery copies are separate from published articles and server drafts. */
window.GameEditorRecovery = (() => {
  const prefix = 'ilovegame.editor-recovery.v1.';
  const fields = { title:300, summary:3000, article_body:50000, ilovegame_point:3000 };
  const content = value => Object.fromEntries(Object.keys(fields).map(name=>[name,value?.[name] || '']));
  const equal = (a,b) => Object.keys(fields).every(name=>(a?.[name]||'')===(b?.[name]||''));
  const validContent = value => value && Object.entries(fields).every(([name,max])=>typeof value[name]==='string'&&value[name].length<=max);
  const key = id => prefix+id;
  function read(id) {
    try {
      const item=JSON.parse(localStorage.getItem(key(id)));
      if (item?.version!==1 || item.id!==id || !validContent(item.content) || !validContent(item.base?.content) ||
          !(item.base.draftUpdatedAt===null || (typeof item.base.draftUpdatedAt==='string' && item.base.draftUpdatedAt.length<=40 && Number.isFinite(Date.parse(item.base.draftUpdatedAt)))) ||
          !Number.isFinite(item.savedAt) || typeof item.token!=='string') return null;
      return item;
    } catch { return null; }
  }
  function write(item) {
    try { localStorage.setItem(key(item.id),JSON.stringify(item));return true; }
    catch { return false; }
  }
  function clear(id,token) {
    try { if (!token || read(id)?.token===token) localStorage.removeItem(key(id)); }
    catch { /* Recovery remains available if storage cannot be changed. */ }
  }
  function sameBase(item,article,draft) {
    return item.base.draftUpdatedAt===(draft?.updated_at??null) && equal(item.base.content,draft||article);
  }
  async function restore(article,draft) {
    const item=read(Number(article.id));
    if (!item) return null;
    const reason=item.reason==='expired'?'ログイン期限切れで中断した':'前回中断した';
    if (equal(item.content,draft||article) && (!item.regenerated||draft?.regenerated)) {
      clear(item.id,item.token);
      return {message:draft ? `${reason}編集内容は、下書きに保存済みです。公開版へは未反映です。` : `${reason}編集内容は公開版と一致しています。復元が必要な変更はありません。`, savedDraft:draft, item:null};
    }
    const result={ item, message:`${reason}編集内容をこの端末から復元しました。`, requiresReview:false };
    if (item.requiresReview || !sameBase(item,article,draft)) {
      return {...result,requiresReview:true,message:result.message+' 保存済みの記事・下書きに変更があるため自動保存していません。内容を確認して下書き保存してください。'};
    }
    try {
      const response=await fetch('/api/editor-save',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'recover',id:item.id,...item.content,regenerated:item.regenerated===true,baseContent:item.base.content,expectedDraftUpdatedAt:item.base.draftUpdatedAt})
      });
      if (response.status===401) { window.GameEditorSession.expire();return {interrupted:true}; }
      const data=await response.json();
      if (response.status===409) return {...result,requiresReview:true,message:result.message+' 他の保存内容と競合したため、自動保存していません。内容を確認して下書き保存してください。'};
      if (!response.ok) throw new Error('Recovery save failed');
      window.GameEditorNavigation?.markChanged();
      clear(item.id,item.token);
      return {...result,savedDraft:data.draft,message:`${reason}編集内容を復元し、下書きとして自動保存しました。公開版へは未反映です。`};
    } catch {
      return {...result,message:result.message+' サーバーへは保存できていません。この端末の一時保存を残しているので、通信状態を確認して下書き保存してください。'};
    }
  }
  function attach({id,form,baseline,draftUpdatedAt,getRegenerated,notice,loginLink,requiresReview=false,onExpired}) {
    let currentToken=null;
    let expired=false;
    const snapshot=(reason='editing')=>{
      if (form.hidden) return true;
      const values=Object.fromEntries(Object.keys(fields).map(name=>[name,form.elements.namedItem(name).value]));
      if (equal(values,baseline) && (!getRegenerated()||baseline.regenerated)) { if(currentToken)clear(id,currentToken);return true; }
      const item={version:1,id,token:`${Date.now()}-${Math.random()}`,content:values,regenerated:getRegenerated(),base:{content:content(baseline),draftUpdatedAt:draftUpdatedAt??null},savedAt:Date.now(),reason:expired?'expired':reason,requiresReview};
      const saved=write(item);
      if(saved)currentToken=item.token;
      else {notice.parentElement.hidden=false;notice.hidden=false;notice.textContent='この端末に一時保存できません。入力内容を失わないよう、下書き保存してください。';}
      return saved;
    };
    form.addEventListener('input',()=>snapshot());
    window.addEventListener('pagehide',()=>snapshot('interrupted'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)snapshot('interrupted');});
    window.addEventListener('editor-session-expired',event=>{
      expired=true;
      if(snapshot('expired'))onExpired();
      else {
        event.preventDefault();
        notice.parentElement.hidden=false;
        notice.hidden=false;
        notice.textContent='ログイン期限が切れました。一時保存できないため、この画面を残しています。別タブでログインし、戻って下書き保存してください。';
        loginLink.hidden=false;
      }
    });
    return {snapshot,clear:()=>{if(currentToken)clear(id,currentToken);}};
  }
  function renderPending(container) {
    if(!container)return;
    const items=[];
    try {for(let i=0;i<localStorage.length;i++){
      const name=localStorage.key(i);if(!name?.startsWith(prefix))continue;
      const id=Number(name.slice(prefix.length));if(!Number.isSafeInteger(id)||id<=0)continue;
      const item=read(id);if(item)items.push(item);
    }}catch {return;}
    container.replaceChildren();container.hidden=items.length===0;
    if(!items.length)return;
    const heading=document.createElement('h2');heading.textContent='中断した記事編集があります';container.append(heading);
    const text=document.createElement('p');text.textContent='この端末に編集内容を一時保存しています。記事を開くと復元して下書き保存します。保存済み内容に変更がある場合は確認を案内します。';container.append(text);
    for(const item of items.sort((a,b)=>b.savedAt-a.savedAt)){
      const link=document.createElement('a');link.href=`/editor-article.html?id=${item.id}`;link.textContent=`編集を再開：${item.content.title||'タイトル未入力'}`;container.append(link);
    }
  }
  return {read,clear,restore,attach,renderPending};
})();
