import React, { useEffect, useState } from 'react';
import { RotateCcw, Megaphone, Send } from 'lucide-react';
import { owner, meterLabel, type Payment, type AuditRow, type AppConfig, type MeterKey } from '../lib/saas';
import { inrPaise, niceDate, relTime, paise, todayIso } from '../lib/format';
import { AppBar, Empty, Field, ListSkeleton, Seg, Toggle, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, MeterBar } from '../motion';
import { useNavigate } from 'react-router-dom';

export function OwnerUsage() {
  const nav = useNavigate(); const toast = useToast();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [r, setR] = useState<Awaited<ReturnType<typeof owner.usageReport>> | null>(null);
  const months = Array.from({ length: 6 }).map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i, 1); return d.toISOString().slice(0, 7); });
  useEffect(() => { setR(null); void owner.usageReport(month).then(setR).catch((e) => toast({ text: e.message, tone: 'error' })); }, [month]);
  const max = Math.max(1, ...(r?.meters || []).map((m) => m.used));
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Usage" rule />
      <div className="chips pad" style={{ padding: '12px 16px' }}>{months.map((m) => <button key={m} className={`chip ${m === month ? 'on' : ''}`} onClick={() => setMonth(m)}>{new Date(m + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' })}</button>)}</div>
      {!r ? <ListSkeleton rows={6} /> : (
        <Stagger>
          <Item className="list">
            {r.meters.map((m) => (
              <div key={m.key} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'default' }}>
                <div className="row"><span className="grow t">{meterLabel(m.key)}</span><span className="mono">{m.used.toLocaleString('en-IN')}</span></div>
                <MeterBar pct={m.used / max} />
                <p className="hint">{m.users.toLocaleString('en-IN')} people used it</p>
              </div>
            ))}
          </Item>
          <Item><div className="h-section">Closest to their limit</div></Item>
          <Item className="list">
            {r.top.map((t) => (
              <div key={`${t.uid}-${t.key}`} className="list-row" onClick={() => nav(`/owner/users/${t.uid}`)}>
                <div className="grow"><p className="t ellipsis">{t.email}</p><p className="s">{meterLabel(t.key as MeterKey)}</p><div style={{ marginTop: 6 }}><MeterBar pct={t.limit < 0 ? 0 : t.used / Math.max(1, t.limit)} height={4} /></div></div>
                <span className="mono">{t.used}/{t.limit < 0 ? '∞' : t.limit}</span>
              </div>
            ))}
            {!r.top.length && <Empty title="Nobody is close to a limit" />}
          </Item>
        </Stagger>
      )}
    </div>
  );
}

export function OwnerPayments() {
  const toast = useToast(); const confirm = useConfirm(); const nav = useNavigate();
  const [status, setStatus] = useState('ALL'); const [rows, setRows] = useState<Payment[] | null>(null); const [next, setNext] = useState<string | undefined>();
  const [refund, setRefund] = useState<Payment | null>(null); const [amt, setAmt] = useState('');
  const load = () => { setRows(null); void owner.listPayments(status).then((r) => { setRows(r.payments); setNext(r.next); }).catch((e) => { toast({ text: e.message, tone: 'error' }); setRows([]); }); };
  useEffect(load, [status]);
  const badge = (s: Payment['status']) => (s === 'SUCCESS' ? 'teal' : s === 'FAILED' ? 'red' : 'amber');
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Payments" kicker="Cashfree" rule />
      <div className="pad" style={{ padding: '12px 16px' }}><Seg id="pst" value={status} onChange={setStatus} options={[{ value: 'ALL', label: 'All' }, { value: 'SUCCESS', label: 'Paid' }, { value: 'FAILED', label: 'Failed' }, { value: 'REFUNDED', label: 'Refunded' }]} /></div>
      {!rows ? <ListSkeleton rows={8} /> : !rows.length ? <Empty title="No payments" /> : (
        <Stagger className="list">
          {rows.map((p) => (
            <Item key={p.id} className="list-row" onClick={() => nav(`/owner/users/${p.uid}`)}>
              <div className="grow"><p className="t ellipsis">{p.email}</p><p className="s ellipsis">{p.invoiceNumber || p.orderId} · {relTime(p.createdAt)} · {p.method || ''}{p.failureReason ? ` · ${p.failureReason}` : ''}</p></div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                <span className="mono">{inrPaise(p.amountPaise)}</span><span className={`badge ${badge(p.status)}`}>{p.status.replace('_', ' ').toLowerCase()}</span>
                {p.status === 'SUCCESS' && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRefund(p); setAmt(String((p.amountPaise - (p.refundedPaise || 0)) / 100)); }}><RotateCcw size={14} />Refund</button>}
              </div>
            </Item>
          ))}
          {next && <div className="pad" style={{ padding: 16 }}><Press className="btn btn-secondary btn-block" onClick={async () => { const r = await owner.listPayments(status, next); setRows((x) => [...(x || []), ...r.payments]); setNext(r.next); }}>Load more</Press></div>}
        </Stagger>
      )}
      <Sheet open={!!refund} onClose={() => setRefund(null)} title="Refund"
        footer={<Press className="btn btn-danger btn-block" onClick={async () => {
          if (!refund) return; const p = paise(amt);
          if (p <= 0 || p > refund.amountPaise - (refund.refundedPaise || 0)) { toast({ text: 'Amount is more than what can be refunded', tone: 'error' }); return; }
          const { ok, reason } = await confirm({ title: `Refund ${inrPaise(p)}?`, body: 'Sent back to the original payment method in 5–7 working days. A credit note is issued.', danger: true, reason: true, confirm: 'Refund' });
          if (!ok) return;
          try { await owner.refund(refund.id, p, reason); setRefund(null); toast({ text: 'Refund started' }); load(); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
        }}>Refund</Press>}>
        {refund && <><p>{refund.email} · {refund.invoiceNumber}</p><Field label="Amount ₹" hint={`Up to ${inrPaise(refund.amountPaise - (refund.refundedPaise || 0))}`}><input className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field></>}
      </Sheet>
    </div>
  );
}

export function OwnerAudit() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[] | null>(null); const [next, setNext] = useState<string | undefined>();
  useEffect(() => { void owner.listAudit().then((r) => { setRows(r.rows); setNext(r.next); }).catch((e) => { toast({ text: e.message, tone: 'error' }); setRows([]); }); }, []);
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Audit log" kicker="Read-only" rule />
      {!rows ? <ListSkeleton rows={8} /> : !rows.length ? <Empty title="No owner actions yet" /> : (
        <Stagger className="list" style={{ borderTop: 0 }}>
          {rows.map((r) => (
            <Item key={r.id} className="list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <div className="grow"><p className="t">{r.action} <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>· {r.target}</span></p><p className="s">{r.actorEmail} · {niceDate(r.at)} {new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>{r.reason && <p className="s" style={{ color: 'var(--ink-2)' }}>“{r.reason}”</p>}{r.detail && <p className="s mono" style={{ fontSize: 12 }}>{r.detail}</p>}</div>
            </Item>
          ))}
          {next && <div className="pad" style={{ padding: 16 }}><Press className="btn btn-secondary btn-block" onClick={async () => { const r = await owner.listAudit(next); setRows((x) => [...(x || []), ...r.rows]); setNext(r.next); }}>Load more</Press></div>}
        </Stagger>
      )}
    </div>
  );
}

export function OwnerConfig() {
  const toast = useToast(); const confirm = useConfirm();
  const [c, setC] = useState<AppConfig | null>(null); const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [ann, setAnn] = useState(false); const [a, setA] = useState({ title: '', body: '', audience: 'all' as 'all' | 'free' | 'paying' | 'trialing', push: true });
  useEffect(() => { void owner.getConfig().then((r) => setC(r.config)); void owner.listPlans().then((r) => setPlans(r.plans)); }, []);
  if (!c) return <div className="screen no-nav"><AppBar back="/owner" title="App settings" rule /><ListSkeleton /></div>;
  const save = async () => {
    if (c.sellerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(c.sellerGstin)) { toast({ text: 'Your GSTIN looks wrong', tone: 'error' }); return; }
    const { ok, reason } = await confirm({ title: 'Save app settings?', body: c.maintenance ? 'Maintenance mode will block everyone except owners.' : undefined, danger: c.maintenance, reason: true, confirm: 'Save' });
    if (!ok) return;
    try { const r = await owner.saveConfig(c, reason); setC(r.config); toast({ text: 'Saved' }); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
  };
  const num = (k: keyof AppConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 });
  const str = (k: keyof AppConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setC({ ...c, [k]: e.target.value });
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="App settings" rule right={<Press className="btn btn-primary btn-sm" onClick={save}>Save</Press>} />
      <div className="stack" style={{ padding: 16, gap: 16 }}>
        <div className="h-section" style={{ margin: 0 }}>Status</div>
        <Toggle on={c.maintenance} onChange={(v) => setC({ ...c, maintenance: v })} label="Maintenance mode" hint="Everyone except owners sees a ‘be right back’ screen" />
        {c.maintenance && <Field label="Maintenance message"><textarea className="input" rows={2} value={c.maintenanceMessage} onChange={str('maintenanceMessage')} /></Field>}
        <Field label="Minimum app version" hint="Older builds are asked to update"><input className="input mono" value={c.minAppVersion} onChange={str('minAppVersion')} /></Field>
        <div className="h-section" style={{ margin: 0 }}>Banner</div>
        <Field label="Announcement" optional hint="Shown at the top of the app until dismissed"><textarea className="input" rows={2} value={c.announcement} onChange={str('announcement')} /></Field>
        <Field label="Tone"><Seg id="tone" value={c.announcementTone} onChange={(v) => setC({ ...c, announcementTone: v })} options={[{ value: 'info', label: 'Info' }, { value: 'offer', label: 'Offer' }, { value: 'warning', label: 'Warning' }]} /></Field>
        <Press className="btn btn-secondary" onClick={() => setAnn(true)}><Megaphone size={18} />Send a push / email announcement</Press>
        <div className="h-section" style={{ margin: 0 }}>Plans</div>
        <div className="grid2">
          <Field label="New users start on"><select className="input" value={c.defaultPlanId} onChange={str('defaultPlanId')}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Signup trial plan"><select className="input" value={c.trialPlanId} onChange={str('trialPlanId')}><option value="">No trial</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <div className="grid2">
          <Field label="Signup trial days"><input className="input" inputMode="numeric" value={c.trialDays} onChange={num('trialDays')} /></Field>
          <Field label="Grace days after failed renewal"><input className="input" inputMode="numeric" value={c.graceDays} onChange={num('graceDays')} /></Field>
        </div>
        <Field label="Usage resets on day" hint="1–28 of each month"><input className="input" inputMode="numeric" value={c.usageResetDay} onChange={(e) => setC({ ...c, usageResetDay: Math.min(28, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) })} /></Field>
        <div className="h-section" style={{ margin: 0 }}>GST invoices</div>
        <Field label="Business name"><input className="input" value={c.sellerName} onChange={str('sellerName')} /></Field>
        <div className="grid2">
          <Field label="GSTIN"><input className="input mono" value={c.sellerGstin} onChange={(e) => setC({ ...c, sellerGstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="State"><input className="input" value={c.sellerState} onChange={str('sellerState')} /></Field>
        </div>
        <div className="grid2">
          <Field label="GST rate %"><input className="input" inputMode="decimal" value={c.gstRate} onChange={num('gstRate')} /></Field>
          <Field label="Invoice prefix"><input className="input mono" value={c.invoicePrefix} onChange={str('invoicePrefix')} /></Field>
        </div>
        <Field label="Support email"><input className="input" type="email" value={c.supportEmail} onChange={str('supportEmail')} /></Field>
      </div>
      <Sheet open={ann} onClose={() => setAnn(false)} title="Announcement"
        footer={<Press className="btn btn-primary btn-block" disabled={!a.title.trim()} onClick={async () => {
          const { ok, reason } = await confirm({ title: `Send to ${a.audience === 'all' ? 'everyone' : a.audience + ' users'}?`, reason: true, confirm: 'Send' }); if (!ok) return;
          try { const r = await owner.sendAnnouncement(a, reason); setAnn(false); toast({ text: `Sent to ${r.sent.toLocaleString('en-IN')} people` }); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
        }}><Send size={18} />Send</Press>}>
        <Field label="Title"><input className="input" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></Field>
        <Field label="Message"><textarea className="input" rows={3} value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} /></Field>
        <Field label="Who"><Seg id="aud" value={a.audience} onChange={(v) => setA({ ...a, audience: v })} options={[{ value: 'all', label: 'All' }, { value: 'free', label: 'Free' }, { value: 'trialing', label: 'Trial' }, { value: 'paying', label: 'Paying' }]} /></Field>
        <Toggle on={a.push} onChange={(v) => setA({ ...a, push: v })} label="Also send as push" />
      </Sheet>
    </div>
  );
}
