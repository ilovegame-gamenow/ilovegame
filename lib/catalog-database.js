export class CatalogError extends Error {
  constructor(status) { super('Catalog database request failed'); this.status = status; }
}
// All catalog persistence lives here; no collectors, AI calls or article-content writes.
export async function catalogRequest(url, key, path, options = {}) {
  const { countExact = false, ...fetchOptions } = options;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...fetchOptions,
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...(countExact?{Prefer:'count=exact'}:{}), ...fetchOptions.headers }
  });
  if (countExact && (response.ok || response.status===416)) {
    const total=Number(response.headers.get('content-range')?.split('/')[1]);
    if(!Number.isSafeInteger(total)||total<0)throw new CatalogError(response.status);
    return {rows:response.status===416?[]:await response.json(),total};
  }
  if (!response.ok) throw new CatalogError(response.status);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
