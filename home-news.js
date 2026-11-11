/* URL-backed filters and search; one response pairs featured slots with the feed. */
(() => {
 const byId=id=>document.getElementById(id), rail=byId('pickup'), latest=document.querySelector('.grid');
 const retry=byId('featured-retry'), pagination=byId('pagination');
 const form=byId('feed-search'),input=byId('feed-query'),include=byId('feed-include'),filters=byId('feed-filters');
 let controller,revision=0;
 const read=()=>new URL(location.href);
 function sync(){
  const params=read().searchParams,q=params.get('q')||'';
  input.value=q; include.checked=!!q||params.get('include_featured')==='1';include.disabled=!!q;
  byId('feed-clear').hidden=!q;byId('feed-search-note').hidden=!q;
  for(const b of filters.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.filter===(q?'all':params.get('filter')||'all')));
 }
 function change(patch){
  const url=read();
  for(const [k,v] of Object.entries(patch))v?url.searchParams.set(k,v):url.searchParams.delete(k);
  url.searchParams.delete('page');url.hash='latest';
  history.pushState(null,'',url);sync();load();
 }
 async function load(){
  controller?.abort();controller=new AbortController();const signal=controller.signal,run=++revision;
  const activeController=controller,timer=setTimeout(()=>activeController.abort(),20000);
  retry.hidden=true;latest.setAttribute('aria-busy','true');rail.setAttribute('aria-busy','true');
  byId('feed-count').textContent='読み込み中…';
  const params=new URLSearchParams(read().searchParams);params.set('view','home');
  try{
   let result;
   for(let attempt=0;attempt<2;attempt++){
    try{
     const response=await fetch(`/api/news?${params}`,{cache:'no-store',signal});
     if(!response.ok)throw Error('News unavailable');
     result=await response.json();
     if(!Array.isArray(result.articles)||!Object.hasOwn(result,'featured'))throw Error('Invalid news response');
     break;
    }catch(error){if(signal.aborted||attempt===1)throw error;}
   }
   if(run!==revision)return;
   GameFeatured.render(result.featured||{breaking:null,pickup:[]});
   if(!result.featured){rail.innerHTML='<p class="meta featured-status">PICK UPを読み込めませんでした。再読み込みをお試しください。</p>';retry.hidden=false;}
   latest.innerHTML=result.articles.map(a=>GameNewsCard.render(a,{compact:true})).join('')||'<p class="feed-empty">条件に合う記事がありません。フィルターや検索語を変えてお試しください。</p>';
   byId('feed-count').textContent=`${result.total}件`;
   const url=read();
   if(result.page!==Number(params.get('page')||1)){url.searchParams.set('page',String(result.page));history.replaceState(null,'',url);}
   pagination.replaceChildren(GamePagination.render(result.page,Math.max(1,Math.ceil(result.total/result.limit)),page=>{
    const url=read();url.searchParams.set('page',String(page));url.hash='latest';history.pushState(null,'',url);load();byId('latest').scrollIntoView();
   }));
  }catch(error){
   if(run!==revision)return;
   GameFeatured.render({breaking:null,pickup:[]});
   rail.innerHTML='<p class="meta featured-status">ニュースを読み込めませんでした。再読み込みをお試しください。</p>';
   latest.innerHTML='<p class="feed-empty">ニュースを読み込めませんでした。</p>';byId('feed-count').textContent='取得失敗';pagination.replaceChildren();retry.hidden=false;
  }finally{clearTimeout(timer);if(run===revision){latest.setAttribute('aria-busy','false');rail.setAttribute('aria-busy','false');}}
 }
 form.addEventListener('submit',e=>{
  e.preventDefault();const q=input.value.trim();
  const url=read();
  if(q&&!url.searchParams.get('q')){url.searchParams.set('previous_filter',url.searchParams.get('filter')||'all');url.searchParams.set('previous_include',url.searchParams.get('include_featured')||'0');history.replaceState(null,'',url);}
  if(!q){clearSearch();return;}change({q,filter:null,include_featured:null});
 });
 function clearSearch(){const p=read().searchParams;change({q:null,filter:p.get('previous_filter')==='all'?null:p.get('previous_filter'),include_featured:p.get('previous_include')==='1'?'1':null,previous_filter:null,previous_include:null});}
 byId('feed-clear').addEventListener('click',clearSearch);
 filters.addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(b)change({filter:b.dataset.filter==='all'?null:b.dataset.filter,q:null,previous_filter:null,previous_include:null});});
 include.addEventListener('change',()=>change({include_featured:include.checked?'1':null}));
 retry.querySelector('button').addEventListener('click',load);
 window.addEventListener('popstate',()=>{sync();load();});sync();load();
})();
