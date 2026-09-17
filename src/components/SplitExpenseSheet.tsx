/** Premium Split sheet — fill modes, live remaining, member select. */

import React, { useMemo, useState } from 'react';
import { Check, Equal, Layers, Lock, PencilLine, Percent, Save, Search, Sparkles, Unlock, Users, UserCheck, X } from 'lucide-react';
import { allocateSplit, buildMoneySplit, fillLockedAmounts, moneySplitToPersonSplits, peopleFromBook, type SplitFillMode } from '../lib/money-splits';
import { saveMoneySplit } from '../lib/money-api';
import { formatPaise, toPaise } from '../lib/money-core';
import type { SplitMethod } from '../lib/money-flow';
import './split-premium.css';

type PersonRow = {
  uid: string;
  name: string;
  email: string;
  amountPaise: number;
  percent: number;
  share: number;
  selected: boolean;
  locked: boolean;
};

type Props = {
  open: boolean;
  bookId: string;
  book: Record<string, unknown> | null;
  expenseId: string;
  amount: number;
  currencySymbol?: string;
  merchant?: string;
  description?: string;
  onClose: () => void;
  onSaved: (personSplits: unknown, split: unknown) => void;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
};

const METHODS: Array<{ id: SplitMethod; label: string; Icon: typeof Equal }> = [
  { id: 'equal', label: 'Equal', Icon: Equal },
  { id: 'exact', label: 'Custom', Icon: PencilLine },
  { id: 'percentage', label: '%', Icon: Percent },
  { id: 'shares', label: 'Shares', Icon: Layers },
];

const FILL_MODES: Array<{ id: SplitFillMode; label: string; hint: string }> = [
  { id: 'automatic', label: 'Automatic', hint: 'Everyone’s amount fills equally' },
  { id: 'partial', label: 'Partial auto', hint: 'Lock a few amounts — the rest split' },
  { id: 'manual', label: 'Manual', hint: 'Type every amount yourself' },
];

export default function SplitExpenseSheet({
  open,
  bookId,
  book,
  expenseId,
  amount,
  currencySymbol = '₹',
  merchant,
  description,
  onClose,
  onSaved,
  onToast,
}: Props) {
  const people = useMemo(() => peopleFromBook(book), [book]);
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [fillMode, setFillMode] = useState<SplitFillMode>('automatic');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonRow[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setMethod('equal');
    setFillMode('automatic');
    setRows(people.map((p) => ({
      uid: p.uid,
      name: p.name,
      email: p.email,
      amountPaise: 0,
      percent: Math.round(100 / Math.max(1, people.length)),
      share: 1,
      selected: true,
      locked: false,
    })));
  }, [people, open]);

  const selected = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const totalPaise = toPaise(amount);

  const effectiveFill: SplitFillMode = method === 'equal' ? 'automatic' : fillMode;
  const rupeeFill = method === 'equal' || method === 'exact' || effectiveFill !== 'automatic';

  const filled = useMemo(
    () => fillLockedAmounts(totalPaise, selected, effectiveFill),
    [totalPaise, selected, effectiveFill],
  );

  const participants = useMemo(
    () => selected.map((r, i) => ({
      ...r,
      amountPaise: filled.amounts[i] ?? r.amountPaise,
    })),
    [selected, filled],
  );

  const preview = rupeeFill
    ? allocateSplit(totalPaise, 'exact', participants)
    : allocateSplit(totalPaise, method, selected);

  const allocated = preview.ok
    ? preview.allocations.reduce((s, a) => s + a.amountPaise, 0)
    : filled.amounts.reduce((s, n) => s + n, 0);
  const remaining = totalPaise - allocated;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  const toggleAll = () => {
    const next = !allSelected;
    setRows((curr) => curr.map((r) => ({ ...r, selected: next })));
  };

  const allocationFor = (uid: string, idxInSelected: number) => {
    if (!rupeeFill && (method === 'percentage' || method === 'shares')) {
      if (!preview.ok) return 0;
      const hit = preview.allocations.find((a) => a.participantKey === uid);
      if (hit) return hit.amountPaise;
      return preview.allocations[idxInSelected]?.amountPaise || 0;
    }
    return filled.amounts[idxInSelected] || 0;
  };

  const lockAmount = (uid: string, rupees: number) => {
    setFillMode((curr) => (curr === 'automatic' ? 'partial' : curr));
    setMethod((curr) => (curr === 'equal' ? 'exact' : curr));
    setRows((curr) => curr.map((r) => r.uid === uid
      ? { ...r, amountPaise: Math.round(Number(rupees || 0) * 100), locked: true }
      : r));
  };

  const save = async () => {
    if (!selected.length) {
      onToast('Select at least one member', 'error');
      return;
    }
    const ready = preview;
    if (!ready.ok) {
      onToast(ready.error || filled.error || 'Invalid split', 'error');
      return;
    }
    const persistMethod: SplitMethod = rupeeFill ? 'exact' : method;
    const split = buildMoneySplit({
      expenseId,
      bookId,
      totalPaise,
      method: persistMethod,
      participants: persistMethod === 'exact' ? participants : selected,
    });
    if (!split) {
      onToast('Could not build split', 'error');
      return;
    }
    const personSplits = moneySplitToPersonSplits(split);
    setBusy(true);
    try {
      await saveMoneySplit(bookId, expenseId, { ...split, personSplits });
      onSaved(personSplits, split);
      onToast('Split saved', 'success');
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save split', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="sp-root" role="dialog" aria-modal="true" aria-label="Split expense">
      <button type="button" className="sp-dim" aria-label="Close" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-handle" aria-hidden />
        <header className="sp-head">
          <div>
            <p className="sp-kicker"><Users className="w-3 h-3 inline -mt-0.5" /> Split expense</p>
            <h2 className="sp-title">{merchant || description || 'Expense'}</h2>
          </div>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="sp-hero">
          <p className="sp-hero-label">Total</p>
          <p className="sp-hero-amount">{formatPaise(totalPaise, currencySymbol)}</p>
          <div className="sp-meters">
            <div>
              <span>Allocated</span>
              <strong>{formatPaise(Math.max(0, allocated), currencySymbol)}</strong>
            </div>
            <div className={remaining === 0 ? 'is-ok' : 'is-warn'}>
              <span>Remaining</span>
              <strong>{formatPaise(remaining, currencySymbol)}</strong>
            </div>
          </div>
          <div className="sp-bar" aria-hidden>
            <i style={{ width: `${totalPaise ? Math.min(100, (allocated / totalPaise) * 100) : 0}%` }} />
          </div>
        </div>

        <div className="sp-methods" role="tablist" aria-label="Split method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={method === m.id}
              className={method === m.id ? 'is-on' : ''}
              onClick={() => {
                setMethod(m.id);
                setFillMode(m.id === 'equal' ? 'automatic' : m.id === 'exact' ? 'partial' : fillMode);
                if (m.id === 'equal') setRows((curr) => curr.map((r) => ({ ...r, locked: false })));
              }}
            >
              <m.Icon className="w-4 h-4" strokeWidth={2.2} />
              {m.label}
            </button>
          ))}
        </div>

        {method !== 'equal' ? (
          <div className="sp-fill" role="radiogroup" aria-label="How amounts fill">
            {FILL_MODES.map((mode) => (
              <label key={mode.id} className={`sp-fill-opt${fillMode === mode.id ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="split-fill"
                  checked={fillMode === mode.id}
                  onChange={() => {
                    setFillMode(mode.id);
                    if (mode.id === 'automatic') setRows((curr) => curr.map((r) => ({ ...r, locked: false })));
                  }}
                />
                <span className="sp-fill-check" aria-hidden>{fillMode === mode.id ? <Check className="w-3 h-3" strokeWidth={3} /> : null}</span>
                <span>
                  <strong>{mode.label}</strong>
                  <em>{mode.hint}</em>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="sp-fill-note"><Sparkles className="w-3.5 h-3.5" /> Automatic — remaining always stays at zero</p>
        )}

        <div className="sp-toolbar">
          <label className="sp-search">
            <Search className="w-4 h-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              inputMode="search"
            />
          </label>
          <button type="button" className="sp-select-all" onClick={toggleAll}>
            <UserCheck className="w-3.5 h-3.5" />
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="sp-list">
          {filtered.length === 0 ? (
            <p className="sp-empty">No members match “{query}”.</p>
          ) : (
            filtered.map((row) => {
              const selectedIdx = selected.findIndex((s) => s.uid === row.uid);
              const liveAmt = row.selected ? allocationFor(row.uid, Math.max(0, selectedIdx)) : 0;
              const canEditRupees = row.selected && rupeeFill && effectiveFill !== 'automatic';
              return (
                <div key={row.uid} className={`sp-row ${row.selected ? 'is-on' : ''} ${row.locked ? 'is-locked' : ''}`}>
                  <button
                    type="button"
                    className="sp-check"
                    aria-pressed={row.selected}
                    onClick={() => setRows((curr) => curr.map((r) => r.uid === row.uid ? { ...r, selected: !r.selected } : r))}
                  >
                    {row.selected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                  </button>
                  <div className="sp-avatar" aria-hidden>{(row.name || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="sp-meta">
                    <p className="sp-name">{row.name}</p>
                    <p className="sp-email">{row.locked ? 'Locked amount' : row.email}</p>
                  </div>
                  {canEditRupees ? (
                    <div className="sp-inline-edit">
                      <button
                        type="button"
                        className="sp-lock"
                        aria-label={row.locked ? 'Unlock amount' : 'Lock amount'}
                        onClick={() => setRows((curr) => curr.map((r) => r.uid === row.uid ? { ...r, locked: !r.locked, amountPaise: liveAmt } : r))}
                      >
                        {row.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <input
                        className="sp-input"
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={row.locked || effectiveFill === 'manual' ? (row.amountPaise ? row.amountPaise / 100 : '') : liveAmt / 100}
                        onChange={(e) => lockAmount(row.uid, Number(e.target.value || 0))}
                      />
                    </div>
                  ) : null}
                  {row.selected && method === 'percentage' && !rupeeFill ? (
                    <div className="sp-inline-edit">
                      <input
                        className="sp-input sp-input-sm"
                        type="number"
                        value={row.percent}
                        onChange={(e) => setRows((curr) => curr.map((r) => r.uid === row.uid
                          ? { ...r, percent: Number(e.target.value || 0), locked: true }
                          : r))}
                      />
                      <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                    </div>
                  ) : null}
                  {row.selected && method === 'shares' && !rupeeFill ? (
                    <div className="sp-inline-edit">
                      <input
                        className="sp-input sp-input-sm"
                        type="number"
                        value={row.share}
                        onChange={(e) => setRows((curr) => curr.map((r) => r.uid === row.uid
                          ? { ...r, share: Number(e.target.value || 0), locked: true }
                          : r))}
                      />
                      <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                    </div>
                  ) : null}
                  {row.selected && !canEditRupees && method !== 'percentage' && method !== 'shares' ? (
                    <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                  ) : null}
                  {!row.selected ? <span className="sp-share is-mute">—</span> : null}
                </div>
              );
            })
          )}
        </div>

        {(!preview.ok || !filled.ok) && selected.length > 0 ? (
          <p className="sp-error">{preview.error || filled.error}</p>
        ) : (
          <p className="sp-hint">Example: total {currencySymbol}900, three people, one pays {currencySymbol}50 — the other two get {currencySymbol}425 each.</p>
        )}

        <div className="sp-footer">
          <p className="sp-footer-meta">
            <Users className="w-3.5 h-3.5" />
            {selected.length} of {rows.length} members
          </p>
          <button
            type="button"
            className="sp-cta"
            disabled={busy || !preview.ok || selected.length === 0}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : <><Save className="w-4 h-4" /> Save split</>}
          </button>
        </div>
      </div>
    </div>
  );
}
