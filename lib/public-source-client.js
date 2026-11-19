// Bounded reads for fixed public source URLs; never follows redirects.
export async function readPublicText(url,maxBytes=500000,headers={},timeoutMs=8000) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json,text/html',...headers}});
  if(!response.ok){await response.body?.cancel();const error=Error('Public source unavailable');error.status=response.status;throw error;}
  let bytes=0;const parts=[];
  for await(const part of response.body){bytes+=part.length;if(bytes>maxBytes)throw Error('Public source too large');parts.push(part);}
  return Buffer.concat(parts).toString('utf8');
}
export async function readPublicJson(url,{maxBytes=350000,headers={},timeoutMs=8000}={}){return JSON.parse(await readPublicText(url,maxBytes,headers,timeoutMs));}
