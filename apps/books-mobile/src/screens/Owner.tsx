import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, CreditCard, Tag, Gauge, Receipt, ScrollText, Settings2, Search, ChevronRight, ShieldOff, ShieldCheck, Gift, RotateCcw, ChevronDown } from 'lucide-react';
import { owner, METERS, meterLabel, type OwnerOverview, type OwnerUser, type Plan, type Subscription, type Usage, type Payment, type MeterKey, type Cycle } from '../lib/saas';
import { tree, toggleFeature, allOn, type FeatureMap, type FeatureNode } from '../lib/features';
import { useSession } from '../lib/session';
import { inrPaise, niceDate, relTime } from '../lib/format';
import { AppBar, Avatar, Empty, Field, ListSkeleton, Seg, Toggle, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, CountUp, MeterBar, motion, AnimatePresence } from '../motion';

const SUB_BADGE: Record<string, string> = { free: '', trialing: 'teal', active: 'teal', past_due: 'red', cancelled: 'amber', expired: 'red' };

/** Owner-only. The route itself is only registered when session.isOwner; the server re-checks every call. */
export function OwnerHome() {
  const nav = useNavigate(); const toast = useToast();
  const [o, setO] = useState<OwnerOverview | null>(null);
  useEffect(() => { void owner.overview().then((r) => setO(r.overview)).catch((e) => toast({ text: e.message, tone: 'error' })); }, []);
  const tiles = [
    { to: '/owner/users', icon: <Users size={20} />, label: 'Users & access', sub: o ? `${o.users.toLocaleString('en-IN')} people` : '' },
    { to: '/owner/plans', icon: <CreditCard size={20} />, label: 'Plans, limits & top-ups', sub: 'Prices, quotas, features per plan' },
    { to: '/owner/offers', icon: <Tag size={20} />, label: 'Offers & coupons', sub: 'Monthly campaigns, codes, banners' },
    { to: '/owner/usage', icon: <Gauge size={20} />, label: 'Usage', sub: o ? `${o.nearLimitUsers} near a limit` : '' },
    { to: '/owner/payments', icon: <Receipt size={20} />, label: 'Payments & refunds', sub: o ? `${o.failedPayments} failed this month` : '' },
    { to: '/owner/audit', icon: <ScrollText size={20} />, label: 'Audit log', sub: 'Every owner action with reason' },
    { to: '/owner/config', icon: <Settings2 size={20} />, label: 'App settings', sub: 'Maintenance, announcement, GST, trial' },
  ];
  const maxRev = Math.max(1, ...(o?.revenueByMonth || []).map((r) => r.paise));
  return (
    <div className="screen no-nav">
      <AppBar back="/settings" title="Owner console" kicker="Byjan platform" rule />
      {!o ? <ListSkeleton rows={4} /> : (
        <Stagger>
          <Item className="cells" style={{ borderTop: 0 }}>
            <div><p className="cell-label">MRR</p><p className="cell-value"><CountUp value={o.mrrPaise / 100} format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`} /></p></div>
            <div><p className="cell-label">This month</p><p className="cell-value"><CountUp value={o.revenueThisMonthPaise / 100} format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`} /></p></div>
            <div><p className="cell-label">Paying</p><p className="cell-value"><CountUp value={o.payingUsers} /></p></div>
            <div><p className="cell-label">On trial</p><p className="cell-value"><CountUp value={o.trialing} /></p></div>
            <div><p className="cell-label">Payment due</p><p className="cell-value" style={{ color: o.pastDue ? 'var(--red-700)' : undefined }}>{o.pastDue}</p></div>
            <div><p className="cell-label">Churned</p><p className="cell-value">{o.churnedThisMonth}</p></div>
          </Item>
          <Item className="pad" style={{ padding: 16 }}>
            <div className="card card-pad">
              <p style={{ font: '600 15px var(--font)' }}>Revenue by month</p>
              <div className="row" style={{ alignItems: 'flex-end', height: 120, gap: 6, marginTop: 12, borderBottom: '1px solid var(--ink)' }}>
                {o.revenueByMonth.slice(-12).map((r, i, a) => <motion.div key={r.month} title={`${r.month} · ${inrPaise(r.paise)}`} initial={{ height: 0 }} animate={{ height: `${(r.paise / maxRev) * 100}%` }} transition={{ delay: i * 0.03, duration: 0.5 }} style={{ flex: 1, background: i === a.length - 1 ? 'var(--teal-700)' : '#CDEBE1', borderRadius: '3px 3px 0 0' }} />)}
              </div>
              <div className="row" style={{ marginTop: 14, gap: 16, flexWrap: 'wrap' }}>
                {o.planMix.map((p) => <div key={p.planId}><p className="hint">{p.name}</p><p style={{ font: '600 17px var(--font)' }}>{p.users.toLocaleString('en-IN')}</p></div>)}
              </div>
            </div>
          </Item>
          <Item className="list">
            {tiles.map((t) => (
              <div key={t.to} className="list-row" onClick={() => nav(t.to)}>
                <span style={{ color: 'var(--teal-700)' }}>{t.icon}</span><div className="grow"><p className="t">{t.label}</p><p className="s">{t.sub}</p></div><ChevronRight size={18} color="var(--faint)" />
              </div>
            ))}
          </Item>
        </Stagger>
      )}
    </div>
  );
}

export function OwnerUsers() {
  const nav = useNavigate(); const toast = useToast();
  const [q, setQ] = useState(''); const [planId, setPlanId] = useState(''); const [status, setStatus] = useState('');
  const [rows, setRows] = useState<OwnerUser[] | null>(null); const [next, setNext] = useState<string | undefined>(); const [total, setTotal] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => { void owner.listPlans().then((r) => setPlans(r.plans)).catch(() => undefined); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setRows(null); void owner.listUsers(q.trim(), { planId: planId || undefined, status: status || undefined }).then((r) => { setRows(r.users); setNext(r.next); setTotal(r.total); }).catch((e) => { toast({ text: e.message, tone: 'error' }); setRows([]); }); }, 250);
    return () => clearTimeout(t);
  }, [q, planId, status]);
  const more = async () => { if (!next) return; const r = await owner.listUsers(q.trim(), { planId: planId || undefined, status: status || undefined }, next); setRows((x) => [...(x || []), ...r.users]); setNext(r.next); };
  return (
    <div className="screen no-nav">
      <AppBar back="/owner" title="Users & access" kicker={rows ? `${total.toLocaleString('en-IN')} people` : ''} rule />
      <div className="stack" style={{ padding: '12px 16px', gap: 10, background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <label className="row input" style={{ gap: 8 }}><Search size={18} color="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or UID" style={{ border: 0, outline: 'none', flex: 1, minWidth: 0, background: 'none', fontSize: 16 }} /></label>
        <div className="chips">
          {[{ id: '', name: 'All plans' }, ...plans].map((p) => <button key={p.id || 'all'} className={`chip ${planId === p.id ? 'on' : ''}`} onClick={() => setPlanId(p.id)}>{p.name}</button>)}
        </div>
        <div className="chips">
          {[['', 'Any status'], ['trialing', 'Trial'], ['active', 'Paying'], ['past_due', 'Payment due'], ['cancelled', 'Cancelled'], ['suspended', 'Suspended'], ['override', 'Custom access']].map(([v, l]) => <button key={v || 'any'} className={`chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}
        </div>
      </div>
      {!rows ? <ListSkeleton rows={8} /> : !rows.length ? <Empty title="No one matches" /> : (
        <Stagger className="list" style={{ borderTop: 0 }}>
          {rows.map((u) => (
            <Item key={u.uid} className="list-row" onClick={() => nav(`/owner/users/${u.uid}`)}>
              <Avatar name={u.displayName || u.email} />
              <div className="grow"><p className="t ellipsis">{u.displayName || u.email}</p><p className="s ellipsis">{u.email} · {u.books} books · {relTime(u.lastActiveAt)}</p></div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                <span className={`badge ${SUB_BADGE[u.subStatus]}`}>{plans.find((p) => p.id === u.planId)?.name || u.planId}</span>
                {u.status === 'suspended' ? <span className="badge red">Suspended</span> : u.hasFeatureOverride ? <span className="badge amber">Custom</span> : null}
              </div>
            </Item>
          ))}
          {next && <div className="pad" style={{ padding: 16 }}><Press className="btn btn-secondary btn-block" onClick={more}>Load more</Press></div>}
        </Stagger>
      )}
    </div>
  );
}

function FeatureTree({ nodes, map, onToggle, planMap, depth = 0 }: { nodes: FeatureNode[]; map: FeatureMap; onToggle: (k: string) => void; planMap?: FeatureMap; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <>
      {nodes.map((n) => {
        const blockedByPlan = planMap && planMap[n.key] === false;
        return (
          <div key={n.key}>
            <div className="row" style={{ paddingLeft: depth * 18, minHeight: 52, borderBottom: '1px solid var(--line)' }}>
              {n.children.length > 0 ? <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setOpen({ ...open, [n.key]: !open[n.key] })}><motion.span animate={{ rotate: open[n.key] ? 0 : -90 }} style={{ display: 'grid' }}><ChevronDown size={16} /></motion.span></button> : <span style={{ width: 32 }} />}
              <div className="grow"><p style={{ font: `${depth === 0 ? 600 : 500} 14.5px var(--font)` }}>{n.label}{n.smart && <span className="badge teal" style={{ marginLeft: 6, height: 18 }}>Smart</span>}</p><p className="hint">{blockedByPlan ? 'Off on this person’s plan' : n.hint}</p></div>
              <motion.button type="button" role="switch" aria-checked={!!map[n.key]} onClick={() => onToggle(n.key)}
                style={{ flex: 'none', width: 44, height: 26, borderRadius: 13, border: 0, padding: 3, background: map[n.key] ? 'var(--teal-700)' : 'var(--line-2)', display: 'flex', justifyContent: map[n.key] ? 'flex-end' : 'flex-start', cursor: 'pointer', opacity: blockedByPlan ? 0.5 : 1 }}>
                <motion.span layout style={{ width: 20, height: 20, borderRadius: 10, background: '#fff' }} />
              </motion.button>
            </div>
            <AnimatePresence initial={false}>
              {open[n.key] && n.children.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <FeatureTree nodes={n.children} map={map} onToggle={onToggle} planMap={planMap} depth={depth + 1} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
}
export { FeatureTree };

export function OwnerUser() {
  const { uid = '' } = useParams();
  const s = useSession(); const toast = useToast(); const confirm = useConfirm();
  const [d, setD] = useState<{ user: OwnerUser; subscription: Subscription; usage: Usage; payments: Payment[]; bookList: Array<{ id: string; name: string; role: string; entries: number }> } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tab, setTab] = useState<'access' | 'plan' | 'usage' | 'activity'>('access');
  const [map, setMap] = useState<FeatureMap>({}); const [custom, setCustom] = useState(false);
  const [planSheet, setPlanSheet] = useState(false); const [pf, setPf] = useState<{ planId: string; cycle: Cycle; seats: number; until: string; comp: boolean }>({ planId: '', cycle: 'monthly', seats: 1, until: '', comp: true });
  const [grant, setGrant] = useState<{ meter: MeterKey; amount: string } | null>(null);
  const load = async () => {
    const [u, p] = await Promise.all([owner.getUser(uid), owner.listPlans()]);
    setD(u); setPlans(p.plans); setMap(u.user.features || allOn()); setCustom(!!u.user.hasFeatureOverride);
  };
  useEffect(() => { void load().catch((e) => toast({ text: e.message, tone: 'error' })); }, [uid]);
  const plan = useMemo(() => plans.find((p) => p.id === d?.subscription.planId), [plans, d]);
  if (!d) return <div className="screen no-nav"><AppBar back="/owner/users" title="User" rule /><ListSkeleton rows={6} /></div>;
  const u = d.user;
  const self = u.uid === s.user?.uid;

  const saveAccess = async (reset: boolean) => {
    const { ok, reason } = await confirm({ title: reset ? 'Reset to plan defaults?' : `Save access for ${u.displayName || u.email}?`, body: reset ? 'Their features follow their plan again.' : 'Takes effect the next time they open the app.', reason: true, confirm: 'Save' });
    if (!ok) return;
    try { await owner.setUserFeatures(uid, reset ? null : map, reason); toast({ text: reset ? 'Back to plan defaults' : 'Access saved' }); void load(); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
  };

  return (
    <div className="screen no-nav">
      <AppBar back="/owner/users" title={u.displayName || u.email} kicker={u.email} rule />
      <div className="row pad" style={{ padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', gap: 12 }}>
        <Avatar name={u.displayName || u.email} size={48} />
        <div className="grow"><p style={{ font: '600 16px var(--font)' }}>{plan?.name || d.subscription.planId} <span className={`badge ${SUB_BADGE[d.subscription.status]}`}>{d.subscription.status.replace('_', ' ')}</span></p><p className="hint">Joined {niceDate(u.createdAt)} · {u.entries.toLocaleString('en-IN')} entries · {inrPaise(u.mrrPaise)}/mo</p></div>
        {!self && <Press className={`btn btn-sm ${u.status === 'suspended' ? 'btn-secondary' : 'btn-danger'}`} onClick={async () => {
          const sus = u.status !== 'suspended';
          const { ok, reason } = await confirm({ title: sus ? 'Suspend this person?' : 'Restore access?', body: sus ? 'They are signed out and can’t sign in. Their books stay intact.' : 'They can sign in again straight away.', danger: sus, reason: true, confirm: sus ? 'Suspend' : 'Restore' });
          if (ok) { await owner.setUserStatus(uid, sus ? 'suspended' : 'active', reason); toast({ text: sus ? 'Suspended' : 'Restored' }); void load(); }
        }}>{u.status === 'suspended' ? <><ShieldCheck size={15} />Restore</> : <><ShieldOff size={15} />Suspend</>}</Press>}
      </div>
      <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <Seg id="outab" value={tab} onChange={setTab} options={[{ value: 'access', label: 'Access' }, { value: 'plan', label: 'Plan' }, { value: 'usage', label: 'Usage' }, { value: 'activity', label: 'Activity' }]} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'access' && (
            <div>
              <div className="pad" style={{ padding: '12px 16px' }}>
                <Toggle on={custom} onChange={(v) => { setCustom(v); if (!v) void saveAccess(true); }} label="Custom access for this person" hint={custom ? 'Overrides their plan’s feature set' : `Following ${plan?.name || 'plan'} defaults`} />
              </div>
              {custom && (
                <>
                  {(['Money', 'App', 'Business'] as const).map((g) => (
                    <div key={g}>
                      <div className="h-section">{g}</div>
                      <div style={{ background: 'var(--surface)', padding: '0 8px' }}><FeatureTree nodes={tree(g)} map={map} onToggle={(k) => setMap(toggleFeature(map, k))} planMap={plan?.features} /></div>
                    </div>
                  ))}
                  <div className="row pad" style={{ padding: 16, gap: 10 }}>
                    <Press className="btn btn-secondary" onClick={() => setMap(plan?.features || allOn())}><RotateCcw size={16} />Plan defaults</Press>
                    <Press className="btn btn-primary grow" onClick={() => saveAccess(false)}>Save access</Press>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === 'plan' && (
            <div className="stack" style={{ padding: 16 }}>
              <div className="card card-pad stack" style={{ gap: 6 }}>
                <p className="row"><span className="grow hint">Plan</span><b>{plan?.name}</b></p>
                <p className="row"><span className="grow hint">Cycle</span><span>{d.subscription.cycle}</span></p>
                <p className="row"><span className="grow hint">Seats</span><span>{d.subscription.seats}</span></p>
                <p className="row"><span className="grow hint">Period ends</span><span>{niceDate(d.subscription.currentPeriodEnd || d.subscription.trialEndsAt)}</span></p>
                {d.subscription.billing?.gstin && <p className="row"><span className="grow hint">GSTIN</span><span className="mono">{d.subscription.billing.gstin}</span></p>}
              </div>
              <Press className="btn btn-primary btn-block" onClick={() => { setPf({ planId: d.subscription.planId, cycle: d.subscription.cycle, seats: d.subscription.seats, until: '', comp: true }); setPlanSheet(true); }}><Gift size={18} />Change plan / give free months</Press>
              <div className="h-section" style={{ margin: 0 }}>Payments</div>
              {!d.payments.length ? <p className="hint">No payments yet.</p> : d.payments.map((p) => (
                <div key={p.id} className="row card card-pad"><div className="grow"><p className="mono" style={{ fontSize: 13.5 }}>{p.invoiceNumber || p.orderId}</p><p className="hint">{niceDate(p.createdAt)} · {p.method}</p></div><span className={`badge ${p.status === 'SUCCESS' ? 'teal' : p.status === 'FAILED' ? 'red' : 'amber'}`}>{p.status}</span><span className="mono">{inrPaise(p.amountPaise)}</span></div>
              ))}
            </div>
          )}
          {tab === 'usage' && (
            <div className="list">
              {METERS.map((m) => {
                const x = d.usage.meters[m.key]; if (!x) return null;
                const cap = x.limit < 0 ? -1 : x.limit + (x.extra || 0);
                return (
                  <div key={m.key} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, cursor: 'default' }}>
                    <div className="row"><span className="grow t">{m.label}</span><span className="mono">{x.used}{cap < 0 ? ' · unlimited' : ` / ${cap}`}</span></div>
                    {cap >= 0 && <MeterBar pct={x.used / Math.max(1, cap)} />}
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => setGrant({ meter: m.key, amount: '' })}>Give extra</button>
                      {m.monthly && <button className="btn btn-ghost btn-sm" onClick={async () => { const { ok, reason } = await confirm({ title: `Reset ${m.label.toLowerCase()} to 0?`, reason: true, confirm: 'Reset' }); if (ok) { await owner.resetUsage(uid, m.key, reason); void load(); } }}>Reset count</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'activity' && (
            <div className="list">
              {d.bookList.map((b) => <div key={b.id} className="list-row" style={{ cursor: 'default' }}><div className="grow"><p className="t">{b.name}</p><p className="s">{b.role} · {b.entries} entries</p></div></div>)}
              {!d.bookList.length && <Empty title="No books yet" />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <Sheet open={planSheet} onClose={() => setPlanSheet(false)} title="Change plan"
        footer={<Press className="btn btn-primary btn-block" onClick={async () => {
          const { ok, reason } = await confirm({ title: 'Apply this plan?', body: pf.comp ? `Free until ${pf.until || 'you change it'} — no charge.` : 'They’ll be charged at their next renewal.', reason: true, confirm: 'Apply' });
          if (!ok) return;
          try { await owner.setUserPlan(uid, { ...pf, until: pf.until || undefined }, reason); setPlanSheet(false); toast({ text: 'Plan updated' }); void load(); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
        }}>Apply</Press>}>
        <Field label="Plan"><select className="input" value={pf.planId} onChange={(e) => setPf({ ...pf, planId: e.target.value })}>{plans.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Cycle"><Seg id="pfc" value={pf.cycle} onChange={(v) => setPf({ ...pf, cycle: v })} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} /></Field>
        <Field label="Seats"><input className="input" inputMode="numeric" value={pf.seats} onChange={(e) => setPf({ ...pf, seats: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></Field>
        <Toggle on={pf.comp} onChange={(v) => setPf({ ...pf, comp: v })} label="Complimentary (no charge)" hint="For partners, support goodwill or testing" />
        {pf.comp && <Field label="Free until" optional><input className="input" type="date" value={pf.until} onChange={(e) => setPf({ ...pf, until: e.target.value })} /></Field>}
      </Sheet>
      <Sheet open={!!grant} onClose={() => setGrant(null)} title={grant ? `Give extra ${meterLabel(grant.meter).toLowerCase()}` : ''}
        footer={<Press className="btn btn-primary btn-block" disabled={!grant?.amount} onClick={async () => {
          if (!grant) return; const { ok, reason } = await confirm({ title: `Add ${grant.amount}?`, body: 'Valid until this month’s usage resets.', reason: true, confirm: 'Add' });
          if (ok) { await owner.grantQuota(uid, grant.meter, Number(grant.amount), reason); setGrant(null); toast({ text: 'Extra quota added' }); void load(); }
        }}>Add</Press>}>
        <Field label="How many"><input className="input" inputMode="numeric" value={grant?.amount || ''} onChange={(e) => grant && setGrant({ ...grant, amount: e.target.value.replace(/\D/g, '') })} autoFocus /></Field>
      </Sheet>
    </div>
  );
}
