import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Split, X, Receipt } from 'lucide-react';

export type SplitPickEntry = {
  id: string;
  amount: number;
  merchant?: string;
  description?: string;
  date?: string;
  alreadySplit?: boolean;
};

type Props = {
  open: boolean;
  currencySymbol?: string;
  bookName?: string;
  entries: SplitPickEntry[];
  onPick: (entry: SplitPickEntry) => void;
  onClose: () => void;
  onViewSettlements?: () => void;
};

function money(n: number, sym: string) {
  const v = Number(n || 0);
  return `${sym}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Premium entry picker after home Split → book pick.
 * User chooses which expense to split (or opens settlements).
 */
export default function SplitEntryPickSheet({
  open,
  currencySymbol = '₹',
  bookName,
  entries,
  onPick,
  onClose,
  onViewSettlements,
}: Props) {
  const list = useMemo(
    () => entries.filter((e) => Number(e.amount || 0) > 0),
    [entries],
  );

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="ios-sheet-dim split-pick-dim" onClick={onClose} />
      <div className="split-pick-sheet" role="dialog" aria-modal="true" aria-label="Choose expense to split">
        <div className="ios-notify-handle" aria-hidden />
        <div className="split-pick-head">
          <div className="min-w-0">
            <p className="split-pick-kicker">Split expense</p>
            <h2 className="split-pick-title">Which entry?</h2>
            <p className="split-pick-sub">
              {bookName
                ? `Pick an outgoing expense in ${bookName}, then set shares.`
                : 'Pick an outgoing expense, then set shares with your team.'}
            </p>
          </div>
          <button type="button" className="ios-notify-close" aria-label="Close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="split-pick-list">
          {list.length === 0 ? (
            <div className="split-pick-empty">
              <Receipt className="w-5 h-5 opacity-50" />
              <p>No outgoing expenses to split yet.</p>
              <p className="split-pick-empty-hint">Add an expense first, then come back to Split.</p>
            </div>
          ) : (
            list.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`split-pick-row${entry.alreadySplit ? ' is-done' : ''}`}
                onClick={() => onPick(entry)}
              >
                <span className="split-pick-icon" aria-hidden>
                  <Split className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="split-pick-name">
                    {entry.merchant || entry.description || 'Expense'}
                  </span>
                  <span className="split-pick-meta">
                    {entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    {entry.alreadySplit ? ' · already split' : ''}
                  </span>
                </span>
                <span className="split-pick-amt">{money(entry.amount, currencySymbol)}</span>
              </button>
            ))
          )}
        </div>

        {onViewSettlements ? (
          <button type="button" className="split-pick-secondary" onClick={onViewSettlements}>
            View settlements &amp; pay
          </button>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
