import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View , Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useColors } from '../state/AppContext';
import { ApiError, paymentsApi, UpiPayee , accountsApi, booksApi, settleApi } from '../api';
import { usePeople } from '../hooks/usePeople';
import { useQuery , useMutation } from '../hooks/useApi';
import { Sheet, Avatar, Button, Card, Chip, CircleBtn, Gap, Header, Icon, IconTile, Input, Keypad, KV, Label, LinkText, Mono, Row, Screen, T } from '../components/ui';
import { fonts, inr } from '../theme/tokens';
import { Perforation, UpiBadge } from '../components/brand';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { CountUp, EASE, haptic, Loop, Press, Replay, Rise } from '../components/motion';
import { LinearGradient } from 'expo-linear-gradient';
import type { ScreenProps } from '../navigation/types';
import { LiveCamera } from '../native/LiveCamera';
import { openUpiAndWait, takeQrOnce } from '../native/device';

/** Accounts the user can pay from (GET /v1/accounts), excluding cash and cards. */
function usePayAccounts() {
  const { data } = useQuery(accountsApi.list, [], 'accounts');
  const banks = (data ?? []).filter(a => a.icon === 'bank');
  return { banks, def: banks.find(a => a.isDefault) ?? banks[0] };
}

/** Opens the UPI app, then polls until the server (webhook or sandbox status) says the payment finished. */
async function openUpi(url: string, paymentId: string, ctx: { amount: number; app: string; to: string }, onWait?: (app: string) => void) {
  return openUpiAndWait(url, paymentId, ctx, onWait);
}

/* ---------- 13 Pay on UPI ---------- */
export function PayScreen({ navigation, route }: ScreenProps<'Pay'>) {
  const p = useColors(); const { showToast } = useApp();
  const to = route.params?.to ?? 'MI'; const full = route.params?.amount ?? 800;
  const ppl = usePeople(); const vpa = ppl.vpa(to);
  const settle = useQuery(settleApi.summary, [], 'settle');
  const why = settle.data?.owe.find(o => o.initials === to)?.note ?? 'Settle up';
  const { banks, def } = usePayAccounts();
  const [fromId, setFromId] = useState<string | null>(null); const from = banks.find(b => b.id === fromId) ?? def;
  const [bankOpen, setBankOpen] = useState(false); const [otherOpen, setOtherOpen] = useState(false); const [other, setOther] = useState('');
  const [share, setShare] = useState<'half' | 'full' | 'other'>('full'); const [app, setApp] = useState('GPay');
  const [pay, busy] = useMutation(async (amount: number) => {
    const intent = await paymentsApi.createIntent({ toVpa: vpa, amount, note: 'Settle up on Byjan', app, fromAccountId: from?.id });
    const r = await openUpi(intent.intentUrl, intent.paymentId, { amount, app, to: vpa }, name => showToast('Waiting for ' + name + '…'));
    return { ...r, paymentId: intent.paymentId };
  });
  const amount = share === 'half' ? full / 2 : share === 'other' ? (parseInt(other || '0', 10) || full) : full;
  const go = async () => {
    try {
      const r = await pay(amount);
      if (r.status === 'SUCCESS') haptic('success');
      if (r.status === 'SUCCESS') navigation.replace('Success', { amount, app, to: vpa, utr: r.utr, time: r.time, from: from ? `${from.name.split(' ')[0]} ••${from.last4} · ${app}` : r.from, paymentId: r.paymentId, name: ppl.name(to) });
      else navigation.replace('PayFail', { amount, reason: r.failReason, code: r.code });
    } catch (e) { const er = e as ApiError; navigation.replace('PayFail', { amount, reason: er.message, code: er.code }); }
  };
  return (
    <Screen glow footer={<View style={{ gap: 8 }}><Button label={busy ? `Waiting for ${app}…` : `Pay ${inr(amount)} with ${app}`} busy={busy} onPress={go} /><Row gap={6} style={{ justifyContent: 'center' }}><Icon name="lock" size={12} color={p.mu} /><T v="tiny">Paid on UPI · Byjan never sees your UPI PIN</T></Row></View>}>
      <Header center title="Settle up" />
      <View style={{ alignItems: 'center' }}>
        <Rise kind="pop" duration={600}><View style={{ padding: 5, borderRadius: 40, borderWidth: 1, borderColor: p.ci2 }}><Avatar ini={to} size={64} /></View></Rise>
        <Rise delay={80}><T v="h3" style={{ marginTop: 12 }}>You owe {ppl.name(to)}</T></Rise>
        <Rise delay={120}><Row gap={6} style={{ marginTop: 2 }}><T v="mono" c="mu">{vpa || '…'}</T><Icon name="sealCheck" size={14} color={p.po} weight="fill" /><T v="tiny" c="po" style={{ fontFamily: fonts.bold }}>Verified</T></Row></Rise>
        <Replay trigger={amount} name="bump" duration={260}><CountUp to={amount} style={{ fontFamily: fonts.bold, fontSize: 60, lineHeight: 68, letterSpacing: -3, color: p.tx, marginTop: 10 }} /></Replay>
        <T v="tiny">{why}</T>
        <Row gap={8} style={{ marginTop: 14 }}>
          <Chip label={'Half · ' + inr(full / 2)} on={share === 'half'} onPress={() => setShare('half')} />
          <Chip label={'Full · ' + inr(full)} on={share === 'full'} onPress={() => setShare('full')} />
          <Chip label={share === 'other' && other ? inr(Number(other)) : 'Other'} on={share === 'other'} onPress={() => setOtherOpen(true)} />
        </Row>
      </View>
      <Label>Pay with</Label>
      <Row gap={8}>{['GPay', 'PhonePe', 'Paytm', 'Other UPI'].map((a, k) => (
        <Rise key={a} kind="tileIn" delay={160 + k * 45} style={{ flex: 1 }}>
          <Press onPress={() => setApp(a)} hapticKind="select" scaleTo={0.94} style={[{ alignItems: 'center', gap: 7, paddingVertical: 13, borderRadius: 16, backgroundColor: app === a ? p.act : p.s1, borderWidth: 1.5, borderColor: app === a ? p.ac : p.sep }, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 180 } as any]}>
            <UpiBadge app={a} /><T v="tiny" c={app === a ? 'ac' : 'tx'} style={{ fontFamily: fonts.bold }}>{a}</T>
            {app === a ? <Rise kind="pop" duration={360} style={{ position: 'absolute', top: 6, right: 6 }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: p.ac, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={10} color={p.ai} weight="bold" /></View></Rise> : null}
          </Press>
        </Rise>
      ))}</Row>
      <Rise delay={340}><Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="bank" size={38} radius={12} /><View style={{ flex: 1 }}><T v="bodyB">{from ? `${from.name} ••${from.last4}` : '…'}</T><T v="tiny">{from?.isDefault ? 'Your default for UPI' : 'Paying from this account'}</T></View><LinkText label="Change" onPress={() => setBankOpen(true)} />
      </Card></Rise>
      <Sheet open={bankOpen} onClose={() => setBankOpen(false)} title="Pay from">
        <View style={{ gap: 6, marginTop: 10 }}>{banks.map(b => (
          <Press key={b.id} onPress={() => { setFromId(b.id); setBankOpen(false); }} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: b.id === from?.id ? p.s2 : 'transparent' }}>
            <IconTile icon="bank" size={38} radius={12} /><View style={{ flex: 1 }}><T v="bodyB">{b.name} ••{b.last4}</T><T v="tiny">Balance {inr(b.balance)}</T></View>
            {b.id === from?.id ? <Icon name="check" size={16} color={p.ac} weight="bold" /> : null}
          </Press>
        ))}</View>
      </Sheet>
      <Sheet open={otherOpen} onClose={() => setOtherOpen(false)} title="Pay a different amount" sub={`You owe ${inr(full)} in total.`}>
        <Gap h={10} />
        <Input value={other} onChangeText={t => setOther(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="Amount" autoFocus left={<T c="mu">₹</T>} style={{ backgroundColor: p.s2 }}
          error={Number(other) > full ? `That's more than the ${inr(full)} you owe` : undefined} />
        <Gap h={14} />
        <Button label="Use this amount" disabled={!Number(other) || Number(other) > full} onPress={() => { setShare('other'); setOtherOpen(false); }} />
      </Sheet>
    </Screen>
  );
}

/* ---------- 14 Payment success ---------- */
export function SuccessScreen({ navigation, route }: ScreenProps<'Success'>) {
  const p = useColors(); const { showToast } = useApp();
  const r = route.params ?? { amount: 800, app: 'GPay', to: 'meera@okaxis' };
  useEffect(() => { const t = setTimeout(() => haptic('success'), 250); return () => clearTimeout(t); }, []);
  const name = r.name ?? r.to.split('@')[0].replace(/^./, c => c.toUpperCase());
  const shareReceipt = async () => {
    try { const rc = await paymentsApi.receipt(r.paymentId ?? 'pay_1'); await Share.share({ message: `${rc.text}\n${rc.url}`, url: rc.url }); }
    catch { showToast("Couldn't prepare the receipt. Try again"); }
  };
  const CONF = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const d = 90 + (i % 3) * 22; return { x: Math.cos(a) * d, y: Math.sin(a) * d, c: [p.ac, p.a2, p.wa, '#fff'][i % 4], s: 6 + (i % 3) * 2 }; });
  return (
    <Screen glow footer={<Row><Button kind="secondary" label="Share" icon="share" style={{ flex: 1 }} onPress={shareReceipt} /><Button label="Done" style={{ flex: 1.4 }} onPress={() => navigation.navigate('Spaces', { space: 'Home', at: Date.now() })} /></Row>}>
      <View style={{ alignItems: 'center', marginTop: 36 }}>
        <View style={{ width: 200, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          {CONF.map((c, i) => (
            <Animated.View key={i} pointerEvents="none" style={[{ position: 'absolute', width: c.s, height: c.s, borderRadius: i % 2 ? c.s / 2 : 2, backgroundColor: c.c },
              { animationName: { '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.3 }, { rotate: '0deg' }] }, '30%': { opacity: 1 }, '100%': { opacity: 0, transform: [{ translateX: c.x }, { translateY: c.y }, { scale: 1 }, { rotate: `${i * 40}deg` }] } }, animationDuration: '1100ms', animationDelay: '320ms', animationTimingFunction: EASE.out, animationFillMode: 'both' } as any]} />
          ))}
          <Loop name="ringOut" duration={2200} delay={500} easing={EASE.out} pointerEvents="none" style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: p.ac }} />
          <Rise kind="pop" duration={700}>
            <View style={{ width: 112, height: 112, borderRadius: 56, shadowColor: p.ac, shadowOpacity: 0.6, shadowRadius: 34 }}>
              <LinearGradient colors={p.fab as [string, string, string]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.85, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <Rise kind="pop" delay={250} duration={500}><Icon name="check" size={52} color="#04140E" weight="bold" /></Rise>
              </LinearGradient>
            </View>
          </Rise>
        </View>
        <Rise delay={300}><T v="small" style={{ marginTop: 14 }}>You paid {name}</T></Rise>
        <CountUp to={r.amount} style={{ fontFamily: fonts.bold, fontSize: 58, lineHeight: 66, letterSpacing: -3, color: p.tx }} />
        <Rise delay={500}><Row gap={6} style={{ backgroundColor: p.pot, borderRadius: 14, paddingHorizontal: 12, height: 28, marginTop: 6 }}><Icon name="sealCheck" size={14} color={p.po} weight="fill" /><T v="tiny" c="po" style={{ fontFamily: fonts.bold }}>You're now settled with {name.split(' ')[0]}</T></Row></Rise>
      </View>
      <Rise delay={600} kind="riseBig">
        <Card style={{ marginTop: 28, paddingVertical: 6 }}>
          <KV border={false} k="To" v={r.to} mono />
          <KV k="From" v={r.from ?? `HDFC ••4821 · ${r.app}`} />
          <Perforation bg={p.bg} />
          <Row between style={{ paddingTop: 6, paddingBottom: 10 }}><View><T v="kicker">UPI REF</T><T v="mono" c="tx" style={{ marginTop: 3 }}>{r.utr ?? '4266 1033 8104'}</T></View><View style={{ alignItems: 'flex-end' }}><T v="kicker">TIME</T><T v="mono" c="tx" style={{ marginTop: 3 }}>{r.time ?? '21:48:06'}</T></View></Row>
        </Card>
      </Rise>
    </Screen>
  );
}

/* ---------- P1–P3 Scan & pay ---------- */
export function ScanPayScreen({ navigation }: ScreenProps) {
  const p = useColors(); const ins = useSafeAreaInsets(); const { showToast } = useApp();
  const [state, setState] = useState<'scan' | 'locking' | 'bad' | 'found'>('scan');
  const [payee, setPayee] = useState<UpiPayee | null>(null);
  const [amt, setAmt] = useState(''); const [err, setErr] = useState(''); const [book, setBook] = useState(0); const [torch, setTorch] = useState(false);
  const recents = useQuery(paymentsApi.recentPayees, [], 'recentPayees');
  const books = useQuery(booksApi.list, [], 'books');
  const BOOKS = ['Personal', ...(books.data ?? []).filter(b => b.kind !== 'Personal').map(b => b.name)];
  const bookIds = ['studio', ...(books.data ?? []).filter(b => b.kind !== 'Personal').map(b => b.id)];
  const { def } = usePayAccounts();
  const [upiOpen, setUpiOpen] = useState(false); const [upi, setUpi] = useState(''); const [upiErr, setUpiErr] = useState('');
  const [resolve, resolving] = useMutation(paymentsApi.resolveVpa);
  const pickPayee = async (vpa: string) => {
    setState('locking');
    try { const r = await resolve(vpa); setPayee(r); setAmt(''); setState('found'); return true; }
    catch (e) { setState('scan'); setUpiErr((e as ApiError).message); return false; }
  };
  const line = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(line, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, [line]);
  const detect = async (payload = 'upi://pay?pa=chaipoint.blr@icici&pn=Chai%20Point') => {
    if (!takeQrOnce(payload)) return;
    setState('locking');
    try { const r = await paymentsApi.parseQr(payload); setPayee(r); setAmt(''); setState('found'); }
    catch { setState('bad'); }
  };
  const [pay, paying] = useMutation(async (amount: number) => {
    const i = await paymentsApi.createIntent({ toVpa: payee!.vpa, amount, note: payee!.name, app: 'UPI', bookId: bookIds[book], fromAccountId: def?.id });
    const r = await openUpi(i.intentUrl, i.paymentId, { amount, app: 'UPI', to: payee!.vpa }, () => showToast('Waiting for UPI…'));
    return { ...r, paymentId: i.paymentId };
  });
  const n = parseInt(amt || '0', 10);
  const doPay = async () => {
    if (!n) return setErr('Enter how much to pay'); if (n > 100000) return setErr('UPI limit is ₹1,00,000 per payment');
    try { const r = await pay(n); navigation.replace('Success', { amount: n, app: 'UPI', to: payee!.vpa, utr: r.utr, time: r.time, paymentId: r.paymentId, name: payee!.name, from: def ? `${def.name.split(' ')[0]} ••${def.last4} · UPI` : undefined }); }
    catch (e) { navigation.replace('PayFail', { amount: n, reason: (e as ApiError).message, code: (e as ApiError).code }); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#050607', paddingTop: ins.top + 8 }}>
      <Row between style={{ paddingHorizontal: 20 }}>
        <CircleBtn icon="x" bg="rgba(255,255,255,.12)" color="#F2F5F7" onPress={() => navigation.goBack()} />
        <View style={{ backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 16, paddingHorizontal: 14, height: 32, justifyContent: 'center' }}><T v="smallB" c="#F2F5F7">Scan any UPI QR</T></View>
        <CircleBtn icon="flashlight" bg={torch ? '#F2F5F7' : 'rgba(255,255,255,.12)'} color={torch ? '#0A0C0F' : '#F2F5F7'} onPress={() => setTorch(!torch)} />
      </Row>
      <Pressable onPress={state === 'scan' ? () => { void detect(); } : undefined} style={{ alignItems: 'center', marginTop: state === 'found' ? 20 : 60 }}>
        <View style={{ width: state === 'found' ? 200 : 260, height: state === 'found' ? 140 : 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {state === 'scan' || state === 'locking' ? <LiveCamera torch={torch} onBarCode={data => { void detect(data); }} /> : null}
          {(['tl', 'tr', 'bl', 'br'] as const).map(c => <View key={c} style={{ position: 'absolute', width: 40, height: 40, borderColor: state === 'locking' ? '#5EE6B5' : state === 'bad' ? '#FF8A80' : '#F2F5F7', [c[0] === 't' ? 'top' : 'bottom']: 0, [c[1] === 'l' ? 'left' : 'right']: 0, [c[0] === 't' ? 'borderTopWidth' : 'borderBottomWidth']: 3, [c[1] === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: 3, borderRadius: 8 } as any} />)}
          <View style={{ width: state === 'found' ? 120 : 160, height: state === 'found' ? 100 : 160, backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {Array.from({ length: 36 }).map((_, i) => <View key={i} style={{ width: '13%', aspectRatio: 1, backgroundColor: (i * 7 + (i >> 2)) % 3 ? '#111' : '#fff', borderRadius: 1 }} />)}
          </View>
          {state === 'scan' || state === 'locking' ? <Animated.View style={{ position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#5EE6B5', transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [-110, 110] }) }] }} /> : null}
        </View>
        <T v="small" c={state === 'bad' ? '#FF8A80' : '#C9CFD6'} style={{ marginTop: 14 }}>{state === 'locking' ? 'Hold steady… reading code' : state === 'bad' ? "That's not a UPI QR. Try another code." : state === 'found' ? '' : 'Point at any UPI QR. It scans by itself.'}</T>
        {state === 'scan' ? <T v="tiny" c="#8C95A1" style={{ marginTop: 4 }}>(Tap the frame to simulate a scan)</T> : null}
      </Pressable>

      {state === 'found' && payee ? (
        <View style={{ flex: 1, marginTop: 14, backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: ins.bottom + 14 }}>
          <Row><Mono ch={payee.initials} bg="#2A1E14" fg="#F5B041" /><View style={{ flex: 1 }}><T v="bodyB">{payee.name}</T><T v="mono" c="mu" style={{ fontSize: 11 }}>{payee.vpa} · {payee.verified ? 'verified merchant' : 'unverified'}</T></View></Row>
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Replay trigger={err} name="shake" duration={420}><Row gap={2} center={false} style={{ alignItems: 'flex-end' }}><T c="mu" style={{ fontFamily: fonts.medium, fontSize: 24, lineHeight: 30, marginBottom: 10 }}>₹</T><Replay trigger={amt} name="bump" duration={200}><T c={n ? 'tx' : 'mu'} style={{ fontFamily: fonts.bold, fontSize: 54, lineHeight: 62, letterSpacing: -2.5 }}>{n ? n.toLocaleString('en-IN') : '0'}</T></Replay></Row></Replay>
            <T v="tiny" c={err ? 'ne' : 'mu'}>{err || (n > 2000 ? "Above ₹2,000 · you'll confirm with your UPI PIN" : (def ? `Paid from ${def.name.split(' ')[0]} ••${def.last4}` : ''))}</T>
            <Row gap={8} style={{ marginTop: 10 }}>{['40', '80', '120', '200'].map(v => <Chip key={v} label={'₹' + v} onPress={() => { setAmt(v); setErr(''); }} />)}</Row>
          </View>
          <Keypad onKey={k => { setErr(''); if (k === 'del') setAmt(a => a.slice(0, -1)); else if (amt.length < 6) setAmt(a => (a === '0' ? k : a + k)); }} style={{ marginTop: 6 }} />
          <Row between style={{ marginTop: 4 }}><T v="small">Log in <T v="smallB">{BOOKS[book]}</T></T><LinkText label="Change" onPress={() => setBook((book + 1) % Math.max(1, BOOKS.length))} /></Row>
          <View style={{ marginTop: 10 }}><SlideToConfirm label={n ? 'Slide to pay ' + inr(n) : 'Enter amount'} busy={paying} disabled={!n} onBlocked={() => { haptic('error'); setErr('Enter how much to pay'); }} onConfirm={doPay} /></View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: ins.bottom + 16 }}>
          {state === 'bad' ? <Button label="Scan again" onPress={() => setState('scan')} style={{ marginBottom: 14 }} /> : null}
          <Row gap={8} style={{ marginBottom: 12 }}>{(recents.data ?? []).map(({ initials: i, bg, fg, name: nme, vpa }) => (
            <Pressable key={i} onPress={() => pickPayee(vpa)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 20, paddingLeft: 4, paddingRight: 12, height: 40 }}><Mono ch={i} bg={bg} fg={fg} size={32} /><T v="smallB" c="#F2F5F7">{nme.split(' ')[0]}</T></Pressable>
          ))}</Row>
          <Row>
            <Button kind="secondary" label="Gallery" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.1)' }} onPress={detect} />
            <Button label="Scan now" style={{ flex: 1, backgroundColor: '#F2F5F7' }} onPress={detect} />
            <Button kind="secondary" label="UPI ID" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.1)' }} onPress={() => { setUpiErr(''); setUpiOpen(true); }} />
          </Row>
        </View>
      )}
      <Sheet open={upiOpen} onClose={() => setUpiOpen(false)} title="Pay a UPI ID" sub="We'll show the name registered to it before you pay.">
        <Gap h={10} />
        <Input value={upi} onChangeText={t => { setUpi(t.replace(/\s/g, '').toLowerCase()); setUpiErr(''); }} placeholder="name@bank" autoCapitalize="none" autoFocus style={{ backgroundColor: p.s2 }} error={upiErr} />
        <Gap h={14} />
        <Button label="Find payee" busy={resolving} onPress={async () => { if (await pickPayee(upi)) setUpiOpen(false); }} />
      </Sheet>
    </View>
  );
}

/* ---------- T2 Request money ---------- */
export function RequestScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp(); const ppl = usePeople();
  const [who, setWho] = useState<Record<string, boolean>>({ RV: true }); const [amt, setAmt] = useState(''); const [note, setNote] = useState(''); const [via, setVia] = useState<'wa' | 'upi'>('wa'); const [err, setErr] = useState('');
  const [send, busy] = useMutation(paymentsApi.request);
  const sel = Object.keys(who).filter(k => who[k]); const n = parseInt(amt || '0', 10);
  const go = async () => {
    if (!sel.length) return setErr('Pick at least one person'); if (!n) return setErr('Enter an amount'); if (n > 100000) return setErr('UPI requests are capped at ₹1,00,000');
    await send({ people: sel, amount: n, note, via }); navigation.goBack();
    showToast(`Requested ${inr(n)} from ${sel.length} ${sel.length === 1 ? 'person' : 'people'}${via === 'wa' ? ' on WhatsApp' : ' via UPI'}`);
  };
  return (
    <Screen footer={<Button label={n ? 'Request ' + inr(n * Math.max(1, sel.length)) : 'Request'} busy={busy} onPress={go} />}>
      <Header title="Request money" />
      <T v="smallB" c="mu">From</T>
      <Row gap={14} style={{ marginTop: 10 }}>{ppl.list.filter(c => c.initials !== 'AK').map(c => c.initials).map(i => (
        <Press key={i} onPress={() => { setWho({ ...who, [i]: !who[i] }); setErr(''); }} hapticKind="select" scaleTo={0.9} style={{ alignItems: 'center', gap: 6 }}>
          <View><Avatar ini={i} size={54} ring={who[i] ? p.ac : undefined} />{who[i] ? <Rise kind="pop" duration={360} style={{ position: 'absolute', right: -2, bottom: -2 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: p.ac, borderWidth: 2, borderColor: p.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={10} color="#04140E" weight="bold" /></View></Rise> : null}</View>
          <T v="tiny" c="tx">{ppl.short(i)}</T>
        </Press>
      ))}</Row>
      <View style={{ alignItems: 'center', marginVertical: 22 }}>
        <Replay trigger={err} name="shake" duration={420}>
          <Input value={amt ? Number(amt).toLocaleString('en-IN') : ''} onChangeText={t => { setAmt(t.replace(/\D/g, '').slice(0, 7)); setErr(''); }} keyboardType="number-pad" placeholder="0"
            left={<T c="mu" style={{ fontFamily: fonts.medium, fontSize: 30, lineHeight: 36 }}>₹</T>}
            style={{ backgroundColor: 'transparent', borderColor: 'transparent', minWidth: 200, justifyContent: 'center' }} inputStyle={{ flex: 0, minWidth: 60, fontFamily: fonts.bold, fontSize: 58, lineHeight: 66, letterSpacing: -2.5, paddingVertical: 0, textAlign: 'center', fontVariant: ['tabular-nums'] } as any} />
        </Replay>
        <Row gap={6} style={{ marginTop: 6 }}>{['200', '500', '1250'].map(v => <Chip key={v} label={'₹' + Number(v).toLocaleString('en-IN')} on={amt === v} onPress={() => { setAmt(v); setErr(''); }} />)}</Row>
        <T v="small" c={err ? 'ne' : 'mu'} style={{ marginTop: 8 }}>{err || (n && sel.length > 1 ? `${inr(n)} from each of ${sel.length} people` : ' ')}</T>
      </View>
      <Input value={note} onChangeText={t => setNote(t.slice(0, 60))} placeholder="What's it for? e.g. Goa scooter" />
      <Label>Send as</Label>
      <Row>{([['wa', 'WhatsApp', 'They get a message with a pay link'], ['upi', 'UPI collect', 'Request pops up in their UPI app']] as const).map(([k, t, d]) => (
        <Press key={k} onPress={() => setVia(k)} hapticKind="select" scaleTo={0.96} style={[{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: via === k ? p.act : p.s1, borderWidth: 1.5, borderColor: via === k ? p.ac : p.sep, minHeight: 96 }, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 180 } as any]}>
          <Icon name={k === 'wa' ? 'whatsapp' : 'qr'} color={via === k ? p.ac : p.tx} /><T v="bodyB" c={via === k ? 'ac' : 'tx'} style={{ marginTop: 8 }}>{t}</T><T v="tiny">{d}</T>
        </Press>
      ))}</Row>
    </Screen>
  );
}
