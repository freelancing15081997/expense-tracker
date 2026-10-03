import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useColors } from '../state/AppContext';
import { adminApi, ApiError, billingApi, booksApi, importApi, supportApi, Plan, Role, Ticket } from '../api';
import { useMutation, useQuery } from '../hooks/useApi';
import { inr } from '../theme/tokens';
import { Button, Card, Chip, ChipRow, CircleBtn, ErrorBox, Gap, Header, Icon, IconTile, Input, KV, Label, LinkText, Loading, Pill, Progress, Row, Screen, Segmented, T, Toggle } from '../components/ui';
import type { IconName } from '../components/icons';
import type { ScreenProps } from '../navigation/types';
import { pickDocument } from '../native/device';

/* ---------- B3 Plans ---------- */
export function PlansScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const plans = useQuery(billingApi.plans); const usage = useQuery(billingApi.usage);
  const [annual, setAnnual] = useState(false); const [sel, setSel] = useState('plus');
  return (
    <Screen footer={<Button label={sel === 'free' ? "You're on Free" : 'Continue with ' + (plans.data?.find(x => x.id === sel)?.name ?? '')} disabled={sel === 'free'} onPress={() => navigation.navigate('Checkout', { plan: sel, cycle: annual ? 'annual' : 'monthly' })} />}>
      <Header title="Plans" right={<LinkText label="Restore" onPress={async () => { const r = await billingApi.restore(); showToast('Restored your ' + r.plan.toUpperCase() + ' plan'); }} />} />
      <Card>
        <Row between><View><T v="kicker">YOUR USAGE · FREE</T><T v="bodyB" style={{ marginTop: 4 }}>Resets on 1 October</T></View><Pill label="Scans running low" color={p.wa} bg={p.wat} /></Row>
        {(usage.data ?? []).map(u => (
          <View key={u.label} style={{ marginTop: 12 }}><Row between><T v="small" c="tx">{u.label}</T><T v="mono" c="mu">{u.used} / {u.limit}</T></Row><View style={{ marginTop: 6 }}><Progress pct={u.used / u.limit * 100} color={u.used / u.limit >= 0.8 ? p.wa : p.ac} /></View></View>
        ))}
      </Card>
      <T v="h1" style={{ marginTop: 22 }}>Pick what fits</T>
      <T v="small" style={{ marginTop: 4, marginBottom: 14 }}>Every plan has all features. Bigger plans lift the limits.</T>
      <Segmented options={['Monthly', 'Annual · save 16%']} value={annual ? 'Annual · save 16%' : 'Monthly'} onChange={v => setAnnual(v !== 'Monthly')} />
      <Gap h={12} />
      {plans.error ? <ErrorBox message={plans.error.message} onRetry={plans.reload} /> : !plans.data ? <Loading /> : (
        <View style={{ gap: 10 }}>{plans.data.map((pl: Plan) => {
          const on = sel === pl.id; const price = annual ? pl.annual : pl.monthly;
          return (
            <Pressable key={pl.id} onPress={() => setSel(pl.id)}>
              <Card edge={on ? p.ac : p.ci2} style={{ borderWidth: on ? 2 : 1, backgroundColor: on ? p.act : p.s1 }}>
                <Row between center={false}>
                  <Row center={false} gap={12} style={{ flex: 1 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 1.5, borderColor: on ? p.ac : p.mu, marginTop: 2 }} />
                    <View style={{ flex: 1 }}><Row gap={8}><T v="h3">{pl.name}</T>{pl.id === 'free' ? <Pill label="Current" color={p.tx} bg={p.s2} dot={false} /> : null}{pl.id === 'plus' ? <Pill label="Most picked" color={p.ac} bg={p.act} dot={false} /> : null}</Row><T v="tiny">{pl.tag}</T></View>
                  </Row>
                  <View style={{ alignItems: 'flex-end' }}><T v="h2">₹{price.toLocaleString('en-IN')}</T><T v="tiny">{pl.monthly ? (annual ? 'per year' : 'per month') + (pl.id === 'biz' ? ' · seat' : '') : 'forever'}</T></View>
                </Row>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginLeft: 34, rowGap: 4 }}>{pl.limits.map(l => <T key={l} v="tiny" c="tx" style={{ width: '50%' }}>{l}</T>)}</View>
                <T v="tiny" style={{ marginTop: 8, marginLeft: 34 }}>{pl.monthly ? `≈ ₹${(annual ? pl.annual / 365 : pl.monthly / 30).toFixed(1)} a day${annual ? ` · save ₹${(pl.monthly * 12 - pl.annual).toLocaleString('en-IN')}/yr` : ''}` : 'No card needed'}</T>
              </Card>
            </Pressable>
          );
        })}</View>
      )}
    </Screen>
  );
}

/* ---------- B4 Checkout (Cashfree) ---------- */
export function CheckoutScreen({ navigation, route }: ScreenProps<'Checkout'>) {
  const p = useColors(); const { showToast } = useApp();
  const plans = useQuery(billingApi.plans);
  const planId = route.params?.plan ?? 'plus'; const annual = route.params?.cycle === 'annual';
  const P = plans.data?.find(x => x.id === planId);
  const [seats, setSeats] = useState(3); const [coupon, setCoupon] = useState(''); const [pct, setPct] = useState(0); const [cerr, setCerr] = useState(''); const [gst, setGst] = useState(''); const [gerr, setGerr] = useState('');
  const [checkout, busy] = useMutation(billingApi.checkout);
  if (!P) return <Screen><Header title="Checkout" /><Loading /></Screen>;
  const n = P.id === 'biz' ? seats : 1; const base = (annual ? P.annual : P.monthly) * n; const disc = Math.round(base * pct / 100); const tax = Math.round((base - disc) * 0.18); const total = base - disc + tax;
  const gstOk = !gst || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gst);
  const pay = async () => {
    if (!gstOk) return setGerr('GSTIN has 15 characters, like 29ABCDE1234F1Z5');
    try {
      const order = await checkout({ plan: P.id, cycle: annual ? 'annual' : 'monthly', seats: n, coupon: pct ? coupon : undefined, gstin: gst || undefined });
      const v = await billingApi.verifyOrder(order.orderId);
      if (v.status !== 'PAID') return showToast("Payment didn't complete. You weren't charged");
      navigation.navigate('Spaces', { space: 'Profile', at: Date.now() }); showToast(`You're on ${P.name}. Invoice sent to your email`);
    } catch (e) { showToast((e as ApiError).message); }
  };
  return (
    <Screen footer={<View style={{ gap: 6 }}><Button label={busy ? 'Opening Cashfree…' : 'Pay ' + inr(total)} busy={busy} onPress={pay} /><T v="tiny" center>Secured by Cashfree · UPI, cards, netbanking</T></View>}>
      <Header title="Checkout" />
      <Card><Row between><View><T v="h3">{P.name} plan</T><T v="tiny">{annual ? 'Billed yearly' : 'Billed monthly'}</T></View><LinkText label="Change" onPress={() => navigation.goBack()} /></Row>
        {P.id === 'biz' ? <Row between style={{ marginTop: 12 }}><T v="small" c="tx">Seats</T><Row><CircleBtn size={32} icon="x" bg={p.s2} onPress={() => (seats > 2 ? setSeats(seats - 1) : showToast('Business needs at least 2 seats'))} /><T v="bodyB">{seats}</T><CircleBtn size={32} icon="plus" bg={p.s2} onPress={() => setSeats(seats + 1)} /></Row></Row> : null}
      </Card>
      <Label>Coupon</Label>
      <Row center={false}>
        <View style={{ flex: 1 }}><Input value={coupon} onChangeText={t => { setCoupon(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)); setCerr(''); setPct(0); }} placeholder="e.g. BYJAN20" autoCapitalize="characters" error={cerr} hint={pct ? `${coupon} applied · ${pct}% off` : 'Try BYJAN20'} hintColor={pct ? p.po : undefined} /></View>
        <Button small kind="secondary" label="Apply" style={{ height: 52, borderRadius: 14 }} onPress={async () => { if (!coupon) return setCerr('Type a code first'); try { const r = await billingApi.validateCoupon(coupon); setPct(r.pctOff); } catch (e) { setCerr((e as ApiError).message); } }} />
      </Row>
      <Label>GSTIN · optional, for business invoices</Label>
      <Input value={gst} onChangeText={t => { setGst(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)); setGerr(''); }} placeholder="29ABCDE1234F1Z5" autoCapitalize="characters" error={gerr} style={{ borderColor: gst.length === 15 && gstOk ? p.po : 'transparent' }} />
      <Card style={{ marginTop: 16, paddingVertical: 4 }}>
        <KV border={false} k={P.name + (n > 1 ? ` × ${n} seats` : '')} v={inr(base)} />
        {disc ? <KV k={'Coupon ' + coupon} v={'−' + inr(disc)} vc="po" /> : null}
        <KV k="GST 18%" v={inr(tax)} />
        <Row between style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: p.sep }}><T v="bodyB">Total today</T><T v="h3">{inr(total)}</T></Row>
      </Card>
    </Screen>
  );
}

/* ---------- B2 Help & support ---------- */
export function HelpScreen() {
  const p = useColors(); const { showToast } = useApp();
  const faq = useQuery(supportApi.faq); const tickets = useQuery(supportApi.tickets);
  const [q, setQ] = useState(''); const [open, setOpen] = useState(-1); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [extra, setExtra] = useState<Ticket[]>([]);
  const [send, busy] = useMutation(supportApi.create);
  const list = (faq.data ?? []).filter(t => !q || (t.q + t.a).toLowerCase().includes(q.toLowerCase()));
  const len = msg.trim().length;
  return (
    <Screen>
      <Header title="Help" />
      <T v="h1">How can we help?</T>
      <Gap h={14} />
      <Input value={q} onChangeText={setQ} placeholder="Search help, e.g. split, refund" left={<Icon name="search" size={16} color={p.mu} />} />
      <Gap h={12} />
      {!faq.data ? <Loading h={100} /> : !list.length ? <Card><T v="small">No articles match. Message us below.</T></Card> : (
        <Card style={{ paddingVertical: 2 }}>{list.map((t, i) => (
          <Pressable key={t.q} onPress={() => setOpen(open === i ? -1 : i)} style={{ paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
            <Row between><T v="bodyB" style={{ flex: 1 }}>{t.q}</T><View style={{ transform: [{ rotate: open === i ? '180deg' : '0deg' }] }}><Icon name="caretDown" size={14} color={p.mu} /></View></Row>
            {open === i ? <T v="small" style={{ marginTop: 6 }}>{t.a}</T> : null}
          </Pressable>
        ))}</Card>
      )}
      <Label>Still stuck? Message us</Label>
      <Input value={msg} onChangeText={t => { setMsg(t.slice(0, 400)); setErr(''); }} multiline placeholder="Tell us what happened. Include the book and amount if it's about an entry." style={{ minHeight: 120, alignItems: 'flex-start' }}
        error={err} hint={len && len < 15 ? 'A bit more detail helps us fix it faster' : `${msg.length}/400`} />
      <Gap h={10} />
      <Button label="Send message" busy={busy} onPress={async () => { if (!len) return setErr('Write your message first'); if (len < 15) return setErr('Please describe it in at least 15 characters'); const t = await send(msg); setExtra([t]); setMsg(''); showToast('Message sent. Ticket #' + t.id); }} />
      <Label>Your requests</Label>
      <Card style={{ paddingVertical: 2 }}>{[...extra, ...(tickets.data ?? [])].map((t, i) => (
        <Row key={t.id} between style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}><View><T v="smallB">{t.title}</T><T v="tiny">{t.when}</T></View><Pill label={t.status} color={t.status === 'Open' ? p.wa : p.po} bg="transparent" /></Row>
      ))}</Card>
    </Screen>
  );
}

/* ---------- B5 Roles & access ---------- */
export function RolesScreen() {
  const p = useColors(); const { showToast } = useApp();
  const RD: Record<Role, [string, number]> = { Owner: ['Full control, including billing and deleting the book', 1], Admin: ['Runs the book day to day, approves and invites', 1], Accountant: ["Records and reconciles. Can export, can't delete", 1], Contributor: ['Adds entries and splits. Needs approval above the limit', 2], Viewer: ['Read-only. Sees entries and balances', 1] };
  const PERMS = [['add', 'Add entries', 'Create expenses and income'], ['editAll', "Edit others' entries", 'Change amounts and categories'], ['del', 'Delete entries', 'Remove entries permanently'], ['approve', 'Approve over-limit entries', 'Say yes or no to big spends'], ['invite', 'Invite people', 'Send invites and set roles'], ['export', 'Export to Tally / Excel', 'Download statements']];
  const DEF: Record<Role, Record<string, boolean>> = { Owner: { add: true, editAll: true, del: true, approve: true, invite: true, export: true }, Admin: { add: true, editAll: true, del: true, approve: true, invite: true, export: true }, Accountant: { add: true, editAll: true, export: true }, Contributor: { add: true }, Viewer: {} };
  const [role, setRole] = useState<Role>('Accountant'); const [ov, setOv] = useState<Partial<Record<Role, Record<string, boolean>>>>({});
  // Current permissions and limits come from the server; DEF is only a fallback while loading.
  const roles = useQuery(() => booksApi.roles('site'), [], 'roles:site');
  const conf = roles.data?.find(r => r.role === role);
  const fmtLim = (n: number | null | undefined) => (n ? '₹' + n.toLocaleString('en-IN') : 'No limit');
  const [limOv, setLimOv] = useState<Partial<Record<Role, string>>>({});
  const lim = limOv[role] ?? fmtLim(conf?.approvalLimit);
  const setLim = (v: string) => setLimOv(o => ({ ...o, [role]: v }));
  const cur = { ...(conf?.perms ?? DEF[role]), ...(ov[role] ?? {}) };
  const save = (perms: Record<string, boolean>, l = lim) => booksApi.updateRole('site', role, perms, l === 'No limit' ? null : Number(l.replace(/\D/g, ''))).catch(() => showToast("Couldn't save"));
  return (
    <Screen>
      <Header title="Roles & access" />
      <T v="small" style={{ marginTop: -6, marginBottom: 14 }}>Control what each person can do in Site Work. Changes apply instantly.</T>
      <ChipRow>{(Object.keys(RD) as Role[]).map(r => <Chip key={r} label={r} count={roles.data?.find(x => x.role === r)?.members ?? RD[r][1]} on={role === r} onPress={() => setRole(r)} />)}</ChipRow>
      <T v="small" style={{ marginTop: 12, marginBottom: 10 }}>{RD[role][0]}</T>
      <Card style={{ paddingVertical: 2 }}>{PERMS.map(([k, n, d], i) => (
        <Row key={k} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
          <View style={{ flex: 1 }}><T v="bodyB">{n}</T><T v="tiny">{role === 'Owner' ? 'Owners always have this' : d}</T></View>
          <Toggle on={!!cur[k]} disabled={role === 'Owner'} onPress={() => { if (role === 'Owner') return showToast("The owner's access can't be reduced"); const n2 = { ...(ov[role] ?? {}), [k]: !cur[k] }; setOv({ ...ov, [role]: n2 }); save({ ...cur, [k]: !cur[k] }); }} />
        </Row>
      ))}</Card>
      <Label>Approval needed above</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{['No limit', '₹10,000', '₹25,000', '₹50,000'].map(n => <Chip key={n} label={n} on={lim === n} onPress={() => { setLim(n); save(cur, n); showToast(`${role}s need approval ${n === 'No limit' ? 'never' : 'above ' + n}`); }} />)}</Row>
    </Screen>
  );
}

/* ---------- B6 Admin console ---------- */
export function AdminScreen() {
  const p = useColors(); const { showToast } = useApp();
  const [tab, setTab] = useState('Overview');
  const ov = useQuery(() => adminApi.overview('site')); const ap = useQuery(() => adminApi.approvals('site'));
  const [done, setDone] = useState<Record<string, boolean>>({}); const [rej, setRej] = useState<string | null>(null); const [reason, setReason] = useState(''); const [rerr, setRerr] = useState('');
  const [pol, setPol] = useState({ twoStep: true, receipts: true, lockMonth: false, exportR: true });
  const pend = (ap.data ?? []).filter(a => !done[a.id]);
  return (
    <Screen>
      <Header title="Site Work · Admin" />
      <Segmented options={['Overview', 'Approvals', 'Policies']} value={tab} onChange={setTab} />
      <Gap h={14} />
      {tab === 'Overview' && (!ov.data ? <Loading /> : <>
        <Row>
          <Card style={{ flex: 1 }}><T v="tiny">Spent this month</T><T v="h2">{inr(ov.data.spentThisMonth)}</T></Card>
          <Card style={{ flex: 1 }} onPress={() => setTab('Approvals')}><T v="tiny">Pending approval</T><T v="h2">{pend.length} entries</T></Card>
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Card style={{ flex: 1 }}><T v="tiny">Members</T><T v="h2">{ov.data.members} active</T></Card>
          <Card style={{ flex: 1 }}><T v="tiny">Over limit</T><T v="h2">{ov.data.overLimit} person</T></Card>
        </Row>
        <Label>Recent</Label>
        <Card style={{ paddingVertical: 2 }}>{ov.data.recent.map((r, i) => <Row key={r.text} between style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}><T v="small" c="tx" style={{ flex: 1 }}>{r.text}</T><T v="tiny">{r.when}</T></Row>)}</Card>
      </>)}
      {tab === 'Approvals' && (!ap.data ? <Loading /> : !pend.length ? <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}><Icon name="checks" size={30} color={p.ac} /><T v="bodyB">Nothing waiting on you</T></Card> : (
        <View style={{ gap: 10 }}>{pend.map(a => {
          const r = rej === a.id;
          return (
            <Card key={a.id}>
              <Row between><View style={{ flex: 1 }}><T v="bodyB">{a.title}</T><T v="tiny">{a.meta}</T></View><T v="h3">{inr(a.amount)}</T></Row>
              <Row gap={6} style={{ marginTop: 8 }}><Icon name={a.hasReceipt ? 'receipt' : 'warning'} size={14} color={a.hasReceipt ? p.mu : p.wa} /><T v="tiny" c={a.hasReceipt ? 'mu' : 'wa'}>{a.hasReceipt ? 'Receipt attached' : 'No receipt · policy needs one'}</T></Row>
              {r ? <View style={{ marginTop: 10 }}><Input value={reason} onChangeText={t => { setReason(t.slice(0, 120)); setRerr(''); }} placeholder="Why? They'll see this" error={rerr} style={{ backgroundColor: p.s2 }} /></View> : null}
              <Row style={{ marginTop: 12 }}>
                <Button small kind="secondary" label={r ? 'Send rejection' : 'Reject'} style={{ flex: 1, backgroundColor: p.s2 }} onPress={async () => {
                  if (!r) { setRej(a.id); setReason(''); return; }
                  if (reason.trim().length < 5) return setRerr('Add a short reason so they know what to fix');
                  await adminApi.decide(a.id, 'reject', reason); setDone({ ...done, [a.id]: true }); setRej(null); showToast(`Rejected. ${a.meta.split(' · ')[0]} was told why`);
                }} />
                <Button small label={r ? 'Cancel' : 'Approve'} style={{ flex: 1 }} onPress={async () => {
                  if (r) return setRej(null);
                  if (!a.hasReceipt && pol.receipts) return showToast('Receipt required by policy. Ask for one or turn the policy off');
                  await adminApi.decide(a.id, 'approve'); setDone({ ...done, [a.id]: true }); showToast(`Approved ${inr(a.amount)} · ${a.title}`, () => setDone(d => ({ ...d, [a.id]: false })));
                }} />
              </Row>
            </Card>
          );
        })}</View>
      ))}
      {tab === 'Policies' && <Card style={{ paddingVertical: 2 }}>{([['twoStep', 'Two-step sign in for admins', 'OTP on new devices'], ['receipts', 'Receipts required', 'Over ₹5,000 entries need a photo'], ['lockMonth', 'Lock closed months', 'No edits after month-end close'], ['exportR', 'Restrict exports', 'Only owner and accountants export']] as const).map(([k, n, d], i) => (
        <Row key={k} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}><View style={{ flex: 1 }}><T v="bodyB">{n}</T><T v="tiny">{d}</T></View><Toggle on={pol[k]} onPress={() => { const n2 = { ...pol, [k]: !pol[k] }; setPol(n2); adminApi.setPolicies('site', n2); }} /></Row>
      ))}</Card>}
    </Screen>
  );
}

/* ---------- B1 Import (Excel / Tally) ---------- */
export function ImportScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const [step, setStep] = useState(0); const [src, setSrc] = useState<'tally' | 'excel' | 'app'>('tally');
  const [prev, setPrev] = useState<Awaited<ReturnType<typeof importApi.upload>> | null>(null);
  const [map, setMap] = useState<Record<string, string>>({}); const [fixed, setFixed] = useState<Record<string, boolean>>({}); const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const FIELDS = ['Date', 'Description', 'Money out', 'Money in', 'Party', 'Skip'];
  const errsLeft = (prev?.errors ?? []).filter(e => !fixed[e.row] && !skipped[e.row]).length;
  const count = (prev?.rows ?? 212) + Object.values(fixed).filter(Boolean).length;
  const next = async () => {
    if (step === 0) {
      setBusy(true);
      try {
        const file = await pickDocument(['text/xml', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'])
          || { uri: 'file://tally.xml', name: 'tally.xml', type: 'text/xml' };
        setPrev(await importApi.upload(file, src)); setStep(1);
      } catch (e) { showToast((e as ApiError).message); } finally { setBusy(false); } return;
    }
    if (step === 1) {
      const v = prev!.columns.map(c => map[c.name] ?? c.mapTo);
      if (!v.includes('Date')) return showToast('Pick which column is the date'); if (!v.includes('Money out') && !v.includes('Money in')) return showToast('Pick at least one amount column');
      return setStep(2);
    }
    if (step === 2) {
      setStep(3); setBusy(true);
      const skip = prev!.errors.filter(e => !fixed[e.row]).map(e => e.row);
      try { await importApi.commit('imp_1', map, Object.fromEntries(Object.keys(fixed).map(k => [k, 'fixed'])), skip); setStep(4); } catch { setStep(2); showToast('Import failed. Nothing was saved'); } finally { setBusy(false); }
      return;
    }
    navigation.navigate('Book', { id: 'studio' });
  };
  const lbl = ['Continue', 'Looks right', errsLeft ? `Import ${count} · skip ${errsLeft}` : `Import ${count} entries`, 'Importing…', 'Open Studio Books'][step];
  return (
    <Screen footer={<Button label={lbl} busy={busy} onPress={next} />}>
      <Header title="Import entries" onBack={() => (step > 0 && step < 3 ? setStep(step - 1) : navigation.goBack())} right={<T v="small">{Math.min(step + 1, 4)} of 4</T>} />
      <Row gap={6} style={{ marginTop: -6, marginBottom: 20 }}>{[0, 1, 2, 3].map(i => <View key={i} style={{ flex: 1 }}><Progress h={3} pct={i < step ? 100 : i === step ? 50 : 0} /></View>)}</Row>
      {step === 0 && <>
        <T v="h1">Where's it coming from?</T><T v="small" style={{ marginTop: 6, marginBottom: 18 }}>We'll match columns for you. Nothing is saved until you confirm.</T>
        <View style={{ gap: 10 }}>{([['tally', 'Tally export', 'XML or Excel from TallyPrime', 'database'], ['excel', 'Excel or CSV', 'Any sheet with dates and amounts', 'fileXls'], ['app', 'Another app', 'Splitwise, Walnut, Khatabook', 'appSwap']] as const).map(([k, n, d, i]) => (
          <Pressable key={k} onPress={() => setSrc(k)}><Card edge={src === k ? p.tx : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon={i as IconName} size={40} /><View style={{ flex: 1 }}><T v="bodyB">{n}</T><T v="tiny">{d}</T></View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: src === k ? 7 : 1.5, borderColor: src === k ? p.tx : p.mu }} />
          </Card></Pressable>
        ))}</View>
      </>}
      {step === 1 && prev && <>
        <T v="h1">Match the columns</T><T v="small" style={{ marginTop: 6, marginBottom: 18 }}>Tap a tag to change it. {prev.rows} rows found.</T>
        <Card style={{ paddingVertical: 2 }}>{prev.columns.map((c, i) => { const m = map[c.name] ?? c.mapTo; return (
          <Row key={c.name} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
            <View style={{ flex: 1 }}><T v="bodyB">{c.name}</T><T v="tiny">{c.example}</T></View>
            <Icon name="arrowRight" size={14} color={p.mu} />
            <Pressable onPress={() => setMap({ ...map, [c.name]: FIELDS[(FIELDS.indexOf(m) + 1) % FIELDS.length] })} style={{ backgroundColor: m === 'Skip' ? p.s2 : p.pb, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}><T v="tiny" c={m === 'Skip' ? p.mu : p.pf}>{m}</T></Pressable>
          </Row>); })}</Card>
      </>}
      {step === 2 && prev && <>
        <T v="h1">{prev.errors.length} rows need a hand</T><T v="small" style={{ marginTop: 6, marginBottom: 18 }}>Fix them or skip. Everything else is ready.</T>
        <View style={{ gap: 10 }}>{prev.errors.map(e => { const fx = !!fixed[e.row], sk = !!skipped[e.row]; return (
          <Card key={e.row}>
            <Row between><T v="bodyB">Row {e.row} · {e.problem}</T><T v="tiny" c={fx ? 'po' : sk ? 'mu' : 'ne'}>{fx ? 'Fixed' : sk ? 'Skipped' : 'Needs fix'}</T></Row>
            <T v="mono" c="mu" style={{ marginTop: 6, fontSize: 11.5 }}>{e.line}</T>
            <Row style={{ marginTop: 10 }}><Button small kind="secondary" label="Skip row" style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => { setSkipped({ ...skipped, [e.row]: true }); setFixed({ ...fixed, [e.row]: false }); }} /><Button small label={fx ? 'Fixed ✓' : e.row === '47' ? 'Use 01-04-2025' : 'Set ₹12,000'} style={{ flex: 1 }} onPress={() => { setFixed({ ...fixed, [e.row]: true }); setSkipped({ ...skipped, [e.row]: false }); }} /></Row>
          </Card>); })}</View>
      </>}
      {step >= 3 && <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Icon name={step === 4 ? 'checkCircle' : 'database'} size={64} color={p.ac} weight={step === 4 ? 'fill' : 'regular'} />
        <T v="h1" center style={{ marginTop: 16 }}>{step === 4 ? `${count} entries imported` : 'Importing…'}</T>
        <T v="small" center style={{ marginTop: 6 }}>{step === 4 ? 'They are in Studio Books, matched to your categories.' : 'This usually takes a few seconds.'}</T>
      </View>}
    </Screen>
  );
}
