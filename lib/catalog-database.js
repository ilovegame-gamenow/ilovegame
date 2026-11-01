export class CatalogError extends Error {
  constructor(status) { super('Catalog database request failed'); this.status = status; }
}
// All catalog persistence lives here; no collectors, AI calls or article-content writes.
export async function catalogRequest(url, key, path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...options.headers }
  });
  if (!response.ok) throw new CatalogError(response.status);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
