import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Mail, RefreshCw, Search, Server, Shield } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { authHeaders } from '../lib/auth-client';

type TracePayload = {
  at?: string;
  health?: Record<string, { id: string; label: string; ok: boolean; hint: string } | undefined>;
  freeTiers?: Array<{ id: string; label: string; ok: boolean; hint: string }>;
  quotaAlerts?: Array<Record<string, unknown>>;
  byFeature?: Record<string, { ok: number; fail: number; quota: number }>;
  env?: Array<{ name: string; set: boolean; length: number }>;
  email?: {
    recentOk: number;
    recentFailed: number;
    lastFail: Record<string, unknown> | null;
    fails: Array<Record<string, unknown>>;
    sent: Array<Record<string, unknown>>;
  };
  events?: Array<Record<string, unknown>>;
  note?: string;
  error?: string;
};

function fmtAt(raw: unknown) {
  return String(raw || '').replace('T', ' ').slice(0, 19) || '—';
}

function eventLine(ev: Record<string, unknown>) {
  const kind = String(ev.kind || 'event');
  const feature = String(ev.feature || '');
  const quota = String(ev.quota || '');
  const to = String(ev.to || '');
  const subject = String(ev.subject || '');
  const error = String(ev.error || '');
  const messageId = String(ev.messageId || '');
  const host = String(ev.host || '');
  const port = ev.port != null ? String(ev.port) : '';
  const note = String(ev.note || '');
  if (ev.ok === false) {
    return [
      quota ? `[${quota}]` : '',
      feature ? `feature:${feature}` : '',
      error || 'failed',
      to ? `to ${to}` : '',
      subject ? `“${subject}”` : '',
      host ? `${host}${port ? `:${port}` : ''}` : '',
      note,
    ].filter(Boolean).join(' · ');
  }
  if (ev.ok === true) {
    return [
      'ok',
      feature ? `feature:${feature}` : '',
      to ? `to ${to}` : '',
      subject ? `“${subject}”` : '',
      messageId ? `id ${messageId}` : '',
      host ? `${host}${port ? `:${port}` : ''}` : '',
      note,
    ].filter(Boolean).join(' · ');
  }
  return JSON.stringify(ev).slice(0, 200);
}

function matchesQuery(ev: Record<string, unknown>, q: string) {
  if (!q) return true;
  const hay = [
    ev.kind, ev.feature, ev.quota, ev.error, ev.to, ev.subject, ev.alertTitle, ev.note, ev.host, ev.messageId,
  ].map((v) => String(v || '').toLowerCase()).join(' ');
  return q.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
}

export default function TraceOps() {
  const [data, setData] = useState<TracePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/ops/trace'), {
        headers: await authHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || `Trace failed (${res.status})`));
      setData(payload);
    } catch (err: any) {
      setError(err?.message || 'Could not load Trace');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const q = query.trim().toLowerCase();
  const fails = useMemo(() => (data?.email?.fails || []).filter((ev) => matchesQuery(ev, q)), [data, q]);
  const sent = useMemo(() => (data?.email?.sent || []).filter((ev) => matchesQuery(ev, q)), [data, q]);
  const configFails = useMemo(
    () => (data?.events || []).filter((e) => e.kind === 'email.config' && e.ok === false && matchesQuery(e, q)),
    [data, q],
  );
  const events = useMemo(() => (data?.events || []).filter((ev) => matchesQuery(ev, q)), [data, q]);
  const quotaAlerts = useMemo(
    () => (data?.quotaAlerts || []).filter((ev) => matchesQuery(ev, q)),
    [data, q],
  );
  const featureRows = Object.entries(data?.byFeature || {});

  return (
    <div className="trace-shell ios-page">
      <header className="trace-head">
        <div>
          <p className="trace-kicker"><Shield className="w-3.5 h-3.5" /> Super admin only</p>
          <h1>Trace</h1>
          <p className="trace-sub">Live ops log: SMTP, quota/free-tier hits, DB/storage/AI readiness — searchable by feature or error.</p>
        </div>
        <button type="button" className="byjan-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <label className="trace-search">
        <Search className="w-4 h-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search feature, quota, email, error…"
          aria-label="Search trace"
        />
      </label>

      {error ? (
        <div className="trace-card is-warn">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <strong>Trace blocked</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="trace-skel" aria-busy="true">
          <span className="byjan-skel h-24 rounded-2xl w-full" />
          <span className="byjan-skel h-40 rounded-2xl w-full" />
          <span className="byjan-skel h-40 rounded-2xl w-full" />
        </div>
      ) : null}

      {data ? (
        <>
          {quotaAlerts.length ? (
            <section className="trace-card is-warn">
              <div className="trace-card-head">
                <AlertTriangle className="w-4 h-4" />
                <h2>Quota / free-tier alerts</h2>
              </div>
              <p className="trace-fail mb-2">
                {quotaAlerts.length} capacity issue{quotaAlerts.length === 1 ? '' : 's'} detected (email daily quota, rate limits, DB/storage/AI limits).
              </p>
              <div className="trace-log">
                {quotaAlerts.slice(0, 30).map((ev, i) => (
                  <article key={String(ev.id || `qa-${i}`)} className="trace-log-row is-bad">
                    <span className="trace-log-kind">{String(ev.feature || 'service')} · {String(ev.quota || 'limit')}</span>
                    <span className="trace-log-at">{fmtAt(ev.at)}</span>
                    <p>
                      <strong>{String(ev.alertTitle || 'Capacity limit')}</strong>
                      {ev.error ? ` — ${String(ev.error)}` : ''}
                      {ev.to ? ` · to ${String(ev.to)}` : ''}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="trace-card">
              <p className="trace-ok-line">No quota or free-tier exhaustion alerts in the recent Trace ledger.</p>
            </section>
          )}

          <section className="trace-grid">
            {(data.freeTiers || []).map((tier) => (
              <article key={tier.id} className={`trace-tile${tier.ok ? ' is-ok' : ' is-bad'}`}>
                <span className="trace-tile-icon" aria-hidden>
                  {tier.id === 'smtp' ? <Mail className="w-4 h-4" /> : tier.id === 'neon' ? <Database className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                </span>
                <div>
                  <strong>{tier.label}</strong>
                  <p>{tier.ok ? 'Connected' : `Missing · ${tier.hint}`}</p>
                </div>
                {tier.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              </article>
            ))}
          </section>

          {featureRows.length ? (
            <section className="trace-card">
              <div className="trace-card-head">
                <Activity className="w-4 h-4" />
                <h2>By feature</h2>
              </div>
              <div className="trace-stats">
                {featureRows.map(([feature, stats]) => (
                  <div key={feature}>
                    <span>{feature}</span>
                    <strong className={stats.quota || stats.fail ? 'is-bad' : ''}>
                      {stats.ok} ok · {stats.fail} fail · {stats.quota} quota
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="trace-card">
            <div className="trace-card-head">
              <Mail className="w-4 h-4" />
              <h2>Email pipeline</h2>
            </div>
            <div className="trace-stats">
              <div><span>Sent</span><strong>{data.email?.recentOk ?? 0}</strong></div>
              <div><span>Failed</span><strong className={data.email?.recentFailed ? 'is-bad' : ''}>{data.email?.recentFailed ?? 0}</strong></div>
            </div>
            {data.email?.lastFail ? (
              <p className="trace-fail">
                Last fail: {String(data.email.lastFail.error || 'unknown')}
                {data.email.lastFail.quota ? ` · quota ${String(data.email.lastFail.quota)}` : ''}
                {data.email.lastFail.to ? ` · to ${String(data.email.lastFail.to)}` : ''}
                {data.email.lastFail.subject ? ` · “${String(data.email.lastFail.subject)}”` : ''}
                {data.email.lastFail.at ? ` · ${fmtAt(data.email.lastFail.at)}` : ''}
              </p>
            ) : (
              <p className="trace-ok-line">No recent email.send failures in the Trace ledger.</p>
            )}
            {configFails.length ? (
              <div className="trace-log mt-3">
                <p className="trace-fail">SMTP config issues ({configFails.length})</p>
                {configFails.slice(0, 10).map((ev, i) => (
                  <article key={String(ev.id || `cfg-${i}`)} className="trace-log-row is-bad">
                    <span className="trace-log-kind">email.config</span>
                    <span className="trace-log-at">{fmtAt(ev.at)}</span>
                    <p>{String(ev.error || 'SMTP not configured')}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {fails.length ? (
              <div className="trace-log mt-3">
                <p className="text-xs font-semibold text-rose-700 mb-2">Failed sends — why</p>
                {fails.slice(0, 40).map((ev, i) => (
                  <article key={String(ev.id || `fail-${i}`)} className="trace-log-row is-bad">
                    <span className="trace-log-kind">{String(ev.kind || 'email.send')}</span>
                    <span className="trace-log-at">{fmtAt(ev.at)}</span>
                    <p>{eventLine(ev)}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {sent.length ? (
              <div className="trace-log mt-3">
                <p className="text-xs font-semibold text-emerald-700 mb-2">Recent successful sends</p>
                {sent.slice(0, 20).map((ev, i) => (
                  <article key={String(ev.id || `ok-${i}`)} className="trace-log-row">
                    <span className="trace-log-kind">{String(ev.kind || 'email.send')}</span>
                    <span className="trace-log-at">{fmtAt(ev.at)}</span>
                    <p>{eventLine(ev)}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="trace-card">
            <div className="trace-card-head">
              <Server className="w-4 h-4" />
              <h2>Environment (presence only)</h2>
            </div>
            <ul className="trace-env">
              {(data.env || []).map((row) => (
                <li key={row.name}>
                  <code>{row.name}</code>
                  <span className={row.set ? 'is-ok' : 'is-bad'}>{row.set ? `set · ${row.length} chars` : 'missing'}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="trace-card">
            <div className="trace-card-head">
              <Activity className="w-4 h-4" />
              <h2>Recent events</h2>
            </div>
            <div className="trace-log">
              {events.slice(0, 60).map((ev, i) => (
                <article key={String(ev.id || i)} className={`trace-log-row${ev.ok === false ? ' is-bad' : ''}`}>
                  <span className="trace-log-kind">{String(ev.kind || 'event')}</span>
                  <span className="trace-log-at">{fmtAt(ev.at)}</span>
                  <p>{eventLine(ev)}</p>
                </article>
              ))}
              {!events.length ? <p className="trace-ok-line">No matching ops events.</p> : null}
            </div>
          </section>

          <p className="trace-note">{data.note} · refreshed {data.at}</p>
        </>
      ) : null}
    </div>
  );
}
