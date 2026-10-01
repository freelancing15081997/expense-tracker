import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Sparkles, Minus, Plus, Tag, Download, AlertTriangle, RotateCcw, Receipt, X, Megaphone } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { getCatalog, quote as getQuote, createOrder, verifyOrder, startTrial, cancelSubscription, resumeSubscription, changeSeats, listInvoices, invoicePdfUrl, updateBilling, METERS, meterLabel,
  type Plan, type AddOn, type Offer, type Cycle, type Quote, type Invoice, type CheckoutInput, type MeterKey } from '../lib/saas';
import { payWithCashfree } from '../lib/cashfree';
import { useSession } from '../lib/session';
import { inrPaise, niceDate } from '../lib/format';
import { AppBar, Field, Seg, Empty, ListSkeleton, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, CountUp, MeterBar, SuccessMark, BrandLoader, motion, AnimatePresence } from '../motion';

const GST_STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other'];
const limitText = (n: number, unit: string) => (n < 0 ? 'Unlimited' : `${n.toLocaleString('en-IN')} ${unit}`);
const priceOf = (p: Plan, cycle: Cycle, seats = 1) => {
  const base = cycle === 'annual' ? p.priceAnnualPaise : p.priceMonthlyPaise;
  const seat = cycle === 'annual' ? p.seatPriceAnnualPaise : p.seatPriceMonthlyPaise;
  return base + (p.perSeat ? Math.max(0, seats - p.includedSeats) * seat : 0);
};

export function Plans() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const [cat, setCat] = useState<{ plans: Plan[]; addons: AddOn[]; offers: Offer[] } | null>(null);
  const [cycle, setCycle] = useState<Cycle>(s.sub?.cycle || 'annual');
  const [seats, setSeats] = useState<Record<string, number>>({});
  useEffect(() => { void getCatalog().then((c) => setCat(c)).catch((e) => toast({ text: e.message, tone: 'error' })); }, []);
  const plans = (cat?.plans || []).filter((p) => p.visible && !p.archived).sort((a, b) => a.sort - b.sort);
  const banner = (cat?.offers || []).find((o) => o.active && o.autoApply);
  const canTrial = !s.sub || s.sub.status === 'free';

  return (
    <div className="screen no-nav">
      <AppBar back title="Plans" kicker="Every feature on every plan · limits differ" rule />
      {banner && (
        <motion.div className="banner offer" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}><Megaphone size={16} /><span className="grow"><b>{banner.title}</b> · {banner.description}</span><span className="badge" style={{ background: 'var(--teal)', color: 'var(--navy)' }}>{banner.code}</span></motion.div>
      )}
      <div className="stack" style={{ padding: 16 }}>
        <Seg id="cycle" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual · save more' }]} />
        {!cat ? <ListSkeleton rows={3} /> : (
          <Stagger className="stack" style={{ gap: 14 }}>
            {plans.map((p) => {
              const current = s.sub?.planId === p.id && s.sub.status !== 'free';
              const n = seats[p.id] || Math.max(p.includedSeats, s.sub?.planId === p.id ? s.sub.seats : 1);
              const price = priceOf(p, cycle, n);
              const perMonth = cycle === 'annual' ? price / 12 : price;
              const save = p.priceMonthlyPaise > 0 ? Math.round((1 - p.priceAnnualPaise / (p.priceMonthlyPaise * 12)) * 100) : 0;
              return (
                <Item key={p.id} className="card" style={{ borderTop: `3px solid ${p.badge ? 'var(--teal)' : 'var(--ink)'}`, overflow: 'hidden' }}>
                  <div className="card-pad stack" style={{ gap: 10 }}>
                    <div className="row"><h2 className="grow" style={{ font: '600 20px var(--font)' }}>{p.name}</h2>{p.badge && <span className="badge teal">{p.badge}</span>}{current && <span className="badge ink">Current</span>}</div>
                    <p className="hint" style={{ fontSize: 14 }}>{p.tagline}</p>
                    <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                      <motion.span key={`${cycle}-${price}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ font: '600 30px var(--font)', letterSpacing: '-.02em' }}>{price === 0 ? '₹0' : inrPaise(price)}</motion.span>
                      <span className="hint">{price === 0 ? 'forever' : cycle === 'annual' ? `/ year · ${inrPaise(perMonth)}/mo` : '/ month'}</span>
                      {cycle === 'annual' && save > 0 && <span className="badge teal" style={{ marginLeft: 'auto' }}>Save {save}%</span>}
                    </div>
                    {p.perSeat && (
                      <div className="row" style={{ background: 'var(--sunk)', borderRadius: 8, padding: '6px 6px 6px 12px' }}>
                        <span className="grow" style={{ font: '500 14px var(--font)' }}>{n} {n === 1 ? 'seat' : 'seats'}<span className="hint"> · {p.includedSeats} included, then {inrPaise(cycle === 'annual' ? p.seatPriceAnnualPaise : p.seatPriceMonthlyPaise)} each</span></span>
                        <Press className="icon-btn" disabled={n <= p.includedSeats} onClick={() => setSeats({ ...seats, [p.id]: n - 1 })}><Minus size={18} /></Press>
                        <motion.span key={n} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="mono" style={{ width: 24, textAlign: 'center' }}>{n}</motion.span>
                        <Press className="icon-btn" disabled={n >= p.maxSeats} onClick={() => setSeats({ ...seats, [p.id]: n + 1 })}><Plus size={18} /></Press>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }} className="stack">
                      {METERS.map((m) => <div key={m.key} className="row" style={{ font: '400 14px var(--font)' }}><span className="grow" style={{ color: 'var(--ink-2)' }}>{m.label}{m.monthly ? ' / mo' : ''}</span><span className="mono" style={{ fontWeight: 500 }}>{limitText(p.limits[m.key] ?? -1, m.unit === 'MB' ? 'MB' : '')}</span></div>)}
                    </div>
                    {p.highlights.length > 0 && <div className="stack" style={{ gap: 6 }}>{p.highlights.map((h) => <span key={h} className="row" style={{ font: '400 14px var(--font)', gap: 8 }}><Check size={15} color="var(--teal-700)" />{h}</span>)}</div>}
                  </div>
                  <div style={{ padding: '0 16px 16px' }}>
                    {current && s.sub?.cycle === cycle && (s.sub.seats === n || !p.perSeat) ? <Press className="btn btn-secondary btn-block" onClick={() => nav('/billing')}>Manage plan</Press>
                      : price === 0 ? <Press className="btn btn-secondary btn-block" disabled={!s.sub || s.sub.planId === p.id} onClick={() => nav('/billing')}>{s.sub?.planId === p.id ? 'Your plan' : 'Switch at period end'}</Press>
                        : (
                          <div className="stack" style={{ gap: 8 }}>
                            <Press className="btn btn-primary btn-block" onClick={() => nav('/checkout', { state: { kind: 'plan', planId: p.id, cycle, seats: n } as CheckoutInput })}>{current ? 'Change to this' : `Get ${p.name}`}</Press>
                            {canTrial && p.trialDays > 0 && <Press className="btn btn-ghost btn-block" onClick={async () => { try { await startTrial(p.id); await s.refreshSaas(); toast({ text: `${p.trialDays}-day ${p.name} trial started` }); nav('/billing'); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); } }}>Try free for {p.trialDays} days</Press>}
                          </div>
                        )}
                  </div>
                </Item>
              );
            })}
            {(cat.addons || []).filter((a) => a.visible).length > 0 && (
              <Item>
                <div className="h-section" style={{ margin: '8px 0 10px' }}>Top-ups</div>
                <div className="list" style={{ margin: '0 -16px' }}>
                  {cat.addons.filter((a) => a.visible).map((a) => (
                    <div key={a.id} className="list-row" onClick={() => nav('/checkout', { state: { kind: 'addon', addons: [{ id: a.id, qty: 1 }] } as CheckoutInput })}>
                      <Sparkles size={18} color="var(--teal-700)" /><div className="grow"><p className="t">{a.name}</p><p className="s">+{a.quantity.toLocaleString('en-IN')} {meterLabel(a.meter).toLowerCase()} · {a.recurring ? 'every month' : 'this month'}</p></div><span className="mono">{inrPaise(a.pricePaise)}</span>
                    </div>
                  ))}
                </div>
              </Item>
            )}
            <Item><p className="hint">Prices exclude 18% GST, added at checkout. GST invoice for every payment. Cancel any time — you keep access until the period ends.</p></Item>
          </Stagger>
        )}
      </div>
    </div>
  );
}

export function Checkout() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const loc = useLocation() as { state?: CheckoutInput };
  const input = loc.state;
  const [coupon, setCoupon] = useState(''); const [applied, setApplied] = useState('');
  const [q, setQ] = useState<Quote | null>(null); const [qErr, setQErr] = useState('');
  const [billing, setBilling] = useState({ name: s.sub?.billing?.name || s.me?.displayName || '', gstin: s.sub?.billing?.gstin || '', state: s.sub?.billing?.state || '', email: s.sub?.billing?.email || s.user?.email || '', address: s.sub?.billing?.address || '' });
  const [gstOpen, setGstOpen] = useState(!!billing.gstin);
  const [busy, setBusy] = useState(false); const [bErr, setBErr] = useState<Record<string, string>>({});
  const body = useMemo(() => (input ? { ...input, coupon: applied || undefined, billing } : null), [input, applied, billing.gstin, billing.state]);

  useEffect(() => { if (!input) nav('/plans', { replace: true }); }, []);
  useEffect(() => {
    if (!body) return;
    setQ(null);
    void getQuote(body).then((r) => { setQ(r.quote); if (r.quote.couponError) { setQErr(r.quote.couponError); setApplied(''); } }).catch((e) => toast({ text: e.message, tone: 'error' }));
  }, [body]);
  if (!input) return null;

  const pay = async () => {
    const e: Record<string, string> = {};
    if (!billing.name.trim()) e.name = 'Name for the invoice';
    if (!/^\S+@\S+\.\S+$/.test(billing.email)) e.email = 'Invoice email';
    if (gstOpen && billing.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(billing.gstin.trim())) e.gstin = 'GSTIN should be 15 characters, e.g. 29ABCDE1234F1Z5';
    if (gstOpen && billing.gstin && !billing.state) e.state = 'Pick the state on your GSTIN';
    setBErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const o = await createOrder({ ...input, coupon: applied || undefined, billing: { ...billing, gstin: billing.gstin.trim().toUpperCase() } });
      if (o.free) { nav(`/payment/${o.orderId}`, { replace: true }); return; }
      const r = await payWithCashfree(o.paymentSessionId, o.orderId, o.mode);
      if (r.result === 'dismissed') { toast({ text: 'Payment cancelled. You weren’t charged.' }); return; }
      nav(`/payment/${o.orderId}`, { replace: true });
    } catch (err) { toast({ text: (err as Error).message, tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <div className="screen no-nav">
      <AppBar back title="Checkout" kicker="Secure payment by Cashfree" rule />
      <div className="stack" style={{ padding: 16, gap: 18 }}>
        <div className="card">
          {!q ? <div className="card-pad stack"><ListSkeleton rows={2} /></div> : (
            <>
              <div className="card-pad stack" style={{ gap: 8 }}>
                {q.lines.map((l) => <div key={l.label} className="row"><span className="grow">{l.label}</span><span className="mono">{inrPaise(l.amountPaise)}</span></div>)}
                {q.discountPaise > 0 && <motion.div className="row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{ color: 'var(--teal-700)' }}><span className="grow row" style={{ gap: 6 }}><Tag size={14} />{q.offer?.title || 'Discount'}</span><span className="mono">−{inrPaise(q.discountPaise)}</span></motion.div>}
                <div className="row hint"><span className="grow">GST</span><span className="mono">{inrPaise(q.taxPaise)}</span></div>
                {q.prorationNote && <p className="hint">{q.prorationNote}</p>}
              </div>
              <div className="row card-pad" style={{ borderTop: '2px solid var(--ink)' }}><span className="grow" style={{ font: '600 16px var(--font)' }}>Pay now</span><span style={{ font: '600 24px var(--font)' }}><CountUp value={q.totalPaise / 100} format={(n) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} /></span></div>
            </>
          )}
        </div>

        <Field label={<><Tag size={14} />Offer code</>} error={qErr} hint={applied ? `“${applied}” applied` : undefined}>
          <div className="row">
            <input className={`input mono ${qErr ? 'bad' : ''}`} value={coupon} autoCapitalize="characters" placeholder="DIWALI50" onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setQErr(''); }} />
            {applied ? <Press className="btn btn-secondary" onClick={() => { setApplied(''); setCoupon(''); }}><X size={16} /></Press> : <Press className="btn btn-secondary" disabled={!coupon.trim()} onClick={() => setApplied(coupon.trim())}>Apply</Press>}
          </div>
        </Field>

        <div className="h-section" style={{ margin: 0 }}>Invoice details</div>
        <Field label="Name on invoice" error={bErr.name}><input className={`input ${bErr.name ? 'bad' : ''}`} value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} /></Field>
        <Field label="Invoice email" error={bErr.email}><input className={`input ${bErr.email ? 'bad' : ''}`} type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} /></Field>
        <label className="row"><input type="checkbox" checked={gstOpen} onChange={(e) => setGstOpen(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--teal-700)' }} /><span>I have a GSTIN — claim input credit</span></label>
        <AnimatePresence>
          {gstOpen && (
            <motion.div className="stack" style={{ gap: 14, overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <Field label="GSTIN" error={bErr.gstin}><input className={`input mono ${bErr.gstin ? 'bad' : ''}`} value={billing.gstin} maxLength={15} autoCapitalize="characters" onChange={(e) => setBilling({ ...billing, gstin: e.target.value.toUpperCase() })} /></Field>
              <Field label="State" error={bErr.state}><select className={`input ${bErr.state ? 'bad' : ''}`} value={billing.state} onChange={(e) => setBilling({ ...billing, state: e.target.value })}><option value="">Choose…</option>{GST_STATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Billing address" optional><textarea className="input" rows={2} value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} /></Field>
            </motion.div>
          )}
        </AnimatePresence>

        <Press className="btn btn-primary btn-block" style={{ minHeight: 54 }} disabled={busy || !q} onClick={pay}>{busy ? 'Opening secure payment…' : q ? `Pay ${inrPaise(q.totalPaise)}` : 'Pay'}<span className="btn-trail row" style={{ gap: 4 }}><img src="/brands/upi.svg" alt="" width={18} height={18} style={{ filter: 'brightness(10)' }} /></span></Press>
        <p className="hint">UPI, cards, net banking and wallets. Payments are processed by Cashfree; Byjan never sees your card or UPI PIN.</p>
      </div>
    </div>
  );
}

export function PaymentResult() {
  const { orderId = '' } = useParams(); const s = useSession(); const nav = useNavigate();
  const [st, setSt] = useState<'checking' | 'paid' | 'failed' | 'pending'>('checking'); const [msg, setMsg] = useState(''); const [inv, setInv] = useState<Invoice | null>(null);
  useEffect(() => {
    let alive = true; let n = 0;
    const poll = async () => {
      try {
        const r = await verifyOrder(orderId);
        if (!alive) return;
        if (r.status === 'PAID' || r.status === 'ACTIVE') { setSt('paid'); setInv(r.invoice || null); await s.refreshSaas(); return; }
        if (r.status === 'FAILED' || r.status === 'EXPIRED' || r.status === 'USER_DROPPED') { setSt('failed'); setMsg(r.message || ''); return; }
      } catch { /* retry */ }
      n += 1;
      if (n >= 12) { setSt('pending'); return; }
      setTimeout(poll, n < 4 ? 1500 : 3000);
    };
    void poll();
    return () => { alive = false; };
  }, [orderId]);
  return (
    <div className="screen no-nav" style={{ justifyContent: 'center', padding: 24, gap: 18 }}>
      {st === 'checking' && <BrandLoader label="Confirming your payment with the bank…" />}
      {st === 'paid' && (
        <motion.div className="stack" style={{ alignItems: 'flex-start', gap: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <SuccessMark confettiOn />
          <h1 className="h-display">You’re on {s.plan?.name}</h1>
          <p style={{ color: 'var(--ink-2)' }}>{inv ? `Invoice ${inv.number} · ${inrPaise(inv.totalPaise)} — emailed to you.` : 'Your plan is active now.'}</p>
          <Press className="btn btn-primary btn-block" onClick={() => nav('/', { replace: true })}>Back to my books</Press>
          <Press className="btn btn-secondary btn-block" onClick={() => nav('/billing', { replace: true })}>See billing</Press>
        </motion.div>
      )}
      {st === 'failed' && (
        <div className="stack" style={{ gap: 14 }}>
          <AlertTriangle size={44} color="var(--red)" />
          <h1 className="h-display">Payment didn’t go through</h1>
          <p style={{ color: 'var(--ink-2)' }}>{msg || 'No money was taken. If it was, it’s refunded automatically within 5–7 days.'}</p>
          <Press className="btn btn-primary btn-block" onClick={() => nav('/plans', { replace: true })}><RotateCcw size={18} />Try again</Press>
        </div>
      )}
      {st === 'pending' && (
        <div className="stack" style={{ gap: 14 }}>
          <h1 className="h-display">Still confirming</h1>
          <p style={{ color: 'var(--ink-2)' }}>Your bank hasn’t replied yet. We’ll switch your plan on and notify you as soon as it does — you don’t need to pay again.</p>
          <Press className="btn btn-secondary btn-block" onClick={() => nav('/', { replace: true })}>OK</Press>
        </div>
      )}
    </div>
  );
}

export function Billing() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [inv, setInv] = useState<Invoice[] | null>(null);
  const [seatOpen, setSeatOpen] = useState(false); const [seats, setSeats] = useState(s.sub?.seats || 1); const [seatQuote, setSeatQuote] = useState<Quote | null>(null);
  useEffect(() => { void listInvoices().then(setInv).catch(() => setInv([])); }, []);
  const sub = s.sub; const plan = s.plan;
  const open = async (i: Invoice) => { try { const r = await invoicePdfUrl(i.id); await Browser.open({ url: r.url }); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); } };
  const statusBadge = { free: ['Free', ''], trialing: ['Trial', 'teal'], active: ['Active', 'teal'], past_due: ['Payment due', 'red'], cancelled: ['Cancelled', 'amber'], expired: ['Expired', 'red'] }[sub?.status || 'free'];

  return (
    <div className="screen no-nav">
      <AppBar back title="Plan & billing" rule />
      <Stagger>
        <Item className="pad" style={{ padding: '18px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <div className="row"><h2 className="grow" style={{ font: '600 22px var(--font)' }}>{plan?.name || 'Free'}</h2><span className={`badge ${statusBadge[1]}`}>{statusBadge[0]}</span></div>
          <p className="hint" style={{ marginTop: 6, fontSize: 14 }}>
            {sub?.status === 'trialing' && `Trial ends ${niceDate(sub.trialEndsAt)}. Add a plan to keep these limits.`}
            {sub?.status === 'active' && (sub.cancelAtPeriodEnd ? `Cancels on ${niceDate(sub.currentPeriodEnd)}. You keep access until then.` : `${sub.cycle === 'annual' ? 'Annual' : 'Monthly'} · renews ${niceDate(sub.currentPeriodEnd)} · ${inrPaise(sub.nextAmountPaise || 0)}`)}
            {sub?.status === 'past_due' && 'Your last renewal failed. Pay now to avoid dropping to Free.'}
            {(!sub || sub.status === 'free') && 'Everything works — smart features have monthly limits.'}
          </p>
          <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
            <Press className="btn btn-primary btn-sm" onClick={() => nav('/plans')}>{sub?.status === 'active' ? 'Change plan' : 'See plans'}</Press>
            {sub?.status === 'past_due' && <Press className="btn btn-primary btn-sm" onClick={() => nav('/checkout', { state: { kind: 'renewal' } as CheckoutInput })}>Pay now</Press>}
            {plan?.perSeat && sub?.status === 'active' && <Press className="btn btn-secondary btn-sm" onClick={() => { setSeats(sub.seats); setSeatQuote(null); setSeatOpen(true); }}>Seats: {sub.seats}</Press>}
            {sub?.status === 'active' && !sub.cancelAtPeriodEnd && <Press className="btn btn-ghost btn-sm" onClick={async () => {
              const { ok, reason } = await confirm({ title: 'Cancel your plan?', body: `You keep ${plan?.name} until ${niceDate(sub.currentPeriodEnd)}, then move to Free. Nothing is deleted.`, confirm: 'Cancel plan', danger: true, reason: true, reasonLabel: 'What could we do better?' });
              if (ok) { await cancelSubscription(reason); await s.refreshSaas(); toast({ text: 'Plan will end at period end' }); }
            }}>Cancel plan</Press>}
            {sub?.cancelAtPeriodEnd && <Press className="btn btn-secondary btn-sm" onClick={async () => { await resumeSubscription(); await s.refreshSaas(); toast({ text: 'Your plan will renew' }); }}>Keep my plan</Press>}
          </div>
        </Item>
        <Item className="list-row" onClick={() => nav('/usage')}><span className="grow t">Usage this month</span><span className="hint">See all</span></Item>
        <Item><div className="h-section">Invoices</div></Item>
        <Item>
          {!inv ? <ListSkeleton rows={3} /> : !inv.length ? <Empty icon={<Receipt size={32} />} title="No invoices yet" body="A GST invoice is created for every payment." /> : (
            <div className="list" style={{ borderTop: 0 }}>
              {inv.map((i) => (
                <div key={i.id} className="list-row" onClick={() => open(i)}>
                  <div className="grow"><p className="t mono" style={{ fontSize: 14 }}>{i.number}</p><p className="s">{niceDate(i.date)} · {i.lines[0]?.label}</p></div>
                  <span className={`badge ${i.status === 'paid' ? 'teal' : i.status === 'refunded' ? 'amber' : 'red'}`}>{i.status}</span>
                  <span className="mono" style={{ width: 84, textAlign: 'right' }}>{inrPaise(i.totalPaise)}</span><Download size={16} color="var(--muted)" />
                </div>
              ))}
            </div>
          )}
        </Item>
        {sub?.billing && (
          <Item className="pad" style={{ padding: 16 }}>
            <p className="label">Billed to</p>
            <p style={{ marginTop: 4 }}>{sub.billing.name}{sub.billing.gstin ? ` · ${sub.billing.gstin}` : ''}</p>
            <p className="hint">{sub.billing.email}</p>
            <button className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={async () => {
              const { ok, reason } = await confirm({ title: 'Update GSTIN', body: 'Enter your 15-character GSTIN. It appears on future invoices.', reason: true, reasonLabel: 'GSTIN', confirm: 'Save' });
              if (ok) { await updateBilling({ ...sub.billing, gstin: reason.toUpperCase() }); await s.refreshSaas(); toast({ text: 'Billing details updated' }); }
            }}>Edit GSTIN</button>
          </Item>
        )}
      </Stagger>
      <Sheet open={seatOpen} onClose={() => setSeatOpen(false)} title="Seats"
        footer={<Press className="btn btn-primary btn-block" disabled={seats === sub?.seats} onClick={async () => {
          try {
            const r = await changeSeats(seats);
            if (r.paymentSessionId && r.orderId) { const p = await payWithCashfree(r.paymentSessionId, r.orderId, (import.meta.env.VITE_CASHFREE_MODE as 'sandbox') || 'sandbox'); if (p.result !== 'dismissed') nav(`/payment/${r.orderId}`); }
            else { await s.refreshSaas(); toast({ text: 'Seats updated' }); }
            setSeatOpen(false);
          } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
        }}>{seats > (sub?.seats || 0) ? 'Pay difference' : 'Reduce at renewal'}</Press>}>
        <div className="row" style={{ justifyContent: 'center', gap: 18 }}>
          <Press className="icon-btn" disabled={seats <= (plan?.includedSeats || 1)} onClick={() => setSeats(seats - 1)}><Minus /></Press>
          <motion.span key={seats} initial={{ scale: 1.25 }} animate={{ scale: 1 }} style={{ font: '600 40px var(--font)' }}>{seats}</motion.span>
          <Press className="icon-btn" disabled={seats >= (plan?.maxSeats || 99)} onClick={() => setSeats(seats + 1)}><Plus /></Press>
        </div>
        <p className="hint">Adding seats charges the prorated difference now. Removing seats takes effect at renewal.</p>
        {seatQuote && <p>{inrPaise(seatQuote.totalPaise)}</p>}
      </Sheet>
    </div>
  );
}

export function MyUsage() {
  const s = useSession(); const nav = useNavigate();
  const u = s.usage;
  useEffect(() => { void s.refreshSaas(); }, []);
  return (
    <div className="screen no-nav">
      <AppBar back title="Usage" kicker={u ? `Resets ${niceDate(u.periodEnd)}` : ''} rule />
      {!u ? <ListSkeleton rows={6} /> : (
        <Stagger className="list">
          {METERS.map((m) => {
            const x = u.meters[m.key]; if (!x) return null;
            const cap = x.limit < 0 ? -1 : x.limit + (x.extra || 0);
            const pct = cap < 0 ? 0 : x.used / Math.max(1, cap);
            return (
              <Item key={m.key} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, cursor: 'default' }}>
                <div className="row"><span className="grow t">{m.label}</span><span className="mono" style={{ fontSize: 14 }}>{x.used.toLocaleString('en-IN')}{cap < 0 ? '' : ` / ${cap.toLocaleString('en-IN')}`}</span></div>
                {cap < 0 ? <p className="hint">Unlimited on {s.plan?.name}</p> : <MeterBar pct={pct} />}
                {x.extra > 0 && <p className="hint">Includes {x.extra.toLocaleString('en-IN')} from top-ups</p>}
                {cap >= 0 && pct >= 0.8 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => nav('/plans')}>{pct >= 1 ? 'Limit reached — get more' : 'Running low — get more'}</button>}
              </Item>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}

/** Opens whenever a limit is hit (client pre-check or server 402). */
export function PaywallSheet() {
  const s = useSession(); const nav = useNavigate();
  const m = s.paywall.meter;
  const open = s.paywall.meter !== null || !!s.paywall.reason;
  const x = m ? s.usage?.meters?.[m] : undefined;
  return (
    <Sheet open={open} onClose={s.closePaywall} title={m ? `${meterLabel(m)} limit reached` : 'Upgrade needed'}
      footer={<><Press className="btn btn-secondary" onClick={s.closePaywall}>Not now</Press><Press className="btn btn-primary grow" onClick={() => { s.closePaywall(); nav('/plans'); }}>See plans & top-ups</Press></>}>
      <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--teal-50)', display: 'grid', placeItems: 'center' }}><Sparkles size={30} color="var(--teal-700)" /></motion.div>
      <p style={{ font: '500 16px var(--font)' }}>{s.paywall.reason || (x ? `You’ve used ${x.used} of ${x.limit + x.extra} this month on ${s.plan?.name || 'Free'}.` : 'This needs a higher plan.')}</p>
      <p className="hint" style={{ fontSize: 14 }}>You can still add entries by hand — nothing is blocked. {s.usage ? `Limits reset ${niceDate(s.usage.periodEnd)}.` : ''}</p>
      {s.offers[0] && <div className="banner offer" style={{ borderRadius: 8 }}><Tag size={16} /><span className="grow">{s.offers[0].title}</span><b className="mono">{s.offers[0].code}</b></div>}
    </Sheet>
  );
}

/** Top-of-app banners: owner announcement, trial ending, payment due. */
export function AnnouncementBar() {
  const s = useSession(); const nav = useNavigate();
  const [hidden, setHidden] = useState<string>(() => sessionStorage.getItem('byjan.annHidden') || '');
  const items: Array<{ id: string; tone: string; text: string; go?: string }> = [];
  if (s.sub?.status === 'past_due') items.push({ id: 'pd', tone: 'warning', text: 'Your renewal payment failed — tap to pay and keep your plan.', go: '/billing' });
  if (s.sub?.status === 'trialing' && s.sub.trialEndsAt && Date.parse(s.sub.trialEndsAt) - Date.now() < 3 * 864e5) items.push({ id: 'tr', tone: 'info', text: `Your trial ends ${niceDate(s.sub.trialEndsAt)}. Pick a plan to keep the higher limits.`, go: '/plans' });
  if (s.config.announcement) items.push({ id: `a:${s.config.announcement}`, tone: s.config.announcementTone || 'info', text: s.config.announcement, go: s.config.announcementTone === 'offer' ? '/plans' : undefined });
  const it = items.find((x) => x.id !== hidden);
  return (
    <AnimatePresence>
      {it && (
        <motion.div key={it.id} className={`banner ${it.tone}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ paddingTop: 'calc(10px + var(--safe-t))' }}>
          <Megaphone size={16} /><span className="grow" onClick={() => it.go && nav(it.go)}>{it.text}</span>
          <button className="icon-btn" style={{ width: 32, height: 32, color: 'inherit' }} onClick={() => { setHidden(it.id); sessionStorage.setItem('byjan.annHidden', it.id); }}><X size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { MeterKey };
