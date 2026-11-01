import { appendGameMedia } from './editor-game-media.js';
(() => {
  const {node,createId}=GameCatalogClient;
  const endpoint='/api/editor-games?resource=discoveries';
  const form=document.getElementById('discoveryCreate'),fields=document.getElementById('discoveryFields');
  const message=document.getElementById('catalogMessage'),list=document.getElementById('candidateList');
  const names=['title','original_title','description','reason','source_url','source_type'];
  const storageKey='ilovegame.discovery.create';
  let state='pending',page=1,hasMore=false,ready=false,busy=false,ending=false,id=createId();
  const values=()=>Object.fromEntries(names.map(name=>[name,form.elements.namedItem(name).value]));
  const dirty=()=>names.filter(n=>n!=='source_type').some(n=>values()[n].trim());
  function stash(){try{sessionStorage.setItem(storageKey,JSON.stringify({id,input:values()}));}catch{}}
  function clear(){form.reset();id=createId();try{sessionStorage.removeItem(storageKey);}catch{}}
  function notify(text,error=false){message.textContent=text;message.dataset.error=String(error);}
  const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{stash();ending=true;});
  function controls(){
    fields.disabled=busy||!ready;
    list.querySelectorAll('button,input,select').forEach(c=>c.disabled=busy||!ready);
    document.querySelectorAll('[data-state]').forEach(b=>{b.disabled=busy||!ready;b.setAttribute('aria-pressed',String(b.dataset.state===state));});
    document.getElementById('previousCandidates').disabled=busy||!ready||page===1;
    document.getElementById('nextCandidates').disabled=busy||!ready||!hasMore;
  }
  const button=(text,run)=>{const b=node('button',text);b.type='button';b.addEventListener('click',run);return b;};
  async function review(candidate,action,gameId){
    if(busy)return;
    if(action.startsWith('adopt')&&!confirm(action==='adopt_new'?'新しい作品として台帳へ採用しますか？':'選択した登録済みの作品にまとめますか？'))return;
    busy=true;controls();
    try{
      const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:candidate.id,action,...(gameId?{game_id:gameId}:{})})});
      if(!result)return;
      try{await load();notify(action.startsWith('adopt')?'作品台帳へ採用しました。':action==='hold'?'候補を保留しました。':'未確認に戻しました。');}
      catch{ready=false;notify('操作を保存しました。再読み込みして状態を確認してください。',true);}
    }catch(error){notify(error.message,true);}finally{busy=false;controls();}
  }
  function card(candidate){
    const li=node('li');li.append(node('h3',candidate.title));
    if(candidate.original_title)li.append(node('small',candidate.original_title));
    li.append(node('small',candidate.discovered_by==='ai'?'AIが発見':'手動で追加'));
    if(candidate.research_metadata?.evidence){const details=node('details');details.append(node('summary','AIが参照した根拠'),node('p',candidate.research_metadata.evidence));li.append(details);}
    appendGameMedia(li,candidate,request);
    if(candidate.description)li.append(node('p',candidate.description));
    li.append(node('h4','どこが面白そう？'),node('p',candidate.reason));
    try{
      const url=new URL(candidate.source_url);
      if(['http:','https:'].includes(url.protocol)){const a=node('a',`出典を確認：${url.hostname}`);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';li.append(a);}
    }catch{}
    if(candidate.status==='adopted'){
      li.append(node('small',`採用先の作品ID：${candidate.adopted_game_id}`));return li;
    }
    const matchBox=node('div',undefined,'discovery-match');
    matchBox.append(node('p',candidate.matches.length?'同じタイトルや出典の作品があります。別作品の場合もあるので確認してください。':'一致するタイトル・出典は見つかりませんでした。必要なら別名でも検索してください。'));
    const select=node('select');select.setAttribute('aria-label',`${candidate.title}の採用先`);
    function setMatches(matches){
      select.replaceChildren();const fresh=node('option','新しい作品として登録');fresh.value='new';select.append(fresh);
      for(const game of matches){const option=node('option',`${game.title}${game.original_title?` ／ ${game.original_title}`:''}${game.match_type?` ／ ${game.match_type==='source'?'同じ出典':'同じ名前'}`:''} (${game.id})`);option.value=game.id;select.append(option);}
      if(matches.length){const placeholder=node('option','採用方法を選択してください');placeholder.value='';placeholder.disabled=true;placeholder.selected=true;select.prepend(placeholder);}
    }
    setMatches(candidate.matches);matchBox.append(select);
    const searchForm=node('form');const input=node('input');input.type='search';input.maxLength=100;input.placeholder='登録済み作品を別名で検索';input.setAttribute('aria-label',`${candidate.title}の重複確認`);
    const searchButton=node('button','登録済み作品を検索');searchButton.type='submit';const resultNote=node('p');searchForm.append(input,searchButton,resultNote);
    searchForm.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;controls();
      try{const result=await request(`/api/editor-games?q=${encodeURIComponent(input.value.trim())}`);if(!result)return;setMatches(result.games);resultNote.textContent=result.games.length?`${result.games.length}件の候補。上の採用先から選んでください。${result.hasMore?'さらに絞り込むには検索語を追加してください。':''}`:'該当作品はありません。';}
      catch(error){notify(error.message,true);}finally{busy=false;controls();}
    });
    matchBox.append(searchForm);li.append(matchBox);
    const actions=node('div',undefined,'discovery-actions');
    actions.append(button('選択した方法で採用',()=>{if(!select.value){notify('新規登録か、まとめる作品を選んでください。',true);return;}review(candidate,select.value==='new'?'adopt_new':'adopt_existing',select.value==='new'?null:select.value);}));
    actions.append(button(candidate.status==='held'?'未確認に戻す':'保留する',()=>review(candidate,candidate.status==='held'?'reopen':'hold')));
    li.append(actions);return li;
  }
  async function load(){
    const result=await request(`${endpoint}&status=${state}&page=${page}`);if(!result)return;
    hasMore=result.hasMore;list.replaceChildren();result.candidates.forEach(c=>list.append(card(c)));ready=true;
    document.getElementById('candidatesEmpty').hidden=result.candidates.length>0;
    document.getElementById('candidatePage').textContent=`${page}ページ`;controls();
  }
  async function refresh(nextState=state,nextPage=page){
    if(busy)return;const oldState=state,oldPage=page;state=nextState;page=nextPage;busy=true;controls();
    try{await load();notify('');}catch(error){state=oldState;page=oldPage;notify(error.message,true);}finally{busy=false;controls();}
  }
  document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>refresh(b.dataset.state,1)));
  document.getElementById('previousCandidates').addEventListener('click',()=>refresh(state,page-1));
  document.getElementById('nextCandidates').addEventListener('click',()=>refresh(state,page+1));
  form.addEventListener('input',stash);form.addEventListener('change',stash);
  document.getElementById('clearCandidate').addEventListener('click',()=>{clear();notify('入力をクリアしました。');});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!ready||!form.reportValidity())return;busy=true;stash();controls();const submittedId=id;
    try{
      const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register',candidate:{id,...values()}})});if(!result)return;
      clear();state=result.candidate.status;page=1;
      try{await load();notify(result.candidate.id===submittedId?'発見候補を追加しました。':'同じ出典・作品名の候補が登録済みです。その候補を表示しました。');}
      catch{notify('候補は保存されました。再読み込みして確認してください。',true);}
    }catch(error){notify(error.message,true);}finally{busy=false;controls();}
  });
  window.addEventListener('editor-session-expired',()=>{stash();ending=true;});
  window.addEventListener('beforeunload',event=>{if(!ending&&(busy||dirty())){stash();event.preventDefault();event.returnValue='';}});
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;stash();
    try{const r=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('ログアウトできませんでした。');ending=true;location.replace('/editor.html');}catch(error){notify(error.message,true);}
  });
  try{const draft=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(draft&&/^[0-9a-f-]{36}$/i.test(draft.id)&&names.every(n=>typeof draft.input?.[n]==='string')){id=draft.id;names.forEach(n=>form.elements.namedItem(n).value=draft.input[n]);if(dirty())document.querySelector('details').open=true;}}catch{}
  GameEditorSession.start();refresh();
})();
