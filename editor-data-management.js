(() => {
 const $=id=>document.getElementById(id);
 const labels={pending:'審査待ち',rejected:'非掲載',published:'掲載中'};
 const SELECTION_LIMIT=20;
 const params=new URLSearchParams(location.search),id=Number(params.get('id'));
 const direct=Number.isSafeInteger(id)&&id>0;
 const manualPanel=$('manualDeletion');
 let loaded=false;
 const returnTarget=params.get('return')||'';
 const safeReturn=returnTarget==='/editor-media.html'||returnTarget==='/editor-dashboard.html'||returnTarget.startsWith('/editor-dashboard.html?')?returnTarget:'/editor-dashboard.html';
 if(direct){$('dataBack').hidden=false;$('dataBackBottom').hidden=false;$('dataBack').href=safeReturn;$('dataBack').textContent='← 元の記事一覧に戻る';}
 GameEditorNavigation.syncBackLinks('dataBack');
 $('resultBack').href=safeReturn;
 $('resultBack').textContent=direct?'元の記事一覧に戻る':'記事管理へ';
 let rows=[],selected=new Map(),page=1,totalPages=1,hasMore=false,busy=false,reviewed=[],activeSearch={status:'unpublished',field:'title',q:''};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function status(text,error=false){$('message').textContent=text;$('message').dataset.error=String(error);}
 // Keep the page at its original position, including on iOS Safari.
 let modalScroll=null;
 function lockModalScroll(){
  if(modalScroll)return;
  modalScroll={x:window.scrollX,y:window.scrollY};
  const root=document.documentElement;
  root.style.setProperty('--data-modal-scroll-top',-modalScroll.y+'px');
  root.style.setProperty('--data-modal-scroll-left',-modalScroll.x+'px');
  root.classList.add('data-modal-scroll-locked');
 }
 function unlockModalScroll(){
  if(!modalScroll||$('confirmationPanel').open)return;
  const {x,y}=modalScroll;modalScroll=null;
  const root=document.documentElement;
  root.classList.remove('data-modal-scroll-locked');
  root.style.removeProperty('--data-modal-scroll-top');
  root.style.removeProperty('--data-modal-scroll-left');
  window.scrollTo({left:x,top:y,behavior:'instant'});
 }
 function openModal(id){lockModalScroll();try{$(id).showModal();}catch(error){unlockModalScroll();throw error;}}
 let stage='review';
 function setStage(next,error=false){
  stage=next;
  const panel=$('confirmationPanel');panel.dataset.stage=next;panel.dataset.error=String(error);
  $('reviewContent').hidden=next!=='review';$('progressContent').hidden=next!=='progress';$('resultContent').hidden=next!=='result';
  panel.setAttribute('aria-describedby',next==='review'?'deleteWarning':next==='result'?'resultSummary':'progressContent');
 }
 function closeReview(){reviewed=[];if($('confirmationPanel').open)$('confirmationPanel').close();unlockModalScroll();}
 function showResult(title,message,error=false,details=[]){
  reviewed=[];
  if(expiring||!$('confirmationPanel').open)return;
  $('confirmationTitle').textContent=title;$('resultSummary').textContent=message;
  $('resultIcon').textContent=error?'!':'✓';
  $('resultList').replaceChildren(...details.map(text=>node('li',text)));
  $('resultDetails').hidden=!details.length;
  setStage('result',error);$('confirmationTitle').focus();
 }
 const selectionBar=$('selectionBar');
 const floatingBar=selectionBar.cloneNode(true);
 floatingBar.id='floatingSelectionBar';
 floatingBar.classList.add('is-floating');
 floatingBar.setAttribute('aria-label','画面下部の削除対象の選択操作');
 floatingBar.hidden=false;
 floatingBar.inert=true;
 floatingBar.setAttribute('aria-hidden','true');
 const mirrorControls=new Map();
 for(const el of floatingBar.querySelectorAll('[id]')){
  const key=el.id;
  el.removeAttribute('id');
  el.dataset.mirrorControl=key;
  if(key==='count'){el.removeAttribute('role');el.removeAttribute('aria-live');}
  if(el.tagName==='BUTTON')el.addEventListener('click',()=>{const original=$(key);if(!original.disabled)original.click();});
  mirrorControls.set(key,el);
 }
 selectionBar.after(floatingBar);
 function sizeSelectionBar(){
  if(!selected.size||!manualPanel.open){document.documentElement.style.removeProperty('--data-selection-height');return;}
  const height=Math.ceil(floatingBar.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--data-selection-height',(height+24)+'px');
 }
 function syncSelectionVisibility(){
  const rect=selectionBar.getBoundingClientRect();
  const viewport=window.visualViewport;
  const top=viewport?.offsetTop??0;
  const bottom=top+(viewport?.height??window.innerHeight);
  const visible=manualPanel.open&&selected.size>0&&(rect.bottom<=top||rect.top>=bottom);
  floatingBar.classList.toggle('is-visible',visible);
  floatingBar.inert=!visible;
  floatingBar.setAttribute('aria-hidden',String(!visible));
 }
 let visibilityFrame=0;
 function queueSelectionVisibility(){
  if(visibilityFrame)return;
  visibilityFrame=requestAnimationFrame(()=>{visibilityFrame=0;syncSelectionVisibility();});
 }
 function updateSelectionBar(){
  for(const [key,mirror] of mirrorControls){
   const original=$(key);mirror.textContent=original.textContent;
   if(mirror.tagName==='BUTTON')mirror.disabled=original.disabled;
  }
  sizeSelectionBar();
  syncSelectionVisibility();
 }
 function resizeSelectionBar(){sizeSelectionBar();queueSelectionVisibility();}
 if(typeof ResizeObserver==='function'){
  const observer=new ResizeObserver(resizeSelectionBar);
  observer.observe(floatingBar);observer.observe(selectionBar);
 }
 window.addEventListener('scroll',queueSelectionVisibility,{passive:true});
 window.addEventListener('resize',resizeSelectionBar);
 window.visualViewport?.addEventListener('resize',resizeSelectionBar);
 window.visualViewport?.addEventListener('scroll',queueSelectionVisibility,{passive:true});
 function controls(){
  for(const id of ['status','field','query'])$(id).disabled=busy;
  $('searchForm').querySelector('button').disabled=busy;
  if($('clearQuery'))$('clearQuery').disabled=busy||(!$('query').value&&!activeSearch.q);
  $('selectAll').disabled=busy||!rows.length||rows.every(r=>selected.has(r.id))||selected.size>=SELECTION_LIMIT;
  $('clear').disabled=busy||!selected.size;
  $('review').disabled=busy||!selected.size;
  for(const id of ['paginationTop','pagination']){const box=$(id);box.replaceChildren();if(totalPages>1){const nav=GamePagination.render(page,totalPages,p=>{if(!busy&&p!==page)load(p);});if(busy)nav.querySelectorAll('button').forEach(b=>b.disabled=true);box.append(nav);}}
  const remaining=SELECTION_LIMIT-selected.size;
  const unselected=rows.filter(r=>!selected.has(r.id)).length;
  $('selectAll').textContent=remaining>0&&unselected>remaining?'このページから残り'+remaining+'件を選択':'このページの全記事を選択';
  $('count').textContent='選択中：'+selected.size+'件（最大'+SELECTION_LIMIT+'件）';
  updateSelectionBar();
  $('cancel').disabled=busy;
  $('delete').disabled=busy||!reviewed.length;
  $('articles').querySelectorAll('input').forEach(el=>el.disabled=busy);
  $('selectedList').querySelectorAll('button').forEach(el=>el.disabled=busy);
 }
 function render(){
  $('articles').replaceChildren();
  for(const row of rows){
   const label=node('label');label.className='data-row';
   const check=node('input');check.type='checkbox';check.checked=selected.has(row.id);
   const thumb=node('div','画像なし');thumb.className='data-thumb';
   const imageUrl=GameImage.getUrl(row.thumbnail_url,row.source_name||'');
   if(imageUrl){const img=node('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.addEventListener('error',()=>{thumb.textContent='画像なし';},{once:true});thumb.replaceChildren(img);}
   const text=node('span');text.className='data-copy';text.append(node('strong',row.title||'（タイトルなし）'),node('small','ID '+row.id+' ／ '+(labels[row.status]||row.status)+' ／ '+(row.source_name||'情報元なし')));
   check.addEventListener('change',()=>{closeReview();if(check.checked){if(selected.size>=SELECTION_LIMIT){check.checked=false;status('一度に選択できるのは最大'+SELECTION_LIMIT+'件です。',true);}else selected.set(row.id,row);}else selected.delete(row.id);controls();});
   label.append(check,thumb,text);$('articles').append(label);
  }
  if(!rows.length)$('articles').append(node('p','対象の記事はありません。'));
  controls();
 }
 async function request(action,options={}){
  const params=new URLSearchParams({action,...(options.query||{})});
  const response=await fetch('/api/editor-news?'+params,{credentials:'same-origin',cache:'no-store',...(options.body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body)}:{})});
  if(response.status===401){GameEditorSession.expire();throw Error('ログイン期限が切れました。');}
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'処理できませんでした。');
  return result;
 }
 async function load(target=1,resultMessage='',preselect=null){
  if(busy)return;
  busy=true;rows=[];hasMore=false;closeReview();render();status('記事を読み込み中…');
  $('publishedWarning').hidden=activeSearch.status!=='published';
  try{
   const data=await request('article-data',{query:{...activeSearch,page:String(target)}});
   rows=data.articles;page=data.page;hasMore=data.hasMore;totalPages=Math.max(1,Math.ceil(data.total/data.limit));
   if(preselect!==null){const match=rows.find(r=>r.id===preselect);if(match)selected.set(match.id,match);else resultMessage='対象記事は削除対象外か、現在の掲載状態が変わっています。';}
   status(resultMessage||'このページ：'+rows.length+'件（処理済み記事のみ）');
  }catch(error){status(error.message,true);}
  finally{busy=false;render();if(preselect!==null&&selected.has(preselect))$('review').click();}
 }
 function search(){if(busy)return;activeSearch={status:$('status').value,field:$('field').value,q:$('query').value.trim()};load(1);}
 $('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
 $('query').addEventListener('input',()=>{if($('clearQuery'))$('clearQuery').disabled=busy||(!$('query').value&&!activeSearch.q);});
 $('clearQuery')?.addEventListener('click',()=>{if(busy)return;$('query').value='';search();});
 $('status').addEventListener('change',search);
 $('selectAll').addEventListener('click',()=>{closeReview();for(const row of rows){if(selected.size>=SELECTION_LIMIT)break;if(!selected.has(row.id))selected.set(row.id,row);}render();});
 $('clear').addEventListener('click',()=>{closeReview();selected.clear();render();});
 $('review').addEventListener('click',()=>{
  if(busy||expiring||!selected.size)return;
  reviewed=[...selected.values()];$('selectedList').replaceChildren(...reviewed.map(r=>{const li=node('li');const copy=node('span','ID '+r.id+' ／ '+(labels[r.status]||r.status)+' ／ '+(r.title||'（タイトルなし）'));const remove=node('button','選択解除');remove.type='button';remove.addEventListener('click',()=>{if(busy)return;selected.delete(r.id);render();if(selected.size){$('review').click();$('cancel').focus();}else{closeReview();controls();}});li.append(copy,remove);return li;}));
  $('selectedSummary').textContent=reviewed.length+'件を削除します。'+(reviewed.some(r=>r.status==='published')?' 掲載中の記事を含みます。':'');
  $('confirmationTitle').textContent='完全削除の最終確認';setStage('review',true);if(!$('confirmationPanel').open){openModal('confirmationPanel');$('cancel').focus();}controls();
 });
 $('cancel').addEventListener('click',()=>{closeReview();controls();});
 $('confirmationPanel').addEventListener('close',unlockModalScroll);
 $('confirmationPanel').addEventListener('cancel',event=>{event.preventDefault();if(!busy){if(stage==='result')continueAfterResult();else{closeReview();controls();}}});
 $('delete').addEventListener('click',async()=>{
  if(busy||expiring||stage!=='review'||!reviewed.length||!$('confirmationPanel').open)return;
  const articles=reviewed.map(({id,status,updated_at})=>({id,status,updated_at}));
  const confirmation='完全削除 '+reviewed.length+'件',includePublished=reviewed.some(r=>r.status==='published');
  const targets=[...reviewed];
  busy=true;controls();$('confirmationTitle').textContent='記事を削除しています';setStage('progress');$('confirmationTitle').focus();
  try{
   const result=await request('delete-articles',{body:{articles,confirmation,includePublished}});
   if(result.deletedIds.length){window.GameEditorNavigation?.markChanged();window.dispatchEvent(new Event('retention-settings-saved'));}
   const summary='削除済み：'+result.deletedIds.length+'件'+(result.remainingIds.length?' ／ 未削除：'+result.remainingIds.length+'件。再検索して確認してください。':'。');
   selected.clear();rows=rows.filter(r=>!result.deletedIds.includes(r.id));
   const details=targets.map(r=>(result.deletedIds.includes(r.id)?'削除済み':result.remainingIds.includes(r.id)?'未削除':'結果未確認')+' ／ ID '+r.id+' ／ '+(r.title||'（タイトルなし）'));
   showResult(result.remainingIds.length?(result.deletedIds.length?'一部の記事を削除できませんでした':'記事を削除できませんでした'):'記事を削除しました',summary,result.remainingIds.length>0,details);
  }catch(error){
   // Never retry a deletion automatically, including a lost response.
   window.GameEditorNavigation?.markChanged();
   selected.clear();rows=[];hasMore=false;showResult('削除結果を確認してください',error.message+'\n続けて記事を整理するボタンから、再検索して状態を確認してください。',true);
  }finally{busy=false;render();}
 });
 function continueAfterResult(){
  if(busy||expiring||stage!=='result')return;
  closeReview();
  if(direct&&activeSearch.field==='id'&&activeSearch.q===String(id)){
   $('status').value='unpublished';$('field').value='title';$('query').value='';activeSearch={status:'unpublished',field:'title',q:''};page=1;
  }
  selected.clear();load(page);
 }
 $('continueData').addEventListener('click',continueAfterResult);
 let expiring=false;
 window.addEventListener('editor-session-expired',()=>{expiring=true;closeReview();});
 window.GameEditorDataManagement={isBusy:()=>busy};
 window.addEventListener('beforeunload',event=>{if(busy&&stage==='progress'){event.preventDefault();event.returnValue='';}});
 manualPanel.addEventListener('toggle',()=>{
  if(manualPanel.open&&!loaded){loaded=true;load();}
  resizeSelectionBar();
 });
 if(direct){
  loaded=true;manualPanel.open=true;$('field').value='id';$('query').value=String(id);$('status').value=params.get('status')==='published'?'published':'unpublished';activeSearch={status:$('status').value,field:'id',q:String(id)};load(1,'',id);
 }else if(location.hash==='#manualDeletion'){manualPanel.open=true;}

})();