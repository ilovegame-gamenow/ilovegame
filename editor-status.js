window.GameEditorStatus = (() => {
  async function update(id, status, excludeGameId) {
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
      body: JSON.stringify({ id, status, ...(excludeGameId ? {exclude_game_id:excludeGameId} : {}) })
    });

    if (response.status === 401) {
      window.GameEditorSession.expire();
      return false;
    }

    if (!response.ok) {
      throw new Error((await response.json().catch(()=>({}))).error || "掲載状態の変更に失敗しました");
    }

    window.GameEditorNavigation?.markChanged();
    return true;
  }

  let choosing=false;
  async function confirmChange(id,status,canExclude=true) {
    if(status!=="rejected")return confirm("この記事を掲載に変更しますか？")?{}:null;
    if(choosing)return null;
    choosing=true;
    let games=[], failed=false;
    try {
      if(canExclude){
        const r=await fetch(`/api/editor-games?resource=context&article_id=${id}`,{credentials:'same-origin',cache:'no-store'});
        if(r.status===401){GameEditorSession.expire();choosing=false;return null;}
        if(!r.ok)throw Error();
        games=(await r.json()).games||[];
      }
    }catch{failed=true;}
    const previous=document.activeElement, dialog=document.createElement('dialog');
    dialog.className='editor-confirm rejection-choice';
    dialog.setAttribute('aria-label','非掲載の確認');
    const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    dialog.append(el('h2','記事を非掲載にする'));
    dialog.append(el('p',games.length?'この記事だけを非掲載にするか、関連作品の追跡も停止するか選べます。':failed?'関連作品を取得できませんでした。記事だけ非掲載にできます。':canExclude?'関連作品が未登録のため、記事のみ非掲載にできます。':'AI処理が完了していないため、記事のみ非掲載にできます。'));
    const select=el('select');select.setAttribute('aria-label','追跡対象外にする作品');
    if(games.length>1){const opt=el('option','作品を選択');opt.value='';select.append(opt);}
    for(const g of games){const opt=el('option',g.title+(g.is_managed===false?'（追跡対象外）':''));opt.value=g.id;select.append(opt);}
    let result=null;
    const actions=el('div');actions.className='editor-confirm-actions';
    const button=(label,fn,kind)=>{const b=el('button',label);b.type='button';if(kind)b.className=kind;b.addEventListener('click',fn);return b;};
    const cancel=button('キャンセル',()=>dialog.close());
    const only=button('この記事だけ非掲載',()=>{result={};dialog.close();},'confirm-danger');
    actions.append(cancel,only);
    if(games.length){
      const exclude=button('非掲載にして作品も追跡対象外',()=>{if(!select.value)return;result={excludeGameId:select.value};dialog.close();},'confirm-danger');
      exclude.disabled=!select.value;select.addEventListener('change',()=>exclude.disabled=!select.value);
      dialog.append(select,el('p','追跡対象外にしても、公開済みの記事と発売情報は残ります。'));actions.append(exclude);
    }
    dialog.append(actions);document.body.append(dialog);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return new Promise(resolve=>{
      dialog.addEventListener('close',()=>{dialog.remove();document.body.style.overflow=overflow;choosing=false;if(previous?.isConnected)previous.focus();resolve(result);},{once:true});
      try{dialog.showModal();cancel.focus();}catch{dialog.remove();document.body.style.overflow=overflow;choosing=false;resolve(null);}
    });
  }
  function thumbnailState(article) {
    if (article.status !== "pending") return null;
    const states = {
      chatgpt_thumbnail_wait_1: "画像取得待ち",
      chatgpt_thumbnail_wait_2: "画像取得待ち",
      chatgpt_thumbnail_processing_1: "画像取得中",
      chatgpt_thumbnail_processing_2: "画像取得中",
      chatgpt_thumbnail_review: "画像要確認"
    };
    return Object.hasOwn(states, article.processing_status) ? states[article.processing_status] : null;
  }
  function imageState(article) {
    if (!String(article.thumbnail_url || '').trim()) return { status:'pending', label:thumbnailState(article) || '画像未設定' };
    const status = ['confirmed','blocked'].includes(article.image_rights_status) ? article.image_rights_status : 'pending';
    return {status,label:({confirmed:'画像権利確認済み',pending:'画像権利確認待ち',blocked:'画像利用不可'})[status]};
  }
  return { update, confirmChange, thumbnailState, imageState };
})();
