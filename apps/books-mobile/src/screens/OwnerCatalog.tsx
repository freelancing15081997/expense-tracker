import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ChevronRight, Archive, X } from 'lucide-react';
import { owner, METERS, meterLabel, type Plan, type AddOn, type Offer, type MeterKey, type Cycle } from '../lib/saas';
import { allOn, tree, toggleFeature } from '../lib/features';
import { inrPaise, paise, todayIso, newId, niceDate } from '../lib/format';
import { AppBar, Empty, Field, ListSkeleton, Seg, Toggle, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item } from '../motion';
import { FeatureTree } from './Owner';

const blankPlan = (): Plan => ({
  id: newId('plan'), name: '', tagline: '', badge: '', sort: 10, visible: true, priceMonthlyPaise: 0, priceAnnualPaise: 0,
  perSeat: false, includedSeats: 1, maxSeats: 1, seatPriceMonthlyPaise: 0, seatPriceAnnualPaise: 0, trialDays: 0,
  limits: Object.fromEntries(METERS.map((m) => [m.key, 0])) as Record<MeterKey, number>, features: allOn(), highlights: [],
});
const rupeesStr = (p: number) => (p ? String(p / 100) : '');

export function OwnerPlans() {
  const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [plans, setPlans] = useState<Plan[] | null>(null); const [addons, setAddons] = useState<AddOn[]>([]);
  const [ad, setAd] = useState<AddOn | null>(null);
  const load = () => owner.listPlans().then((r) => { setPlans(r.plans); setAddons(r.addons); }).catch((e) => toast({ text: e.message, tone: 'error' }));
  useEffect(() => { void load(); }, []);
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Plans & limits" rule right={<Press className="btn btn-primary btn-sm" onClick={() => nav('/owner/plans/new')}><Plus size={16} />Plan</Press>} />
      {!plans ? <ListSkeleton rows={4} /> : (
        <Stagger>
          <Item className="list" style={{ borderTop: 0 }}>
            {plans.slice().sort((a, b) => a.sort - b.sort).map((p) => (
              <div key={p.id} className="list-row" onClick={() => nav(`/owner/plans/${p.id}`)}>
                <div className="grow"><p className="t">{p.name}{p.badge && <span className="badge teal" style={{ marginLeft: 6 }}>{p.badge}</span>}</p><p className="s">{inrPaise(p.priceMonthlyPaise)}/mo · {inrPaise(p.priceAnnualPaise)}/yr{p.perSeat ? ' · per seat' : ''} · {p.limits.receipt_scans < 0 ? '∞' : p.limits.receipt_scans} scans</p></div>
                {p.archived ? <span className="badge">Archived</span> : !p.visible ? <span className="badge amber">Hidden</span> : null}
                <ChevronRight size={18} color="var(--faint)" />
              </div>
            ))}
          </Item>
          <Item><div className="h-section">Top-ups<button onClick={() => setAd({ id: newId('addon'), name: '', meter: 'receipt_scans', quantity: 100, pricePaise: 4900, recurring: false, visible: true })}><Plus size={14} />Add</button></div></Item>
          <Item className="list">
            {addons.map((a) => <div key={a.id} className="list-row" onClick={() => setAd(a)}><div className="grow"><p className="t">{a.name}</p><p className="s">+{a.quantity} {meterLabel(a.meter).toLowerCase()} · {a.recurring ? 'monthly' : 'one-time'}</p></div><span className="mono">{inrPaise(a.pricePaise)}</span>{!a.visible && <span className="badge">Hidden</span>}</div>)}
            {!addons.length && <Empty title="No top-ups yet" />}
          </Item>
        </Stagger>
      )}
      <Sheet open={!!ad} onClose={() => setAd(null)} title="Top-up"
        footer={<Press className="btn btn-primary btn-block" onClick={async () => {
          if (!ad?.name.trim()) { toast({ text: 'Give it a name', tone: 'error' }); return; }
          const { ok, reason } = await confirm({ title: 'Save top-up?', reason: true, confirm: 'Save' }); if (!ok) return;
          await owner.saveAddon(ad, reason); setAd(null); toast({ text: 'Saved' }); void load();
        }}>Save</Press>}>
        {ad && (
          <>
            <Field label="Name"><input className="input" value={ad.name} placeholder="100 extra scans" onChange={(e) => setAd({ ...ad, name: e.target.value })} /></Field>
            <Field label="Adds to"><select className="input" value={ad.meter} onChange={(e) => setAd({ ...ad, meter: e.target.value as MeterKey })}>{METERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></Field>
            <div className="grid2">
              <Field label="Quantity"><input className="input" inputMode="numeric" value={ad.quantity} onChange={(e) => setAd({ ...ad, quantity: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
              <Field label="Price ₹ (ex-GST)"><input className="input" inputMode="decimal" value={rupeesStr(ad.pricePaise)} onChange={(e) => setAd({ ...ad, pricePaise: paise(e.target.value) })} /></Field>
            </div>
            <Toggle on={ad.recurring} onChange={(v) => setAd({ ...ad, recurring: v })} label="Renews every month" />
            <Toggle on={ad.visible} onChange={(v) => setAd({ ...ad, visible: v })} label="Show in the app" />
          </>
        )}
      </Sheet>
    </div>
  );
}

export function OwnerPlanEdit() {
  const { planId = 'new' } = useParams(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [p, setP] = useState<Plan | null>(null); const [err, setErr] = useState<Record<string, string>>({}); const [hl, setHl] = useState('');
  useEffect(() => {
    if (planId === 'new') { setP(blankPlan()); return; }
    void owner.listPlans().then((r) => setP(r.plans.find((x) => x.id === planId) || null));
  }, [planId]);
  if (!p) return <div className="screen no-nav"><AppBar back="/owner/plans" title="Plan" rule /><ListSkeleton /></div>;
  const save = async () => {
    const e: Record<string, string> = {};
    if (!p.name.trim()) e.name = 'Name the plan';
    if (p.priceAnnualPaise && p.priceMonthlyPaise && p.priceAnnualPaise > p.priceMonthlyPaise * 12) e.annual = 'Annual is more than 12 × monthly';
    if (p.perSeat && p.maxSeats < p.includedSeats) e.seats = 'Max seats must be ≥ included seats';
    setErr(e); if (Object.keys(e).length) return;
    const { ok, reason } = await confirm({ title: `Save ${p.name}?`, body: 'Price changes apply to new purchases and at each person’s next renewal. Limit and feature changes apply right away.', reason: true, confirm: 'Save plan' });
    if (!ok) return;
    try { await owner.savePlan(p, reason); toast({ text: 'Plan saved' }); nav('/owner/plans', { replace: true }); } catch (x) { toast({ text: (x as Error).message, tone: 'error' }); }
  };
  return (
    <div className="screen no-nav">
      <AppBar back="/owner/plans" title={planId === 'new' ? 'New plan' : p.name} rule right={<Press className="btn btn-primary btn-sm" onClick={save}>Save</Press>} />
      <div className="stack" style={{ padding: 16, gap: 16 }}>
        <Field label="Name" error={err.name}><input className={`input ${err.name ? 'bad' : ''}`} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Tagline"><input className="input" value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} /></Field>
        <div className="grid2">
          <Field label="Badge" optional><input className="input" value={p.badge || ''} placeholder="Most popular" onChange={(e) => setP({ ...p, badge: e.target.value })} /></Field>
          <Field label="Order"><input className="input" inputMode="numeric" value={p.sort} onChange={(e) => setP({ ...p, sort: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
        </div>
        <Toggle on={p.visible} onChange={(v) => setP({ ...p, visible: v })} label="Show on the Plans screen" hint="Hidden plans can still be given to people by you" />

        <div className="h-section" style={{ margin: 0 }}>Price (₹, before GST)</div>
        <div className="grid2">
          <Field label="Monthly"><input className="input" inputMode="decimal" value={rupeesStr(p.priceMonthlyPaise)} onChange={(e) => setP({ ...p, priceMonthlyPaise: paise(e.target.value) })} /></Field>
          <Field label="Annual" error={err.annual}><input className="input" inputMode="decimal" value={rupeesStr(p.priceAnnualPaise)} onChange={(e) => setP({ ...p, priceAnnualPaise: paise(e.target.value) })} /></Field>
        </div>
        <Field label="Free trial days"><input className="input" inputMode="numeric" value={p.trialDays} onChange={(e) => setP({ ...p, trialDays: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
        <Toggle on={p.perSeat} onChange={(v) => setP({ ...p, perSeat: v, maxSeats: v ? Math.max(p.maxSeats, 50) : 1 })} label="Charge per team seat" hint="For teams sharing one subscription" />
        {p.perSeat && (
          <>
            <div className="grid2">
              <Field label="Seats included"><input className="input" inputMode="numeric" value={p.includedSeats} onChange={(e) => setP({ ...p, includedSeats: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></Field>
              <Field label="Max seats" error={err.seats}><input className="input" inputMode="numeric" value={p.maxSeats} onChange={(e) => setP({ ...p, maxSeats: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></Field>
            </div>
            <div className="grid2">
              <Field label="Extra seat / month"><input className="input" inputMode="decimal" value={rupeesStr(p.seatPriceMonthlyPaise)} onChange={(e) => setP({ ...p, seatPriceMonthlyPaise: paise(e.target.value) })} /></Field>
              <Field label="Extra seat / year"><input className="input" inputMode="decimal" value={rupeesStr(p.seatPriceAnnualPaise)} onChange={(e) => setP({ ...p, seatPriceAnnualPaise: paise(e.target.value) })} /></Field>
            </div>
          </>
        )}

        <div className="h-section" style={{ margin: 0 }}>Limits</div>
        {METERS.map((m) => {
          const v = p.limits[m.key] ?? 0; const unl = v < 0;
          return (
            <div key={m.key} className="row" style={{ gap: 10 }}>
              <div className="grow"><p style={{ font: '500 14.5px var(--font)' }}>{m.label}</p><p className="hint">{m.monthly ? 'per month' : 'at any time'}</p></div>
              <input className="input" style={{ width: 100 }} inputMode="numeric" disabled={unl} value={unl ? '' : v} placeholder={unl ? '∞' : '0'} onChange={(e) => setP({ ...p, limits: { ...p.limits, [m.key]: Number(e.target.value.replace(/\D/g, '')) || 0 } })} />
              <button className={`chip ${unl ? 'on' : ''}`} onClick={() => setP({ ...p, limits: { ...p.limits, [m.key]: unl ? 0 : -1 } })}>∞</button>
            </div>
          );
        })}

        <div className="h-section" style={{ margin: 0 }}>Features on this plan</div>
        <p className="hint">Everything is on by default. Turn something off here and nobody on this plan sees it — unless you give a person custom access.</p>
        {(['Money', 'App', 'Business'] as const).map((g) => (
          <div key={g} className="card" style={{ padding: '0 8px' }}><p className="kicker" style={{ padding: '12px 8px 4px' }}>{g}</p><FeatureTree nodes={tree(g)} map={p.features} onToggle={(k) => setP({ ...p, features: toggleFeature(p.features, k) })} /></div>
        ))}

        <div className="h-section" style={{ margin: 0 }}>Highlights</div>
        {p.highlights.map((h, i) => <div key={i} className="row"><span className="grow">{h}</span><button className="icon-btn" onClick={() => setP({ ...p, highlights: p.highlights.filter((_, j) => j !== i) })}><X size={16} /></button></div>)}
        <div className="row"><input className="input" value={hl} placeholder="Priority support" onChange={(e) => setHl(e.target.value)} /><Press className="btn btn-secondary" onClick={() => { if (hl.trim()) { setP({ ...p, highlights: [...p.highlights, hl.trim()] }); setHl(''); } }}><Plus size={18} /></Press></div>

        {planId !== 'new' && !p.archived && (
          <Press className="btn btn-danger btn-block" onClick={async () => {
            const { ok, reason } = await confirm({ title: `Archive ${p.name}?`, body: 'It disappears from Plans. People already on it keep it until they change.', danger: true, reason: true, confirm: 'Archive' });
            if (ok) { await owner.archivePlan(p.id, reason); toast({ text: 'Archived' }); nav('/owner/plans', { replace: true }); }
          }}><Archive size={18} />Archive plan</Press>
        )}
      </div>
    </div>
  );
}

const offerState = (o: Offer) => { const t = todayIso(); return !o.active ? ['Off', ''] : o.startsAt > t ? ['Scheduled', 'amber'] : o.endsAt && o.endsAt < t ? ['Ended', ''] : ['Live', 'teal']; };
const offerValue = (o: Offer) => (o.kind === 'percent' ? `${o.value}% off` : o.kind === 'flat' ? `${inrPaise(o.value)} off` : o.kind === 'extra_days' ? `+${o.value} days` : `+${o.value} ${o.meter ? meterLabel(o.meter).toLowerCase() : ''}`);

export function OwnerOffers() {
  const nav = useNavigate(); const toast = useToast();
  const [rows, setRows] = useState<Offer[] | null>(null);
  useEffect(() => { void owner.listOffers().then((r) => setRows(r.offers)).catch((e) => toast({ text: e.message, tone: 'error' })); }, []);
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Offers & coupons" rule right={<Press className="btn btn-primary btn-sm" onClick={() => nav('/owner/offers/new')}><Plus size={16} />Offer</Press>} />
      {!rows ? <ListSkeleton rows={5} /> : !rows.length ? <Empty title="No offers yet" body="Create a coupon code or a banner offer that applies automatically this month." /> : (
        <Stagger className="list" style={{ borderTop: 0 }}>
          {rows.map((o) => { const [label, cls] = offerState(o); return (
            <Item key={o.id} className="list-row" onClick={() => nav(`/owner/offers/${o.id}`)}>
              <div className="grow"><p className="t">{o.title} <span className="mono hint">{o.code}</span></p><p className="s">{offerValue(o)} · {niceDate(o.startsAt)} – {o.endsAt ? niceDate(o.endsAt) : 'no end'} · {o.redemptions || 0}{o.maxRedemptions ? `/${o.maxRedemptions}` : ''} used</p></div>
              <span className={`badge ${cls}`}>{label}</span>
            </Item>
          ); })}
        </Stagger>
      )}
    </div>
  );
}

export function OwnerOfferEdit() {
  const { offerId = 'new' } = useParams(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [o, setO] = useState<Offer | null>(null); const [plans, setPlans] = useState<Plan[]>([]); const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => {
    void owner.listPlans().then((r) => setPlans(r.plans));
    if (offerId === 'new') {
      const end = new Date(); end.setMonth(end.getMonth() + 1, 0);
      setO({ id: newId('offer'), code: '', title: '', description: '', kind: 'percent', value: 20, planIds: [], cycles: ['monthly', 'annual'], startsAt: todayIso(), endsAt: end.toISOString().slice(0, 10), maxRedemptions: 0, perUserLimit: 1, firstPaymentOnly: false, autoApply: false, active: true });
    } else void owner.listOffers().then((r) => setO(r.offers.find((x) => x.id === offerId) || null));
  }, [offerId]);
  if (!o) return <div className="screen no-nav"><AppBar back="/owner/offers" title="Offer" rule /><ListSkeleton /></div>;
  const save = async () => {
    const e: Record<string, string> = {};
    if (!/^[A-Z0-9_-]{3,20}$/.test(o.code)) e.code = '3–20 letters/numbers, no spaces';
    if (!o.title.trim()) e.title = 'Title shown to people';
    if (o.kind === 'percent' && (o.value <= 0 || o.value > 100)) e.value = '1–100%';
    if (o.value <= 0) e.value = e.value || 'Must be more than 0';
    if (o.endsAt && o.endsAt < o.startsAt) e.endsAt = 'Ends before it starts';
    if (o.kind === 'extra_quota' && !o.meter) e.meter = 'Pick what to give more of';
    setErr(e); if (Object.keys(e).length) return;
    const { ok, reason } = await confirm({ title: `Save ${o.code}?`, reason: true, confirm: 'Save offer' }); if (!ok) return;
    try { await owner.saveOffer(o, reason); toast({ text: 'Offer saved' }); nav('/owner/offers', { replace: true }); } catch (x) { toast({ text: (x as Error).message, tone: 'error' }); }
  };
  const togglePlan = (id: string) => setO({ ...o, planIds: o.planIds.includes(id) ? o.planIds.filter((x) => x !== id) : [...o.planIds, id] });
  const toggleCycle = (c: Cycle) => setO({ ...o, cycles: o.cycles.includes(c) ? o.cycles.filter((x) => x !== c) : [...o.cycles, c] });
  return (
    <div className="screen no-nav">
      <AppBar back="/owner/offers" title={offerId === 'new' ? 'New offer' : o.code} rule right={<Press className="btn btn-primary btn-sm" onClick={save}>Save</Press>} />
      <div className="stack" style={{ padding: 16, gap: 16 }}>
        <Toggle on={o.active} onChange={(v) => setO({ ...o, active: v })} label="Offer is on" />
        <Field label="Code" error={err.code}><input className={`input mono ${err.code ? 'bad' : ''}`} value={o.code} autoCapitalize="characters" onChange={(e) => setO({ ...o, code: e.target.value.toUpperCase().replace(/\s/g, '') })} /></Field>
        <Field label="Title" error={err.title}><input className={`input ${err.title ? 'bad' : ''}`} value={o.title} placeholder="Diwali — 50% off annual" onChange={(e) => setO({ ...o, title: e.target.value })} /></Field>
        <Field label="Description" optional><input className="input" value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} /></Field>
        <Field label="Gives"><Seg id="okind" value={o.kind} onChange={(v) => setO({ ...o, kind: v })} options={[{ value: 'percent', label: '% off' }, { value: 'flat', label: '₹ off' }, { value: 'extra_days', label: 'Free days' }, { value: 'extra_quota', label: 'Extra quota' }]} /></Field>
        <div className="grid2">
          <Field label={o.kind === 'percent' ? 'Percent' : o.kind === 'flat' ? 'Rupees' : o.kind === 'extra_days' ? 'Days' : 'Amount'} error={err.value}>
            <input className={`input ${err.value ? 'bad' : ''}`} inputMode="decimal" value={o.kind === 'flat' ? rupeesStr(o.value) : o.value || ''} onChange={(e) => setO({ ...o, value: o.kind === 'flat' ? paise(e.target.value) : Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 })} />
          </Field>
          {o.kind === 'extra_quota' && <Field label="Of" error={err.meter}><select className="input" value={o.meter || ''} onChange={(e) => setO({ ...o, meter: e.target.value as MeterKey })}><option value="">Choose…</option>{METERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></Field>}
        </div>
        <Field label="Plans" hint="None selected = every paid plan"><div className="chips" style={{ flexWrap: 'wrap' }}>{plans.filter((p) => !p.archived && p.priceMonthlyPaise > 0).map((p) => <button key={p.id} className={`chip ${o.planIds.includes(p.id) ? 'on' : ''}`} onClick={() => togglePlan(p.id)}>{p.name}</button>)}</div></Field>
        <Field label="Billing cycles"><div className="chips">{(['monthly', 'annual'] as Cycle[]).map((c) => <button key={c} className={`chip ${o.cycles.includes(c) ? 'on' : ''}`} onClick={() => toggleCycle(c)}>{c === 'monthly' ? 'Monthly' : 'Annual'}</button>)}</div></Field>
        <div className="grid2">
          <Field label="Starts"><input className="input" type="date" value={o.startsAt} onChange={(e) => setO({ ...o, startsAt: e.target.value })} /></Field>
          <Field label="Ends" error={err.endsAt} optional><input className="input" type="date" value={o.endsAt} onChange={(e) => setO({ ...o, endsAt: e.target.value })} /></Field>
        </div>
        <div className="grid2">
          <Field label="Total uses" hint="0 = no cap"><input className="input" inputMode="numeric" value={o.maxRedemptions} onChange={(e) => setO({ ...o, maxRedemptions: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
          <Field label="Per person"><input className="input" inputMode="numeric" value={o.perUserLimit} onChange={(e) => setO({ ...o, perUserLimit: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></Field>
        </div>
        <Toggle on={o.firstPaymentOnly} onChange={(v) => setO({ ...o, firstPaymentOnly: v })} label="First payment only" hint="Renewals go back to full price" />
        <Toggle on={o.autoApply} onChange={(v) => setO({ ...o, autoApply: v })} label="Apply automatically & show banner" hint="No code needed — shown on Plans and in the app banner" />
      </div>
    </div>
  );
}
