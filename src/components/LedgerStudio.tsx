import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { createExpense, softDeleteExpense, updateExpense } from '../lib/expenses';
import { listLedgers, updateLedger } from '../lib/ledgers';
import {
  advanceIso,
  applyCategoryRules,
  budgetDaysLeft,
  downloadText,
  entryPlainText,
  isoDay,
  ledgerInsights,
  methodMix,
  newId,
  parseLedgerCsv,
  readCategoryRules,
  readRecurring,
  readTemplates,
  readWatchMerchants,
  tileHue,
  taxYearRange,
  toLedgerCsv,
  toOfx,
  toQif,
  weekOverWeek,
  type CategoryRule,
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
  onAdded?: (row: Record<string, unknown>) => void;
  onRemoved?: (ids: string[]) => void;
  onPatched?: (row: Record<string, unknown>) => void;
  onToast: (message: string, kind?: 'success' | 'error') => void;
  amountMin: string;
  amountMax: string;
  onAmountMin: (v: string) => void;
  onAmountMax: (v: string) => void;
  hideTransfers: boolean;
  onHideTransfers: (v: boolean) => void;
  flaggedOnly: boolean;
  onFlaggedOnly: (v: boolean) => void;
  filtered: Array<Record<string, unknown>>;
  hideDrafts: boolean;
  onHideDrafts: (v: boolean) => void;
  staleOnly: boolean;
  onStaleOnly: (v: boolean) => void;
  anomalyOnly: boolean;
  onAnomalyOnly: (v: boolean) => void;
  onCopyFilterLink: () => void;
  onRepeatLast: () => void;
  missingOnly: boolean;
  onMissingOnly: (v: boolean) => void;
  privacy: boolean;
  onPrivacy: (v: boolean) => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="ios-section-label !px-1">{title}</p>
      <div className="ios-group">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="ios-row !items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-[#0B1F3A] tracking-tight">{label}</p>
        {hint ? <p className="text-[12px] text-[#8e8e93] mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ios-switch" data-on={on} onClick={onClick} aria-pressed={on} />
  );
}

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
  const [watch, setWatch] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [peers, setPeers] = useState<Array<{ id: string; name: string }>>([]);
  const rules = readCategoryRules(props.book);
  const templates = readTemplates(props.book);
  const recurring = readRecurring(props.book);
  const watched = readWatchMerchants(props.book);
  const views = Array.isArray(props.book.savedViews) ? props.book.savedViews as Array<{ id: string; name: string; min?: string; max?: string }> : [];
  const insights = useMemo(() => ledgerInsights(props.expenses, Number(props.book.monthlyBudget || 0)), [props.expenses, props.book.monthlyBudget]);
  const wow = useMemo(() => weekOverWeek(props.expenses), [props.expenses]);
  const mix = useMemo(() => methodMix(props.expenses).slice(0, 3), [props.expenses]);
  const daysLeft = budgetDaysLeft(insights.monthOut, insights.budget);
  const money = (n: number) => `${props.currencySymbol}${Math.abs(n).toLocaleString()}`;

  const persist = async (patch: Record<string, unknown>) => {
    const next = await updateLedger(props.bookId, patch);
    props.onBook(next as Record<string, unknown>);
  };

  if (!props.canWrite && !open) {
    return (
      <button type="button" className="byjan-chip" onClick={() => setOpen(true)}>Insights</button>
    );
  }

  const body = (
    <div className="studio-body">
      <header className="studio-head">
        <div>
          <p className="ios-caption">Ledger</p>
          <h2 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-[#0B1F3A] leading-none mt-1">Studio</h2>
        </div>
        <button type="button" className="w-9 h-9 rounded-full bg-white/80 text-[#3a3a3c]" onClick={() => setOpen(false)} aria-label="Close">
          <X className="w-4 h-4 mx-auto" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <div className="ios-widget !p-3.5">
          <p className="ios-caption">This month out</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#0B1F3A]">{money(insights.monthOut)}</p>
        </div>
        <div className="ios-widget !p-3.5">
          <p className="ios-caption">Last month</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#0B1F3A]">{money(insights.lastOut)}</p>
        </div>
        <div className="ios-widget !p-3.5">
          <p className="ios-caption">Week vs last</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#0B1F3A]">{wow.delta >= 0 ? '+' : ''}{Math.round(wow.delta)}%</p>
        </div>
        <div className="ios-widget !p-3.5">
          <p className="ios-caption">Possible duplicates</p>
          <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-[#0B1F3A]">{insights.dupes}</p>
        </div>
      </div>

      {insights.budget > 0 && (
        <p className="ios-caption px-1">
          Budget pace {money(Math.round(insights.pace))} of {money(insights.budget)}
          {insights.pace > insights.budget ? ' — over pace' : ' — on track'}
          {daysLeft > 0 ? ` · about ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ' · used up at this pace'}
        </p>
      )}
      {insights.topMerchants.length > 0 && (
        <p className="ios-caption px-1">Top merchants: {insights.topMerchants.map(([name, amt]) => `${name} ${money(amt)}`).join(' · ')}</p>
      )}
      {mix.length > 0 && (
        <p className="ios-caption px-1">Methods: {mix.map(([name, amt]) => `${name} ${money(amt)}`).join(' · ')}</p>
      )}

      <Section title="View">
        <Row label="Hide transfers"><Switch on={props.hideTransfers} onClick={() => props.onHideTransfers(!props.hideTransfers)} /></Row>
        <Row label="Flagged only"><Switch on={props.flaggedOnly} onClick={() => props.onFlaggedOnly(!props.flaggedOnly)} /></Row>
        <Row label="Hide drafts"><Switch on={props.hideDrafts} onClick={() => props.onHideDrafts(!props.hideDrafts)} /></Row>
        <Row label="Stale reimbursements"><Switch on={props.staleOnly} onClick={() => props.onStaleOnly(!props.staleOnly)} /></Row>
        <Row label="Unusual amounts"><Switch on={props.anomalyOnly} onClick={() => props.onAnomalyOnly(!props.anomalyOnly)} /></Row>
        <Row label="Needs a receipt"><Switch on={props.missingOnly} onClick={() => props.onMissingOnly(!props.missingOnly)} /></Row>
        <Row label="Hide amounts"><Switch on={props.privacy} onClick={() => props.onPrivacy(!props.privacy)} /></Row>
        <div className="ios-row !gap-2">
          <input className="byjan-filter flex-1" placeholder="Min amount" value={props.amountMin} onChange={(e) => props.onAmountMin(e.target.value)} />
          <input className="byjan-filter flex-1" placeholder="Max amount" value={props.amountMax} onChange={(e) => props.onAmountMax(e.target.value)} />
        </div>
        {views.length > 0 && views.map((view) => (
          <button key={view.id} type="button" className="ios-row w-full text-left" onClick={() => { props.onAmountMin(view.min || ''); props.onAmountMax(view.max || ''); }}>
            <span className="text-[15px] font-medium text-[#0B1F3A]">{view.name}</span>
            <ChevronRight className="ios-chevron w-4 h-4" />
          </button>
        ))}
      </Section>

      {props.canWrite && (
        <>
          <Section title="Selected entries">
            <p className="ios-row text-[13px] text-[#8e8e93]">
              {props.selected.length ? `${props.selected.length} selected` : 'Select rows in the list to split, merge, move, or copy.'}
            </p>
            <div className="ios-row !flex-col !items-stretch !gap-2">
              <div className="flex gap-2">
                <input className="byjan-filter flex-1" placeholder="Split amount" value={splitA} onChange={(e) => setSplitA(e.target.value)} />
                <select className="byjan-filter flex-1" value={splitCat} onChange={(e) => setSplitCat(e.target.value)}>
                  {props.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button
                type="button"
                className="byjan-btn !h-10"
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
                    const next = await updateExpense(props.bookId, String(exp.id), {
                      splits: [
                        { category: exp.category, amount: total - part },
                        { category: splitCat, amount: part },
                      ],
                    });
                    props.onPatched?.(next as Record<string, unknown>);
                    props.onToast('Split saved.', 'success');
                  } finally { setBusy(''); }
                }}
              >
                {busy === 'split' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Split selected'}
              </button>
            </div>
            <button
              type="button"
              className="ios-row w-full text-left"
              disabled={props.selected.length !== 2 || busy === 'merge'}
              onClick={async () => {
                const [a, b] = props.selected;
                if (!a || !b) return;
                setBusy('merge');
                try {
                  const next = await updateExpense(props.bookId, String(a.id), {
                    amount: Number(a.amount || 0) + Number(b.amount || 0),
                    notes: [a.notes, b.notes, `Merged ${b.description || b.id}`].filter(Boolean).join(' · '),
                    mergedFrom: b.id,
                  });
                  await softDeleteExpense(props.bookId, String(b.id));
                  props.onPatched?.(next as Record<string, unknown>);
                  props.onRemoved?.([String(b.id)]);
                  props.onToast('Two rows merged.', 'success');
                } finally { setBusy(''); }
              }}
            >
              <span className="text-[15px] font-medium">Merge two</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
            <div className="ios-row !gap-2">
              <select
                className="byjan-filter flex-1"
                value={moveTo}
                onFocus={() => {
                  if (peers.length) return;
                  void listLedgers().then((rows) => setPeers(rows.filter((row) => row.id !== props.bookId).map((row) => ({ id: row.id, name: String(row.name || 'Ledger') }))));
                }}
                onChange={(e) => setMoveTo(e.target.value)}
              >
                <option value="">Move to another ledger</option>
                {peers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <button
                type="button"
                className="byjan-btn-ghost !h-9"
                disabled={!moveTo || props.selected.length === 0 || busy === 'move'}
                onClick={async () => {
                  setBusy('move');
                  try {
                    const ids: string[] = [];
                    for (const exp of props.selected) {
                      await createExpense(moveTo, {
                        amount: Number(exp.amount || 0),
                        description: exp.description,
                        category: exp.category,
                        entryType: exp.entryType || 'out',
                        date: exp.date || isoDay(),
                        merchant: exp.merchant || '',
                        paymentMethod: exp.paymentMethod || 'cash',
                        notes: exp.notes || '',
                        reimbursable: Boolean(exp.reimbursable),
                        paidByName: props.enteredBy,
                        enteredBy: props.enteredBy,
                        enteredByUid: props.enteredByUid,
                        enteredByEmail: props.enteredByEmail,
                        movedFrom: `${props.bookId}:${exp.id}`,
                      }, { force: true });
                      await softDeleteExpense(props.bookId, String(exp.id));
                      ids.push(String(exp.id));
                    }
                    props.onRemoved?.(ids);
                    props.onToast(`Moved ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}.`, 'success');
                  } finally { setBusy(''); }
                }}
              >
                Move
              </button>
            </div>
            <button
              type="button"
              className="ios-row w-full text-left"
              disabled={props.selected.length === 0}
              onClick={() => {
                const text = props.selected.map((exp) => entryPlainText(exp, props.currencySymbol)).join('\n');
                void navigator.clipboard.writeText(text);
                props.onToast('Copied as text.', 'success');
              }}
            >
              <span className="text-[15px] font-medium">Copy selected</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
            <button
              type="button"
              className="ios-row w-full text-left"
              disabled={!props.selected[0] || busy === 'share'}
              onClick={async () => {
                const exp = props.selected[0];
                const roles = (props.book.roles || {}) as Record<string, { email?: string }>;
                const people = Object.values(roles).map((row) => String(row.email || '')).filter(Boolean);
                const total = Number(exp?.amount || 0);
                if (!exp || people.length < 2 || total <= 0) {
                  props.onToast('Select one entry on a shared ledger.', 'error');
                  return;
                }
                const share = Math.round((total / people.length) * 100) / 100;
                setBusy('share');
                try {
                  const next = await updateExpense(props.bookId, String(exp.id), {
                    splits: people.map((email) => ({ person: email, amount: share })),
                  });
                  props.onPatched?.(next as Record<string, unknown>);
                  props.onToast(`Split equally across ${people.length} people.`, 'success');
                } finally { setBusy(''); }
              }}
            >
              <span className="text-[15px] font-medium">Split with team</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
          </Section>

          <Section title="Categories">
            <form
              className="ios-row !flex-col !items-stretch !gap-2"
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
              <input className="byjan-input" placeholder="If description or merchant contains" value={match} onChange={(e) => setMatch(e.target.value)} />
              <div className="flex gap-2">
                <select className="byjan-filter flex-1" value={ruleCat} onChange={(e) => setRuleCat(e.target.value)}>
                  {props.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button className="byjan-btn !h-9" disabled={busy === 'rule'}>{busy === 'rule' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add rule'}</button>
              </div>
            </form>
            {rules.map((rule) => (
              <div key={rule.id} className="ios-row">
                <span className="text-[15px] text-[#0B1F3A] truncate">{rule.match}</span>
                <span className="text-[13px] text-[#8e8e93]">{rule.category}</span>
              </div>
            ))}
            <button
              type="button"
              className="ios-row w-full text-left"
              disabled={busy === 'apply'}
              onClick={async () => {
                setBusy('apply');
                try {
                  let n = 0;
                  for (const exp of props.expenses) {
                    const cat = String(exp.category || '').toLowerCase();
                    if (cat && cat !== 'uncategorized') continue;
                    const nextCat = applyCategoryRules(String(exp.description || ''), String(exp.merchant || ''), rules);
                    if (!nextCat) continue;
                    const next = await updateExpense(props.bookId, String(exp.id), { category: nextCat });
                    props.onPatched?.(next as Record<string, unknown>);
                    n += 1;
                  }
                  props.onToast(n ? `Categorized ${n} ${n === 1 ? 'entry' : 'entries'}.` : 'No unmatched rows hit a rule.', 'success');
                } finally { setBusy(''); }
              }}
            >
              <span className="text-[15px] font-medium">Apply to uncategorized</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
          </Section>

          <Section title="Shortcuts">
            {templates.length === 0 && recurring.filter((row) => row.active).length === 0 && (
              <p className="ios-row text-[13px] text-[#8e8e93]">Save a quick add as a template, or add a recurring rule from Quick add.</p>
            )}
            {templates.map((tpl) => (
              <div key={tpl.id} className="ios-row">
                <span className="text-[15px] font-medium text-[#0B1F3A] truncate">{tpl.name}</span>
                <span className="text-[13px] text-[#8e8e93]">{money(Number(tpl.amount || 0))}</span>
              </div>
            ))}
            {recurring.filter((row) => row.active).length > 0 && (
              <button
                type="button"
                className="ios-row w-full text-left"
                onClick={() => {
                  let skipped = false;
                  const next: RecurringRule[] = recurring.map((row) => {
                    if (skipped || !row.active) return row;
                    skipped = true;
                    return { ...row, nextDate: advanceIso(row.nextDate, row.cadence) };
                  });
                  void persist({ recurringRules: next });
                  props.onToast('Skipped the next recurring post.', 'success');
                }}
              >
                <span className="text-[15px] font-medium">Skip next recurring</span>
                <ChevronRight className="ios-chevron w-4 h-4" />
              </button>
            )}
            <button type="button" className="ios-row w-full text-left" onClick={props.onRepeatLast}>
              <span className="text-[15px] font-medium">Repeat last entry</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
            <div className="ios-row !gap-2">
              <input className="byjan-input flex-1" placeholder="Name this view" value={viewName} onChange={(e) => setViewName(e.target.value)} />
              <button
                type="button"
                className="byjan-btn-ghost !h-9"
                onClick={() => {
                  if (!viewName.trim()) return;
                  void persist({ savedViews: [...views, { id: newId('view'), name: viewName.trim(), min: props.amountMin, max: props.amountMax }] });
                  setViewName('');
                }}
              >
                Save
              </button>
            </div>
          </Section>

          <Section title="Watch & settle">
            <div className="ios-row !gap-2">
              <input className="byjan-input flex-1" placeholder="Watch a merchant" value={watch} onChange={(e) => setWatch(e.target.value)} />
              <button
                type="button"
                className="byjan-btn-ghost !h-9"
                onClick={() => {
                  if (!watch.trim()) return;
                  void persist({ watchMerchants: [...watched, watch.trim()] });
                  setWatch('');
                }}
              >
                Watch
              </button>
            </div>
            {watched.map((name) => (
              <button key={name} type="button" className="ios-row w-full text-left" onClick={() => void persist({ watchMerchants: watched.filter((row) => row !== name) })}>
                <span className="text-[15px]">{name}</span>
                <span className="text-[12px] text-[#8e8e93]">Remove</span>
              </button>
            ))}
            <button
              type="button"
              className="ios-row w-full text-left"
              disabled={busy === 'settle'}
              onClick={async () => {
                setBusy('settle');
                try {
                  let n = 0;
                  for (const exp of props.expenses) {
                    if (!exp.reimbursable) continue;
                    const next = await updateExpense(props.bookId, String(exp.id), { reimbursable: false, reimbursedAt: isoDay() });
                    props.onPatched?.(next as Record<string, unknown>);
                    n += 1;
                  }
                  props.onToast(n ? `Settled ${n} reimbursable ${n === 1 ? 'row' : 'rows'}.` : 'Nothing marked reimbursable.', 'success');
                } finally { setBusy(''); }
              }}
            >
              <span className="text-[15px] font-medium">Settle reimbursable</span>
              <ChevronRight className="ios-chevron w-4 h-4" />
            </button>
          </Section>

          <Section title="Import & export">
            <form
              className="ios-row !flex-col !items-stretch !gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const file = (e.currentTarget.elements.namedItem('csv') as HTMLInputElement)?.files?.[0];
                if (!file) return;
                setBusy('csv');
                try {
                  const rows = parseLedgerCsv(await file.text());
                  for (const row of rows) {
                    const created = await createExpense(props.bookId, {
                      ...row,
                      paidByName: props.enteredBy,
                      enteredBy: props.enteredBy,
                      enteredByUid: props.enteredByUid,
                      enteredByEmail: props.enteredByEmail,
                      imported: true,
                    }, { force: true });
                    if (created) props.onAdded?.(created as Record<string, unknown>);
                  }
                  props.onToast(`Imported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}.`, 'success');
                  e.currentTarget.reset();
                } finally { setBusy(''); }
              }}
            >
              <input name="csv" type="file" accept=".csv,text/csv" className="text-xs" />
              <button className="byjan-btn !h-10" disabled={busy === 'csv'}>{busy === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import CSV'}</button>
            </form>
            {[
              { label: 'Copy filter link', run: props.onCopyFilterLink },
              { label: 'Filtered CSV', run: () => { downloadText(`${String(props.bookName || 'ledger').replace(/\s+/g, '-')}-filtered.csv`, toLedgerCsv(props.filtered), 'text/csv'); props.onToast('Filtered CSV downloaded.', 'success'); } },
              { label: 'India tax year CSV', run: () => { const range = taxYearRange('fy-in'); downloadText(`ledger-${range.label}.csv`, toLedgerCsv(props.expenses.filter((exp) => { const day = String(exp.date || ''); return day >= range.from && day <= range.to; })), 'text/csv'); props.onToast(`${range.label} downloaded.`, 'success'); } },
              { label: 'Calendar year CSV', run: () => { const range = taxYearRange('calendar'); downloadText(`ledger-${range.label}.csv`, toLedgerCsv(props.expenses.filter((exp) => { const day = String(exp.date || ''); return day >= range.from && day <= range.to; })), 'text/csv'); props.onToast(`${range.label} downloaded.`, 'success'); } },
              { label: 'QIF for bank import', run: () => { downloadText(`${String(props.bookName || 'ledger').replace(/\s+/g, '-')}.qif`, toQif(props.expenses, props.bookName), 'application/qif'); props.onToast('QIF downloaded.', 'success'); } },
              { label: 'OFX', run: () => { downloadText(`${String(props.bookName || 'ledger').replace(/\s+/g, '-')}.ofx`, toOfx(props.filtered, props.bookName), 'application/x-ofx'); props.onToast('OFX downloaded.', 'success'); } },
              { label: 'JSON backup', run: () => { downloadText(`${String(props.bookName || 'ledger').replace(/\s+/g, '-')}.json`, JSON.stringify({ book: props.book, expenses: props.expenses }, null, 2), 'application/json'); props.onToast('JSON backup downloaded.', 'success'); } },
            ].map((item) => (
              <button key={item.label} type="button" className="ios-row w-full text-left" onClick={item.run}>
                <span className="text-[15px] font-medium text-[#0B1F3A]">{item.label}</span>
                <ChevronRight className="ios-chevron w-4 h-4" />
              </button>
            ))}
          </Section>

          {props.canManage && (
            <Section title="Ledger">
              <div className="ios-row !flex-col !items-stretch !gap-2">
                <label className="text-[13px] text-[#8e8e93]">
                  Lock entries before
                  <input type="date" className="byjan-filter mt-1 w-full" value={lockBefore} onChange={(e) => setLockBefore(e.target.value)} />
                </label>
                <button type="button" className="byjan-btn-ghost !h-9" onClick={() => void persist({ lockBefore })}>Save lock</button>
              </div>
              <div className="ios-row !flex-col !items-stretch !gap-2">
                <label className="text-[13px] text-[#8e8e93]">
                  Daily spending cap
                  <input className="byjan-filter mt-1 w-full" value={cap} onChange={(e) => setCap(e.target.value)} />
                </label>
                <button type="button" className="byjan-btn-ghost !h-9" onClick={() => void persist({ dailyCap: Number(cap) || 0 })}>Save cap</button>
              </div>
              <button type="button" className="ios-row w-full text-left" onClick={() => void persist({ archived: !props.book.archived })}>
                <span className="text-[15px] font-medium">{props.book.archived ? 'Unarchive ledger' : 'Archive ledger'}</span>
                <ChevronRight className="ios-chevron w-4 h-4" />
              </button>
              <button type="button" className="ios-row w-full text-left" onClick={() => void persist({ accentHue: (Number(props.book.accentHue || tileHue(props.bookName)) + 37) % 360 })}>
                <span className="text-[15px] font-medium">Recolor tile</span>
                <ChevronRight className="ios-chevron w-4 h-4" />
              </button>
            </Section>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <button type="button" className="byjan-chip" data-on={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Studio
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="byjan-studio-mask" onClick={() => setOpen(false)} />
          <aside className="byjan-studio-sheet" role="dialog" aria-label="Studio">
            {body}
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
