// 公開表示件数と収集件数は別設定。許容値は編集室APIでも共通利用する。
export const settingRules = {
  editor_page_size: { min: 1, max: 100, defaultValue: 20 },
  public_page_size: { min: 1, max: 100, defaultValue: 20 },
  nintendo_limit: { min: 0, max: 100, defaultValue: 20 },
  playstation_limit: { min: 0, max: 100, defaultValue: 20 }
};
export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const settings = {};
  for (const [key, rule] of Object.entries(settingRules)) {
    const value = input[key];
    if (!Number.isSafeInteger(value) || value < rule.min || value > rule.max) return null;
    settings[key] = value;
  }
  if (Object.keys(input).some(key => !Object.hasOwn(settingRules, key))) return null;
  return settings;
}

async function requestSettings(url, key, options = {}) {
  if (!url || !key) throw new Error('Settings database unavailable');
  const fields = [...Object.keys(settingRules), 'updated_at'].join(',');
  const response = await fetch(`${url}/rest/v1/site_settings?id=eq.1&select=${fields}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) throw new Error(`Settings request failed: ${response.status}`);
  const rows = await response.json();
  const row = rows[0];
  if (!row || !validateSettings(Object.fromEntries(Object.keys(settingRules).map(k => [k, row[k]])))) {
    throw new Error('Settings record missing or invalid');
  }
  return row;
}
export function getSiteSettings(url, key) { return requestSettings(url, key); }
export function saveSiteSettings(url, key, settings) {
  const validated = validateSettings(settings);
  if (!validated) throw new Error('Invalid settings');
  return requestSettings(url, key, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...validated, updated_at: new Date().toISOString() })
  });
}
