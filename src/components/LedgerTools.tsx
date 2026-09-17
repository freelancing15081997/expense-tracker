import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Zap } from 'lucide-react';
import { createExpense, softDeleteExpense } from '../lib/expenses';
import { CapacitorService } from '../lib/capacitor';
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
import { buildCapturePreview } from '../lib/money-capture';
import { newMoneyId, readUserRules } from '../lib/money-core';
import CapturePreviewSheet from './CapturePreviewSheet';
import type { CapturePreview } from '../lib/money-core';

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
  onNotifyTeam?: (action: string, detail: string) => void;
  onOpenFullForm?: () => void;
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
  onNotifyTeam,
  onOpenFullForm,
}: Props) {
  const rules = readRecurring(book);
  const lastQuick = readLastQuick(bookId);
  const [kind, setKind] = useState<'out' | 'in' | 'transfer'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(lastQuick.category || categories[0] || 'Uncategorized');
  const [merchant, setMerchant] = useState(lastQuick.merchant || '');
  useEffect(() => {
    if (!categories.length) return;
    if (!categories.includes(category)) setCategory(categories[0]);
  }, [categories, category]);
  const [method, setMethod] = useState(lastQuick.method || 'cash');
  const [when, setWhen] = useState(isoDay());
  const [line, setLine] = useState('');
  const [lastPosted, setLastPosted] = useState<string[]>([]);
  const [fieldError, setFieldError] = useState<'line' | 'amount' | null>(null);
  const lineRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptions = useMemo(
    () => Array.from(new Set(expenses.map((exp) => String(exp.description || '').trim()).filter(Boolean))).slice(0, 40),
    [expenses],
  );
  const [busy, setBusy] = useState('');
  const [capturePreview, setCapturePreview] = useState<CapturePreview | null>(null);
  const [open, setOpen] = useState(false);
  const dueCount = useMemo(() => dueRecurringPosts(rules, expenses).posts.length, [rules, expenses]);
  const userRules = readUserRules(book, enteredByUid);

  if (!canWrite) return null;

  const record = async (payload: Record<string, unknown>, label: string) => {
    const lockBefore = String(book.lockBefore || '');
    const day = String(payload.date || isoDay());
    if (lockBefore && day < lockBefore) {
      onToast(`This book is locked before ${lockBefore}.`, 'error');
      return false;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = String(payload.entryType || 'out') === 'out' ? Number(payload.amount || 0) : 0;
    if (wouldBreakDailyCap(expenses, cap, extra, day) && !window.confirm(`This would go past the daily limit of ${currencySymbol}${cap.toLocaleString()}. Add anyway?`)) {
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
        financialStatus: 'CONFIRMED',
        processingStatus: 'COMPLETED',
      }, expenses), {
        force: Boolean(payload.recurringRuleId),
        idempotencyKey: String(payload.idempotencyKey || newMoneyId('exp')),
      });
      if (created?.id) {
        setLastPosted((ids) => [String(created.id), ...ids].slice(0, 8));
        onAdded?.(created as Record<string, unknown>);
        if (created.flagReason) onToast(String(created.flagReason), 'success');
        onNotifyTeam?.('Added a new entry', `${label}: ${String(payload.description || payload.merchant || 'entry')} · ${currencySymbol}${Number(payload.amount || 0)}`);
        void CapacitorService.hapticImpact();
      } else {
        void onRefresh();
      }
      onToast(label, 'success');
      return true;
    } catch (err: any) {
      onToast(err?.message || 'Could not save that expense', 'error');
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
      setFieldError(null);
    } finally {
      setBusy('');
    }
  };

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    const pasted = parseCaptureLines(line);
    if (pasted.length > 1) {
      await postParsed(pasted.map((row) => ({ ...row, category: applyCategoryRules(row.description, row.merchant, readCategoryRules(book)) || category })), `${pasted.length} expenses added`);
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
      const missingLine = !line.trim() && !description.trim();
      const missingAmount = !Number(amount) && !(parsed && Number(parsed.amount));
      if (missingLine) {
        setFieldError('line');
        lineRef.current?.focus();
        onToast('Tell us what it was for. Example: Swiggy 349', 'error');
        return;
      }
      if (missingAmount) {
        setFieldError('amount');
        amountRef.current?.focus();
        onToast('Enter the amount.', 'error');
        return;
      }
      setFieldError('line');
      lineRef.current?.focus();
      onToast('Try Swiggy 349 or paste your UPI SMS.', 'error');
      return;
    }
    const preview = buildCapturePreview(line, 'sms', expenses, readCategoryRules(book), userRules);
    if (preview.processingStatus === 'REVIEW_REQUIRED' || preview.confidence !== 'high') {
      setCapturePreview(preview);
      return;
    }
    const prior = lastMatchFor(expenses, parsed.description);
    await postParsed([{
      ...parsed,
      category: preview.category || applyCategoryRules(parsed.description, parsed.merchant, readCategoryRules(book)) || prior?.category || category,
      merchant: parsed.merchant || prior?.merchant || merchant,
      paymentMethod: parsed.paymentMethod || method,
      date: parsed.date || when,
    }], 'Expense added');
  };

  const postDue = async () => {
    const { posts, nextRules } = dueRecurringPosts(rules, expenses);
    if (!posts.length) return;
    setBusy('due');
    try {
      for (const row of posts) await record(row, 'Recurring expense added');
      const next = await updateLedger(bookId, { recurringRules: nextRules });
      onBook(next as Record<string, unknown>);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
    <div className="tool-collapse" data-quick-add>
      <button
        type="button"
        className="tool-collapse-trigger"
        aria-expanded={open}
        onClick={() => {
          void CapacitorService.hapticTick();
          setOpen((v) => !v);
        }}
      >
        <Zap className="w-3.5 h-3.5" />
        Quick add
        {dueCount > 0 ? <span className="tool-collapse-badge">{dueCount}</span> : null}
        <ChevronDown className={`w-3.5 h-3.5 tool-collapse-chevron ${open ? 'is-open' : ''}`} />
      </button>
      {open ? (
        <form onSubmit={quickAdd} className="tool-collapse-panel quick-add-bar">
          <div className="quick-add-label">
            <span className="quick-add-kicker">Fast add</span>
            <span>One line or paste a UPI SMS. Bills & photos → Add expense.</span>
          </div>
          <div className="quick-add-row">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'out' | 'in' | 'transfer')} className="byjan-filter !w-auto !h-11" aria-label="Type">
            <option value="out">Spent</option>
            <option value="in">Received</option>
            <option value="transfer">Transfer</option>
          </select>
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setFieldError(null); }}
            placeholder={`${currencySymbol}0`}
            className={`byjan-input money-quick-amount ${fieldError === 'amount' ? 'byjan-input-error' : ''}`}
            aria-label="Amount"
            aria-invalid={fieldError === 'amount'}
          />
          <input
            ref={lineRef}
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              setFieldError(null);
              const parsed = parseBankSms(e.target.value);
              if (parsed) {
                setAmount(String(parsed.amount));
                setDescription(parsed.description);
                setKind((parsed.entryType as 'out' | 'in' | 'transfer') || 'out');
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
            placeholder="Swiggy 349 · or paste UPI SMS"
            className={`byjan-input flex-1 min-w-[140px] !h-11 ${fieldError === 'line' ? 'byjan-input-error' : ''}`}
            list="ledger-descriptions"
            aria-invalid={fieldError === 'line'}
          />
          <datalist id="ledger-descriptions">
            {descriptions.map((name) => <option key={name} value={name} />)}
          </datalist>
          {categories.length > 0 ? (
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="byjan-filter !w-auto !h-11" aria-label="Category">
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          ) : null}
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
            <button type="button" className="byjan-chip !h-9" data-on="true" onClick={() => void postDue()} disabled={busy === 'due'} title="Add rent, EMI, salary, or other due items.">
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
                  onToast('Last expense removed.', 'success');
                } catch (err: any) {
                  void onRefresh();
                  onToast(err?.message || 'Could not undo', 'error');
                }
              }}
            >
              Undo
            </button>
          )}
          <button type="submit" disabled={busy === 'quick'} className="btn-quick-add" data-quick-add-submit>
            {busy === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add quickly'}
          </button>
          {onOpenFullForm && (
            <button type="button" className="btn-quick-form hidden sm:inline-flex" onClick={onOpenFullForm}>
              <Plus className="w-4 h-4" />
              Full form
            </button>
          )}
          </div>
        </form>
      ) : null}
    </div>
    <CapturePreviewSheet
      open={Boolean(capturePreview)}
      preview={capturePreview}
      bookId={bookId}
      currency={String(book.currency || 'INR')}
      onClose={() => setCapturePreview(null)}
      onConfirmed={(expense) => {
        onAdded?.(expense);
        setLine('');
        setAmount('');
        setDescription('');
        setOpen(false);
        void onRefresh();
      }}
      onToast={onToast}
    />
    </>
  );
}
