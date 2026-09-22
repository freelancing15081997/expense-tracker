import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  Download,
  Minus,
  Repeat,
  Search,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';
import {
  filterExpenses,
  percentDelta,
  periodBounds,
  previousPeriodBounds,
  summarizeExpenses,
  budgetPerformance,
  recurringSummary,
  whereDidMoneyGo,
  whatIfReduceCategory,
  type ReportPeriod,
} from '../../lib/money-reports';
import { runNaturalLanguageSearch, detectAnomalies, detectCommitments } from '../../lib/money-intelligence';
import { formatIndianAmount } from '../../lib/bridge-automations';
import { getCurrencySymbol } from '../../lib/currency';
import { downloadText, toLedgerCsv } from '../../lib/ledger-advanced';
import { toUserMessage } from '../../lib/user-message';
import { Skel } from './MoneySkeletons';

export const REPORT_PERIODS: Array<{ key: ReportPeriod; label: string; long: string }> = [
  { key: 'week', label: 'Week', long: 'Last 7 days' },
  { key: 'month', label: 'Month', long: 'This month' },
  { key: 'quarter', label: '3 months', long: 'Last 3 months' },
  { key: 'year', label: 'Year', long: 'This year' },
  { key: 'custom', label: 'Dates', long: 'Your dates' },
];

function localIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CAT_TONES = ['#0B1F3A', '#3654FF', '#12B8A8', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'];

export function humanDay(day: string) {
  if (!day) return '';
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function DeltaPill({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="rp-delta is-flat"><Minus className="w-3 h-3" /> nothing to compare</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  if (value === 0) return <span className="rp-delta is-flat"><Minus className="w-3 h-3" /> same as last time</span>;
  return (
    <span className={`rp-delta ${good ? 'is-good' : 'is-bad'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}% vs last time
    </span>
  );
}

/** Count-up for money values; respects reduced motion. */
function useCountUp(value: number, ms = 420) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Dual-series area chart (money out vs in) — pure SVG, no runtime deps. */
function FlowChart({ points, currency, from, to }: { points: Array<{ date: string; out: number; in: number }>; currency: string; from: string; to: string }) {
  const [active, setActive] = useState<number | null>(null);
  const series = useMemo(() => {
    if (!from || !to) return points;
    const map = new Map(points.map((p) => [p.date, p]));
    const out: Array<{ date: string; out: number; in: number }> = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    let guard = 0;
    while (cursor <= end && guard < 400) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      out.push(map.get(key) || { date: key, out: 0, in: 0 });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return out;
  }, [points, from, to]);

  const W = 640;
  const H = 180;
  const padX = 8;
  const padTop = 14;
  const padBottom = 26;
  const max = Math.max(...series.map((p) => Math.max(p.out, p.in)), 1);
  const n = series.length;
  const x = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const path = (key: 'out' | 'in') => series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const area = (key: 'out' | 'in') => `${path(key)} L${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} Z`;
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const hover = active !== null ? series[active] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - padX) / (W - padX * 2)) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, idx)));
  };

  return (
    <div className="rp-chart" data-testid="reports-chart">
      <div className="rp-chart-legend">
        <span><i className="is-out" /> Money out</span>
        <span><i className="is-in" /> Money in</span>
        <span className="rp-chart-hover">
          {hover ? `${humanDay(hover.date)} · out ${currency}${Math.round(hover.out).toLocaleString('en-IN')} · in ${currency}${Math.round(hover.in).toLocaleString('en-IN')}` : `${humanDay(series[0]?.date)} – ${humanDay(series[n - 1]?.date)}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Money in and out over time" onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
        <defs>
          <linearGradient id="rp-out-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rp-in-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12B8A8" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#12B8A8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padX} x2={W - padX} y1={y(max * f)} y2={y(max * f)} className="rp-grid" />
        ))}
        {n > 1 ? (
          <g className="rp-chart-enter">
            <path d={area('in')} fill="url(#rp-in-fill)" />
            <path d={area('out')} fill="url(#rp-out-fill)" />
            <path d={path('in')} className="rp-line is-in" />
            <path d={path('out')} className="rp-line is-out" />
          </g>
        ) : null}
        {hover && active !== null ? (
          <>
            <line x1={x(active)} x2={x(active)} y1={padTop} y2={H - padBottom} className="rp-cursor" />
            <circle cx={x(active)} cy={y(hover.out)} r="4" className="rp-dot is-out" />
            <circle cx={x(active)} cy={y(hover.in)} r="4" className="rp-dot is-in" />
          </>
        ) : null}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 8} className="rp-tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {humanDay(series[i]?.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Donut({ rows, total, currency }: { rows: Array<{ name: string; amount: number }>; total: number; currency: string }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="rp-donut-wrap">
      <svg viewBox="0 0 100 100" className="rp-donut" role="img" aria-label="Spend by category">
        <circle cx="50" cy="50" r={R} className="rp-donut-track" />
        {rows.map((row, i) => {
          const frac = total > 0 ? row.amount / total : 0;
          const len = frac * C;
          const el = (
            <circle key={row.name} cx="50" cy="50" r={R} className="rp-donut-seg" stroke={CAT_TONES[i % CAT_TONES.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="rp-donut-center">
        <span className="rp-donut-label">Spent</span>
        <strong className="byjan-money">{formatIndianAmount(total, currency)}</strong>
      </div>
    </div>
  );
}

export function ReportsSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? 'rp-page rp-embedded' : 'dash-shell ios-page web-page max-w-5xl lg:max-w-6xl mx-auto rp-page'} aria-busy="true" aria-label="Loading summary">
      {!embedded ? <div className="rp-head"><Skel className="h-9 w-9 rounded-xl" /><div className="space-y-2"><Skel className="h-3 w-14" /><Skel className="h-6 w-44" /></div></div> : null}
      <Skel className="h-11 w-full rounded-2xl" />
      <Skel className="h-44 w-full rounded-3xl" />
      <div className="rp-kpis"><Skel className="h-20 rounded-2xl" /><Skel className="h-20 rounded-2xl" /><Skel className="h-20 rounded-2xl" /></div>
      <Skel className="h-56 w-full rounded-3xl" />
    </div>
  );
}

export type ReportsDashboardProps = {
  expenses: Array<Record<string, unknown>>;
  books: Array<Record<string, unknown>>;
  /** When set, the dashboard is locked to one book (Book → Summary tab). */
  fixedBookId?: string;
  /** Skip the header controls row (caller renders its own). */
  embedded?: boolean;
  /** Optional: open an entry from the search results. */
  onOpenEntry?: (id: string) => void;
  /** Extra cards rendered after the dashboard (e.g. book budget / export). */
  children?: React.ReactNode;
};

export default function ReportsDashboard({ expenses, books, fixedBookId, embedded = false, onOpenEntry, children }: ReportsDashboardProps) {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customFrom, setCustomFrom] = useState(() => {
    const start = new Date();
    start.setDate(1);
    return localIso(start);
  });
  const [customTo, setCustomTo] = useState(() => localIso());
  const [bookId, setBookId] = useState(fixedBookId || 'all');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [whatIfCat, setWhatIfCat] = useState('');
  const [whatIfPct, setWhatIfPct] = useState(20);
  const exportTimer = useRef<number | null>(null);

  useEffect(() => { if (fixedBookId) setBookId(fixedBookId); }, [fixedBookId]);
  useEffect(() => () => { if (exportTimer.current) window.clearTimeout(exportTimer.current); }, []);

  const bounds = useMemo(() => {
    if (period !== 'custom') return periodBounds(period);
    const from = customFrom || '';
    const to = customTo || localIso();
    if (from && to && from > to) return { from: to, to: from };
    return { from, to };
  }, [period, customFrom, customTo]);
  const prevBounds = useMemo(() => {
    if (period !== 'custom') return previousPeriodBounds(period);
    if (!bounds.from || !bounds.to) return { from: '', to: '' };
    const start = new Date(`${bounds.from}T00:00:00`);
    const end = new Date(`${bounds.to}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - (days - 1));
    return { from: localIso(prevStart), to: localIso(prevEnd) };
  }, [period, bounds]);
  // In a fixed-book context the rows may not carry bookId — don't filter them out.
  const bookIds = fixedBookId || bookId === 'all' ? undefined : [bookId];
  const filtered = useMemo(() => filterExpenses(expenses, { ...bounds, bookIds }), [expenses, bounds, bookId, fixedBookId]);
  const previous = useMemo(() => filterExpenses(expenses, { ...prevBounds, bookIds }), [expenses, prevBounds, bookId, fixedBookId]);
  const summary = useMemo(() => summarizeExpenses(filtered), [filtered]);
  const prevSummary = useMemo(() => summarizeExpenses(previous), [previous]);

  const selectedBook = books.find((b) => String(b.id) === bookId);
  const currency = getCurrencySymbol(String((selectedBook || books[0])?.currency || 'INR'));
  const monthlyBudget = Number((selectedBook || (books.length === 1 ? books[0] : undefined))?.monthlyBudget || 0);
  const budget = useMemo(
    () => (period === 'month' && monthlyBudget > 0 ? budgetPerformance(filtered, Math.round(monthlyBudget * 100)) : null),
    [filtered, monthlyBudget, period],
  );
  const recurring = useMemo(() => recurringSummary(filtered), [filtered]);
  const story = useMemo(() => whereDidMoneyGo(filtered), [filtered]);
  const anomalies = useMemo(() => detectAnomalies(filtered).slice(0, 5), [filtered]);
  const commitments = useMemo(() => detectCommitments(filtered).slice(0, 5), [filtered]);
  const nl = useMemo(() => (nlQuery.trim() ? runNaturalLanguageSearch(filtered, nlQuery) : null), [filtered, nlQuery]);
  const whatIfCategory = whatIfCat || summary.topCategories[0]?.name || 'Food';
  const whatIf = useMemo(() => whatIfReduceCategory(filtered, whatIfCategory, whatIfPct), [filtered, whatIfCategory, whatIfPct]);

  const outDelta = percentDelta(summary.moneyOut, prevSummary.moneyOut);
  const inDelta = percentDelta(summary.moneyIn, prevSummary.moneyIn);
  const netNeg = summary.net < 0;
  const periodMeta = REPORT_PERIODS.find((p) => p.key === period) || REPORT_PERIODS[1];
  const dayCount = useMemo(() => {
    if (!bounds.from || !bounds.to) return 1;
    return Math.max(1, Math.round((new Date(`${bounds.to}T00:00:00`).getTime() - new Date(`${bounds.from}T00:00:00`).getTime()) / 86400000) + 1);
  }, [bounds]);
  const dailyAvg = summary.moneyOut / dayCount;
  const categoryTotal = summary.topCategories.reduce((s, r) => s + r.amount, 0);
  const topCats = summary.topCategories.slice(0, 6);
  const netShown = useCountUp(Math.abs(summary.net));
  const outShown = useCountUp(summary.moneyOut);
  const inShown = useCountUp(summary.moneyIn);
  const empty = filtered.length === 0;

  const exportCsv = () => {
    if (exporting) return;
    setExporting(true);
    setExportNote('');
    try {
      const scope = !fixedBookId && bookId === 'all' ? 'all-books' : String(selectedBook?.name || books[0]?.name || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadText(`byjan-${scope}-${period}-${bounds.from || 'all'}-to-${bounds.to || 'now'}.csv`, toLedgerCsv(filtered), 'text/csv');
      setExportNote(filtered.length ? `Exported ${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'} · ${periodMeta.long.toLowerCase()}` : 'Nothing to export for this period.');
    } catch (err) {
      setExportNote(toUserMessage(err, 'Could not export. Try again.'));
    } finally {
      exportTimer.current = window.setTimeout(() => setExporting(false), 700);
    }
  };

  return (
    <div className={embedded ? 'rp-page rp-embedded' : 'rp-page'} data-testid="reports-page">
      <div className="rp-controls">
        <div className="rp-seg" role="tablist" aria-label="Period" data-testid="reports-period">
          {REPORT_PERIODS.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={period === p.key} data-on={period === p.key} data-period={p.key} className="rp-seg-btn" onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <div className="rp-dates">
            <label>
              From
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} data-testid="reports-from" />
            </label>
            <label>
              To
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} data-testid="reports-to" />
            </label>
          </div>
        ) : null}
        {!fixedBookId && books.length > 1 ? (
          <select className="rp-book-select" value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Book" data-testid="reports-book">
            <option value="all">All books</option>
            {books.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>{String(b.name || 'Book')}</option>
            ))}
          </select>
        ) : null}
        <button type="button" className="rp-export" data-testid="reports-export" disabled={exporting || empty} onClick={exportCsv} title="Download these entries as a spreadsheet">
          <Download className="w-3.5 h-3.5" /> {exporting ? 'Saving…' : 'Spreadsheet'}
        </button>
      </div>
      {exportNote ? <p className="rp-note" role="status" data-testid="reports-export-note">{exportNote}</p> : null}

      <section className={`rp-hero ${netNeg ? 'is-out' : 'is-in'}`} data-testid="reports-hero">
        <div className="rp-hero-top">
          <span className="rp-hero-kicker">{periodMeta.long} · {humanDay(bounds.from)} – {humanDay(bounds.to)}</span>
          <span className="rp-hero-scope">{fixedBookId ? String(books[0]?.name || 'This book') : bookId === 'all' ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : String(selectedBook?.name || 'Book')}</span>
        </div>
        <p className="rp-hero-label">{netNeg ? 'Spent more than came in' : 'Left over after spending'}</p>
        <p className="rp-hero-amount byjan-money" data-testid="reports-net">{netNeg ? '−' : ''}{formatIndianAmount(Math.round(netShown), currency)}</p>
        <p className="rp-hero-story" data-testid="reports-plain">
          {empty
            ? 'Nothing recorded in this period yet. Add an entry and this explains where the money went.'
            : `You paid ${formatIndianAmount(Math.round(summary.moneyOut), currency)}. You received ${formatIndianAmount(Math.round(summary.moneyIn), currency)}. ${netNeg ? 'More went out than came in.' : `You still have ${formatIndianAmount(Math.round(summary.net), currency)} left.`}`}
        </p>
        {!empty ? (
          <div className="rp-split" aria-hidden>
            <span className="is-out" style={{ flex: Math.max(summary.moneyOut, 1) }} />
            <span className="is-in" style={{ flex: Math.max(summary.moneyIn, 0.001) }} />
          </div>
        ) : null}
        {!empty && story.narrative ? <p className="rp-hero-story">{story.narrative}</p> : null}
        <div className="rp-hero-row">
          <div className="rp-hero-cell">
            <span className="rp-cell-label"><ArrowUpRight className="w-3.5 h-3.5" /> Money out</span>
            <strong className="byjan-money" data-testid="reports-out">{formatIndianAmount(Math.round(outShown), currency)}</strong>
            <DeltaPill value={outDelta} invert />
          </div>
          <div className="rp-hero-cell">
            <span className="rp-cell-label"><ArrowDownRight className="w-3.5 h-3.5" /> Money in</span>
            <strong className="byjan-money" data-testid="reports-in">{formatIndianAmount(Math.round(inShown), currency)}</strong>
            <DeltaPill value={inDelta} />
          </div>
        </div>
      </section>

      <div className="rp-kpis">
        <div className="rp-kpi">
          <span className="rp-kpi-icon tone-navy"><BarChart3 className="w-4 h-4" /></span>
          <span className="rp-kpi-label">Entries</span>
          <strong data-testid="reports-count">{summary.count}</strong>
        </div>
        <div className="rp-kpi">
          <span className="rp-kpi-icon tone-teal"><CalendarClock className="w-4 h-4" /></span>
          <span className="rp-kpi-label">Spent per day</span>
          <strong className="byjan-money">{formatIndianAmount(Math.round(dailyAvg), currency)}</strong>
        </div>
        <div className="rp-kpi">
          <span className="rp-kpi-icon tone-amber"><Wallet className="w-4 h-4" /></span>
          <span className="rp-kpi-label">Moved between accounts</span>
          <strong className="byjan-money">{formatIndianAmount(summary.transfers, currency)}</strong>
        </div>
      </div>

      {!empty ? (
        <section className="rp-card">
          <header className="rp-card-head"><div><p className="rp-kicker">Day by day</p><h2>Money in vs money out</h2></div></header>
          <FlowChart points={summary.trend} currency={currency} from={bounds.from} to={bounds.to} />
        </section>
      ) : null}

      {budget ? (
        <section className="rp-card rp-budget" data-testid="reports-budget">
          <header className="rp-card-head">
            <div><p className="rp-kicker">Monthly limit</p><h2>{budget.over ? 'Over your limit this month' : 'Within your limit this month'}</h2></div>
            <strong className={`byjan-money ${budget.over ? 'text-rose-600' : 'text-teal-700'}`}>{budget.over ? '−' : ''}{formatIndianAmount(Math.abs(budget.remaining), currency)} {budget.over ? 'over' : 'left'}</strong>
          </header>
          <div className="rp-budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((budget.monthSpent / Math.max(1, budget.monthlyBudget)) * 100))}>
            <span className={budget.over ? 'is-over' : ''} style={{ width: `${Math.min(100, (budget.monthSpent / Math.max(1, budget.monthlyBudget)) * 100)}%` }} />
          </div>
          <p className="rp-muted">Spent {formatIndianAmount(budget.monthSpent, currency)} of {formatIndianAmount(budget.monthlyBudget, currency)}</p>
        </section>
      ) : null}

      {topCats.length > 0 ? (
        <section className="rp-card" data-testid="reports-categories">
          <header className="rp-card-head"><div><p className="rp-kicker">Where it went</p><h2>By category</h2></div></header>
          <div className="rp-mix">
            <Donut rows={topCats} total={categoryTotal} currency={currency} />
            <ul className="rp-mix-list">
              {topCats.map((row, i) => {
                const share = categoryTotal > 0 ? Math.round((row.amount / categoryTotal) * 100) : 0;
                return (
                  <li key={row.name}>
                    <span className="rp-mix-swatch" style={{ background: CAT_TONES[i % CAT_TONES.length] }} />
                    <span className="rp-mix-name">{row.name}</span>
                    <span className="rp-mix-share">{share}%</span>
                    <span className="rp-mix-amt byjan-money">{formatIndianAmount(row.amount, currency)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {summary.topMerchants.length > 0 ? (
        <section className="rp-card">
          <header className="rp-card-head"><div><p className="rp-kicker">Who you paid</p><h2>Most paid to</h2></div></header>
          <ul className="rp-rank">
            {summary.topMerchants.slice(0, 6).map((row, i) => {
              const share = summary.moneyOut > 0 ? (row.amount / summary.moneyOut) * 100 : 0;
              return (
                <li key={row.name}>
                  <span className="rp-rank-idx">{i + 1}</span>
                  <span className="rp-rank-icon"><Store className="w-3.5 h-3.5" /></span>
                  <span className="rp-rank-body">
                    <span className="rp-rank-name">{row.name}</span>
                    <span className="rp-rank-bar"><i style={{ width: `${Math.max(3, Math.min(100, share))}%` }} /></span>
                  </span>
                  <span className="rp-rank-amt byjan-money">{formatIndianAmount(row.amount, currency)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!empty ? (
        <section className="rp-card">
          <header className="rp-card-head"><div><p className="rp-kicker">Look up</p><h2>Find an entry</h2></div></header>
          <label className="rp-search">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="search" value={nlQuery} onChange={(e) => setNlQuery(e.target.value)} placeholder='Try "Food last month" or "above 5000"' data-testid="reports-search" />
          </label>
          {nl ? (
            nl.expenses.length ? (
              <ul className="rp-results" data-testid="reports-results">
                {nl.expenses.slice(0, 8).map((exp) => {
                  const inner = (
                    <>
                      <span className="min-w-0 truncate">{String(exp.description || exp.merchant || 'Entry')}</span>
                      <span className="rp-muted shrink-0">{humanDay(String(exp.date || '').slice(0, 10))}</span>
                      <span className="byjan-money shrink-0">{currency}{Number(exp.amount || 0).toLocaleString('en-IN')}</span>
                    </>
                  );
                  const id = String(exp.id);
                  if (onOpenEntry) return <li key={id}><button type="button" className="rp-result-btn" onClick={() => onOpenEntry(id)}>{inner}</button></li>;
                  const href = exp.bookId ? `/book/${String(exp.bookId)}?entry=${encodeURIComponent(id)}` : undefined;
                  return <li key={id}>{href ? <Link to={href} className="rp-result-btn">{inner}</Link> : inner}</li>;
                })}
              </ul>
            ) : <p className="rp-muted mt-2">No entries match that in this period.</p>
          ) : null}
        </section>
      ) : null}

      {(recurring.length > 0 || commitments.length > 0) ? (
        <section className="rp-card">
          <header className="rp-card-head">
            <div><p className="rp-kicker">Repeating</p><h2>Bills & regular payments</h2></div>
            <Link to="/regular-payments" className="rp-link">See all</Link>
          </header>
          <ul className="rp-list">
            {recurring.slice(0, 5).map((row) => (
              <li key={`r-${row.description}`}>
                <span className="rp-list-icon"><Repeat className="w-3.5 h-3.5" /></span>
                <span className="rp-list-body"><span className="rp-list-name">{row.description || 'Repeating payment'}</span><span className="rp-muted">{row.count} times · last {humanDay(row.lastDate)}</span></span>
                <span className="byjan-money">~{currency}{row.monthlyEstimate.toLocaleString('en-IN')}<small>/mo</small></span>
              </li>
            ))}
            {commitments.slice(0, 5).map((row) => (
              <li key={`c-${row.id}`}>
                <span className="rp-list-icon is-teal"><CalendarClock className="w-3.5 h-3.5" /></span>
                <span className="rp-list-body"><span className="rp-list-name">{row.label}</span><span className="rp-muted">{row.cadence}</span></span>
                <span className="byjan-money">{currency}{row.amount.toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {anomalies.length > 0 ? (
        <section className="rp-card">
          <header className="rp-card-head"><div><p className="rp-kicker">Worth a look</p><h2>Unusual spends</h2></div></header>
          <ul className="rp-alerts">
            {anomalies.map((row) => (
              <li key={`${row.id}-${row.kind}`}><Bell className="w-3.5 h-3.5" /> {row.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!empty ? (
        <section className="rp-card rp-whatif">
          <header className="rp-card-head">
            <div><p className="rp-kicker">Try it</p><h2>If you spent less on…</h2></div>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </header>
          <div className="rp-whatif-row">
            <select className="rp-book-select" value={whatIfCategory} onChange={(e) => setWhatIfCat(e.target.value)} aria-label="Category">
              {(summary.topCategories.length ? summary.topCategories : [{ name: whatIfCategory, amount: 0, paise: 0 }]).map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <div className="rp-whatif-pct">
              <input type="range" min={5} max={80} step={5} value={whatIfPct} onChange={(e) => setWhatIfPct(Number(e.target.value))} aria-label="Reduce by percent" />
              <span>{whatIfPct}%</span>
            </div>
          </div>
          <p className="rp-whatif-out">You would keep about <strong className="byjan-money">{currency}{whatIf.projectedSaving.toLocaleString('en-IN')}</strong> more each month</p>
          <p className="rp-muted">Based on what you spent on this category this month.</p>
        </section>
      ) : null}

      {children}
    </div>
  );
}
