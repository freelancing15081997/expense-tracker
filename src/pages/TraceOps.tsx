import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Mail, RefreshCw, Server, Shield } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { authHeaders } from '../lib/auth-client';

type TracePayload = {
  at?: string;
  health?: Record<string, { id: string; label: string; ok: boolean; hint: string } | undefined>;
  freeTiers?: Array<{ id: string; label: string; ok: boolean; hint: string }>;
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

export default function TraceOps() {
  const [data, setData] = useState<TracePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="trace-shell ios-page">
      <header className="trace-head">
        <div>
          <p className="trace-kicker"><Shield className="w-3.5 h-3.5" /> Super admin only</p>
          <h1>Trace</h1>
          <p className="trace-sub">End-to-end mail, connections, free-tier readiness, and ops events. Never shown to members.</p>
        </div>
        <button type="button" className="byjan-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

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

          <section className="trace-card">
            <div className="trace-card-head">
              <Activity className="w-4 h-4" />
              <h2>Email pipeline</h2>
            </div>
            <div className="trace-stats">
              <div><span>Sent</span><strong>{data.email?.recentOk ?? 0}</strong></div>
              <div><span>Failed</span><strong className={data.email?.recentFailed ? 'is-bad' : ''}>{data.email?.recentFailed ?? 0}</strong></div>
            </div>
            {data.email?.lastFail ? (
              <p className="trace-fail">
                Last fail: {String(data.email.lastFail.error || 'unknown')} · to {String(data.email.lastFail.to || '—')} · {String(data.email.lastFail.at || '')}
              </p>
            ) : (
              <p className="trace-ok-line">No recent email failures in Trace log.</p>
            )}
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
              {(data.events || []).slice(0, 60).map((ev, i) => (
                <article key={String(ev.id || i)} className={`trace-log-row${ev.ok === false ? ' is-bad' : ''}`}>
                  <span className="trace-log-kind">{String(ev.kind || 'event')}</span>
                  <span className="trace-log-at">{String(ev.at || '').replace('T', ' ').slice(0, 19)}</span>
                  <p>
                    {ev.ok === false ? String(ev.error || 'failed') : ev.ok === true ? `ok · ${String(ev.to || ev.messageId || '')}` : JSON.stringify(ev).slice(0, 160)}
                  </p>
                </article>
              ))}
              {!data.events?.length ? <p className="trace-ok-line">No ops events yet. Send a team email to populate.</p> : null}
            </div>
          </section>

          <p className="trace-note">{data.note} · refreshed {data.at}</p>
        </>
      ) : null}
    </div>
  );
}
