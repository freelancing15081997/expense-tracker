/**
 * Parse shared Excel / CSV into ledger-ready rows (in / out / transfer).
 */

export type ExcelLedgerRow = {
  amount: number;
  date: string;
  merchant: string;
  description: string;
  category: string;
  entryType: 'in' | 'out' | 'transfer';
  paymentMethod: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toAmount(raw: unknown) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.abs(raw);
  const cleaned = String(raw ?? '')
    .replace(/[₹$€£]/g, '')
    .replace(/\b(rs\.?|inr|usd)\b/gi, '')
    .replace(/,/g, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n !== 0 && Math.abs(n) < 100_000_000 ? Math.abs(n) : 0;
}

function excelSerialToIso(n: number) {
  // Excel serial date (days since 1899-12-30)
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return '';
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function toDate(raw: unknown) {
  if (typeof raw === 'number') {
    const iso = excelSerialToIso(raw);
    if (iso) return iso;
  }
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    let yy = dmy[3];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return todayIso();
}

function normHeader(h: unknown) {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickCol(headers: string[], aliases: string[]) {
  for (const a of aliases) {
    const i = headers.findIndex((h) => h === a || h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

function entryFromCell(raw: unknown, amountSigned: number): 'in' | 'out' | 'transfer' {
  const s = String(raw || '').toLowerCase();
  if (/transfer|xfer|neft|imps/.test(s)) return 'transfer';
  if (/^(in|income|credit|cr|refund|received|money in)$/.test(s) || /income|credit|refund|received/.test(s)) return 'in';
  if (/^(out|expense|debit|dr|paid|money out)$/.test(s) || /expense|debit|paid/.test(s)) return 'out';
  if (amountSigned < 0) return 'out';
  return 'out';
}

function rowsFromMatrix(matrix: unknown[][]): ExcelLedgerRow[] {
  if (!matrix?.length) return [];
  const headerIdx = matrix.findIndex((row) =>
    (row || []).some((cell) => /amount|debit|credit|type|date|merchant|description|category/i.test(String(cell || ''))),
  );
  const start = headerIdx >= 0 ? headerIdx : 0;
  const headers = (matrix[start] || []).map(normHeader);
  const amountIdx = pickCol(headers, ['amount', 'amt', 'total', 'value', 'rupees']);
  const debitIdx = pickCol(headers, ['debit', 'dr', 'money out', 'out', 'expense']);
  const creditIdx = pickCol(headers, ['credit', 'cr', 'money in', 'in', 'income']);
  const typeIdx = pickCol(headers, ['type', 'entry type', 'txn type', 'transaction type', 'direction', 'mode']);
  const dateIdx = pickCol(headers, ['date', 'txn date', 'transaction date', 'entry date']);
  const merchantIdx = pickCol(headers, ['merchant', 'payee', 'party', 'vendor', 'name', 'to', 'from']);
  const descIdx = pickCol(headers, ['description', 'particulars', 'narration', 'details', 'note', 'notes', 'memo']);
  const catIdx = pickCol(headers, ['category', 'cat', 'head', 'account']);
  const payIdx = pickCol(headers, ['payment', 'payment method', 'paid via', 'mode of payment', 'upi']);

  const out: ExcelLedgerRow[] = [];
  for (let r = start + 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    if (!row.some((c) => String(c ?? '').trim())) continue;

    let amount = 0;
    let signed = 0;
    let entryType: 'in' | 'out' | 'transfer' = 'out';

    if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = toAmount(row[debitIdx]);
      const credit = toAmount(row[creditIdx]);
      if (credit > 0 && debit <= 0) {
        amount = credit;
        entryType = 'in';
        signed = credit;
      } else if (debit > 0) {
        amount = debit;
        entryType = 'out';
        signed = -debit;
      }
    } else if (amountIdx >= 0) {
      const rawAmt = row[amountIdx];
      const n = typeof rawAmt === 'number' ? rawAmt : Number(String(rawAmt ?? '').replace(/,/g, ''));
      signed = Number.isFinite(n) ? n : 0;
      amount = toAmount(rawAmt);
      entryType = entryFromCell(typeIdx >= 0 ? row[typeIdx] : '', signed);
      if (signed < 0) entryType = 'out';
    } else {
      continue;
    }

    if (!(amount > 0)) continue;
    if (typeIdx >= 0) entryType = entryFromCell(row[typeIdx], signed);

    const merchant = String(merchantIdx >= 0 ? row[merchantIdx] : '').trim().slice(0, 120);
    const description = String(descIdx >= 0 ? row[descIdx] : merchant || 'Excel entry').trim().slice(0, 200) || merchant || 'Excel entry';
    const category = String(catIdx >= 0 ? row[catIdx] : 'Uncategorized').trim().slice(0, 80) || 'Uncategorized';
    const paymentMethod = String(payIdx >= 0 ? row[payIdx] : 'cash').toLowerCase().slice(0, 32) || 'cash';
    const date = dateIdx >= 0 ? toDate(row[dateIdx]) : todayIso();

    out.push({
      amount,
      date,
      merchant: merchant || description.slice(0, 80),
      description,
      category,
      entryType,
      paymentMethod: /^(cash|card|upi|bank|wallet)$/i.test(paymentMethod) ? paymentMethod : 'cash',
    });
  }
  return out.slice(0, 200);
}

export async function parseSpreadsheetBuffer(input: {
  base64: string;
  mimeType?: string;
  fileName?: string;
}): Promise<{ rows: ExcelLedgerRow[]; engine: string; error?: string }> {
  const rawB64 = String(input.base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!rawB64) return { rows: [], engine: 'empty', error: 'Empty spreadsheet' };
  const buf = Buffer.from(rawB64, 'base64');
  const mime = String(input.mimeType || '').toLowerCase();
  const name = String(input.fileName || '').toLowerCase();

  if (mime.includes('csv') || name.endsWith('.csv') || mime === 'text/plain') {
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const matrix = lines.map((line) => {
      // simple CSV split (handles quoted commas lightly)
      const cells: string[] = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') { q = !q; continue; }
        if (ch === ',' && !q) { cells.push(cur); cur = ''; continue; }
        cur += ch;
      }
      cells.push(cur);
      return cells;
    });
    return { rows: rowsFromMatrix(matrix), engine: 'csv' };
  }

  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { rows: [], engine: 'xlsx', error: 'No sheet found' };
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
    return { rows: rowsFromMatrix(matrix), engine: 'xlsx' };
  } catch (err: any) {
    return { rows: [], engine: 'xlsx_failed', error: String(err?.message || 'Could not read spreadsheet') };
  }
}

export function isSpreadsheetMime(mimeType?: string, fileName?: string) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  return (
    mime.includes('spreadsheet')
    || mime.includes('excel')
    || mime.includes('csv')
    || name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || name.endsWith('.csv')
  );
}
