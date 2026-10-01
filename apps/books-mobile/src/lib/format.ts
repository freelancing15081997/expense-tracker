export const inr = (n: number, opts: { decimals?: boolean } = {}) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: opts.decimals ? 2 : 0, maximumFractionDigits: 2 });

export const paise = (rupees: unknown) => {
  const n = Number(String(rupees ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const rupees = (p: number) => Math.round(Number(p || 0)) / 100;
export const inrPaise = (p: number) => inr(rupees(p));

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function niceDate(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y) return iso;
  const t = todayIso();
  if (iso.slice(0, 10) === t) return 'Today';
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  if (iso.slice(0, 10) === `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`) return 'Yesterday';
  return `${d} ${MON[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
export function relTime(ts?: string | number) {
  if (!ts) return '';
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return niceDate(new Date(ms).toISOString());
}
export const initials = (s = '') => s.split(/[\s@._]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'B';
export const monthKey = (iso: string) => iso.slice(0, 7);
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const fmtBytes = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(0) + ' MB' : Math.round(b / 1e3) + ' KB');
