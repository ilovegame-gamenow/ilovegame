// Compose the existing idempotent operations. Keep the same creation ID on retries.
window.GameCatalogWorkflow={async register(request,game,articleId){
  const result=await request('/api/editor-games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',game})});
  if(!result||articleId===null)return result;
  try{
    const linked=await request('/api/editor-games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'link',article_id:articleId,game_id:result.game.id})});
    return linked?result:null;
  }catch{
    throw Error('作品の登録は完了しましたが、記事への関連づけを確認できませんでした。同じ入力のままもう一度「登録してこの記事に使う」を押すと、重複せず再試行できます。');
  }
}};
