// Only public display indexes use this cache. Editorial/publication policy reads stay live.
export function createPublicReadCache({ttl=10000,maxEntries=8,now=Date.now}={}) {
  const entries=new Map();
  return async function read(key,load) {
    const current=entries.get(key);
    if(current && current.expires>now())return current.promise;
    if(current)entries.delete(key);
    while(entries.size>=maxEntries)entries.delete(entries.keys().next().value);
    const entry={expires:now()+ttl};
    entry.promise=Promise.resolve().then(load).catch(error=>{
      if(entries.get(key)===entry)entries.delete(key);
      throw error;
    });
    entries.set(key,entry);
    return entry.promise;
  };
}
