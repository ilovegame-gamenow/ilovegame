import {renderReleaseMaintenance} from './release-maintenance-view.js';
const panel=document.getElementById('releaseMaintenance'),list=document.getElementById('releaseCheckList'),message=document.getElementById('releaseCheckMessage');
const endpoint='/api/editor-games?resource=release-maintenance';
let busy=false;
async function load(){
  if(busy)return;busy=true;message.textContent='発売情報を読み込んでいます…';list.replaceChildren();
  try{
    const data=await GameCatalogClient.request(endpoint);if(!data)return;
    renderReleaseMaintenance(list,data,async(action,c)=>{
      if(busy)return;busy=true;
      try{
        const saved=await GameCatalogClient.request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:c.id,expected_updated_at:c.before_values.updated_at})});
        if(saved){busy=false;await load();}
      }catch(error){message.textContent=error.message;}finally{busy=false;}
    });
    message.textContent='公式に確認できた変更だけを反映します。表示差や取得失敗だけでは日付を変更しません。';
  }catch(error){message.textContent=error.message;}finally{busy=false;}
}
panel.addEventListener('toggle',()=>{if(panel.open)load();});
document.getElementById('reloadReleases').addEventListener('click',load);
