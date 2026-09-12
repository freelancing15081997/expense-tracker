import React, { useMemo, useState } from 'react';
import { Loader2, Repeat, Zap } from 'lucide-react';
import { createExpense } from '../lib/expenses';
import { updateLedger } from '../lib/ledgers';
import {
  advanceIso,
  dueRecurringPosts,
  isoDay,
  newId,
  applyCategoryRules,
  readCategoryRules,
  readLastQuick,
  readRecurring,
  readTemplates,
  wouldBreakDailyCap,
  writeLastQuick,
  type EntryTemplate,
  type RecurringRule,
} from '../lib/ledger-advanced';

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
  onToast: (message: string, kind?: 'success' | 'error') => void;
};

export default function LedgerTools({
  bookId,
  book,
  canWrite,
  categories,
  merchants,
  currencySymbol,
  enteredBy,
  enteredByUid,
  enteredByEmail,
  expenses,
  onBook,
  onRefresh,
  onToast,
}: Props) {
  const templates = readTemplates(book);
  const rules = readRecurring(book);
  const lastQuick = readLastQuick(bookId);
  const [kind, setKind] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(lastQuick.category || categories[0] || 'Uncategorized');
  const [merchant, setMerchant] = useState(lastQuick.merchant || '');
  const descriptions = useMemo(
    () => Array.from(new Set(expenses.map((exp) => String(exp.description || '').trim()).filter(Boolean))).slice(0, 40),
    [expenses],
  );
  const [busy, setBusy] = useState('');
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rule, setRule] = useState({
    description: '',
    amount: '',
    category: categories[0] || 'Uncategorized',
    entryType: 'out' as 'in' | 'out',
    cadence: 'monthly' as 'weekly' | 'monthly',
    nextDate: isoDay(),
  });

  const dueCount = useMemo(() => dueRecurringPosts(rules, expenses).posts.length, [rules, expenses]);

  if (!canWrite) return null;

  const persistBook = async (patch: Record<string, unknown>) => {
    const next = await updateLedger(bookId, patch);
    onBook(next as Record<string, unknown>);
    return next;
  };

  const record = async (payload: Record<string, unknown>, label: string) => {
    const lockBefore = String(book.lockBefore || '');
    const day = String(payload.date || isoDay());
    if (lockBefore && day < lockBefore) {
      onToast(`This ledger is locked before ${lockBefore}.`, 'error');
      return;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = String(payload.entryType || 'out') === 'out' ? Number(payload.amount || 0) : 0;
    if (wouldBreakDailyCap(expenses, cap, extra, day) && !window.confirm(`This would go past the daily cap of ${currencySymbol}${cap.toLocaleString()}. Record anyway?`)) {
      return;
    }
    try {
      const auto = applyCategoryRules(String(payload.description || ''), String(payload.merchant || ''), readCategoryRules(book));
      await createExpense(bookId, {
        ...payload,
        category: payload.category || auto || 'Uncategorized',
        paidByName: enteredBy,
        enteredBy,
        enteredByUid,
        enteredByEmail,
        status: Number(payload.amount || 0) > 0 ? 'recorded' : 'draft',
      }, { force: Boolean(payload.recurringRuleId) });
      await onRefresh();
      onToast(label, 'success');
    } catch (err: any) {
      onToast(err?.message || 'Could not save that entry', 'error');
      throw err;
    }
  };

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      onToast('Add an amount and a short description.', 'error');
      return;
    }
    setBusy('quick');
    try {
      await record({
        amount: value,
        description: description.trim(),
        category,
        entryType: kind,
        date: isoDay(),
        merchant,
        paymentMethod: 'cash',
      }, 'Entry recorded');
      writeLastQuick(bookId, { category, merchant });
      setAmount('');
      setDescription('');
    } finally {
      setBusy('');
    }
  };

  const applyTemplate = async (tpl: EntryTemplate) => {
    setBusy(tpl.id);
    try {
      await record({
        amount: Number(tpl.amount || 0),
        description: tpl.description,
        category: tpl.category,
        entryType: tpl.entryType,
        date: isoDay(),
        merchant: tpl.merchant || '',
        paymentMethod: tpl.paymentMethod || 'cash',
        templateId: tpl.id,
      }, `${tpl.name} recorded`);
    } finally {
      setBusy('');
    }
  };

  const saveCurrentAsTemplate = async () => {
    if (!description.trim() || !Number(amount)) {
      onToast('Fill the quick bar first, then save it as a template.', 'error');
      return;
    }
    const next: EntryTemplate = {
      id: newId('tpl'),
      name: description.trim().slice(0, 32),
      description: description.trim(),
      amount: Number(amount),
      category,
      entryType: kind,
      merchant,
      paymentMethod: 'cash',
    };
    setBusy('tpl');
    try {
      await persistBook({ entryTemplates: [...templates, next] });
      onToast('Template saved on this ledger.', 'success');
    } catch (err: any) {
      onToast(err?.message || 'Could not save template', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeTemplate = async (id: string) => {
    setBusy(id);
    try {
      await persistBook({ entryTemplates: templates.filter((row) => row.id !== id) });
    } finally {
      setBusy('');
    }
  };

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(rule.amount);
    if (!rule.description.trim() || !Number.isFinite(value) || value <= 0) {
      onToast('Recurring needs a description and amount.', 'error');
      return;
    }
    setBusy('rule');
    try {
      const next: RecurringRule = {
        id: newId('rec'),
        description: rule.description.trim(),
        amount: value,
        category: rule.category,
        entryType: rule.entryType,
        cadence: rule.cadence,
        nextDate: rule.nextDate || isoDay(),
        active: true,
      };
      await persistBook({ recurringRules: [...rules, next] });
      setRuleOpen(false);
      setRule({ ...rule, description: '', amount: '' });
      onToast('Recurring rule saved. Due entries post when you open this ledger.', 'success');
    } catch (err: any) {
      onToast(err?.message || 'Could not save recurring rule', 'error');
    } finally {
      setBusy('');
    }
  };

  const postDue = async () => {
    const { posts, nextRules } = dueRecurringPosts(rules, expenses);
    if (!posts.length) {
      onToast('Nothing is due yet.', 'success');
      return;
    }
    setBusy('due');
    try {
      for (const row of posts) {
        await record(row, 'Recurring entry posted');
      }
      await persistBook({ recurringRules: nextRules });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mb-2">
      <form onSubmit={quickAdd} className="byjan-card byjan-capture">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'out' | 'in')} className="byjan-filter !w-auto" aria-label="Type">
          <option value="out">Out</option>
          <option value="in">In</option>
        </select>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`${currencySymbol}0.00`}
          className="byjan-input !w-24 sm:!w-28"
          aria-label="Amount"
        />
        <input
          list="ledger-descriptions"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Quick add — rent, milk, salary"
          className="byjan-input flex-1 min-w-[140px]"
        />
        <datalist id="ledger-descriptions">
          {descriptions.map((name) => <option key={name} value={name} />)}
        </datalist>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="byjan-filter !w-[140px] hidden sm:block">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input
          list="ledger-merchants"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Merchant"
          className="byjan-input !w-[140px] hidden md:block"
        />
        <datalist id="ledger-merchants">
          {merchants.map((name) => <option key={name} value={name} />)}
        </datalist>
        <button type="button" className="byjan-btn-ghost !h-9 !px-2 hidden sm:inline-flex" onClick={() => void saveCurrentAsTemplate()} disabled={busy === 'tpl'} title="Save as template">
          Save
        </button>
        <button type="submit" disabled={busy === 'quick'} className="byjan-btn !h-9">
          {busy === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Add
        </button>
      </form>

      {(templates.length > 0 || dueCount > 0 || ruleOpen) && (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void applyTemplate(tpl)}
            onContextMenu={(e) => {
              e.preventDefault();
              void removeTemplate(tpl.id);
            }}
            className="byjan-chip"
            title="Click to post. Right-click to remove."
          >
            {busy === tpl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {tpl.name} · {currencySymbol}{Number(tpl.amount || 0).toLocaleString()}
          </button>
        ))}
        <button type="button" className="byjan-chip" onClick={() => setRuleOpen((v) => !v)}>
          <Repeat className="w-3 h-3" /> Recurring{dueCount ? ` · ${dueCount}` : ''}
        </button>
        {dueCount > 0 && (
          <button type="button" className="byjan-chip" data-on="true" onClick={() => void postDue()} disabled={busy === 'due'}>
            {busy === 'due' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Post due
          </button>
        )}
      </div>
      )}

      {ruleOpen && (
        <form onSubmit={addRule} className="byjan-card p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input className="byjan-input col-span-2 sm:col-span-1" placeholder="Rent, salary…" value={rule.description} onChange={(e) => setRule((r) => ({ ...r, description: e.target.value }))} />
          <input className="byjan-input" placeholder="Amount" inputMode="decimal" value={rule.amount} onChange={(e) => setRule((r) => ({ ...r, amount: e.target.value }))} />
          <select className="byjan-filter" value={rule.category} onChange={(e) => setRule((r) => ({ ...r, category: e.target.value }))}>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="byjan-filter" value={rule.entryType} onChange={(e) => setRule((r) => ({ ...r, entryType: e.target.value as 'in' | 'out' }))}>
            <option value="out">Money out</option>
            <option value="in">Money in</option>
          </select>
          <select className="byjan-filter" value={rule.cadence} onChange={(e) => setRule((r) => ({ ...r, cadence: e.target.value as 'weekly' | 'monthly' }))}>
            <option value="monthly">Every month</option>
            <option value="weekly">Every week</option>
          </select>
          <input type="date" className="byjan-filter" value={rule.nextDate} onChange={(e) => setRule((r) => ({ ...r, nextDate: e.target.value }))} />
          <button type="submit" disabled={busy === 'rule'} className="byjan-btn col-span-2 sm:col-span-1">
            {busy === 'rule' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save rule · next {advanceIso(rule.nextDate || isoDay(), rule.cadence) && rule.nextDate}
          </button>
        </form>
      )}
    </div>
  );
}
