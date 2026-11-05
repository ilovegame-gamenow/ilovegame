// Search and collection management share one page; article linking keeps its own workflow.
(() => {
 const params=new URLSearchParams(location.search),articleMode=params.has('article_id');
 const tabs=document.getElementById('workspaceTabs'),finder=document.getElementById('finderPanel'),managed=document.getElementById('managedPanel');
 function show(view){
  if(articleMode)return;
  const find=view==='find';finder.hidden=!find;managed.hidden=find;
  tabs.querySelectorAll('[data-workspace]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workspace===view)));
 }
 tabs.hidden=articleMode;
 tabs.querySelectorAll('[data-workspace]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.workspace;show(button.dataset.workspace);}));
 window.addEventListener('hashchange',()=>show(location.hash==='#find'?'find':'manage'));
 document.addEventListener('game-finder-open',event=>{if(articleMode)return;document.getElementById('findTitle').value=event.detail?.title||'';location.hash='find';show('find');document.getElementById('findTitle').focus();});
 document.addEventListener('game-management-open',event=>{if(articleMode)return;document.getElementById('followingFilter').value='managed';document.dispatchEvent(new CustomEvent('game-selection-request',{detail:{title:event.detail?.title||''}}));show('manage');});
 show(location.hash==='#find'?'find':'manage');
})();
