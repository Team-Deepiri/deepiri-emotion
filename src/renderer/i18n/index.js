import en from './en';

const locale = 'en';
const messages = { en };

/**
 * Look up a locale string by dot path.
 * @param {string} key - e.g. 'common.save', 'about.version'
 * @param {Record<string, string | number>} [vars] - Optional: { version: '1.0' } → replaces {version} in the string
 * @returns {string}
 */
export function t(key, vars = null) {
  const parts = key.split('.');
  let obj = messages[locale] || messages.en;
  for (const p of parts) {
    obj = obj?.[p];
  }
  let s = typeof obj === 'string' ? obj : (obj ?? key);
  if (vars && typeof s === 'string') {
    s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
  }
  return s;
}

export { en };
export default messages;
