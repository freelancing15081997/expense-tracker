import React, { useMemo, useState } from 'react';
import { Loader2, Repeat, Zap } from 'lucide-react';
import { createExpense, softDeleteExpense } from '../lib/expenses';
import { updateLedger } from '../lib/ledgers';
import {
  advanceIso,
  dueRecurringPosts,
  isoDay,
  lastMatchFor,
  newId,
  applyCategoryRules,
  parseManyLines,
  parseQuickLine,
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
  const [method, setMethod] = useState(lastQuick.method || 'cash');
  const [when, setWhen] = useState(isoDay());
  const [line, setLine] = useState('');
  const [lastPosted, setLastPosted] = useState<string[]>([]);
  const recent = expenses.slice(0, 4);
  const topMerchants = merchants.slice(0, 4);
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
      return false;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = String(payload.entryType || 'out') === 'out' ? Number(payload.amount || 0) : 0;
    if (wouldBreakDailyCap(expenses, cap, extra, day) && !window.confirm(`This would go past the daily cap of ${currencySymbol}${cap.toLocaleString()}. Record anyway?`)) {
      return false;
    }
    try {
      const auto = applyCategoryRules(String(payload.description || ''), String(payload.merchant || ''), readCategoryRules(book));
      const created = await createExpense(bookId, {
        ...payload,
        category: payload.category || auto || 'Uncategorized',
        paidByName: enteredBy,
        enteredBy,
        enteredByUid,
        enteredByEmail,
        status: Number(payload.amount || 0) > 0 ? 'recorded' : 'draft',
      }, { force: Boolean(payload.recurringRuleId) });
      if (created?.id) setLastPosted((ids) => [String(created.id), ...ids].slice(0, 8));
      await onRefresh();
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
    const pasted = parseManyLines(line);
    if (pasted.length > 1) {
      await postParsed(pasted.map((row) => ({ ...row, category: applyCategoryRules(row.description, row.merchant, readCategoryRules(book)) || category })), `${pasted.length} entries recorded`);
      return;
    }
    const parsed = parseQuickLine(line) || (amount && description.trim() ? {
      amount: Number(amount),
      description: description.trim(),
      merchant,
      entryType: kind,
      date: when,
      paymentMethod: method,
    } : null);
    if (!parsed || !Number(parsed.amount)) {
      onToast('Type like “swiggy 349 yesterday” or fill amount and description.', 'error');
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
          placeholder={`${currencySymbol}0`}
          className="byjan-input !w-20 sm:!w-24"
          aria-label="Amount"
        />
        <input
          value={line}
          onChange={(e) => {
            setLine(e.target.value);
            const parsed = parseQuickLine(e.target.value);
            if (parsed) {
              setAmount(String(parsed.amount));
              setDescription(parsed.description);
              setKind(parsed.entryType);
              setWhen(parsed.date);
              if (parsed.merchant) setMerchant(parsed.merchant);
              if (parsed.paymentMethod) setMethod(parsed.paymentMethod);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (text.includes('\n') && parseManyLines(text).length > 1) {
              e.preventDefault();
              setLine(text);
            }
          }}
          placeholder="swiggy 349 yesterday · or paste a UPI SMS"
          className="byjan-input flex-1 min-w-[160px]"
          list="ledger-descriptions"
        />
        <datalist id="ledger-descriptions">
          {descriptions.map((name) => <option key={name} value={name} />)}
        </datalist>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="byjan-filter !w-[120px] hidden md:block">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button type="submit" disabled={busy === 'quick'} className="byjan-btn !h-9">
          {busy === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Add
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <button type="button" className="byjan-chip" data-on={when === isoDay()} onClick={() => setWhen(isoDay())}>Today</button>
        <button type="button" className="byjan-chip" data-on={when !== isoDay()} onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setWhen(isoDay(d)); }}>Yesterday</button>
        {(['upi', 'card', 'cash'] as const).map((row) => (
          <button key={row} type="button" className="byjan-chip" data-on={method === row} onClick={() => setMethod(row)}>{row.toUpperCase()}</button>
        ))}
        <button type="button" className="byjan-chip hidden sm:inline-flex" onClick={() => void saveCurrentAsTemplate()} disabled={busy === 'tpl'}>Save</button>
        <button
          type="button"
          className="byjan-chip"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              const rows = parseManyLines(text);
              if (!rows.length) {
                onToast('Clipboard has no amount I can read.', 'error');
                return;
              }
              setLine(text);
              await postParsed(rows.map((row) => ({ ...row, category })), rows.length > 1 ? `${rows.length} entries recorded` : 'Entry recorded');
            } catch {
              onToast('Allow clipboard access, then try again.', 'error');
            }
          }}
        >
          Paste
        </button>
        {lastPosted[0] && (
          <button
            type="button"
            className="byjan-chip"
            onClick={async () => {
              const id = lastPosted[0];
              await softDeleteExpense(bookId, id);
              setLastPosted((ids) => ids.slice(1));
              await onRefresh();
              onToast('Last entry undone.', 'success');
            }}
          >
            Undo last
          </button>
        )}
        {recent.map((exp) => (
          <button
            key={String(exp.id)}
            type="button"
            className="byjan-chip"
            disabled={Boolean(busy)}
            onClick={() => void postParsed([{
              amount: Number(exp.amount || 0),
              description: exp.description,
              category: exp.category,
              entryType: exp.entryType || 'out',
              date: when,
              merchant: exp.merchant || '',
              paymentMethod: exp.paymentMethod || method,
            }], 'Repeated')}
          >
            {String(exp.description || 'Entry').slice(0, 16)} {currencySymbol}{Number(exp.amount || 0).toLocaleString()}
          </button>
        ))}
        {topMerchants.map((name) => (
          <button
            key={name}
            type="button"
            className="byjan-chip"
            onClick={() => {
              const prior = lastMatchFor(expenses, name);
              setMerchant(name);
              setLine(prior ? `${name} ${prior.amount}` : name);
              if (prior) {
                setAmount(String(prior.amount || ''));
                setDescription(String(prior.description || name));
                setCategory(String(prior.category || category));
              }
            }}
          >
            {name}
          </button>
        ))}
      </div>

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
