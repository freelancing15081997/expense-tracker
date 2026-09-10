import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnGhost, Card, Field, FileField, IconBtn, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { BankTxn } from '../../core/types';

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

export default function Banking() {
  const books = useBooks();
  const { postingAccounts, bankTxns, currency, can, transfer, createBankTxn, reconcileTxn } = books;
  const banks = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank' || a.type === 'asset');
  const [fromAccountId, setFrom] = useState(banks.find((a) => a.systemKey === 'bank')?.id || banks[0]?.id || '');
  const [toAccountId, setTo] = useState(banks.find((a) => a.systemKey === 'cash')?.id || banks[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('Bank transfer');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnMemo, setTxnMemo] = useState('');
  const [txnAccountId, setTxnAccount] = useState(banks.find((a) => a.systemKey === 'bank')?.id || banks[0]?.id || '');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  return (
    <PageShell title="Banking" subtitle="Transfers, bank journals, and CSV statement import post to the ledger. Live bank feeds are not connected.">
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Transfer</h2>
        <form
          className="grid md:grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              setError('');
              setOk('');
              await transfer({ fromAccountId, toAccountId, amountMinor: parseMoney(amount), date, memo });
              setOk('Transfer posted to the ledger.');
              setAmount('');
            } catch (err: any) {
              setError(err.message || 'Transfer failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="From">
            <select className={inputClass} value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className={inputClass} value={toAccountId} onChange={(e) => setTo(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label={`Amount (${currency})`}><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
          <div className="flex items-end gap-2">
            <IconBtn action="post" disabled={busy || !can('post')}>{busy ? 'Posting…' : 'Post transfer'}</IconBtn>
            {ok && <p className="text-sm text-emerald-700">{ok}</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Bank journal</h2>
        <p className="text-sm text-slate-500 mb-3">Positive amount = deposit. Negative amount = withdrawal. Clearing uses the operating expense / sales account until you recode via reversal.</p>
        <form
          className="grid md:grid-cols-3 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setError('');
              await createBankTxn({ accountId: txnAccountId, date, amountMinor: parseMoney(txnAmount), memo: txnMemo });
              setTxnAmount('');
              setTxnMemo('');
            } catch (err: any) {
              setError(err.message || 'Bank journal failed');
            }
          }}
        >
          <Field label="Account">
            <select className={inputClass} value={txnAccountId} onChange={(e) => setTxnAccount(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label="Signed amount"><input className={inputClass} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} required /></Field>
          <Field label="Memo"><input className={inputClass} value={txnMemo} onChange={(e) => setTxnMemo(e.target.value)} required /></Field>
          <IconBtn action="post" disabled={!can('post')}>Post bank journal</IconBtn>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">CSV statement import</h2>
        <p className="text-sm text-slate-500 mb-3">Header must include Date plus Amount, or Debit and Credit. First 50 valid rows post as bank journals. This is not a live bank feed.</p>
        <FileField
          label="Statement CSV"
          hint="CSV · Date, Amount or Debit/Credit, Memo · 50 rows max"
          accept=".csv,text/csv"
          onFiles={async (picked) => {
            const file = picked[0];
            if (!file) return;
            try {
              setCsvBusy(true);
              setError('');
              setOk('');
              if (!can('post')) throw new Error('You cannot post bank journals');
              const rows = parseBankCsv(await file.text());
              let posted = 0;
              const failures: string[] = [];
              for (const row of rows) {
                try {
                  await createBankTxn({ accountId: txnAccountId, date: row.date, amountMinor: row.amountMinor, memo: row.memo });
                  posted += 1;
                } catch (err: any) {
                  failures.push(`${row.date} ${row.memo}: ${err.message || 'failed'}`);
                }
              }
              setOk(`Posted ${posted} of ${rows.length} row${rows.length === 1 ? '' : 's'}.`);
              if (failures.length) setError(failures.slice(0, 3).join(' · '));
            } catch (err: any) {
              setError(err.message || 'CSV import failed');
            } finally {
              setCsvBusy(false);
            }
          }}
        />
        {csvBusy && <p className="text-sm text-slate-500 mt-2">Posting CSV rows…</p>}
      </Card>
      <PagedTable<BankTxn> rows={bankTxns} empty="No bank journals yet.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Memo</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Reconciled</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">{row.date}</td>
                  <td className="px-4 py-2.5">{row.memo}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.amountMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.reconciled ? 'reconciled' : 'open'} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {can('post') && (
                      <button className={btnGhost} onClick={() => reconcileTxn(row)}>{row.reconciled ? 'Unreconcile' : 'Reconcile'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}
