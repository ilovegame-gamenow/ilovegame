(() => {
 const $=id=>document.getElementById(id);
 const labels={pending:'審査待ち',rejected:'非掲載',published:'掲載中'};
 let rows=[],selected=new Set(),page=1,hasMore=false,busy=false,reviewed=[],activeSearch={status:'unpublished',field:'title',q:''};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function status(text,error=false){$('message').textContent=text;$('message').dataset.error=String(error);}
 function closeReview(){reviewed=[];$('confirmationPanel').hidden=true;$('confirmationText').value='';$('deleteResult').textContent='';}
 function controls(){
  for(const id of ['status','field','query'])$(id).disabled=busy;
  $('searchForm').querySelector('button').disabled=busy;
  $('selectAll').disabled=busy||!rows.length||selected.size===rows.length;
  $('clear').disabled=busy||!selected.size;
  $('review').disabled=busy||!selected.size;
  $('prev').disabled=busy||page===1;$('next').disabled=busy||!hasMore;
  $('count').textContent='選択：'+selected.size+'件';
  $('page').textContent=page+'ページ';
  $('cancel').disabled=busy;$('confirmationText').disabled=busy;
  $('delete').disabled=busy||!reviewed.length||$('confirmationText').value!=='完全削除 '+reviewed.length+'件';
  $('articles').querySelectorAll('input').forEach(el=>el.disabled=busy);
 }
 function render(){
  $('articles').replaceChildren();
  for(const row of rows){
   const label=node('label');label.className='data-row';
   const check=node('input');check.type='checkbox';check.checked=selected.has(row.id);
   const text=node('span');text.append(node('strong',row.title||'（タイトルなし）'),node('small','ID '+row.id+' ／ '+(labels[row.status]||row.status)+' ／ '+(row.source_name||'情報元なし')));
   check.addEventListener('change',()=>{closeReview();if(check.checked)selected.add(row.id);else selected.delete(row.id);controls();});
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
 async function load(target=1,resultMessage=''){
  if(busy)return;
  busy=true;selected.clear();rows=[];hasMore=false;closeReview();render();status('記事を読み込み中…');
  $('publishedWarning').hidden=activeSearch.status!=='published';
  try{
   const data=await request('article-data',{query:{...activeSearch,page:String(target)}});
   rows=data.articles;page=data.page;hasMore=data.hasMore;
   status(resultMessage||'このページ：'+rows.length+'件（処理済み記事のみ）');
  }catch(error){status(error.message,true);}
  finally{busy=false;render();}
 }
 function search(){if(busy)return;activeSearch={status:$('status').value,field:$('field').value,q:$('query').value.trim()};load(1);}
 $('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
 $('status').addEventListener('change',search);
 $('selectAll').addEventListener('click',()=>{closeReview();selected=new Set(rows.map(r=>r.id));render();});
 $('clear').addEventListener('click',()=>{closeReview();selected.clear();render();});
 $('prev').addEventListener('click',()=>load(page-1));$('next').addEventListener('click',()=>load(page+1));
 $('review').addEventListener('click',()=>{
  if(busy||!selected.size)return;
  reviewed=rows.filter(r=>selected.has(r.id));$('selectedList').replaceChildren(...reviewed.map(r=>node('li','ID '+r.id+' ／ '+(labels[r.status]||r.status)+' ／ '+(r.title||'（タイトルなし）'))));
  $('selectedSummary').textContent=reviewed.length+'件を削除します。'+(reviewed.some(r=>r.status==='published')?' 掲載中の記事を含みます。':'');
  $('requiredText').textContent='完全削除 '+reviewed.length+'件';
  $('confirmationText').value='';$('deleteResult').textContent='';$('confirmationPanel').hidden=false;controls();$('confirmationPanel').scrollIntoView({block:'start'});
 });
 $('confirmationText').addEventListener('input',controls);
 $('cancel').addEventListener('click',()=>{closeReview();controls();});
 $('delete').addEventListener('click',async()=>{
  if(busy||!reviewed.length||$('confirmationText').value!=='完全削除 '+reviewed.length+'件')return;
  const articles=reviewed.map(({id,status,updated_at})=>({id,status,updated_at}));
  const confirmation=$('confirmationText').value,includePublished=activeSearch.status==='published';
  busy=true;controls();$('deleteResult').textContent='削除結果を確認中…';
  try{
   const result=await request('delete-articles',{body:{articles,confirmation,includePublished}});
   if(result.deletedIds.length)window.GameEditorNavigation?.markChanged();
   const summary='削除済み：'+result.deletedIds.length+'件'+(result.deletedIds.length?'（ID '+result.deletedIds.join('、')+'）':'')+(result.remainingIds.length?'。未削除：'+result.remainingIds.length+'件（ID '+result.remainingIds.join('、')+'）。再検索して確認してください。':'。');
   busy=false;await load(1,summary);
  }catch(error){
   // Never retry a deletion automatically, including a lost response.
   selected.clear();closeReview();rows=[];hasMore=false;status(error.message+' 状態を確認するため検索し直してください。',true);
  }finally{busy=false;render();}
 });
 document.addEventListener('click',async event=>{
  if(!event.target.closest('#logoutButton')||busy)return;
  try{const r=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('ログアウトできませんでした。');location.replace('/editor.html');}catch(error){status(error.message,true);}
 });
 GameEditorSession.start();load();
})();