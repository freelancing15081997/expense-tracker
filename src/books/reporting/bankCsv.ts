import { parseMoney } from '../core/money';

function splitCsvLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delim && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsvDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const first = Number(m[1]);
  const second = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const day = second > 12 ? second : first;
  const month = second > 12 ? first : second;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCsvAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₹$\s]/g, '').replace(/,/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n === 0) return null;
  try {
    return parseMoney(n.toFixed(2));
  } catch {
    return null;
  }
}

export function parseBankCsv(text: string): { date: string; amountMinor: number; memo: string }[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one transaction');
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const header = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  const idx = (...names: string[]) => names.reduce((found, n) => (found >= 0 ? found : header.indexOf(n)), -1);
  const dateI = idx('date', 'valuedate', 'txndate', 'transactiondate', 'postingdate');
  const memoI = idx('memo', 'narration', 'description', 'particulars', 'remarks', 'details');
  const amountI = idx('amount', 'amt', 'value');
  const debitI = idx('debit', 'withdrawal', 'dr');
  const creditI = idx('credit', 'deposit', 'cr');
  if (dateI < 0) throw new Error('CSV needs a Date column');
  if (amountI < 0 && debitI < 0 && creditI < 0) throw new Error('CSV needs Amount or Debit/Credit columns');
  const rows: { date: string; amountMinor: number; memo: string }[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, delim);
    const date = parseCsvDate(cols[dateI] || '');
    let amount: number | null = amountI >= 0 ? parseCsvAmount(cols[amountI] || '') : null;
    if (amount == null && (debitI >= 0 || creditI >= 0)) {
      const credit = creditI >= 0 ? parseCsvAmount(cols[creditI] || '') : null;
      const debit = debitI >= 0 ? parseCsvAmount(cols[debitI] || '') : null;
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    const memo = ((memoI >= 0 ? cols[memoI] : '') || 'Bank CSV import').slice(0, 200);
    if (!date || amount == null) continue;
    rows.push({ date, amountMinor: amount, memo });
    if (rows.length >= 50) break;
  }
  if (!rows.length) throw new Error('No valid rows found. Need date plus amount (or debit/credit).');
  return rows;
}
