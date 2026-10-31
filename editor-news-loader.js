/* Read-only list requests may be retried; editing and publication writes never are. */
window.GameEditorNewsLoader = (() => {
  const attempts = 3;
  function valid(data) {
    return data && Array.isArray(data.articles) && Array.isArray(data.sources) &&
      Number.isSafeInteger(data.page) && data.page > 0 &&
      Number.isSafeInteger(data.limit) && data.limit > 0 &&
      Number.isSafeInteger(data.total) && data.total >= 0 &&
      ['all','pending','published','rejected'].every(name=>Number.isSafeInteger(data.counts?.[name])&&data.counts[name]>=0) &&
      typeof data.filters?.status === 'string' && typeof data.filters?.source === 'string' &&
      data.sources.every(source=>typeof source.id==='string'&&typeof source.label==='string'&&Number.isSafeInteger(source.count)&&source.count>=0);
  }
  function pause(delay, signal) {
    return new Promise((resolve,reject)=>{
      const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);
      signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted)abort();
    });
  }
  async function load({ page, status, source, signal, onRetry }) {
    const query=new URLSearchParams({page:String(page),status,source});
    for(let attempt=0;attempt<attempts;attempt++){
      try {
        const response=await fetch(`/api/editor-news?${query}`,{method:'GET',credentials:'same-origin',cache:'no-store',signal});
        if(!response.ok){
          const error=new Error(`Editor list request failed (${response.status})`);
          error.status=response.status;error.retryable=response.status>=500||response.status===429;throw error;
        }
        const data=await response.json();
        if(!valid(data)){
          const error=new Error('Invalid editor list response');error.retryable=true;throw error;
        }
        return data;
      } catch(error) {
        if(signal?.aborted||error.name==='AbortError')throw error;
        const retryable=error.retryable??(error instanceof TypeError||error instanceof SyntaxError);
        if(!retryable||attempt===attempts-1)throw error;
        onRetry?.();
        await pause(300*(attempt+1),signal);
      }
    }
  }
  return {load};
})();
