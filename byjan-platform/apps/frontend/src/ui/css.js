const cache = new Map();
const camel = p => p.trim().replace(/^-webkit-/, 'Webkit-').replace(/^-moz-/, 'Moz-').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
// Inline CSS string → React style object (cached). Keeps components identical to the design.
export function css(s) {
  if (!s) return undefined;
  if (typeof s === 'object') return s;
  let o = cache.get(s);
  if (o) return o;
  o = {};
  let depth = 0, quote = null, cur = '';
  const parts = [];
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  for (const d of parts) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const k = d.slice(0, i).trim();
    if (!k) continue;
    o[k.startsWith('--') ? k : camel(k)] = d.slice(i + 1).replace(/!important/g, '').trim();
  }
  if (cache.size > 5000) cache.clear();
  cache.set(s, o);
  return o;
}
