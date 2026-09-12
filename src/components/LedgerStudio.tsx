import React, { useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { createExpense, updateExpense } from '../lib/expenses';
import { updateLedger } from '../lib/ledgers';
import {
  advanceIso,
  applyCategoryRules,
  downloadText,
  isoDay,
  ledgerInsights,
  newId,
  parseLedgerCsv,
  readCategoryRules,
  readRecurring,
  readTemplates,
  toQif,
  type CategoryRule,
  type EntryTemplate,
  type RecurringRule,
} from '../lib/ledger-advanced';

type Props = {
  bookId: string;
  book: Record<string, unknown>;
  bookName: string;
  canWrite: boolean;
  canManage: boolean;
  categories: string[];
  currencySymbol: string;
  expenses: Array<Record<string, unknown>>;
  selected: Array<Record<string, unknown>>;
  enteredBy: string;
  enteredByUid: string;
  enteredByEmail: string;
  onBook: (book: Record<string, unknown>) => void;
  onRefresh: () => Promise<void>;
  onToast: (message: string, kind?: 'success' | 'error') => void;
  amountMin: string;
  amountMax: string;
  onAmountMin: (v: string) => void;
  onAmountMax: (v: string) => void;
  hideTransfers: boolean;
  onHideTransfers: (v: boolean) => void;
  flaggedOnly: boolean;
  onFlaggedOnly: (v: boolean) => void;
};

export default function LedgerStudio(props: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [match, setMatch] = useState('');
  const [ruleCat, setRuleCat] = useState(props.categories[0] || 'Uncategorized');
  const [splitA, setSplitA] = useState('');
  const [splitCat, setSplitCat] = useState(props.categories[0] || 'Uncategorized');
  const [viewName, setViewName] = useState('');
  const [cap, setCap] = useState(String(props.book.dailyCap || ''));
  const [lockBefore, setLockBefore] = useState(String(props.book.lockBefore || ''));
  const rules = readCategoryRules(props.book);
  const templates = readTemplates(props.book);
  const recurring = readRecurring(props.book);
  const views = Array.isArray(props.book.savedViews) ? props.book.savedViews as Array<{ id: string; name: string; min?: string; max?: string }> : [];
  const insights = useMemo(() => ledgerInsights(props.expenses, Number(props.book.monthlyBudget || 0)), [props.expenses, props.book.monthlyBudget]);

  const persist = async (patch: Record<string, unknown>) => {
    const next = await updateLedger(props.bookId, patch);
    props.onBook(next as Record<string, unknown>);
  };

  if (!props.canWrite && !open) {
    return (
      <button type="button" className="byjan-chip" onClick={() => setOpen(true)}>Insights</button>
    );
  }

  return (
    <div>
      <button type="button" className="byjan-chip" data-on={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal className="w-3 h-3" />
        Studio
      </button>
      {open && (
        <div className="byjan-card p-3 mt-2 space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <p>This month out <b className="block text-slate-900">{props.currencySymbol}{insights.monthOut.toLocaleString()}</b></p>
            <p>Last month <b className="block text-slate-900">{props.currencySymbol}{insights.lastOut.toLocaleString()}</b></p>
            <p>Weekday / weekend <b className="block text-slate-900">{props.currencySymbol}{insights.weekday.toLocaleString()} / {props.currencySymbol}{insights.weekend.toLocaleString()}</b></p>
            <p>Possible duplicates <b className="block text-slate-900">{insights.dupes}</b></p>
          </div>
          {insights.budget > 0 && (
            <p className="text-[11px] text-slate-600">
              Budget pace {props.currencySymbol}{Math.round(insights.pace).toLocaleString()} vs {props.currencySymbol}{insights.budget.toLocaleString()}
              {insights.pace > insights.budget ? ' — over pace' : ' — on track'}
            </p>
          )}
          {insights.topMerchants.length > 0 && (
            <p className="text-[11px] text-slate-600">Top merchants: {insights.topMerchants.map(([name, amt]) => `${name} ${props.currencySymbol}${amt.toLocaleString()}`).join(' · ')}</p>
          )}
          {insights.settlement.length > 1 && (
            <p className="text-[11px] text-slate-600">Who is ahead: {insights.settlement.map(([name, amt]) => `${name} ${amt >= 0 ? '+' : '−'}${props.currencySymbol}${Math.abs(amt).toLocaleString()}`).join(' · ')}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <input className="byjan-filter !w-24" placeholder="Min amt" value={props.amountMin} onChange={(e) => props.onAmountMin(e.target.value)} />
            <input className="byjan-filter !w-24" placeholder="Max amt" value={props.amountMax} onChange={(e) => props.onAmountMax(e.target.value)} />
            <button type="button" className="byjan-chip" data-on={props.hideTransfers} onClick={() => props.onHideTransfers(!props.hideTransfers)}>Hide transfers</button>
            <button type="button" className="byjan-chip" data-on={props.flaggedOnly} onClick={() => props.onFlaggedOnly(!props.flaggedOnly)}>Flagged only</button>
          </div>

          {props.canWrite && (
            <>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!match.trim()) return;
                  setBusy('rule');
                  try {
                    const next: CategoryRule = { id: newId('cr'), match: match.trim(), category: ruleCat };
                    await persist({ categoryRules: [...rules, next] });
                    setMatch('');
                    props.onToast('Category rule saved.', 'success');
                  } finally { setBusy(''); }
                }}
              >
                <input className="byjan-input !w-40" placeholder="If merchant contains" value={match} onChange={(e) => setMatch(e.target.value)} />
                <select className="byjan-filter !w-auto" value={ruleCat} onChange={(e) => setRuleCat(e.target.value)}>
                  {props.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button className="byjan-btn !h-9" disabled={busy === 'rule'}>{busy === 'rule' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add rule'}</button>
                <button
                  type="button"
                  className="byjan-btn-ghost !h-9"
                  disabled={busy === 'apply'}
                  onClick={async () => {
                    setBusy('apply');
                    try {
                      let n = 0;
                      for (const exp of props.expenses) {
                        const cat = String(exp.category || '').toLowerCase();
                        if (cat && cat !== 'uncategorized') continue;
                        const next = applyCategoryRules(String(exp.description || ''), String(exp.merchant || ''), rules);
                        if (!next) continue;
                        await updateExpense(props.bookId, String(exp.id), { category: next });
                        n += 1;
                      }
                      await props.onRefresh();
                      props.onToast(n ? `Categorized ${n} ${n === 1 ? 'entry' : 'entries'}.` : 'No unmatched rows hit a rule.', 'success');
                    } finally { setBusy(''); }
                  }}
                >
                  Apply to uncategorized
                </button>
              </form>
              {rules.length > 0 && <p className="text-[11px] text-slate-500">{rules.map((rule) => `${rule.match} → ${rule.category}`).join(' · ')}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="byjan-chip"
                  disabled={!props.selected[0] || busy === 'split'}
                  onClick={async () => {
                    const exp = props.selected[0];
                    const part = Number(splitA);
                    const total = Number(exp?.amount || 0);
                    if (!exp || !Number.isFinite(part) || part <= 0 || part >= total) {
                      props.onToast('Select one entry and a split amount under the total.', 'error');
                      return;
                    }
                    setBusy('split');
                    try {
                      await updateExpense(props.bookId, String(exp.id), {
                        splits: [
                          { category: exp.category, amount: total - part },
                          { category: splitCat, amount: part },
                        ],
                      });
                      await props.onRefresh();
                      props.onToast('Split saved on the selected entry.', 'success');
                    } finally { setBusy(''); }
                  }}
                >
                  Split selected
                </button>
                <input className="byjan-filter !w-24" placeholder="Split amt" value={splitA} onChange={(e) => setSplitA(e.target.value)} />
                <select className="byjan-filter !w-auto" value={splitCat} onChange={(e) => setSplitCat(e.target.value)}>
                  {props.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button
                  type="button"
                  className="byjan-chip"
                  disabled={busy === 'settle'}
                  onClick={async () => {
                    setBusy('settle');
                    try {
                      let n = 0;
                      for (const exp of props.expenses) {
                        if (!exp.reimbursable) continue;
                        await updateExpense(props.bookId, String(exp.id), { reimbursable: false, reimbursedAt: isoDay() });
                        n += 1;
                      }
                      await props.onRefresh();
                      props.onToast(n ? `Settled ${n} reimbursable ${n === 1 ? 'row' : 'rows'}.` : 'Nothing marked reimbursable.', 'success');
                    } finally { setBusy(''); }
                  }}
                >
                  Settle reimbursable
                </button>
                <button
                  type="button"
                  className="byjan-chip"
                  onClick={() => {
                    const slug = String(props.bookName || 'ledger').replace(/\s+/g, '-');
                    downloadText(`${slug}.qif`, toQif(props.expenses, props.bookName), 'application/qif');
                    props.onToast('QIF downloaded for bank import.', 'success');
                  }}
                >
                  Export QIF
                </button>
                <button
                  type="button"
                  className="byjan-chip"
                  onClick={() => {
                    downloadText(`${String(props.bookName || 'ledger').replace(/\s+/g, '-')}.json`, JSON.stringify({ book: props.book, expenses: props.expenses }, null, 2), 'application/json');
                    props.onToast('JSON backup downloaded.', 'success');
                  }}
                >
                  JSON backup
                </button>
              </div>

              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const file = (e.currentTarget.elements.namedItem('csv') as HTMLInputElement)?.files?.[0];
                  if (!file) return;
                  setBusy('csv');
                  try {
                    const rows = parseLedgerCsv(await file.text());
                    for (const row of rows) {
                      await createExpense(props.bookId, {
                        ...row,
                        paidByName: props.enteredBy,
                        enteredBy: props.enteredBy,
                        enteredByUid: props.enteredByUid,
                        enteredByEmail: props.enteredByEmail,
                        imported: true,
                      }, { force: true });
                    }
                    await props.onRefresh();
                    props.onToast(`Imported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}.`, 'success');
                    e.currentTarget.reset();
                  } finally { setBusy(''); }
                }}
              >
                <input name="csv" type="file" accept=".csv,text/csv" className="text-xs" />
                <button className="byjan-btn !h-9" disabled={busy === 'csv'}>{busy === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import CSV'}</button>
              </form>

              {props.canManage && (
                <div className="flex flex-wrap gap-2">
                  <label className="text-[11px] text-slate-500">Lock before
                    <input type="date" className="byjan-filter mt-1" value={lockBefore} onChange={(e) => setLockBefore(e.target.value)} />
                  </label>
                  <button type="button" className="byjan-btn-ghost !h-9 self-end" onClick={() => void persist({ lockBefore })}>Save lock</button>
                  <label className="text-[11px] text-slate-500">Daily cap
                    <input className="byjan-filter mt-1" value={cap} onChange={(e) => setCap(e.target.value)} />
                  </label>
                  <button type="button" className="byjan-btn-ghost !h-9 self-end" onClick={() => void persist({ dailyCap: Number(cap) || 0 })}>Save cap</button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <input className="byjan-input !w-40" placeholder="Name this view" value={viewName} onChange={(e) => setViewName(e.target.value)} />
                <button
                  type="button"
                  className="byjan-chip"
                  onClick={() => {
                    if (!viewName.trim()) return;
                    void persist({ savedViews: [...views, { id: newId('view'), name: viewName.trim(), min: props.amountMin, max: props.amountMax }] });
                    setViewName('');
                  }}
                >
                  Save view
                </button>
                {views.map((view) => (
                  <button key={view.id} type="button" className="byjan-chip" onClick={() => { props.onAmountMin(view.min || ''); props.onAmountMax(view.max || ''); }}>
                    {view.name}
                  </button>
                ))}
                {recurring.filter((row) => row.active).length > 0 && (
                  <button
                    type="button"
                    className="byjan-chip"
                    onClick={() => {
                      let skipped = false;
                      const next: RecurringRule[] = recurring.map((row) => {
                        if (skipped || !row.active) return row;
                        skipped = true;
                        return { ...row, nextDate: advanceIso(row.nextDate, row.cadence) };
                      });
                      void persist({ recurringRules: next });
                      props.onToast('Skipped the next post on the first live rule.', 'success');
                    }}
                  >
                    Skip next recurring
                  </button>
                )}
                {templates.length > 0 && <span className="text-[11px] text-slate-500">{templates.length} templates on this ledger</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
