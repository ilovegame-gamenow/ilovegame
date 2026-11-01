window.GameCatalogClient = (() => {
  function createId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function node(tag,text,className) {
    const result=document.createElement(tag);
    if (text!==undefined) result.textContent=text;
    if (className) result.className=className;
    return result;
  }
  async function request(path,options={},onExpired=()=>{}) {
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
    if(response.status===401){onExpired();GameEditorSession.expire();return null;}
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'情報を取得・保存できませんでした。');
    return result;
  }
  return {createId,node,request};
})();
