(() => {
 const {node,createId}=GameCatalogClient,form=document.getElementById('titleFinder'),input=document.getElementById('findTitle'),list=document.getElementById('finderResults'),message=document.getElementById('finderMessage');
 let busy=false;
 const request=(path,options={})=>GameCatalogClient.request(path,options,()=>{location.replace('/editor.html');});
 function controls(value){busy=value;form.querySelectorAll('input,button').forEach(e=>e.disabled=value);list.querySelectorAll('button').forEach(e=>e.disabled=value);}
 const options=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 function externalLink(text,url){
  try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)return null;}catch{return null;}
  const link=node('a',text);link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;
 }
 function entry(title,description,{game,appid,result,unverified=false}={}){
  const card=node('article',undefined,'finder-result');
  if(result?.sourceLabel)card.append(node('span',result.sourceLabel,'finder-source'));
  else if(game)card.append(node('span','登録済み','finder-source'));
  if(result?.image){const image=node('img');const valid=externalLink('',result.image);if(valid){image.src=valid.href;image.alt='';image.loading='lazy';image.className='finder-image';image.addEventListener('error',()=>{image.hidden=true;});card.append(image);}}
  card.append(node('h3',title));if(description)card.append(node('p',description.slice(0,500),'finder-description'));
  if(result?.platforms?.length)card.append(GamePlatforms.element(result.platforms));
  if(result?.developer)card.append(node('p',result.developer,'catalog-note'));
  if(result){
   const source=externalLink(result.provider==='appstore'?'App Storeで見る ↗':result.provider==='steam'?'Steamで見る ↗':'作品情報・出典を見る ↗',result.url);if(source)card.append(source);
   const official=externalLink('公式サイト（参考リンク） ↗',result.officialUrl);if(official)card.append(official);
   if(result.provider==='wikidata')card.append(node('p','参考データです。最新の対応機種・日本向け情報は公式発表で確認します。','catalog-note'));
  }
  if(game){const manage=node('a','作品管理で確認 →');manage.href='#manage';manage.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('game-management-open',{detail:{title:game.title}})));card.append(manage);}
  if(game?.is_favorite){card.append(node('p','★ お気に入り登録済み'));return card;}
  if(unverified)card.append(node('p','タイトルだけで追跡登録し、公式情報の確認から始めます。','catalog-note'));
  const button=node('button','★ このゲームを追う');button.type='button';const id=createId();
  button.addEventListener('click',async()=>{
   if(busy)return;
   if(unverified&&!confirm(`「${title}」をタイトル指定で追跡します。公式情報の確認が済むまで、作品の詳細や発売日は未確認として扱います。登録しますか？`))return;
   controls(true);
   try{
    const body=result&&result.provider!=='steam'?{id,provider:result.provider,external_id:result.externalId}:{id,...(appid?{appid}:{title})};
    const saved=game?await request('/api/editor-games',options({action:'following',game_id:game.id,operation:'favorite_on'})):await request('/api/editor-games?resource=finder',options(body));
    if(!saved)return;
    button.replaceWith(node('p','★ お気に入りに登録しました'));document.dispatchEvent(new Event('game-following-changed'));message.textContent='登録しました。「管理中のゲーム」で確認できます。次回の定期収集から個別確認の対象になります。';
   }catch(error){message.textContent=error.message;}finally{controls(false);}
  });card.append(button);return card;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const title=input.value.trim();if(!title)return;controls(true);list.replaceChildren();message.textContent='登録済み作品・全機種の作品データ・Steam・App Storeを検索しています…';
  try{
   const data=await request(`/api/editor-games?resource=finder&q=${encodeURIComponent(title)}`);if(!data)return;
   const games=data.games||[],results=data.results||[],shown=new Set();
   if(games.length)list.append(node('h3','登録済みのゲーム','finder-group-heading'));
   games.forEach(game=>{shown.add(game.id);list.append(entry(game.title,game.description,{game}));});
   if(results.length)list.append(node('h3','見つかったゲーム','finder-group-heading'));
   for(const result of results){
    if(result.game&&shown.has(result.game.id))continue;
    if(result.game)shown.add(result.game.id);
    list.append(entry(result.title,result.description,{game:result.game,result,...(result.provider==='steam'?{appid:Number(result.externalId)}:{})}));
   }
   if(!games.length&&!results.length)list.append(node('p','一致するゲームを取得できませんでした。別の表記や原題でも検索できます。'));
   const summary=(data.sources||[]).map(source=>`${source.name}：${source.available?`${source.count}件`:'取得できませんでした'}`).join(' ／ ');
   message.textContent=`登録済み：${games.length}件${summary?' ／ '+summary:''}。`;
   const fallback=node('details',undefined,'finder-fallback');fallback.append(node('summary','見つからない作品を探す・登録する'));
   const web=externalLink('Webで公式情報・関連記事を探す ↗',`https://www.google.com/search?q=${encodeURIComponent(title+' ゲーム 公式 ニュース')}`);fallback.append(web,entry(title,'検索元にまだ載っていない新作なども登録できます。',{unverified:true}));list.append(fallback);
  }catch(error){message.textContent=error.message;}finally{controls(false);}
 });
})();
