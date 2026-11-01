(() => {
  const {node,createId}=GameCatalogClient;
  const endpoint='/api/editor-games?resource=research',storageKey='ilovegame.research.last-run';
  const prepare=document.getElementById('prepareResearch'),execute=document.getElementById('executeResearch'),refresh=document.getElementById('refreshResearch');
  const message=document.getElementById('catalogMessage'),list=document.getElementById('researchSources');
  let id=createId(),run=null,config=null,busy=false,ending=false;
  try{const saved=sessionStorage.getItem(storageKey);if(/^[0-9a-f-]{36}$/i.test(saved))id=saved;}catch{}
  const remember=()=>{try{sessionStorage.setItem(storageKey,id);}catch{}};
  const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{ending=true;});
  function notify(text,error=false){message.textContent=text;message.dataset.error=String(error);}
  function controls(){prepare.disabled=busy||!config;execute.disabled=busy||!config||run?.status!=='prepared';refresh.disabled=busy||!config;}
  function render(){
    list.replaceChildren();
    document.getElementById('researchCost').textContent=config?`AI料金の目安：1回 ${config.estimatedMaxUsd.toFixed(2)}米ドル以下。1日最大${config.dailyLimit}回。対象の取得だけではAI料金は発生しません。`:'';
    document.getElementById('researchStatus').textContent=run?`${({prepared:'対象確認待ち（AI未実行）',running:'実行中・結果確認待ち',completed:'完了',failed:'結果を確定できませんでした'})[run.status]} ／ ${GameDate.format(run.created_at)}`:'まだ対象を取得していません。';
    for(const source of run?.sources||[]){
      const li=node('li');li.append(node('h3',source.title),node('p',source.description));
      const a=node('a','Steamの出典を開く');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);
    }
    const result=document.getElementById('researchResult');result.textContent='';
    const checks=document.getElementById('researchChecks');checks.replaceChildren();
    if(run?.status==='completed'){
      const count=run.analysis.items.filter(i=>i.selected).length;
      result.textContent=`${count}作品を発見候補の登録対象として処理しました。既に登録されていた場合はその候補を維持します。`;
      for(const check of run.analysis.verification?.checks||[]){
        const title=run.sources.find(source=>source.appid===check.appid)?.title||String(check.appid);
        const supported=check.description==='supported'&&check.reason==='supported';
        checks.append(node('li',`${title}：${supported?'AI点検で裏付けを確認（採用前に出典確認が必要）':'裏付け不足のため候補登録を見送り'}${check.note?' ／ '+check.note:''}`));
      }
      if(run.analysis.usage?.input_tokens!==undefined)result.textContent+=` 使用量：入力${run.analysis.usage.input_tokens}／出力${run.analysis.usage.output_tokens}トークン。`;
    }
    if(run?.status==='failed')result.textContent=run.error_message;
    if(run?.status==='running')result.textContent='同じ調査を自動でやり直すことはありません。「状態を再読み込み」で確認してください。';
    controls();
  }
  async function load(){const result=await request(`${endpoint}&id=${id}`);if(result){run=result.run;config=result.config;render();}}
  async function action(kind){
    if(busy||!config)return;
    if(kind==='execute'&&!confirm(`表示中の最大3作品をAIで整理し、続けて出典との点検を行います（最大2回のAI呼び出し）。料金の目安は${config.estimatedMaxUsd.toFixed(2)}米ドル以下です。実行しますか？`))return;
    if(kind==='prepare'&&run?.status==='running'){notify('実行中です。先に状態を読み直してください。',true);return;}
    if(kind==='prepare'&&['completed','failed'].includes(run?.status)){id=createId();run=null;}
    remember();busy=true;controls();
    try{
      const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind,id,...(kind==='execute'?{confirm_cost:true}:{})})});
      if(!result)return;run=result.run;config=result.config;render();notify(kind==='prepare'?'出典と対象を確認してください。まだAIは実行していません。':'調査の状態を更新しました。');
    }catch(error){notify(error.message,true);await load().catch(()=>{});}finally{busy=false;controls();}
  }
  prepare.addEventListener('click',()=>action('prepare'));execute.addEventListener('click',()=>action('execute'));
  refresh.addEventListener('click',async()=>{if(busy)return;busy=true;controls();try{await load();notify('状態を読み直しました。');}catch(error){notify(error.message,true);}finally{busy=false;controls();}});
  document.addEventListener('click',async event=>{
    if(!event.target.closest('#logoutButton')||busy)return;
    try{const r=await fetch('/api/editor-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('ログアウトできませんでした。');ending=true;location.replace('/editor.html');}catch(error){notify(error.message,true);}
  });
  window.addEventListener('editor-session-expired',()=>{ending=true;});
  window.addEventListener('beforeunload',event=>{if(!ending&&busy){event.preventDefault();event.returnValue='';}});
  GameEditorSession.start();busy=true;
  load().then(()=>notify('')).catch(error=>notify(error.message,true)).finally(()=>{busy=false;controls();});
})();
