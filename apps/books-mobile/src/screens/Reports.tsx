import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { listBooks, type Book } from '../lib/books';
import { reportSummary, type ReportSummary } from '../lib/money';
import { apiPost } from '../lib/api';
import { useSession } from '../lib/session';
import { inr, inrPaise, todayIso } from '../lib/format';
import { AppBar, Empty, ListSkeleton, Seg, useToast } from '../ui';
import { Press, CountUp, Stagger, Item, motion } from '../motion';

export function BarList({ title, rows }: { title: string; rows: Array<{ label: string; paise: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.paise));
  const sorted = rows.slice().sort((a, b) => b.paise - a.paise).slice(0, 8);
  return (
    <div className="card card-pad">
      <p style={{ font: '600 15px var(--font)', marginBottom: 12 }}>{title}</p>
      <div className="stack" style={{ gap: 10 }}>
        {sorted.map((r, i) => (
          <div key={r.label}>
            <div className="row" style={{ font: '500 13.5px var(--font)' }}><span className="grow ellipsis">{r.label}</span><span className="mono">{inrPaise(r.paise)}</span></div>
            <div className="meter" style={{ marginTop: 5 }}><motion.div initial={{ width: 0 }} animate={{ width: `${(r.paise / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }} style={{ background: i === 0 ? 'var(--teal-700)' : 'var(--teal)' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthBars({ rows }: { rows: ReportSummary['byMonth'] }) {
  const last = rows.slice(-6);
  const max = Math.max(1, ...last.map((r) => Math.max(r.outPaise, r.inPaise)));
  return (
    <div className="card card-pad">
      <p style={{ font: '600 15px var(--font)' }}>Last 6 months</p>
      <div className="row" style={{ alignItems: 'flex-end', height: 140, gap: 10, marginTop: 14, borderBottom: '1px solid var(--ink)' }}>
        {last.map((r, i) => (
          <div key={r.month} className="grow row" style={{ alignItems: 'flex-end', gap: 3, height: '100%' }}>
            <motion.div title={`Out ${inrPaise(r.outPaise)}`} initial={{ height: 0 }} animate={{ height: `${(r.outPaise / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.06 }} style={{ flex: 1, background: 'var(--ink)', borderRadius: '3px 3px 0 0' }} />
            <motion.div title={`In ${inrPaise(r.inPaise)}`} initial={{ height: 0 }} animate={{ height: `${(r.inPaise / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.06 + 0.03 }} style={{ flex: 1, background: 'var(--teal)', borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 10, marginTop: 6 }}>{last.map((r) => <span key={r.month} className="grow hint" style={{ fontSize: 11 }}>{new Date(r.month + '-01').toLocaleString('en-IN', { month: 'short' })}</span>)}</div>
      <div className="row hint" style={{ marginTop: 8, gap: 14 }}><span className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, background: 'var(--ink)', borderRadius: 2 }} />Out</span><span className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, background: 'var(--teal)', borderRadius: 2 }} />In</span></div>
    </div>
  );
}

export default function Reports() {
  const s = useSession(); const toast = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [pick, setPick] = useState<string>('all');
  const [range, setRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [r, setR] = useState<ReportSummary | null | undefined>(undefined);
  const [insight, setInsight] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void listBooks().then(setBooks).catch(() => undefined); }, []);
  const { from, to } = useMemo(() => {
    const d = new Date(); const t = todayIso();
    if (range === 'month') return { from: `${t.slice(0, 7)}-01`, to: t };
    if (range === 'quarter') { d.setMonth(d.getMonth() - 2); return { from: `${d.toISOString().slice(0, 7)}-01`, to: t }; }
    return { from: `${d.getFullYear()}-01-01`, to: t };
  }, [range]);
  useEffect(() => {
    if (!books.length) { setR(null); return; }
    setR(undefined);
    void reportSummary(pick === 'all' ? books.map((b) => b.id) : [pick], from, to).then(setR).catch(() => setR(null));
  }, [books, pick, from, to]);

  if (!s.can('money_reports')) return <div className="screen"><AppBar title="Reports" rule /><Empty title="Reports are turned off for your account" body="Ask the Byjan owner to enable Money reports." /></div>;

  return (
    <div className="screen">
      <AppBar title="Reports" rule />
      <div className="stack" style={{ padding: 16 }}>
        <Seg id="range" value={range} onChange={setRange} options={[{ value: 'month', label: 'This month' }, { value: 'quarter', label: '3 months' }, { value: 'year', label: 'This year' }]} />
        <div className="chips">{[{ id: 'all', name: 'All books' }, ...books].map((b) => <button key={b.id} className={`chip ${pick === b.id ? 'on' : ''}`} onClick={() => setPick(b.id)}>{b.name}</button>)}</div>
        {r === undefined ? <ListSkeleton rows={4} /> : !r || !r.count ? <Empty title="No entries in this period" /> : (
          <Stagger className="stack">
            <Item className="cells" style={{ margin: '0 -16px' }}>
              <div><p className="cell-label">Spent</p><p className="cell-value"><CountUp value={r.outPaise / 100} format={(n) => inr(n)} /></p></div>
              <div><p className="cell-label">Received</p><p className="cell-value amt-in"><CountUp value={r.inPaise / 100} format={(n) => inr(n)} /></p></div>
              <div><p className="cell-label">Entries</p><p className="cell-value"><CountUp value={r.count} /></p></div>
              <div><p className="cell-label">Avg / day</p><p className="cell-value">{inr(r.outPaise / 100 / Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / 864e5) + 1))}</p></div>
            </Item>
            {s.can('money_ai_insights') && (
              <Item>
                {insight ? (
                  <div className="card card-pad stack" style={{ gap: 8, background: 'var(--teal-25)', borderColor: '#9ED6C4' }}>
                    <p className="row" style={{ font: '600 15px var(--font)', gap: 6 }}><Sparkles size={16} color="var(--teal-700)" />What stands out</p>
                    {insight.map((x, i) => <motion.p key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} style={{ fontSize: 14.5 }}>{x}</motion.p>)}
                  </div>
                ) : (
                  <Press className="btn btn-secondary btn-block" disabled={busy} onClick={async () => {
                    if (!s.guard('ai_insights')) return;
                    setBusy(true);
                    try { const x = await apiPost<{ insights?: string[] }>('/api/money', { op: 'insights', bookIds: pick === 'all' ? books.map((b) => b.id) : [pick], from, to }); setInsight(x.insights || []); s.bump('ai_insights'); }
                    catch (e) { if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
                  }}><Sparkles size={16} />{busy ? 'Looking at your spending…' : 'Explain my spending'}<span className="hint btn-trail">{s.remaining('ai_insights') === Infinity ? '' : `${s.remaining('ai_insights')} left`}</span></Press>
                )}
              </Item>
            )}
            <Item><MonthBars rows={r.byMonth} /></Item>
            <Item><BarList title="Where it went" rows={r.byCategory.map((c) => ({ label: c.category || 'Uncategorized', paise: c.outPaise }))} /></Item>
            {r.byMethod && <Item><BarList title="How you paid" rows={r.byMethod.map((c) => ({ label: c.method || 'Other', paise: c.outPaise }))} /></Item>}
            {r.topMerchants && <Item><BarList title="Top payees" rows={r.topMerchants.map((c) => ({ label: `${c.merchant} · ${c.count}×`, paise: c.outPaise }))} /></Item>}
          </Stagger>
        )}
      </div>
    </div>
  );
}
