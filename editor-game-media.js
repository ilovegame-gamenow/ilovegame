import { steamAppId } from './game-source-utils.js';
const cache=new Map();
export function appendGameMedia(container,{title,source_url},request) {
  const appid=steamAppId(source_url);if(!appid)return;
  const {node}=GameCatalogClient;
  const details=node('details',undefined,'discovery-media');
  const summary=node('summary','ゲーム画面を見る');details.append(summary);
  const content=node('div');details.append(content);container.append(details);
  let loading=false,loaded=false;
  details.addEventListener('toggle',async()=>{
    if(!details.open||loading||loaded)return;
    loading=true;content.replaceChildren(node('p','Steamの画面を読み込んでいます…'));
    try{
      if(!cache.has(appid))cache.set(appid,request(`/api/editor-games?resource=steam-media&appid=${appid}`).catch(error=>{cache.delete(appid);throw error;}));
      const result=await cache.get(appid);if(!result)return;
      content.replaceChildren();loaded=true;
      content.append(node('p',result.images.length?'Steam掲載のスクリーンショット。画像を押すと拡大できます。':'掲載画像を取得できませんでした。出典のストアページで確認してください。'));
      const gallery=node('div',undefined,'discovery-gallery');content.append(gallery);
      result.images.forEach((image,index)=>{
        const link=node('a');link.href=image.full;link.target='_blank';link.rel='noopener noreferrer';
        const img=node('img');img.src=image.thumbnail;img.alt=`${title}のゲーム画面 ${index+1}`;img.loading='lazy';img.referrerPolicy='no-referrer';
        img.addEventListener('error',()=>{link.replaceChildren(node('span','画像を読み込めませんでした（押すと出典画像を開きます）'));},{once:true});
        link.append(img);gallery.append(link);
      });
    }catch(error){content.replaceChildren(node('p',`${error.message} いったん閉じて開くと再読み込みできます。`));}
    finally{loading=false;}
  });
}
