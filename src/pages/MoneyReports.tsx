import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Search, TrendingDown, TrendingUp, Wallet, ArrowLeft } from 'lucide-react';
import { listAllExpenses } from '../lib/expenses';
import {
  filterExpenses,
  periodBounds,
  summarizeExpenses,
  budgetPerformance,
  recurringSummary,
  whereDidMoneyGo,
  whatIfReduceCategory,
  type ReportPeriod,
} from '../lib/money-reports';
import { runNaturalLanguageSearch } from '../lib/money-intelligence';
import { detectAnomalies, detectCommitments } from '../lib/money-intelligence';
import { formatIndianAmount } from '../lib/bridge-automations';
import { getCurrencySymbol } from '../lib/currency';
import { downloadText, toLedgerCsv } from '../lib/ledger-advanced';
import AppLoader from '../components/AppLoader';
import { toUserMessage } from '../lib/user-message';

function TrendBars({ points, currency }: { points: Array<{ date: string; out: number; in: number }>; currency: string }) {
  const max = Math.max(...points.map((p) => Math.max(p.out, p.in)), 1);
  if (!points.length) return null;
  return (
    <div className="flex items-end gap-1 h-24 mt-3" role="img" aria-label="Spend trend">
      {points.slice(-14).map((p) => (
        <div key={p.date} className="flex-1 flex flex-col justify-end gap-0.5 min-w-0" title={`${p.date} · out ${currency}${Math.round(p.out)}`}>
          <span className="block w-full rounded-sm bg-rose-400/80" style={{ height: `${Math.max(4, (p.out / max) * 88)}px` }} />
        </div>
      ))}
    </div>
  );
}

export default function MoneyReports() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [expenses, setExpenses] = useState<Array<Record<string, unknown>>>([]);
  const [books, setBooks] = useState<Array<Record<string, unknown>>>([]);
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [bookId, setBookId] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [whatIfCat, setWhatIfCat] = useState('Food');
  const [whatIfPct, setWhatIfPct] = useState(20);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await listAllExpenses();
        setExpenses(data.expenses);
        setBooks(data.books);
      } catch (err) {
        setLoadError(toUserMessage(err, 'Could not load reports. Please try again.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadTick]);

  const bounds = periodBounds(period);
  const bookIds = bookId === 'all' ? undefined : [bookId];
  const filtered = useMemo(() => filterExpenses(expenses, { ...bounds, bookIds }), [expenses, bounds.from, bounds.to, bookId]);
  const summary = useMemo(() => summarizeExpenses(filtered), [filtered]);
  const currency = getCurrencySymbol(String(books[0]?.currency || 'INR'));
  const monthlyBudget = Number((books.find((b) => String(b.id) === bookId) || books[0])?.monthlyBudget || 0);
  const budget = useMemo(
    () => (period === 'month' ? budgetPerformance(filtered, Math.round(monthlyBudget * 100)) : null),
    [filtered, monthlyBudget, period],
  );
  const recurring = useMemo(() => recurringSummary(filtered), [filtered]);
  const story = useMemo(() => whereDidMoneyGo(filtered), [filtered]);
  const anomalies = useMemo(() => detectAnomalies(filtered).slice(0, 6), [filtered]);
  const commitments = useMemo(() => detectCommitments(filtered).slice(0, 6), [filtered]);
  const nl = useMemo(() => (nlQuery.trim() ? runNaturalLanguageSearch(filtered, nlQuery) : null), [filtered, nlQuery]);
  const whatIf = useMemo(() => whatIfReduceCategory(filtered, whatIfCat, whatIfPct), [filtered, whatIfCat, whatIfPct]);

  if (loading) return <AppLoader title="Reports" message="Building your spending picture." />;

  if (loadError) {
    return (
      <div className="dash-shell ios-page web-page max-w-5xl lg:max-w-6xl mx-auto">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Money</p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Reports & insights</h1>
        <p className="text-[13px] text-slate-500 mt-3 mb-4">{loadError}</p>
        <button type="button" className="byjan-btn-ghost !h-9 text-xs" onClick={() => setReloadTick((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="dash-shell ios-page web-page max-w-5xl lg:max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/expenses" className="p-2 -ml-2 rounded-xl text-slate-500" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Money</p>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Reports & insights</h1>
        </div>
      </div>
      <p className="text-[13px] text-slate-500 mb-4">{story.narrative}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {(['week', 'month', 'quarter', 'year'] as ReportPeriod[]).map((p) => (
          <button key={p} type="button" className="byjan-chip" data-on={period === p} onClick={() => setPeriod(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className="byjan-btn-ghost !h-9 ml-auto text-xs"
          disabled={exporting}
          onClick={() => {
            if (exporting) return;
            setExporting(true);
            setExportNote('');
            try {
              downloadText(`byjan-report-${period}-${bounds.from || 'all'}.csv`, toLedgerCsv(filtered), 'text/csv');
              setExportNote(`Exported ${filtered.length} ${filtered.length === 1 ? 'row' : 'rows'} for ${period}.`);
            } catch {
              setExportNote('Could not export. Try again.');
            } finally {
              window.setTimeout(() => setExporting(false), 800);
            }
          }}
        >
          <Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {books.length > 1 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="byjan-chip" data-on={bookId === 'all'} onClick={() => setBookId('all')}>All books</button>
          {books.slice(0, 8).map((b) => (
            <button key={String(b.id)} type="button" className="byjan-chip" data-on={bookId === String(b.id)} onClick={() => setBookId(String(b.id))}>
              {String(b.name || 'Book')}
            </button>
          ))}
        </div>
      ) : null}
      {exportNote ? <p className="text-[12px] text-slate-500 mb-3">{exportNote}</p> : null}

      <section className="md3-panel mb-4">
        <div className="md3-panel-head">
          <div>
            <p className="md3-kicker">Overview</p>
            <h2>Period snapshot</h2>
          </div>
        </div>
        <div className="md3-stats">
          {[
            { label: 'Money out', value: formatIndianAmount(summary.moneyOut, currency), tone: 'out', Icon: TrendingDown },
            { label: 'Money in', value: formatIndianAmount(summary.moneyIn, currency), tone: 'in', Icon: TrendingUp },
            { label: 'Net', value: formatIndianAmount(summary.net, currency), tone: 'idle', Icon: Wallet },
            { label: 'Entries', value: String(summary.count), tone: 'warn', Icon: BarChart3 },
          ].map((item) => (
            <div key={item.label} className={`md3-stat tone-${item.tone}`}>
              <span className="md3-stat-icon" aria-hidden>
                <item.Icon className="w-4 h-4" />
              </span>
              <span className="md3-stat-label">{item.label}</span>
              <strong className="md3-stat-value byjan-money">{item.value}</strong>
            </div>
          ))}
        </div>
        {summary.trend.length > 1 ? <TrendBars points={summary.trend} currency={currency} /> : null}
      </section>

      {summary.topCategories.length > 0 && (
        <section className="access-card p-4 mb-4">
          <p className="ios-section-label !px-0">Category mix</p>
          <div className="space-y-2 mt-2">
            {summary.topCategories.slice(0, 6).map((row) => {
              const share = summary.moneyOut > 0 ? Math.round((row.amount / summary.moneyOut) * 100) : 0;
              return (
                <div key={row.name}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span>{row.name}</span>
                    <span className="byjan-money">{formatIndianAmount(row.amount, currency)}</span>
                  </div>
                  <span className="mt-1 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full bg-[#3654FF]" style={{ width: `${Math.min(100, share)}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <label className="access-search mb-4 block">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={nlQuery}
          onChange={(e) => setNlQuery(e.target.value)}
          placeholder='Try "Food spending last month" or "Above ₹5000"'
        />
      </label>

      {nl && nl.expenses.length > 0 && (
        <section className="mb-4">
          <p className="dash-section-label">Search results ({nl.expenses.length})</p>
          <div className="ios-group divide-y divide-slate-100">
            {nl.expenses.slice(0, 8).map((exp) => (
              <div key={String(exp.id)} className="px-4 py-3 flex justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{String(exp.description || exp.merchant)}</span>
                <span className="byjan-money shrink-0">{currency}{Number(exp.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <section className="access-card p-4">
          <p className="ios-section-label !px-0">Top categories</p>
          <div className="space-y-2 mt-2">
            {summary.topCategories.map((row) => (
              <div key={row.name} className="flex items-center justify-between text-[13px]">
                <span>{row.name}</span>
                <span className="byjan-money">{formatIndianAmount(row.amount, currency)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="access-card p-4">
          <p className="ios-section-label !px-0">Top merchants</p>
          <div className="space-y-2 mt-2">
            {summary.topMerchants.map((row) => (
              <div key={row.name} className="flex items-center justify-between text-[13px]">
                <span className="truncate">{row.name}</span>
                <span className="byjan-money shrink-0">{formatIndianAmount(row.amount, currency)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {period === 'month' && monthlyBudget > 0 && budget && (
        <section className="access-card p-4 mb-4">
          <p className="ios-section-label !px-0">Budget this month</p>
          <p className="text-[13px] text-slate-600 mt-1">
            Spent {formatIndianAmount(budget.monthSpent, currency)} of {formatIndianAmount(budget.monthlyBudget, currency)}
            {budget.over ? ' — over budget' : ` — ${formatIndianAmount(budget.remaining, currency)} left`}
          </p>
        </section>
      )}

      {recurring.length > 0 && (
        <section className="access-card p-4 mb-4">
          <p className="ios-section-label !px-0">Recurring & subscriptions</p>
          <div className="space-y-2 mt-2">
            {recurring.map((row) => (
              <div key={row.description} className="flex justify-between text-[13px]">
                <span>{row.description}</span>
                <span className="byjan-money">~{currency}{row.monthlyEstimate.toLocaleString()}/mo</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {commitments.length > 0 && (
        <section className="access-card p-4 mb-4">
          <p className="ios-section-label !px-0">Commitment radar</p>
          <div className="space-y-2 mt-2">
            {commitments.map((row) => (
              <div key={row.id} className="text-[13px] flex justify-between gap-2">
                <span>{row.label} <span className="text-slate-400">({row.cadence})</span></span>
                <span className="byjan-money shrink-0">{currency}{row.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {anomalies.length > 0 && (
        <section className="access-card p-4 mb-4">
          <p className="ios-section-label !px-0">Spending alerts</p>
          <div className="space-y-2 mt-2">
            {anomalies.map((row) => (
              <div key={`${row.id}-${row.kind}`} className="text-[13px] text-slate-600">· {row.message}</div>
            ))}
          </div>
        </section>
      )}

      <section className="access-card p-4">
        <p className="ios-section-label !px-0">What-if · reduce category spend</p>
        <div className="flex flex-wrap gap-2 mt-2 items-end">
          <input className="byjan-input !h-10 !w-32" value={whatIfCat} onChange={(e) => setWhatIfCat(e.target.value)} />
          <input type="number" className="byjan-input !h-10 !w-20" value={whatIfPct} onChange={(e) => setWhatIfPct(Number(e.target.value))} />
          <span className="text-[13px] text-slate-500">% less → save ~{currency}{whatIf.projectedSaving.toLocaleString()}/mo</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">{whatIf.note}</p>
      </section>
    </div>
  );
}
