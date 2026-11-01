import { appendGameMedia } from './editor-game-media.js';
const {node}=GameCatalogClient;
const list=document.getElementById('showcaseGames'),load=document.getElementById('loadShowcase'),message=document.getElementById('catalogMessage');
let busy=false,ending=false;
const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{ending=true;});
function notify(text,error=false){message.textContent=text;message.dataset.error=String(error);}
function controls(){load.disabled=busy;list.querySelectorAll('fieldset').forEach(fieldset=>fieldset.disabled=busy);}
function card(game,source){
  const li=node('li');li.append(node('h3',game.title),node('small',`発見元：${source.name} ／ 作品情報：Steam`));
  appendGameMedia(li,{title:game.title,source_url:game.url},request);
  li.append(node('p',game.description));
  const a=node('a','Steamの出典を確認');a.href=game.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);
  const form=node('form'),fieldset=node('fieldset');form.append(fieldset);
  const inputId=`showcase-reason-${game.appid}`,label=node('label','どこが気になる？');label.htmlFor=inputId;
  const reason=node('textarea');reason.id=inputId;reason.maxLength=1800;reason.required=true;reason.rows=2;reason.placeholder='見た目や遊びの仕組みで気になる点を書いてください。';
  const draftKey=`ilovegame.showcase.reason.${game.appid}`;
  try{reason.value=sessionStorage.getItem(draftKey)||'';}catch{}
  reason.addEventListener('input',()=>{try{sessionStorage.setItem(draftKey,reason.value);}catch{}});
  const button=node('button','発見候補に追加');button.type='submit';
  fieldset.append(label,reason,button);li.append(form);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;if(!reason.value.trim()){reason.focus();return;}
    busy=true;controls();
    try{
      const result=await request('/api/editor-games?resource=discoveries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register',candidate:{id:game.candidate_id,title:game.title,original_title:'',description:game.description,reason:`${source.name}掲載作品（${source.url}）。\n${reason.value.trim()}`,source_url:game.url,source_type:'store'}})});
      if(!result)return;
      try{sessionStorage.removeItem(draftKey);}catch{}
      form.replaceChildren(node('p','発見候補に追加しました。同じ出典・作品名があった場合は既存候補を維持します。'));
      notify('発見候補に保存しました。');
    }catch(error){notify(error.message,true);}finally{busy=false;controls();}
  });
  return li;
}
load.addEventListener('click',async()=>{
  if(busy)return;
  if([...list.querySelectorAll('textarea')].some(input=>input.value.trim())&&!confirm('入力中の気になる点を破棄して、作品を取得し直しますか？'))return;
  busy=true;controls();
  try{
    const result=await request('/api/editor-games?resource=showcase');if(!result)return;
    list.replaceChildren(...result.games.map(game=>card(game,result.source)));
    document.getElementById('showcaseEmpty').textContent=result.games.length?'':'新しく取得できる発売予定作品はありませんでした。登録済み作品や、取得できない作品は表示していません。';
    notify(`${result.games.length}作品を取得しました。AIは使用していません。`);
  }catch(error){notify(error.message,true);}finally{busy=false;controls();}
});
window.addEventListener('beforeunload',event=>{if(!ending&&(busy||[...list.querySelectorAll('textarea')].some(input=>input.value.trim()))){event.preventDefault();event.returnValue='';}});
document.addEventListener('click',async event=>{
  if(!event.target.closest('#logoutButton')||busy)return;
  try{const response=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw Error('ログアウトできませんでした。');ending=true;list.replaceChildren();location.replace('/editor.html');}catch(error){notify(error.message,true);}
});
window.addEventListener('editor-session-expired',()=>{ending=true;});
GameEditorSession.start();
