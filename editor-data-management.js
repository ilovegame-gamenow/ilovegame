(() => {
 const $=id=>document.getElementById(id);
 const labels={pending:'審査待ち',rejected:'非掲載',published:'掲載中'};
 const SELECTION_LIMIT=20;
 let rows=[],selected=new Map(),page=1,hasMore=false,busy=false,reviewed=[],activeSearch={status:'unpublished',field:'title',q:''};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function status(text,error=false){$('message').textContent=text;$('message').dataset.error=String(error);}
 function closeReview(){reviewed=[];$('confirmationPanel').hidden=true;$('deleteResult').textContent='';}
 function controls(){
  for(const id of ['status','field','query'])$(id).disabled=busy;
  $('searchForm').querySelector('button').disabled=busy;
  $('selectAll').disabled=busy||!rows.length||rows.every(r=>selected.has(r.id))||selected.size>=SELECTION_LIMIT;
  $('clear').disabled=busy||!selected.size;
  $('review').disabled=busy||!selected.size;
  $('prev').disabled=busy||page===1;$('next').disabled=busy||!hasMore;
  $('count').textContent='選択：'+selected.size+'件（全ページ・最大'+SELECTION_LIMIT+'件）';
  $('page').textContent=page+'ページ';
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
   const text=node('span');text.append(node('strong',row.title||'（タイトルなし）'),node('small','ID '+row.id+' ／ '+(labels[row.status]||row.status)+' ／ '+(row.source_name||'情報元なし')));
   check.addEventListener('change',()=>{closeReview();if(check.checked){if(selected.size>=SELECTION_LIMIT){check.checked=false;status('一度に選択できるのは最大'+SELECTION_LIMIT+'件です。',true);}else selected.set(row.id,row);}else selected.delete(row.id);controls();});
   label.append(check,text);$('articles').append(label);
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
   rows=data.articles;page=data.page;hasMore=data.hasMore;
   if(preselect!==null){const match=rows.find(r=>r.id===preselect);if(match)selected.set(match.id,match);else resultMessage='対象記事は削除対象外か、現在の掲載状態が変わっています。';}
   status(resultMessage||'このページ：'+rows.length+'件（処理済み記事のみ）');
  }catch(error){status(error.message,true);}
  finally{busy=false;render();if(preselect!==null&&selected.has(preselect))$('review').click();}
 }
 function search(){if(busy)return;activeSearch={status:$('status').value,field:$('field').value,q:$('query').value.trim()};load(1);}
 $('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
 $('status').addEventListener('change',search);
 $('selectAll').addEventListener('click',()=>{closeReview();for(const row of rows){if(selected.size>=SELECTION_LIMIT)break;if(!selected.has(row.id))selected.set(row.id,row);}render();});
 $('clear').addEventListener('click',()=>{closeReview();selected.clear();render();});
 $('prev').addEventListener('click',()=>load(page-1));$('next').addEventListener('click',()=>load(page+1));
 $('review').addEventListener('click',()=>{
  if(busy||!selected.size)return;
  reviewed=[...selected.values()];$('selectedList').replaceChildren(...reviewed.map(r=>{const li=node('li','ID '+r.id+' ／ '+(labels[r.status]||r.status)+' ／ '+(r.title||'（タイトルなし）'));const remove=node('button','選択解除');remove.type='button';remove.addEventListener('click',()=>{if(busy)return;selected.delete(r.id);closeReview();render();if(selected.size)$('review').click();});li.append(' ',remove);return li;}));
  $('selectedSummary').textContent=reviewed.length+'件を削除します。'+(reviewed.some(r=>r.status==='published')?' 掲載中の記事を含みます。':'');
  $('deleteResult').textContent='';$('confirmationPanel').hidden=false;controls();$('confirmationPanel').scrollIntoView({block:'start'});
 });
 $('cancel').addEventListener('click',()=>{closeReview();controls();});
 $('delete').addEventListener('click',async()=>{
  if(busy||!reviewed.length||$('confirmationPanel').hidden)return;
  const articles=reviewed.map(({id,status,updated_at})=>({id,status,updated_at}));
  const confirmation='完全削除 '+reviewed.length+'件',includePublished=reviewed.some(r=>r.status==='published');
  busy=true;controls();$('deleteResult').textContent='削除結果を確認中…';
  try{
   const result=await request('delete-articles',{body:{articles,confirmation,includePublished}});
   if(result.deletedIds.length)window.GameEditorNavigation?.markChanged();
   const summary='削除済み：'+result.deletedIds.length+'件'+(result.deletedIds.length?'（ID '+result.deletedIds.join('、')+'）':'')+(result.remainingIds.length?'。未削除：'+result.remainingIds.length+'件（ID '+result.remainingIds.join('、')+'）。再検索して確認してください。':'。');
   selected.clear();busy=false;await load(1,summary);
  }catch(error){
   // Never retry a deletion automatically, including a lost response.
   selected.clear();closeReview();rows=[];hasMore=false;status(error.message+' 状態を確認するため検索し直してください。',true);
  }finally{busy=false;render();}
 });
 document.addEventListener('click',async event=>{
  if(!event.target.closest('#logoutButton')||busy)return;
  try{const r=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}catch(error){status(error.message,true);}
 });
 GameEditorSession.start();
 const params=new URLSearchParams(location.search),id=Number(params.get('id'));
 if(Number.isSafeInteger(id)&&id>0){$('field').value='id';$('query').value=String(id);$('status').value=params.get('status')==='published'?'published':'unpublished';activeSearch={status:$('status').value,field:'id',q:String(id)};load(1,'',id);}else load();
})();