import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createExpense, softDeleteExpense } from '../lib/expenses';
import { updateLedger } from '../lib/ledgers';
import {
  dueRecurringPosts,
  isoDay,
  lastMatchFor,
  applyCategoryRules,
  readCategoryRules,
  readLastQuick,
  readRecurring,
  wouldBreakDailyCap,
  writeLastQuick,
} from '../lib/ledger-advanced';
import { enrichCapture, parseBankSms, parseCaptureLines } from '../lib/bridge-automations';

type Props = {
  bookId: string;
  book: Record<string, unknown>;
  canWrite: boolean;
  categories: string[];
  merchants: string[];
  currencySymbol: string;
  enteredBy: string;
  enteredByUid: string;
  enteredByEmail: string;
  expenses: Array<Record<string, unknown>>;
  onBook: (book: Record<string, unknown>) => void;
  onRefresh: () => Promise<void>;
  onAdded?: (row: Record<string, unknown>) => void;
  onRemoved?: (ids: string[]) => void;
  onToast: (message: string, kind?: 'success' | 'error') => void;
};

export default function LedgerTools({
  bookId,
  book,
  canWrite,
  categories,
  currencySymbol,
  enteredBy,
  enteredByUid,
  enteredByEmail,
  expenses,
  onBook,
  onRefresh,
  onAdded,
  onRemoved,
  onToast,
}: Props) {
  const rules = readRecurring(book);
  const lastQuick = readLastQuick(bookId);
  const [kind, setKind] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(lastQuick.category || categories[0] || 'Uncategorized');
  const [merchant, setMerchant] = useState(lastQuick.merchant || '');
  const [method, setMethod] = useState(lastQuick.method || 'cash');
  const [when, setWhen] = useState(isoDay());
  const [line, setLine] = useState('');
  const [lastPosted, setLastPosted] = useState<string[]>([]);
  const descriptions = useMemo(
    () => Array.from(new Set(expenses.map((exp) => String(exp.description || '').trim()).filter(Boolean))).slice(0, 40),
    [expenses],
  );
  const [busy, setBusy] = useState('');
  const dueCount = useMemo(() => dueRecurringPosts(rules, expenses).posts.length, [rules, expenses]);

  if (!canWrite) return null;

  const record = async (payload: Record<string, unknown>, label: string) => {
    const lockBefore = String(book.lockBefore || '');
    const day = String(payload.date || isoDay());
    if (lockBefore && day < lockBefore) {
      onToast(`This ledger is locked before ${lockBefore}.`, 'error');
      return false;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = String(payload.entryType || 'out') === 'out' ? Number(payload.amount || 0) : 0;
    if (wouldBreakDailyCap(expenses, cap, extra, day) && !window.confirm(`This would go past the daily cap of ${currencySymbol}${cap.toLocaleString()}. Record anyway?`)) {
      return false;
    }
    try {
      const auto = applyCategoryRules(String(payload.description || ''), String(payload.merchant || ''), readCategoryRules(book));
      const created = await createExpense(bookId, enrichCapture({
        ...payload,
        category: payload.category || auto || 'Uncategorized',
        paidByName: enteredBy,
        enteredBy,
        enteredByUid,
        enteredByEmail,
        status: Number(payload.amount || 0) > 0 ? 'recorded' : 'draft',
      }, expenses), { force: Boolean(payload.recurringRuleId) });
      if (created?.id) {
        setLastPosted((ids) => [String(created.id), ...ids].slice(0, 8));
        onAdded?.(created as Record<string, unknown>);
        if (created.flagReason) onToast(String(created.flagReason), 'success');
      } else {
        void onRefresh();
      }
      onToast(label, 'success');
      return true;
    } catch (err: any) {
      onToast(err?.message || 'Could not save that entry', 'error');
      return false;
    }
  };

  const postParsed = async (rows: Array<Record<string, unknown>>, label: string) => {
    setBusy('quick');
    try {
      for (const row of rows) {
        const ok = await record(row, label);
        if (ok === false) return;
      }
      writeLastQuick(bookId, { category, merchant, method });
      setAmount('');
      setDescription('');
      setLine('');
    } finally {
      setBusy('');
    }
  };

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const pasted = parseCaptureLines(line);
    if (pasted.length > 1) {
      await postParsed(pasted.map((row) => ({ ...row, category: applyCategoryRules(row.description, row.merchant, readCategoryRules(book)) || category })), `${pasted.length} entries recorded`);
      return;
    }
    const parsed = parseBankSms(line) || (amount && (description.trim() || line.trim()) ? {
      amount: Number(amount),
      description: description.trim() || line.trim(),
      merchant,
      entryType: kind,
      date: when,
      paymentMethod: method,
    } : null);
    if (!parsed || !Number(parsed.amount)) {
      onToast('Type like “swiggy 349 yesterday” or paste a UPI SMS.', 'error');
      return;
    }
    const prior = lastMatchFor(expenses, parsed.description);
    await postParsed([{
      ...parsed,
      category: applyCategoryRules(parsed.description, parsed.merchant, readCategoryRules(book)) || prior?.category || category,
      merchant: parsed.merchant || prior?.merchant || merchant,
      paymentMethod: parsed.paymentMethod || method,
      date: parsed.date || when,
    }], 'Entry recorded');
  };

  const postDue = async () => {
    const { posts, nextRules } = dueRecurringPosts(rules, expenses);
    if (!posts.length) return;
    setBusy('due');
    try {
      for (const row of posts) await record(row, 'Recurring entry posted');
      const next = await updateLedger(bookId, { recurringRules: nextRules });
      onBook(next as Record<string, unknown>);
    } finally {
      setBusy('');
    }
  };

  return (
    <form onSubmit={quickAdd} className="byjan-card byjan-capture mb-2">
      <select value={kind} onChange={(e) => setKind(e.target.value as 'out' | 'in')} className="byjan-filter !w-auto !h-9" aria-label="Type">
        <option value="out">Out</option>
        <option value="in">In</option>
      </select>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`${currencySymbol}0`}
        className="byjan-input !w-[76px] !h-9"
        aria-label="Amount"
      />
      <input
        value={line}
        onChange={(e) => {
          setLine(e.target.value);
          const parsed = parseBankSms(e.target.value);
          if (parsed) {
            setAmount(String(parsed.amount));
            setDescription(parsed.description);
            setKind(parsed.entryType);
            setWhen(parsed.date);
            if (parsed.merchant) setMerchant(parsed.merchant);
            if (parsed.paymentMethod) setMethod(parsed.paymentMethod);
          } else {
            setDescription(e.target.value);
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text.includes('\n') && parseCaptureLines(text).length > 1) {
            e.preventDefault();
            setLine(text);
          }
        }}
        placeholder="swiggy 349 yesterday · or paste UPI SMS"
        className="byjan-input flex-1 min-w-[140px] !h-9"
        list="ledger-descriptions"
      />
      <datalist id="ledger-descriptions">
        {descriptions.map((name) => <option key={name} value={name} />)}
      </datalist>
      <select value={when === isoDay() ? 'today' : 'yesterday'} onChange={(e) => setWhen(e.target.value === 'today' ? isoDay() : isoDay(new Date(Date.now() - 86400000)))} className="byjan-filter !w-auto !h-9 hidden sm:block" aria-label="When">
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
      </select>
      <select value={method} onChange={(e) => setMethod(e.target.value)} className="byjan-filter !w-auto !h-9 hidden md:block" aria-label="Method">
        <option value="upi">UPI</option>
        <option value="card">Card</option>
        <option value="cash">Cash</option>
        <option value="bank">Bank</option>
      </select>
      {dueCount > 0 && (
        <button type="button" className="byjan-chip !h-9" data-on="true" onClick={() => void postDue()} disabled={busy === 'due'} title="Post recurring rent, EMI, maid, or salary that is due.">
          {dueCount} due
        </button>
      )}
      {lastPosted[0] && (
        <button
          type="button"
          className="byjan-chip !h-9"
          onClick={async () => {
            const id = lastPosted[0];
            onRemoved?.([id]);
            setLastPosted((ids) => ids.slice(1));
            try {
              await softDeleteExpense(bookId, id);
              onToast('Last entry undone.', 'success');
            } catch (err: any) {
              void onRefresh();
              onToast(err?.message || 'Could not undo', 'error');
            }
          }}
        >
          Undo
        </button>
      )}
      <button type="submit" disabled={busy === 'quick'} className="byjan-btn !h-9">
        {busy === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
      </button>
    </form>
  );
}
