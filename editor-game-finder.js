(() => {
 const {node,createId}=GameCatalogClient,form=document.getElementById('titleFinder'),input=document.getElementById('findTitle'),list=document.getElementById('finderResults'),message=document.getElementById('finderMessage');
 let busy=false;
 const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{location.replace('/editor.html');});
 function controls(value){busy=value;form.querySelectorAll('input,button').forEach(e=>e.disabled=value);list.querySelectorAll('button').forEach(e=>e.disabled=value);}
 const options=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 function entry(title,description,{game,appid,unverified=false}={}){
  const card=node('article',undefined,'finder-result');card.append(node('h3',title));if(description)card.append(node('p',description));
  const search=node('a','Webで探す（全機種） ↗');search.href=`https://www.google.com/search?q=${encodeURIComponent(title+' ゲーム 公式 ニュース')}`;search.target='_blank';search.rel='noopener noreferrer';card.append(search);
  if(appid){const official=node('a','Steamで作品を見る ↗');official.href=`https://store.steampowered.com/app/${appid}/`;official.target='_blank';official.rel='noopener noreferrer';card.append(official);}
  if(game){const manage=node('a','作品管理で確認 →');manage.href='#manage';manage.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('game-management-open',{detail:{title}})));card.append(manage);}
  if(game?.is_favorite){card.append(node('p','★ お気に入り登録済み'));return card;}
  if(unverified)card.append(node('p','公式情報がまだ確認できていない場合の登録です。定期確認で公式出典と作品の同定から始めます。同名作品にはご注意ください。','catalog-note'));
  const button=node('button','★ このゲームを追う');button.type='button';const id=createId();
  button.addEventListener('click',async()=>{
   if(busy)return;
   if(unverified&&!confirm(`「${title}」をタイトル指定で追跡します。公式情報の確認が済むまで、作品の詳細や発売日は未確認として扱います。登録しますか？`))return;
   controls(true);
   try{
    const result=game?await request('/api/editor-games',options({action:'following',game_id:game.id,operation:'favorite_on'})):await request('/api/editor-games?resource=finder',options({id,...(appid?{appid}:{title})}));
    if(!result)return;
    button.replaceWith(node('p','★ お気に入りに登録しました'));document.dispatchEvent(new Event('game-following-changed'));message.textContent='登録しました。「管理中のゲーム」で確認できます。次回の定期収集から個別確認の対象になります。';
   }catch(error){message.textContent=error.message;}finally{controls(false);}
  });card.append(button);return card;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const title=input.value.trim();if(!title)return;controls(true);list.replaceChildren();message.textContent='登録済み作品とSteamを検索しています…';
  try{
   const data=await request(`/api/editor-games?resource=finder&q=${encodeURIComponent(title)}`);if(!data)return;
   data.games.forEach(game=>list.append(entry(game.title,game.description,{game})));
   data.steam.filter(app=>!data.games.some(game=>game.title.toLowerCase()===app.title.toLowerCase())).forEach(app=>list.append(entry(app.title,'Steamの検索結果です。作品ページで内容を確認してから登録してください。',{appid:app.appid})));
   const web=node('a','Webで探す（全機種の公式情報・関連記事） ↗');web.href=`https://www.google.com/search?q=${encodeURIComponent(title+' ゲーム 公式 ニュース')}`;web.target='_blank';web.rel='noopener noreferrer';list.prepend(web);
   list.append(entry(title,'Switch・PlayStation・スマホなど、検索結果にない作品もタイトルを指定して追跡できます。',{unverified:true}));
   message.textContent=`登録済み ${data.games.length}件／Steam ${data.steam.length}件。${data.steamUnavailable?'Steamの取得に失敗しました。':'Steam以外の外部作品は、関連記事を確認してタイトル指定で登録できます。'}`;
  }catch(error){message.textContent=error.message;}finally{controls(false);}
 });
})();
