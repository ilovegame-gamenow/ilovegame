// Bounded reads for fixed public source URLs; never follows redirects.
export async function readPublicText(url,maxBytes=500000) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json,text/html'}});
  if(!response.ok)throw Error('Public source unavailable');
  let bytes=0;const parts=[];
  for await(const part of response.body){bytes+=part.length;if(bytes>maxBytes)throw Error('Public source too large');parts.push(part);}
  return Buffer.concat(parts).toString('utf8');
}
export async function readPublicJson(url){return JSON.parse(await readPublicText(url,350000));}
