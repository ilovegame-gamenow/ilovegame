(() => {
 const form=document.getElementById('retentionForm'),fields=document.getElementById('retentionFields'),message=document.getElementById('retentionMessage'),button=document.getElementById('saveRetention');
 const inputs=()=>[...form.querySelectorAll('[name]')];let original=null,busy=false;
 const values=()=>Object.fromEntries(inputs().map(x=>[x.name,x.type==='time'?x.value:Number(x.value)]));
 function notify(text,error=false){message.textContent=text;message.dataset.error=String(error);}
 function fill(settings){for(const x of inputs())x.value=settings[x.name];original=JSON.stringify(values());}
 async function request(options={}){const r=await fetch('/api/editor-settings?resource=retention',{credentials:'same-origin',cache:'no-store',...options});if(r.status===401){GameEditorSession.expire();return null;}const data=await r.json();if(!r.ok)throw Error(data.error||'設定を保存できませんでした');return data;}
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;fields.disabled=true;button.textContent='保存中…';try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values())});if(data){fill(data.settings);notify('✓ 自動整理の設定を保存しました。');}}catch(e){notify(e.message,true);}finally{busy=false;fields.disabled=false;button.textContent='自動整理の設定を保存';}});
 window.addEventListener('beforeunload',e=>{if(busy||(original!==null&&original!==JSON.stringify(values()))){e.preventDefault();e.returnValue='';}});
 request().then(data=>{if(data){fill(data.settings);fields.disabled=false;notify('');}}).catch(e=>notify(e.message,true));
})();
