import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2 } from 'lucide-react';
import { listAllExpenses } from '../lib/expenses';
import { detectCommitments, detectAnomalies } from '../lib/money-intelligence';
import { detectRegularPayments } from '../lib/recurrence-engine';
import { formatIndianAmount } from '../lib/bridge-automations';
import { getCurrencySymbol } from '../lib/currency';
import AppLoader from '../components/AppLoader';

type ExpenseRow = Record<string, unknown>;

export default function RegularPayments() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [currency, setCurrency] = useState('INR');

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const data = await listAllExpenses();
        if (!alive) return;
        setExpenses(data.expenses || []);
        setCurrency(String(data.books?.[0]?.currency || 'INR'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => expenses, [expenses]);
  const patterns = useMemo(() => detectRegularPayments(rows.map((e) => ({
    id: String(e.id),
    amount: Number(e.amount || 0),
    date: String(e.date || ''),
    merchant: String(e.merchant || ''),
    description: String(e.description || ''),
    category: String(e.category || ''),
    entryType: String(e.entryType || 'out'),
    paymentMethod: String(e.paymentMethod || ''),
  }))).filter((p) => p.band !== 'NOT_RECURRING'), [rows]);
  const commitments = useMemo(() => detectCommitments(rows), [rows]);
  const anomalies = useMemo(() => detectAnomalies(rows).slice(0, 5), [rows]);
  const sym = getCurrencySymbol(currency);

  if (loading) return <AppLoader title="Regular payments" message="Looking for patterns in your books." />;

  return (
    <div className="dash-shell ios-page max-w-xl mx-auto pb-28 md:pb-8">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/" className="p-2 -ml-2 rounded-xl text-slate-500" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Autopilot</p>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Regular payments</h1>
        </div>
      </div>
      <p className="text-[13px] text-slate-500 mb-4">
        Detected from your history — confirm before treating anything as fixed.
      </p>

      {patterns.length === 0 && commitments.length === 0 ? (
        <div className="fin-inbox-empty mt-8">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
          <strong>No recurring patterns yet</strong>
          Keep adding entries — Byjan learns after a few repeats.
        </div>
      ) : null}

      {commitments.length > 0 ? (
        <section className="mb-5">
          <h2 className="dash-section-label"><CalendarClock className="w-3.5 h-3.5" /> Upcoming</h2>
          <div className="space-y-2 mt-2">
            {commitments.map((c) => (
              <article key={c.id} className="activity-card">
                <p className="font-semibold text-[#0B1F3A] truncate">{c.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatIndianAmount(c.amount, sym)} · {c.cadence} · next {c.nextEstimate || '—'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Predicted — payment not confirmed until you mark it.</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {patterns.length > 0 ? (
        <section className="mb-5">
          <h2 className="dash-section-label">Detected patterns</h2>
          <div className="space-y-2 mt-2">
            {patterns.slice(0, 20).map((p) => (
              <article key={p.id} className="activity-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0B1F3A] truncate">{p.merchant || 'Merchant'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.frequency} · {p.occurrences} times · confidence {p.band}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#0B1F3A] shrink-0">{formatIndianAmount(p.avgAmount, sym)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {anomalies.length > 0 ? (
        <section>
          <h2 className="dash-section-label">Unusual activity</h2>
          <div className="space-y-2 mt-2">
            {anomalies.map((a) => (
              <article key={`${a.id}-${a.kind}`} className="activity-card">
                <p className="text-sm text-[#0B1F3A]">{a.message}</p>
                <p className="text-[11px] text-slate-400 mt-1 capitalize">{a.severity} · {a.kind}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
