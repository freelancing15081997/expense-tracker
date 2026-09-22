import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { listAllExpenses } from '../lib/expenses';
import { toUserMessage } from '../lib/user-message';
import ReportsDashboard, { ReportsSkeleton } from '../components/money/ReportsDashboard';

export default function MoneyReports() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [expenses, setExpenses] = useState<Array<Record<string, unknown>>>([]);
  const [books, setBooks] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await listAllExpenses();
        if (cancelled) return;
        setExpenses(data.expenses);
        setBooks(data.books);
      } catch (err) {
        if (!cancelled) setLoadError(toUserMessage(err, 'Could not load your summary. Please try again.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  if (loading) return <ReportsSkeleton />;

  const head = (
    <div className="rp-head">
      <Link to="/expenses" className="rp-back" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
      <div className="min-w-0 flex-1">
        <p className="rp-kicker">Money</p>
        <h1 className="rp-title">Summary</h1>
      </div>
    </div>
  );

  if (loadError) {
    return (
      <div className="dash-shell ios-page web-page max-w-5xl lg:max-w-6xl mx-auto rp-page">
        {head}
        <div className="rp-card rp-empty">
          <p>{loadError}</p>
          <button type="button" className="byjan-btn !h-10 text-xs" onClick={() => setReloadTick((n) => n + 1)}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-shell ios-page web-page max-w-5xl lg:max-w-6xl mx-auto rp-page">
      {head}
      <ReportsDashboard expenses={expenses} books={books} />
    </div>
  );
}
