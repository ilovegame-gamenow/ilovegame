(() => {
 const $=id=>document.getElementById(id),list=$('retentionUpcomingList'),status=$('retentionUpcomingStatus'),alert=$('retentionAlert');
 let page=1,total=0,busy=false,expired=false;
 const node=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e;};
 const endpoint='/api/editor-news?action=';
 async function request(action,options={}){const r=await fetch(endpoint+action,{credentials:'same-origin',cache:'no-store',...options});if(r.status===401){GameEditorSession.expire();throw Error('ログイン期限が切れました。');}const data=await r.json();if(!r.ok)throw Error(data.error||'取得できませんでした。');return data;}
 function controls(){ $('retentionPrev').disabled=busy||expired||page<=1;$('retentionNext').disabled=busy||expired||page*20>=total;$('retentionRefresh').disabled=busy||expired;for(const b of list.querySelectorAll('button'))b.disabled=busy||expired; }
 function render(data){
  page=data.page;total=data.total;alert.hidden=!data.overdue;alert.textContent=data.overdue?'本日の自動整理の完了を確認できません。実行状況を確認してください。':'';
  status.textContent=(data.enabled?'自動整理 ON':'自動整理 OFF（実行されません）')+' ／ 対象 '+total+'件';
  status.dataset.error='false';$('retentionPage').textContent=page+' / '+Math.max(1,Math.ceil(total/20));
  const rows=data.articles.map(a=>{
   const row=node('div'),copy=node('div'),link=node('a',a.title||'記事 '+a.id),detail=node('small');
   row.className='retention-upcoming-row';link.href='/editor-article.html?id='+encodeURIComponent(a.id);
   const when=new Date(a.due_at),days=Math.max(0,Math.ceil((when-Date.now())/86400000));
   const date=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(when);
   detail.textContent=a.retention_protected?'自動整理から保護中':(a.status==='pending'?'非掲載へ移動':'完全削除')+'予定：'+date+'（'+(days===0?'まもなく':'残り約'+days+'日')+'）';
   copy.append(link,detail);const button=node('button',a.retention_protected?'保護解除':'保護する');button.type='button';button.addEventListener('click',()=>toggle(a));row.append(copy,button);return row;
  });list.replaceChildren(...rows);if(!rows.length)list.append(node('p','今後7日以内の予定・保護中の記事はありません。'));
 }
 async function load(next=page){if(busy||expired)return;busy=true;controls();try{render(await request('retention-overview&page='+next));}catch(e){status.textContent=e.message;status.dataset.error='true';}finally{busy=false;controls();}}
 async function toggle(a){if(busy||expired)return;busy=true;controls();try{await request('retention-protection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,status:a.status,updated_at:a.updated_at,protected:!a.retention_protected})});render(await request('retention-overview&page='+page));}catch(e){status.textContent=e.message;status.dataset.error='true';}finally{busy=false;controls();}}
 $('retentionPrev').addEventListener('click',()=>load(page-1));$('retentionNext').addEventListener('click',()=>load(page+1));$('retentionRefresh').addEventListener('click',()=>load());
 window.addEventListener('retention-settings-saved',()=>load(1));window.addEventListener('editor-session-expired',()=>{expired=true;controls();});load(1);
})();
