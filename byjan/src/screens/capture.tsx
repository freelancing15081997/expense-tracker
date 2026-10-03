import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useColors } from '../state/AppContext';
import { captureApi, entriesApi, Category, ScanResult, VoiceParse, booksApi, profileApi } from '../api';
import { usePeople } from '../hooks/usePeople';
import { useMutation, useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { Avatar, Button, Card, Chip, ChipRow, CircleBtn, Gap, Header, Icon, IconTile, Input, Keypad, Label, Row, Screen, Segmented, Sheet, T, Toggle } from '../components/ui';
import type { IconName } from '../components/icons';
import { haptic, Loop, Press, Replay, Rise } from '../components/motion';
import type { ScreenProps } from '../navigation/types';
import { pickImage } from '../native/device';
import { LiveCamera } from '../native/LiveCamera';

const CATS: [Category, IconName][] = [['Food', 'utensils'], ['Travel', 'car'], ['Groceries', 'cart'], ['Bills', 'receipt'], ['Shopping', 'bag'], ['Stay', 'bed'], ['Fun', 'ticket']];
const fmtAmt = (a: string) => { const [i, d] = a.split('.'); return parseInt(i || '0', 10).toLocaleString('en-IN') + (a.includes('.') ? '.' + (d ?? '') : ''); };

/* ---------- 10 Add entry ---------- */
export function AddEntryScreen({ navigation, route }: ScreenProps<'AddEntry'>) {
  const p = useColors(); const { showToast } = useApp();
  const [flow, setFlow] = useState<'out' | 'in'>(route.params?.flow ?? 'out');
  const [amt, setAmt] = useState(route.params?.amount ?? '1240');
  const [cat, setCat] = useState<Category>('Food');
  const [day, setDay] = useState(0);
  const [note, setNote] = useState(''); const [noteOpen, setNoteOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null); const [uploading, setUploading] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [save, busy] = useMutation(route.params?.editId ? (b: any) => entriesApi.update(route.params!.editId!, b) : entriesApi.create);
  const books = useQuery(booksApi.list, [], 'books');
  const [bookId, setBookId] = useState(route.params?.bookId ?? 'goa');
  const book = books.data?.find(b => b.id === bookId);
  const detail = useQuery(() => booksApi.get(bookId), [bookId], 'book:' + bookId);
  const members = (detail.data?.members ?? []).map(m => m.initials).slice(0, 4);
  const num = parseFloat(amt) || 0;
  const press = (k: string) => {
    let a = amt;
    if (k === 'del') a = a.slice(0, -1) || '0';
    else if (k === '.') { if (!a.includes('.')) a += '.'; }
    else { if (a.includes('.') && a.split('.')[1].length >= 2) return; if (a.replace('.', '').length >= 8) return; a = a === '0' ? k : a + k; }
    setAmt(a);
  };
  const shown = fmtAmt(amt);
  const DAYS = ['Today', 'Yesterday', '2 days ago'];
  const isoDate = () => { const d = new Date(); d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); };
  const attachReceipt = async () => {
    if (receiptId) { setReceiptId(null); return; }
    setUploading(true);
    try {
      const file = await pickImage('library') || await pickImage('camera') || { uri: 'file://receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' };
      const r = await entriesApi.uploadReceipt(file); setReceiptId(r.receiptId); showToast('Receipt attached');
    }
    catch { showToast("Couldn't upload the receipt. Try again"); } finally { setUploading(false); }
  };
  const [err, setErr] = useState(0);
  const go = async () => {
    if (!num) { haptic('error'); setErr(e => e + 1); return showToast('Enter an amount first'); }
    try { await save({ bookId, amount: num, flow, category: cat, date: isoDate(), note: note.trim() || undefined, receiptId: receiptId ?? undefined, paidBy: 'AK', split: { mode: 'Equal', members } }); }
    catch { haptic('error'); return showToast("Couldn't save. Check your connection and try again"); }
    haptic('success');
    navigation.navigate('Spaces', { space: 'Home', at: Date.now() });
    showToast(`Saved ${inr(num)} to ${book?.name ?? 'your book'}`);
  };
  return (
    <Screen scroll={false}>
      <Row between>
        <CircleBtn icon="back" onPress={() => navigation.goBack()} />
        <Press onPress={() => setBookOpen(true)} scaleTo={0.94} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, paddingHorizontal: 12, height: 38, borderRadius: 19 }}>
          <LinearGradient colors={p[book?.gradient ?? 'c1'] as [string, string]} style={{ width: 18, height: 18, borderRadius: 6 }} /><T v="smallB">{book?.name ?? '…'}</T><Icon name="caretDown" size={12} color={p.mu} weight="bold" />
        </Press>
        <CircleBtn icon="mic" onPress={() => navigation.navigate('Voice')} />
      </Row>
      <Segmented options={['Money out', 'Money in']} value={flow === 'out' ? 'Money out' : 'Money in'} onChange={v => setFlow(v === 'Money out' ? 'out' : 'in')} style={{ marginTop: 16 }} />
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Replay trigger={err} name="shake" duration={420}>
          <Row gap={4} center={false} style={{ alignItems: 'center', height: 84 }}>
            <T c="mu" style={{ fontFamily: fonts.medium, fontSize: 30, lineHeight: 36, marginTop: 10 }}>₹</T>
            <Replay trigger={amt} name="bump" duration={200}>
              <T c={flow === 'in' ? 'po' : 'tx'} style={{ fontFamily: fonts.bold, fontSize: shown.length > 9 ? 48 : shown.length > 7 ? 58 : 72, lineHeight: 84, letterSpacing: -3, fontVariant: ['tabular-nums'] }}>{shown}</T>
            </Replay>
            <Loop name="caret" duration={1000} easing="linear"><View style={{ width: 2.5, height: 54, borderRadius: 2, backgroundColor: p.ac }} /></Loop>
          </Row>
        </Replay>
        <Press onPress={async () => { const s = await entriesApi.suggest(num); if (s) { setCat(s.category); showToast('Filled from your last ' + s.title + ' entry'); } }} scaleTo={0.94} style={{ backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, borderRadius: 13, paddingHorizontal: 12, height: 26, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="sparkle" size={12} color={p.ac} /><T v="tiny" c="tx">Swiggy · same as last time</T>
        </Press>
      </View>
      <Gap h={16} />
      <ChipRow>{CATS.map(([n, i], k) => <Rise key={n} delay={80 + k * 35} kind="tileIn"><Chip icon={i} label={n + (n === 'Food' && cat === 'Food' ? ' · AUTO' : '')} on={cat === n} onPress={() => setCat(n)} /></Rise>)}</ChipRow>
      <Rise delay={160}><Card style={{ marginTop: 12, padding: 0 }}>
        <Press onPress={() => navigation.navigate('Split', { amount: String(num), bookId, entryId: route.params?.editId })} scaleTo={0.985} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
          <Row gap={0}>{members.map((m, i) => <View key={m} style={{ marginLeft: i ? -8 : 0 }}><Avatar ini={m} size={26} ring={p.s1} /></View>)}</Row>
          <View style={{ flex: 1 }}><T v="tiny">{flow === 'out' ? 'You paid · split with' : 'Received from'}</T><T v="bodyB">{members.length} people · {inr(num / members.length)} each</T></View>
          <Icon name="caretRight" size={16} color={p.mu} />
        </Press>
        <Row gap={0} style={{ borderTopWidth: 1, borderColor: p.sep }}>
          {[{ i: 'calendar', n: DAYS[day], on: day > 0, go: () => setDay((day + 1) % 3) }, { i: 'note', n: note ? 'Note added' : 'Add note', on: !!note, go: () => setNoteOpen(true) }, { i: 'paperclip', n: uploading ? 'Uploading…' : receiptId ? 'Receipt ✓' : 'Receipt', on: !!receiptId, go: attachReceipt }].map((m, k) => (
            <Press key={k} onPress={m.go} hapticKind="select" scaleTo={0.94} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderLeftWidth: k ? 1 : 0, borderColor: p.sep }}>
              <Icon name={m.i as IconName} size={15} color={m.on ? p.ac : p.tx} weight={m.on ? 'fill' : 'regular'} /><T v="tiny" c={m.on ? 'ac' : 'tx'} style={{ fontFamily: fonts.bold }}>{m.n}</T>
            </Press>
          ))}
        </Row>
      </Card></Rise>
      <View style={{ flex: 1 }} />
      <Keypad keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']} onKey={press} />
      <Button label={`Save · ₹${shown} · ${cat}`} busy={busy} onPress={go} style={{ marginTop: 8, marginBottom: 14 }} />
      <Sheet open={bookOpen} onClose={() => setBookOpen(false)} title="Add to which book?">
        <View style={{ gap: 6, marginTop: 10 }}>{(books.data ?? []).map(b => (
          <Press key={b.id} onPress={() => { setBookId(b.id); setBookOpen(false); }} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: b.id === bookId ? p.s2 : 'transparent' }}>
            <LinearGradient colors={p[b.gradient] as [string, string]} style={{ width: 34, height: 34, borderRadius: 10 }} />
            <View style={{ flex: 1 }}><T v="bodyB">{b.name}</T><T v="tiny">{b.kind} · {b.people === 1 ? 'just you' : b.people + ' people'}</T></View>
            {b.id === bookId ? <Icon name="check" size={16} color={p.ac} weight="bold" /> : null}
          </Press>
        ))}</View>
      </Sheet>
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Note" sub="Everyone in this book can see it.">
        <Gap h={10} />
        <Input value={note} onChangeText={t => setNote(t.slice(0, 140))} placeholder="e.g. Team dinner after check-in" autoFocus style={{ backgroundColor: p.s2 }} hint={`${note.length}/140`} />
        <Gap h={14} />
        <Button label="Done" onPress={() => setNoteOpen(false)} />
      </Sheet>
    </Screen>
  );
}

/* ---------- 11 Split ---------- */
export function SplitScreen({ navigation, route }: ScreenProps<'Split'>) {
  const p = useColors(); const { showToast } = useApp();
  const total = parseFloat(route.params?.amount ?? '1240') || 0;
  const bookId = route.params?.bookId ?? 'goa';
  const ppl = usePeople();
  const detail = useQuery(() => booksApi.get(bookId), [bookId], 'book:' + bookId);
  const ids = (detail.data?.members ?? []).map(m => m.initials);
  const [mode, setMode] = useState<'Equal' | 'Exact' | 'Shares'>('Equal');
  const [off, setOff] = useState<Record<string, boolean>>({ MI: true });
  const on = Object.fromEntries(ids.map(i => [i, !off[i]])) as Record<string, boolean>;
  const setOn = (n: Record<string, boolean>) => setOff(Object.fromEntries(ids.map(i => [i, !n[i]])));
  const [exact, setExact] = useState<Record<string, string>>({});
  const [shareMap, setShares] = useState<Record<string, number>>({});
  const shares = new Proxy(shareMap, { get: (t, k: string) => t[k] ?? 1 }) as Record<string, number>;
  const sel = ids.filter(i => on[i]); const n = sel.length || 1;
  const [saveSplit, saving] = useMutation(async () => {
    const split = { mode, members: sel, parts: mode === 'Equal' ? undefined : Object.fromEntries(sel.map(i => [i, Math.round(part(i) * 100) / 100])) };
    if (route.params?.entryId) return entriesApi.update(route.params.entryId, { split });
    return entriesApi.create({ bookId, amount: total, flow: 'out', category: 'Other', title: route.params?.title ?? 'Split bill', date: new Date().toISOString().slice(0, 10), paidBy: 'AK', split });
  });
  const shareTot = sel.reduce((a, i) => a + shares[i], 0) || 1;
  const part = (i: string) => mode === 'Equal' ? total / n : mode === 'Shares' ? total * shares[i] / shareTot : parseFloat(exact[i] || '0') || 0;
  const sum = sel.reduce((a, i) => a + part(i), 0); const ok = mode !== 'Exact' || Math.abs(sum - total) < 1;
  const footer = (
    <View style={{ gap: 10 }}>
      <Card style={{ paddingVertical: 12, borderColor: ok ? p.sep : p.ne }}><T v="small" center c={ok ? 'mu' : 'ne'}>{ok ? (mode === 'Equal' ? `Adds up: ${n} people × ${inr(total / n)}` : `Adds up to ${inr(total)}`) : `Parts add up to ${inr(sum)}, ${inr(Math.abs(total - sum))} ${sum < total ? 'short' : 'over'}`}</T></Card>
      <Button label="Save split" disabled={!ok || !sel.length} busy={saving} onPress={async () => { try { await saveSplit(); } catch { haptic('error'); return showToast("Couldn't save the split. Try again"); } haptic('success'); navigation.goBack(); showToast(`Split ${inr(total)} between ${n} people`); }} />
    </View>
  );
  return (
    <Screen footer={footer}>
      <Row gap={12} style={{ marginBottom: 18 }}><CircleBtn icon="back" onPress={() => navigation.goBack()} /><View><T v="tiny">Split in {detail.data?.name ?? '…'}</T><T v="h2" style={{ fontVariant: ['tabular-nums'] }}>{inr(total)}</T></View></Row>
      <Segmented options={['Equal', 'Exact', 'Shares']} value={mode} onChange={v => setMode(v as typeof mode)} />
      <T v="bodyB" style={{ marginTop: 18, marginBottom: 10 }}>Who's in · tap to add or remove</T>
      <View style={{ gap: 8 }}>
        {ids.map((i, k) => (
          <Rise key={i} delay={k * 50}>
          <Press onPress={() => setOn({ ...on, [i]: !on[i] })} hapticKind="select" scaleTo={0.98}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: on[i] ? 1 : 0.7 }}>
              <Avatar ini={i} size={38} />
              <View style={{ flex: 1 }}><T v="bodyB">{i === 'AK' ? 'Arjun (you)' : ppl.name(i)}</T><Replay trigger={on[i] ? part(i).toFixed(0) : 'off'} name="bump" duration={240}><T v="mono" c={on[i] ? 'tx' : 'mu'}>{on[i] ? inr(part(i)) : 'Not in this split'}</T></Replay></View>
              {on[i] && mode === 'Exact' ? <View style={{ width: 90 }}><Input value={exact[i] ?? ''} onChangeText={t => setExact({ ...exact, [i]: t.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="0" style={{ backgroundColor: p.s2, minHeight: 40 }} /></View> : null}
              {on[i] && mode === 'Shares' ? <Row gap={6}><CircleBtn size={30} icon="x" bg={p.s2} onPress={() => setShares({ ...shares, [i]: Math.max(1, shares[i] - 1) })} /><T v="bodyB">{shares[i]}</T><CircleBtn size={30} icon="plus" bg={p.s2} onPress={() => setShares({ ...shares, [i]: shares[i] + 1 })} /></Row> : null}
              <View style={[{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: on[i] ? p.ac : p.mu, backgroundColor: on[i] ? p.ac : 'transparent', alignItems: 'center', justifyContent: 'center' }, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 180 } as any]}>{on[i] ? <Rise kind="pop" duration={380}><Icon name="check" size={14} color={p.ai} weight="bold" /></Rise> : null}</View>
            </Card>
          </Press>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}

/* ---------- 12 Scan receipt ---------- */
export function ScanScreen({ navigation }: ScreenProps) {
  const p = useColors(); const ins = useSafeAreaInsets(); const { showToast } = useApp();
  const [kind, setKind] = useState<'Receipt' | 'Bill' | 'Invoice'>('Receipt');
  const [state, setState] = useState<'cam' | 'read' | 'review'>('cam');
  const [res, setRes] = useState<ScanResult | null>(null);
  const line = useRef(new Animated.Value(0)).current;
  const cam = useRef<{ takePictureAsync: () => Promise<{ uri?: string } | undefined> }>(null);
  const [torch, setTorch] = useState(false);
  useEffect(() => { Animated.loop(Animated.timing(line, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, [line]);
  const shoot = async () => {
    setState('read');
    let file = { uri: 'file://receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' };
    try { const shot = await cam.current?.takePictureAsync(); if (shot?.uri) file = { uri: shot.uri, name: 'receipt.jpg', type: 'image/jpeg' }; } catch { /* keep the frame photo */ }
    try { const r = await captureApi.scanReceipt(file, kind); setRes(r); setState('review'); }
    catch { setState('cam'); navigation.navigate('ScanFail'); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#050607', paddingTop: ins.top + 8 }}>
      <Row between style={{ paddingHorizontal: 20 }}>
        <CircleBtn icon="x" bg="rgba(255,255,255,.12)" color="#F2F5F7" onPress={() => navigation.goBack()} />
        <Row gap={2} style={{ backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 18, padding: 3 }}>
          {(['Receipt', 'Bill', 'Invoice'] as const).map(k => <Pressable key={k} onPress={() => setKind(k)} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: kind === k ? '#F2F5F7' : 'transparent' }}><T v="smallB" c={kind === k ? '#0A0C0F' : '#F2F5F7'}>{k}</T></Pressable>)}
        </Row>
        <CircleBtn icon="flashlight" bg={torch ? '#F2F5F7' : 'rgba(255,255,255,.12)'} color={torch ? '#0A0C0F' : '#F2F5F7'} onPress={() => setTorch(t => !t)} />
      </Row>
      {state !== 'review' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 250, height: 330, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <LiveCamera ref={cam} torch={torch} />
            {(['tl', 'tr', 'bl', 'br'] as const).map(c => <View key={c} style={{ position: 'absolute', width: 34, height: 34, borderColor: state === 'read' ? '#5EE6B5' : '#F2F5F7', [c[0] === 't' ? 'top' : 'bottom']: 0, [c[1] === 'l' ? 'left' : 'right']: 0, [c[0] === 't' ? 'borderTopWidth' : 'borderBottomWidth']: 3, [c[1] === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: 3, borderRadius: 6 } as any} />)}
            <View style={{ width: 180, height: 270, backgroundColor: '#EDEAE3', borderRadius: 4, padding: 16, gap: 8, transform: [{ rotate: '-3deg' }] }}>
              {[70, 100, 85, 100, 60, 90, 75].map((w, i) => <View key={i} style={{ height: 6, width: `${w}%`, backgroundColor: '#B9B4AA', borderRadius: 3 }} />)}
            </View>
            <Animated.View style={{ position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#5EE6B5', shadowColor: '#5EE6B5', shadowOpacity: 1, shadowRadius: 8, transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] }) }] }} />
          </View>
          <T v="small" c="#C9CFD6" style={{ marginTop: 20 }}>{state === 'read' ? 'Reading receipt…' : 'Fit the whole receipt inside the frame'}</T>
        </View>
      ) : res && (
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Card style={{ backgroundColor: p.s1 }}>
            <Row between><T v="kicker">READ IN 1.2s · {Math.round(res.confidence * 100)}% SURE</T><Icon name="sealCheck" color={p.ac} /></Row>
            <T v="h2" style={{ marginTop: 8 }}>{res.merchant}</T><T v="small">{res.date}</T>
            {res.items.map(it => <Row key={it.name} between style={{ marginTop: 10 }}><T v="small" c="tx">{it.name}</T><T v="mono">{inr(it.amount)}</T></Row>)}
            <Row between style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: p.sep }}><T v="bodyB">Total</T><T v="h3">{inr(res.amount)}</T></Row>
          </Card>
          <Gap h={16} />
          <Button label="Split this bill" onPress={() => { navigation.replace('Split', { amount: String(res.amount), title: res.merchant }); showToast(`Receipt read: ${inr(res.amount)} at ${res.merchant.split(' ')[0]}`); }} />
          <Gap h={8} />
          <Button kind="secondary" label="Retake" onPress={() => setState('cam')} />
        </View>
      )}
      {state !== 'review' ? (
        <Row between style={{ paddingHorizontal: 40, paddingBottom: ins.bottom + 30 }}>
          <Pressable onPress={async () => { const file = await pickImage('library'); if (!file) return; setState('read'); try { const r = await captureApi.scanReceipt(file, kind); setRes(r); setState('review'); } catch { setState('cam'); navigation.navigate('ScanFail'); } }}><IconTile icon="images" size={48} bg="rgba(255,255,255,.1)" color="#F2F5F7" /></Pressable>
          <Pressable onPress={shoot} disabled={state === 'read'} style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#F2F5F7', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: state === 'read' ? '#5EE6B5' : '#F2F5F7' }} /></Pressable>
          <Pressable onPress={() => navigation.replace('AddEntry')}><IconTile icon="pencil" size={48} bg="rgba(255,255,255,.1)" color="#F2F5F7" /></Pressable>
        </Row>
      ) : null}
    </View>
  );
}

/* ---------- F4 Voice entry ---------- */
export function VoiceScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const [state, setState] = useState<'listen' | 'busy' | 'parsed' | 'fail'>('listen'); const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [res, setRes] = useState<VoiceParse | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })])).start(); }, [pulse]);
  const rec = useRef<{ stop: () => Promise<void>; uri?: string | null } | null>(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const Audio = await import('expo-audio');
        const perm = await Audio.requestRecordingPermissionsAsync();
        if (!perm.granted || stop) return;
        const recorder = new Audio.AudioModule.AudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
        await recorder.prepareToRecordAsync();
        recorder.record();
        rec.current = recorder;
      } catch { /* voice still parses through the API */ }
    })();
    return () => { stop = true; rec.current?.stop().catch(() => {}); };
  }, []);
  const done = async () => {
    setState('busy');
    let file = { uri: 'file://clip.m4a', name: 'clip.m4a', type: 'audio/m4a' };
    try { await rec.current?.stop(); if (rec.current?.uri) file = { uri: rec.current.uri, name: 'clip.m4a', type: 'audio/m4a' }; } catch { /* mock clip */ }
    try { const r = await captureApi.parseVoice(file, lang); setRes(r); setState('parsed'); }
    catch { setState('fail'); }
  };
  const footer = state === 'parsed' && res ? (
    <Row><Button kind="secondary" label="Edit" style={{ flex: 1 }} onPress={() => navigation.replace('AddEntry', { amount: String(res.amount) })} />
      <Button label="Save" style={{ flex: 2 }} onPress={async () => { const bk = (await booksApi.list()).find(b => b.name === res.book) ?? { id: 'goa' }; const d = await booksApi.get(bk.id); await entriesApi.create({ bookId: bk.id, amount: res.amount, flow: 'out', category: 'Travel', title: res.title, date: new Date().toISOString().slice(0, 10), paidBy: 'AK', split: { mode: 'Equal', members: d.members.map(m => m.initials) } }); navigation.navigate('Spaces', { space: 'Home', at: Date.now() }); showToast(`Saved ${inr(res.amount)} · ${res.title.split(' ')[0]} to airport, split ${res.splitWays} ways`); }} /></Row>
  ) : (
    <Row><Button kind="secondary" label="Type instead" style={{ flex: 1 }} onPress={() => navigation.replace('AddEntry')} /><Button label={state === 'fail' ? 'Try again' : 'Done'} busy={state === 'busy'} style={{ flex: 1.4 }} onPress={state === 'fail' ? () => setState('listen') : done} /></Row>
  );
  return (
    <Screen scroll={false} footer={footer}>
      <Row between><CircleBtn icon="x" onPress={() => navigation.goBack()} /><Pressable onPress={() => setLang(lang === 'en-IN' ? 'hi-IN' : 'en-IN')} style={{ backgroundColor: p.s1, borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center' }}><T v="smallB">{lang === 'en-IN' ? 'English · हिंदी' : 'हिंदी · English'}</T></Pressable></Row>
      {state === 'parsed' && res ? (
        <View style={{ marginTop: 30 }}>
          <T v="h1">Got it</T><T v="small" style={{ marginTop: 6 }}>"{res.transcript}"</T>
          <Card style={{ marginTop: 20, gap: 4 }}>
            <Row between><T v="small">Amount</T><T v="h3">{inr(res.amount)}</T></Row>
            <Row between><T v="small">What</T><T v="bodyB">{res.title}</T></Row>
            <Row between><T v="small">Book</T><T v="bodyB">{res.book}</T></Row>
            <Row between><T v="small">Split</T><T v="bodyB">{res.splitWays} ways · {inr(res.amount / res.splitWays)} each</T></Row>
          </Card>
        </View>
      ) : (
        <View style={{ alignItems: 'center', flex: 1 }}>
          <T v="h2" style={{ marginTop: 24 }}>{state === 'fail' ? "Didn't catch that" : state === 'busy' ? 'Understanding…' : 'Listening...'}</T>
          <T v="small" center style={{ marginTop: 6 }}>{state === 'fail' ? 'Try again in a quieter spot, or type it.' : 'Say the amount, what it was for, and the book'}</T>
          <Animated.View style={{ marginTop: 40, width: 180, height: 180, borderRadius: 90, backgroundColor: p.act, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }] }}>
            <LinearGradient colors={p.fab as [string, string, string]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.9, y: 1 }} style={{ width: 96, height: 96, borderRadius: 48 }} />
          </Animated.View>
          <Row gap={4} style={{ marginTop: 34, height: 44 }}>{[10, 22, 34, 18, 40, 26, 12, 30, 44, 20, 28, 14, 36, 16].map((h, i) => <View key={i} style={{ width: 4, height: state === 'listen' ? h : 6, borderRadius: 2, backgroundColor: p.ac }} />)}</Row>
          <T v="bodyB" center style={{ marginTop: 26, paddingHorizontal: 20 }}>“₹450 auto to the airport, Goa trip, split with everyone”</T>
        </View>
      )}
    </Screen>
  );
}

/* ---------- M6 Share to Byjan (from GPay share sheet) ---------- */
export function ShareInScreen({ navigation, route }: ScreenProps<'ShareIn'>) {
  const { showToast } = useApp();
  const books = useQuery(booksApi.list, [], 'books');
  const shared = route.params?.file ?? { uri: 'file://shared.png', name: 'shared.png', type: 'image/png' };
  const parsed = useQuery(() => captureApi.parseShared(shared), [shared.uri], 'share:parse');
  const [amt, setAmt] = useState(''); const [bookId, setBookId] = useState('home'); const [cat, setCat] = useState<Category>('Food'); const [keep, setKeep] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (parsed.data && !amt) setAmt(String(parsed.data.amount)); }, [parsed.data]);  
  const book = books.data?.find(b => b.id === bookId);
  const [save, busy] = useMutation(async (a: number) => {
    const d = await booksApi.get(bookId);
    await entriesApi.create({ bookId, amount: a, flow: 'out', category: cat, title: parsed.data?.payee ?? 'UPI payment', date: new Date().toISOString().slice(0, 10), note: parsed.data ? 'UPI ref ' + parsed.data.ref : undefined, paidBy: 'AK', split: { mode: 'Equal', members: d.members.map(m => m.initials) } });
    if (keep) await profileApi.updatePrefs({ autoSaveGpayShares: true });
  });
  const go = async () => {
    const a = parseInt(amt || '0', 10); if (!a) return setErr("Amount can't be empty");
    try { await save(a); } catch { return showToast("Couldn't save. Try again"); }
    haptic('success'); navigation.navigate('Spaces', { space: 'Home', at: Date.now() });
    showToast(`Saved ${inr(a)} ${parsed.data?.payee ?? ''} to ${book?.name ?? 'your book'}${keep ? ' · auto next time' : ''}`);
  };
  return (
    <Screen footer={<Button label={'Save to  ' + (book?.name ?? '…')} busy={busy} onPress={go} />}>
      <Header title="Shared from Google Pay" />
      <Card style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ width: 56, height: 72, backgroundColor: '#fff', borderRadius: 8, padding: 8, gap: 5 }}>{[60, 90, 70, 90].map((w, i) => <View key={i} style={{ height: 4, width: `${w}%`, backgroundColor: '#ccc', borderRadius: 2 }} />)}</View>
        <View style={{ flex: 1 }}>{parsed.data ? <><T v="bodyB">Screenshot read</T><T v="small">Paid to {parsed.data.payee} · UPI ref {parsed.data.ref}</T></> : parsed.error ? <><T v="bodyB">Couldn't read it</T><T v="small">Type the amount below.</T></> : <><T v="bodyB">Reading screenshot…</T><T v="small">This takes a second.</T></>}</View>
      </Card>
      <Label>Amount</Label>
      <Input value={amt} onChangeText={t => { setAmt(t.replace(/\D/g, '').slice(0, 7)); setErr(''); }} keyboardType="number-pad" left={<T c="mu">₹</T>} error={err} style={{ minHeight: 60 }} />
      <Label>Add to book</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{(books.data ?? []).map(b => <Chip key={b.id} label={b.name} on={bookId === b.id} onPress={() => setBookId(b.id)} />)}</Row>
      <Label>Category</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{(['Food', 'Travel', 'Groceries', 'Bills', 'Other'] as Category[]).map(b => <Chip key={b} label={b} on={cat === b} onPress={() => setCat(b)} />)}</Row>
      <Row between style={{ marginTop: 20 }}><View><T v="bodyB">Always do this for GPay shares</T><T v="tiny">Skip this screen next time</T></View><Toggle on={keep} onPress={() => setKeep(!keep)} /></Row>
    </Screen>
  );
}
