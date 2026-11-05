/* Keep title selection independent of catalogue pagination and saved following state. */
(() => {
 async function collect(request,filter,articleId=null){
  const games=[],seen=new Set();let linkedGames=[];
  for(let page=1;page<=10001;page++){
   const query=new URLSearchParams({q:'',page:String(page),filter});
   if(articleId!==null)query.set('article_id',String(articleId));
   const data=await request(`/api/editor-games?${query}`);if(!data)return null;
   if(page===1)linkedGames=data.linkedGames;
   for(const game of data.games){if(seen.has(game.id))throw Error('作品一覧が更新されました。もう一度読み込んでください。');seen.add(game.id);games.push(game);}
   if(!data.hasMore)return {games,linkedGames};
   if(!data.games.length)throw Error('作品一覧を取得できませんでした。');
  }
  throw Error('作品数が表示上限を超えました。');
 }
 function view(games,selectedId,page,size=20){
  const selected=games.some(g=>g.id===selectedId)?selectedId:'';
  const filtered=selected?games.filter(g=>g.id===selected):games;
  const totalPages=Math.max(1,Math.ceil(filtered.length/size));
  const currentPage=Math.max(1,Math.min(page,totalPages));
  return {selectedId:selected,page:currentPage,hasMore:currentPage<totalPages,games:filtered.slice((currentPage-1)*size,currentPage*size)};
 }
 window.GameSelection={collect,view};
})();
