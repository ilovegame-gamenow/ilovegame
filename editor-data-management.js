(() => {
 const $=id=>document.getElementById(id);
 const labels={pending:'審査待ち',rejected:'非掲載',published:'掲載中'};
 const SELECTION_LIMIT=20;
 const params=new URLSearchParams(location.search),id=Number(params.get('id'));
 const direct=Number.isSafeInteger(id)&&id>0;
 const returnTarget=params.get('return')||'';
 const safeReturn=returnTarget==='/editor-media.html'||returnTarget==='/editor-dashboard.html'||returnTarget.startsWith('/editor-dashboard.html?')?returnTarget:'/editor-dashboard.html';
 if(direct){$('dataBack').href=safeReturn;$('dataBack').textContent='← 元の記事一覧に戻る';}
 $('resultBack').href=safeReturn;
 $('resultBack').textContent=direct?'元の記事一覧に戻る':'編集室に戻る';
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
  if(!modalScroll||$('confirmationPanel').open||$('resultPanel').open)return;
  const {x,y}=modalScroll;modalScroll=null;
  const root=document.documentElement;
  root.classList.remove('data-modal-scroll-locked');
  root.style.removeProperty('--data-modal-scroll-top');
  root.style.removeProperty('--data-modal-scroll-left');
  window.scrollTo({left:x,top:y,behavior:'instant'});
 }
 function openModal(id){lockModalScroll();try{$(id).showModal();}catch(error){unlockModalScroll();throw error;}}
 function closeReview(keepLock=false){reviewed=[];if($('confirmationPanel').open)$('confirmationPanel').close();$('deleteResult').textContent='';if(!keepLock)unlockModalScroll();}
 function showResult(title,message,error=false){
  closeReview(true);
  $('resultTitle').textContent=title;$('resultSummary').textContent=message;
  $('resultPanel').dataset.error=String(error);
  if(!expiring){openModal('resultPanel');$('resultTitle').focus();}else unlockModalScroll();
 }
 function controls(){
  for(const id of ['status','field','query'])$(id).disabled=busy;
  $('searchForm').querySelector('button').disabled=busy;
  if($('clearQuery'))$('clearQuery').disabled=busy||(!$('query').value&&!activeSearch.q);
  $('selectAll').disabled=busy||!rows.length||rows.every(r=>selected.has(r.id))||selected.size>=SELECTION_LIMIT;
  $('clear').disabled=busy||!selected.size;
  $('review').disabled=busy||!selected.size;
  for(const id of ['paginationTop','pagination']){const box=$(id);box.replaceChildren();if(totalPages>1){const nav=GamePagination.render(page,totalPages,p=>{if(!busy&&p!==page)load(p);});if(busy)nav.querySelectorAll('button').forEach(b=>b.disabled=true);box.append(nav);}}
  $('count').textContent='選択：'+selected.size+'件（全ページ・最大'+SELECTION_LIMIT+'件）';
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
  $('deleteResult').textContent='';if(!$('confirmationPanel').open){openModal('confirmationPanel');$('cancel').focus();}controls();
 });
 $('cancel').addEventListener('click',()=>{closeReview();controls();});
 $('confirmationPanel').addEventListener('close',unlockModalScroll);
 $('confirmationPanel').addEventListener('cancel',event=>{event.preventDefault();if(!busy){closeReview();controls();}});
 $('delete').addEventListener('click',async()=>{
  if(busy||expiring||!reviewed.length||!$('confirmationPanel').open)return;
  const articles=reviewed.map(({id,status,updated_at})=>({id,status,updated_at}));
  const confirmation='完全削除 '+reviewed.length+'件',includePublished=reviewed.some(r=>r.status==='published');
  busy=true;controls();$('deleteResult').textContent='削除結果を確認中…';
  try{
   const result=await request('delete-articles',{body:{articles,confirmation,includePublished}});
   if(result.deletedIds.length)window.GameEditorNavigation?.markChanged();
   const summary='削除済み：'+result.deletedIds.length+'件'+(result.deletedIds.length?'（ID '+result.deletedIds.join('、')+'）':'')+(result.remainingIds.length?'。未削除：'+result.remainingIds.length+'件（ID '+result.remainingIds.join('、')+'）。再検索して確認してください。':'。');
   selected.clear();rows=rows.filter(r=>!result.deletedIds.includes(r.id));
   showResult(result.remainingIds.length?(result.deletedIds.length?'一部の記事を削除できませんでした':'記事を削除できませんでした'):'✓ 記事を削除しました',summary,result.remainingIds.length>0);
  }catch(error){
   // Never retry a deletion automatically, including a lost response.
   window.GameEditorNavigation?.markChanged();
   selected.clear();rows=[];hasMore=false;showResult('削除結果を確認してください',error.message+'\n続けて記事を整理するボタンから、再検索して状態を確認してください。',true);
  }finally{busy=false;render();}
 });
 $('continueData').addEventListener('click',()=>{
  if(busy)return;
  $('resultPanel').close();
 });
 $('resultPanel').addEventListener('close',()=>{
  unlockModalScroll();
  if(expiring)return;
  if(direct&&activeSearch.field==='id'&&activeSearch.q===String(id)){
   $('status').value='unpublished';$('field').value='title';$('query').value='';activeSearch={status:'unpublished',field:'title',q:''};page=1;
  }
  selected.clear();load(page);
 });
 let expiring=false;
 window.addEventListener('editor-session-expired',()=>{expiring=true;closeReview();if($('resultPanel').open)$('resultPanel').close();unlockModalScroll();});
 document.addEventListener('click',async event=>{
  if(!event.target.closest('#logoutButton')||busy)return;
  try{const r=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}catch(error){status(error.message,true);}
 });
 GameEditorSession.start();
 if(direct){$('field').value='id';$('query').value=String(id);$('status').value=params.get('status')==='published'?'published':'unpublished';activeSearch={status:$('status').value,field:'id',q:String(id)};load(1,'',id);}else load();
})();