/** Premium Split sheet — payment-app depth, member select, live allocation. */

import React, { useMemo, useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { allocateSplit, buildMoneySplit, moneySplitToPersonSplits, peopleFromBook } from '../lib/money-splits';
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

const METHODS: Array<{ id: SplitMethod; label: string }> = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'Custom' },
  { id: 'percentage', label: '%' },
  { id: 'shares', label: 'Shares' },
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
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonRow[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setMethod('equal');
    setRows(people.map((p) => ({
      uid: p.uid,
      name: p.name,
      email: p.email,
      amountPaise: 0,
      percent: Math.round(100 / Math.max(1, people.length)),
      share: 1,
      selected: true,
    })));
  }, [people, open]);

  const selected = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const totalPaise = toPaise(amount);
  const preview = allocateSplit(totalPaise, method, selected);
  const allocated = preview.ok
    ? preview.allocations.reduce((s, a) => s + a.amountPaise, 0)
    : selected.reduce((s, r) => s + Number(r.amountPaise || 0), 0);
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
    if (!preview.ok) return 0;
    const hit = preview.allocations.find((a) => a.participantKey === uid);
    if (hit) return hit.amountPaise;
    return preview.allocations[idxInSelected]?.amountPaise || 0;
  };

  const save = async () => {
    if (!selected.length) {
      onToast('Select at least one member', 'error');
      return;
    }
    if (!preview.ok) {
      onToast(preview.error || 'Invalid split', 'error');
      return;
    }
    const split = buildMoneySplit({
      expenseId,
      bookId,
      totalPaise,
      method,
      participants: selected,
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
            <p className="sp-kicker">Split expense</p>
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
              onClick={() => setMethod(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

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
              return (
                <div key={row.uid} className={`sp-row ${row.selected ? 'is-on' : ''}`}>
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
                    <p className="sp-email">{row.email}</p>
                  </div>
                  {row.selected && method === 'exact' ? (
                    <input
                      className="sp-input"
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={row.amountPaise ? row.amountPaise / 100 : ''}
                      onChange={(e) => setRows((curr) => curr.map((r) => r.uid === row.uid
                        ? { ...r, amountPaise: Math.round(Number(e.target.value || 0) * 100) }
                        : r))}
                    />
                  ) : null}
                  {row.selected && method === 'percentage' ? (
                    <div className="sp-inline-edit">
                      <input
                        className="sp-input sp-input-sm"
                        type="number"
                        value={row.percent}
                        onChange={(e) => setRows((curr) => curr.map((r) => r.uid === row.uid
                          ? { ...r, percent: Number(e.target.value || 0) }
                          : r))}
                      />
                      <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                    </div>
                  ) : null}
                  {row.selected && method === 'shares' ? (
                    <div className="sp-inline-edit">
                      <input
                        className="sp-input sp-input-sm"
                        type="number"
                        value={row.share}
                        onChange={(e) => setRows((curr) => curr.map((r) => r.uid === row.uid
                          ? { ...r, share: Number(e.target.value || 0) }
                          : r))}
                      />
                      <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                    </div>
                  ) : null}
                  {row.selected && method === 'equal' ? (
                    <span className="sp-share">{formatPaise(liveAmt, currencySymbol)}</span>
                  ) : null}
                  {!row.selected ? <span className="sp-share is-mute">—</span> : null}
                </div>
              );
            })
          )}
        </div>

        {!preview.ok && selected.length > 0 ? (
          <p className="sp-error">{preview.error}</p>
        ) : null}

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
            {busy ? 'Saving…' : 'Save split'}
          </button>
        </div>
      </div>
    </div>
  );
}
