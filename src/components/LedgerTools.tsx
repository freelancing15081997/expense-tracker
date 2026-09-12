import React, { useMemo, useState } from 'react';
import { Loader2, Repeat } from 'lucide-react';
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
  onAdded?: (row: Record<string, unknown>) => void;
  onRemoved?: (ids: string[]) => void;
  onToast: (message: string, kind?: 'success' | 'error') => void;
};

export default function LedgerTools({
  bookId,
  book,
  canWrite,
  categories,
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
  const descriptions = useMemo(
    () => Array.from(new Set(expenses.map((exp) => String(exp.description || '').trim()).filter(Boolean))).slice(0, 40),
    [expenses],
  );
  const [busy, setBusy] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
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
  const yesterday = isoDay(new Date(Date.now() - 86400000));

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
      if (created?.id) {
        setLastPosted((ids) => [String(created.id), ...ids].slice(0, 8));
        onAdded?.(created as Record<string, unknown>);
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
      onToast('Fill amount and description first, then save it.', 'error');
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
      paymentMethod: method,
    };
    setBusy('tpl');
    try {
      await persistBook({ entryTemplates: [...templates, next] });
      onToast('Saved as a shortcut.', 'success');
    } catch (err: any) {
      onToast(err?.message || 'Could not save template', 'error');
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
      onToast('Recurring saved.', 'success');
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
    <div className="mb-3">
      <form onSubmit={quickAdd} className="ios-widget byjan-capture-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#0B1F3A] tracking-tight">Quick add</p>
            <p className="ios-caption">Type a line or fill the amount.</p>
          </div>
          {lastPosted[0] && (
            <button
              type="button"
              className="text-[13px] font-semibold text-[#0B1F3A]"
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
              Undo last
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="ios-seg" role="group" aria-label="In or out">
            <button type="button" data-on={kind === 'out'} onClick={() => setKind('out')}>Out</button>
            <button type="button" data-on={kind === 'in'} onClick={() => setKind('in')}>In</button>
          </div>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${currencySymbol}0`}
            className="byjan-input !w-[88px] !h-10"
            aria-label="Amount"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="byjan-filter !h-10 !w-[140px] hidden sm:block">
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

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
            } else {
              setDescription(e.target.value);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (text.includes('\n') && parseManyLines(text).length > 1) {
              e.preventDefault();
              setLine(text);
            }
          }}
          placeholder="swiggy 349 yesterday"
          className="byjan-input !h-11 w-full"
          list="ledger-descriptions"
        />
        <datalist id="ledger-descriptions">
          {descriptions.map((name) => <option key={name} value={name} />)}
        </datalist>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="ios-seg" role="group" aria-label="Date">
              <button type="button" data-on={when === isoDay()} onClick={() => setWhen(isoDay())}>Today</button>
              <button type="button" data-on={when === yesterday} onClick={() => setWhen(yesterday)}>Yesterday</button>
            </div>
            <div className="ios-seg" role="group" aria-label="Method">
              {(['upi', 'card', 'cash'] as const).map((row) => (
                <button key={row} type="button" data-on={method === row} onClick={() => setMethod(row)}>{row.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy === 'quick'} className="byjan-btn !h-10 !rounded-full !px-5">
            {busy === 'quick' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/60">
          <button type="button" className="text-[13px] font-semibold text-[#6e6e73]" onClick={() => setMoreOpen((v) => !v)}>
            {moreOpen ? 'Hide extras' : 'Templates & recurring'}
          </button>
          <button
            type="button"
            className="text-[13px] font-semibold text-[#0B1F3A]"
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
        </div>
      </form>

      {moreOpen && (
        <div className="ios-group mt-2">
          <button type="button" className="ios-row w-full text-left" onClick={() => void saveCurrentAsTemplate()} disabled={busy === 'tpl'}>
            <span className="text-[15px] font-medium text-[#0B1F3A]">Save current as template</span>
          </button>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="ios-row w-full text-left"
              disabled={Boolean(busy)}
              onClick={() => void applyTemplate(tpl)}
            >
              <span className="text-[15px] font-medium text-[#0B1F3A] truncate">{tpl.name}</span>
              <span className="text-[13px] text-[#8e8e93]">{currencySymbol}{Number(tpl.amount || 0).toLocaleString()}</span>
            </button>
          ))}
          <button type="button" className="ios-row w-full text-left" onClick={() => setRuleOpen((v) => !v)}>
            <span className="inline-flex items-center gap-2 text-[15px] font-medium text-[#0B1F3A]">
              <Repeat className="w-4 h-4" /> Recurring
            </span>
            {dueCount ? <span className="text-[13px] text-[#8e8e93]">{dueCount} due</span> : null}
          </button>
          {dueCount > 0 && (
            <button type="button" className="ios-row w-full text-left" onClick={() => void postDue()} disabled={busy === 'due'}>
              <span className="text-[15px] font-medium text-[#0B1F3A]">Post due entries</span>
            </button>
          )}
        </div>
      )}

      {moreOpen && ruleOpen && (
        <form onSubmit={addRule} className="ios-widget mt-2 grid grid-cols-2 gap-2">
          <input className="byjan-input col-span-2" placeholder="Rent, salary…" value={rule.description} onChange={(e) => setRule((r) => ({ ...r, description: e.target.value }))} />
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
          <input type="date" className="byjan-filter col-span-2" value={rule.nextDate} onChange={(e) => setRule((r) => ({ ...r, nextDate: e.target.value }))} />
          <button type="submit" disabled={busy === 'rule'} className="byjan-btn col-span-2">
            {busy === 'rule' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save rule · next {advanceIso(rule.nextDate || isoDay(), rule.cadence) && rule.nextDate}
          </button>
        </form>
      )}
    </div>
  );
}
