/** Integer minor units (paise/cents). Never use floats for money. */

export function parseMoney(input: string): number {
  const raw = input.trim().replace(/,/g, '');
  if (!raw || raw === '-' || raw === '.') throw new Error('Enter a valid amount');
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Amount may have at most 2 decimals');
  const negative = raw.startsWith('-');
  const [whole, frac = ''] = (negative ? raw.slice(1) : raw).split('.');
  const minor = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(minor)) throw new Error('Amount is too large');
  return negative ? -minor : minor;
}

export function parseQty(input: string): number {
  const raw = input.trim();
  if (!raw) throw new Error('Enter a quantity');
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) throw new Error('Quantity may have at most 3 decimals');
  const [whole, frac = ''] = raw.split('.');
  const milli = Number(whole) * 1000 + Number((frac + '000').slice(0, 3));
  if (!Number.isSafeInteger(milli) || milli <= 0) throw new Error('Quantity must be greater than zero');
  return milli;
}

export function mulDiv(a: number, b: number, divisor: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(divisor) || divisor <= 0) {
    throw new Error('Invalid integer math');
  }
  const prod = a * b;
  if (!Number.isSafeInteger(prod)) throw new Error('Amount overflow');
  return Math.floor((prod + Math.floor(divisor / 2)) / divisor);
}

export function percentOf(minor: number, rateBps: number): number {
  if (minor < 0 || rateBps < 0) throw new Error('Tax inputs must be non-negative');
  return mulDiv(minor, rateBps, 10_000);
}

export function lineAmount(qtyMilli: number, unitPriceMinor: number): number {
  return mulDiv(qtyMilli, unitPriceMinor, 1000);
}

export function formatMoney(minor: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${currency} ${formatMinorPlain(minor)}`;
  }
}

export function formatMinorPlain(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodIdFromDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD');
  return date.slice(0, 7);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}
