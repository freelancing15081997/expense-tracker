import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { useApp, useColors } from '../state/AppContext';
import { ApiError, authApi, billingApi, booksApi, dashboardApi, profileApi, settleApi, BookKind } from '../api';
import { prefetch, useMutation, useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { Avatar, Button, Card, Chip, Divider, ErrorBox, Gap, Icon, IconTile, Input, Label, LinkText, Loading, Pill, Progress, Row, Screen, T, Toggle, Sheet } from '../components/ui';
import { Donut, FlatBook } from '../components/brand';
import { measureOrigin } from '../components/BookMorph';
import type { BookSummary } from '../api';
import { CountUp, EASE, haptic, Loop, Odometer, Press, Rise } from '../components/motion';
import { deviceFlags } from '../native/device';
import type { IconName } from '../components/icons';
import { HScroll } from './SpacesScreen';

/** Shared space page shell: same top padding as Screen, no slide-in (the pager animates spaces). */
function SpaceScroll({ children }: { children: React.ReactNode }) {
  const p = useColors();
  return <Screen bg={p.bg} style={{ paddingBottom: 30 }}>{children}</Screen>;
}
function SpaceHead({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <Rise>
      <Row between center={false} style={{ marginBottom: 18 }}>
        <View><T v="tiny">{kicker}</T><T v="h1" style={{ fontSize: 32, lineHeight: 37, marginTop: 2 }}>{title}</T></View>
        <View style={{ marginTop: 10 }}>{right}</View>
      </Row>
    </Rise>
  );
}

/* ---------- 05 Books ---------- */
export function BooksScreen() {
  const p = useColors(); const { showToast } = useApp(); const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { data, error, reload } = useQuery(booksApi.list);
  const [f, setF] = useState('All'); const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(!!route.params?.newBook);
  const list = (data ?? []).filter(b => (f === 'All' || b.filter === f) && (!q || b.name.toLowerCase().includes(q.toLowerCase())));
  const filters: [string, string][] = [['All', p.tx], ['Owed to you', p.po], ['You owe', p.ne], ['Needs action', p.wa]];
  return (
    <SpaceScroll>
      <SpaceHead kicker={`${data?.length ?? '–'} active · 1 archived`} title="Books" right={<Button small label="New book" icon="plus" onPress={() => setSheet(true)} />} />
      <Rise delay={60}><Input value={q} onChangeText={setQ} placeholder="Search books, people, entries" left={<Icon name="search" size={17} color={p.mu} />} /></Rise>
      <Gap h={12} />
      <Rise delay={100}><HScroll style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {filters.map(([n, dot]) => <Chip key={n} label={n} dot={n === 'All' ? undefined : dot} on={f === n} count={n === 'All' ? data?.length : data?.filter(b => b.filter === n).length} onPress={() => setF(n)} />)}
      </HScroll></Rise>
      <Gap h={16} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : (
        <View style={{ gap: 14 }} key={f + q}>
          {list.map((b, i) => <BookRow key={b.id} b={b} i={i} onOpen={(origin) => navigation.navigate('Book', { id: b.id, origin })} />)}
          {!list.length ? <Rise><Card style={{ alignItems: 'center', gap: 8, paddingVertical: 26 }}><Icon name="books" size={28} color={p.mu} /><T v="bodyB">No books match</T><LinkText label="Clear filters" onPress={() => { setF('All'); setQ(''); }} /></Card></Rise> : null}
        </View>
      )}
      <NewBookSheet open={sheet} onClose={() => setSheet(false)} onCreated={n => { setSheet(false); reload(); haptic('success'); showToast('Created ' + n); }} />
    </SpaceScroll>
  );
}

/** Measures the tapped book so the detail can grow out of it (macOS-style). */
const BookRow = React.memo(function BookRow({ b, i, onOpen }: { b: BookSummary; i: number; onOpen: (o?: { cx: number; cy: number }) => void }) {
  const ref = React.useRef<View>(null);
  // Prefetch on touch-down so the detail is complete on its first frame when the window opens.
  const warm = () => { prefetch('book:' + b.id, () => booksApi.get(b.id)); prefetch('entries:' + b.id, () => booksApi.entries(b.id)); prefetch('bal:' + b.id, () => booksApi.balances(b.id)); };
  return <FlatBook b={b} i={i} innerRef={ref} onPressIn={warm} onPress={() => measureOrigin(ref, onOpen)} />;
});

export function NewBookSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const p = useColors();
  const [name, setName] = useState(''); const [purpose, setPurpose] = useState<BookKind>('Trip'); const [budget, setBudget] = useState(''); const [err, setErr] = useState('');
  const [create, busy] = useMutation(booksApi.create);
  const go = async () => {
    const n = name.trim();
    if (!n) return setErr('Give your book a name'); if (n.length < 2) return setErr('Use at least 2 characters');
    try { await create({ name: n, purpose, monthlyBudget: budget ? Number(budget) : undefined }); setName(''); setBudget(''); onCreated(n + (budget ? ' · budget ₹' + Number(budget).toLocaleString('en-IN') : '')); }
    catch (e) { haptic('error'); setErr((e as ApiError).message); }
  };
  const ICON: Record<BookKind, IconName> = { Trip: 'plane', Household: 'house', Business: 'briefcase', Event: 'confetti', Personal: 'user' };
  return (
    <Sheet open={open} onClose={onClose} title="New book" sub="A book keeps one part of your money together.">
      <Gap h={14} />
      <Input value={name} onChangeText={t => { setName(t.slice(0, 40)); setErr(''); }} placeholder="e.g. Manali trip, Flat 302" error={err} hint={name.trim().length >= 2 ? 'Looks good' : undefined} hintColor={p.po} style={{ backgroundColor: p.s2 }} />
      <Label>What's it for?</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{(Object.keys(ICON) as BookKind[]).map(n => <Chip key={n} icon={ICON[n]} label={n} on={purpose === n} onPress={() => setPurpose(n)} />)}</Row>
      <Label>Monthly budget · optional</Label>
      <Input value={budget ? Number(budget).toLocaleString('en-IN') : ''} onChangeText={t => setBudget(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="40,000" left={<T c="mu" style={{ fontFamily: fonts.bold }}>₹</T>} style={{ backgroundColor: p.s2 }} inputStyle={{ fontFamily: fonts.mono }} />
      <Row gap={6} style={{ marginTop: 8 }}>{['10000', '25000', '40000'].map(v => <Chip key={v} label={'₹' + Number(v).toLocaleString('en-IN')} on={budget === v} onPress={() => setBudget(v)} />)}</Row>
      <Gap h={20} />
      <Button label="Create book" busy={busy} onPress={go} />
    </Sheet>
  );
}

/* ---------- 06 Settle ---------- */
export function SettleScreen() {
  const p = useColors(); const { showToast } = useApp(); const navigation = useNavigation<any>();
  const { data: s, error, reload } = useQuery(settleApi.summary);
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const remind = async (ids: string[], label: string) => { await settleApi.remind(ids); setNudged(n => ({ ...n, ...Object.fromEntries(ids.map(i => [i, true])) })); haptic('success'); showToast(label); };
  return (
    <SpaceScroll>
      <SpaceHead kicker="4 books · updated just now" title="Settle up" right={<Press onPress={reload} scaleTo={0.9} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, alignItems: 'center', justifyContent: 'center' }}><Icon name="refresh" size={17} /></Press>} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !s ? <Loading /> : <>
        <Rise delay={40} kind="riseBig">
          <View style={{ borderRadius: 27, padding: 3, borderWidth: 1, borderColor: p.sep }}>
            <LinearGradient colors={p.c1 as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
              <Loop name="sheen" duration={6000} pointerEvents="none" style={{ position: 'absolute', top: -20, bottom: -20, left: 0, width: 90 }}>
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
              </Loop>
              <Row between><T v="kicker" c={p.cm}>NET POSITION</T><Pill label="You're ahead" color={p.ct} bg="rgba(0,0,0,.28)" pulse /></Row>
              <Row gap={0} style={{ marginTop: 6 }}><T c={p.ct} style={{ fontFamily: fonts.bold, fontSize: 46, lineHeight: 52, letterSpacing: -2 }}>+₹</T><Odometer value={s.net.toLocaleString('en-IN')} size={46} color={p.ct} font={fonts.bold} /></Row>
              <T v="small" c={p.cm}>What you'll be left with once everyone settles</T>
              <Row gap={4} style={{ marginTop: 14 }}>
                <Animated.View style={[{ flex: s.youGetBack, height: 6, borderRadius: 3, backgroundColor: p.po, transformOrigin: 'left' } as any, { animationName: { from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } }, animationDuration: '900ms', animationDelay: '300ms', animationTimingFunction: EASE.out, animationFillMode: 'both' } as any]} />
                <Animated.View style={[{ flex: s.youOwe, height: 6, borderRadius: 3, backgroundColor: p.ne, transformOrigin: 'right' } as any, { animationName: { from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } }, animationDuration: '900ms', animationDelay: '500ms', animationTimingFunction: EASE.out, animationFillMode: 'both' } as any]} />
              </Row>
              <Row style={{ marginTop: 14 }}>
                <View style={{ flex: 1 }}><Row gap={6}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.po }} /><T v="tiny" c={p.cm}>You'll get back</T></Row><CountUp to={s.youGetBack} style={{ fontFamily: fonts.bold, fontSize: 20, color: p.ct, marginTop: 2 }} /><T v="tiny" c={p.cm}>from {s.fromCount} people</T></View>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 8 }} />
                <View style={{ flex: 1 }}><Row gap={6}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.ne }} /><T v="tiny" c={p.cm}>You owe</T></Row><CountUp to={s.youOwe} style={{ fontFamily: fonts.bold, fontSize: 20, color: p.ct, marginTop: 2 }} /><T v="tiny" c={p.cm}>to {s.toCount} person</T></View>
              </Row>
            </LinearGradient>
          </View>
        </Rise>
        <Rise delay={120}><Row style={{ marginTop: 12 }}>
          <Button label={'Pay ' + inr(s.youOwe)} style={{ flex: 1 }} onPress={() => navigation.navigate('Pay', { to: 'MI', amount: s.youOwe })} />
          <Button kind="secondary" icon={s.owed.every(o => nudged[o.initials]) ? 'checks' : 'whatsapp'} label={s.owed.every(o => nudged[o.initials]) ? 'All nudged' : `Remind all ${s.owed.length}`} style={{ flex: 1 }} onPress={() => remind(s.owed.map(o => o.initials), 'Nudges sent to Rahul, Kabir and Priya')} />
        </Row></Rise>
        <Rise delay={170}><Card style={{ marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Row gap={0}>{['RV', 'KS', 'MI'].map((a, i) => <View key={a} style={{ marginLeft: i ? -8 : 0 }}><Avatar ini={a} size={26} ring={p.s1} /></View>)}</Row>
          <T v="small" style={{ flex: 1 }}><T v="smallB" c="a2">Smart settle</T> {s.smartNote.replace('Smart settle ', '')}</T>
        </Card></Rise>

        <Rise delay={220}><Row between style={{ marginTop: 24, marginBottom: 10 }}><T v="h3">You owe</T><T v="smallB" c="ne">{inr(s.youOwe)} · {s.toCount} person</T></Row></Rise>
        {s.owe.map((o, i) => (
          <Rise key={o.initials} delay={260 + i * 50}>
            <Card onPress={() => navigation.navigate('Pay', { to: o.initials, amount: o.amount })}><Row><Avatar ini={o.initials} size={42} /><View style={{ flex: 1 }}><T v="bodyB">{o.name}</T><T v="tiny">{o.note}</T></View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}><T v="amount" c="ne">{inr(o.amount)}</T><Button small kind="accent" label="Pay" onPress={() => navigation.navigate('Pay', { to: o.initials, amount: o.amount })} style={{ height: 30, paddingHorizontal: 16 }} /></View></Row></Card>
          </Rise>
        ))}
        <Rise delay={320}><Row between style={{ marginTop: 24, marginBottom: 10 }}><T v="h3">Owed to you</T><T v="smallB" c="po">{inr(s.youGetBack)} · {s.owed.length} people</T></Row></Rise>
        <Card style={{ paddingVertical: 2 }}>
          {s.owed.map((o, i) => (
            <Rise key={o.initials} delay={360 + i * 60} kind="slideL">
              <Row style={{ paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
                <Avatar ini={o.initials} size={42} /><View style={{ flex: 1 }}><T v="bodyB">{o.name}</T><T v="tiny">{o.note}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}><T v="amount" c="po">{inr(o.amount)}</T>
                  <Button small kind={nudged[o.initials] ? 'ghost' : 'secondary'} icon={nudged[o.initials] ? 'checks' : 'whatsapp'} label={nudged[o.initials] ? 'Nudged' : 'Remind'} style={{ height: 30, backgroundColor: nudged[o.initials] ? p.pot : p.s2 }} onPress={() => !nudged[o.initials] && remind([o.initials], `Nudge sent to ${o.name.split(' ')[0]} on WhatsApp`)} /></View>
              </Row>
            </Rise>
          ))}
        </Card>
      </>}
    </SpaceScroll>
  );
}

/* ---------- 07 Insights ---------- */
export function InsightsScreen() {
  const p = useColors(); const [month, setMonth] = useState('Sep');
  const { data, error, reload } = useQuery(() => dashboardApi.insights(month), [month]);
  const [wk, setWk] = useState(2);
  const max = Math.max(...(data?.weeks.map(w => w.amount) ?? [1]));
  const MonthSel = (
    <Row gap={2} style={{ backgroundColor: p.s1, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: p.sep }}>
      {['Jul', 'Aug', 'Sep'].map(m => <Press key={m} onPress={() => setMonth(m)} hapticKind="select" scaleTo={0.92} style={{ paddingHorizontal: 12, height: 30, borderRadius: 11, justifyContent: 'center', backgroundColor: month === m ? p.pb : 'transparent' }}><T v="smallB" c={month === m ? p.pf : p.mu}>{m}</T></Press>)}
    </Row>
  );
  return (
    <SpaceScroll>
      <SpaceHead kicker="All books" title="Insights" right={MonthSel} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : <View key={month}>
        <Rise><Card><Row gap={18}>
          <Donut size={140} stroke={14} parts={data.categories.map(c => ({ v: c.pct, color: p[c.color] }))}
            center={<View style={{ alignItems: 'center' }}><T v="tiny">Spent</T><CountUp to={data.total} style={{ fontFamily: fonts.bold, fontSize: 19, color: p.tx, letterSpacing: -0.5 }} /></View>} />
          <View style={{ flex: 1, gap: 9 }}>{data.categories.map((c, i) => <Rise key={c.name} delay={200 + i * 50} kind="slideL"><Row between><Row gap={8}><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p[c.color] }} /><T v="small" c="tx">{c.name}</T></Row><T v="mono" c="mu" style={{ fontSize: 11.5 }}>{c.pct}%</T></Row></Rise>)}</View>
        </Row></Card></Rise>
        <Gap />
        <Rise delay={100}><Card>
          <Row between><T v="bodyB">Week by week</T><T v="smallB" c="po">Avg ₹{(data.avgWeek / 1000).toFixed(1)}k</T></Row>
          <Row gap={12} center={false} style={{ height: 130, alignItems: 'flex-end', marginTop: 16 }}>
            {data.weeks.map((w, i) => (
              <Pressable key={w.label} onPress={() => { haptic('select'); setWk(i); }} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
                {w.forecast ? <View style={{ width: '100%', height: 24, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.ci2 }} />
                  : <Animated.View style={[{ width: '100%', height: Math.max(10, w.amount / max * 100), borderRadius: 12, overflow: 'hidden', transformOrigin: 'bottom' } as any, { animationName: { from: { transform: [{ scaleY: 0 }] }, to: { transform: [{ scaleY: 1 }] } }, animationDuration: '800ms', animationDelay: `${200 + i * 70}ms`, animationTimingFunction: EASE.spring, animationFillMode: 'both' } as any]}>
                    <LinearGradient colors={i === wk ? [p.ac, p.a2] : [p.s2, p.s2]} style={{ flex: 1, borderWidth: i === wk ? 0 : 1, borderColor: p.sep, borderRadius: 12 }} />
                  </Animated.View>}
                <T v="tiny" c={i === wk ? 'tx' : 'mu'} style={{ fontFamily: fonts.mono, fontSize: 10.5 }}>{w.label}</T>
              </Pressable>
            ))}
          </Row>
          <Rise key={wk} duration={260}><T v="tiny" center style={{ marginTop: 10 }}>{data.weeks[wk].forecast ? 'This week so far · forecast ₹9,500' : `${data.weeks[wk].label} · ${inr(data.weeks[wk].amount)}`}</T></Rise>
        </Card></Rise>
        <Rise delay={160}><T v="h3" style={{ marginTop: 24, marginBottom: 10 }}>Worth knowing</T></Rise>
        <View style={{ gap: 10 }}>{data.tips.map((t, i) => (
          <Rise key={t.title} delay={200 + i * 60}><Card><Row center={false} gap={12}><IconTile icon={(['trendDown', 'sparkle', 'calendar'] as IconName[])[i]} size={36} radius={12} color={[p.wa, p.po, p.a2][i]} /><View style={{ flex: 1 }}><T v="bodyB">{t.title}</T><T v="small" style={{ marginTop: 2 }}>{t.body}</T></View></Row></Card></Rise>
        ))}</View>
      </View>}
    </SpaceScroll>
  );
}

/* ---------- 08 Profile / You ---------- */
export function ProfileScreen() {
  const p = useColors(); const app = useApp(); const navigation = useNavigation<any>();
  const me = useQuery(profileApi.get);
  const usage = useQuery(billingApi.usage);
  const sub = useQuery(billingApi.subscription, [], 'subscription');
  const [prefs, setPrefs] = useState({ lock: true, bio: true, alerts: true, daily: false });
  const setPref = (k: keyof typeof prefs) => { const n = { ...prefs, [k]: !prefs[k] }; setPrefs(n); deviceFlags.lock = n.lock; deviceFlags.bio = n.bio; profileApi.updatePrefs(n).catch(() => app.showToast("Couldn't save. Try again")); };
  const u = me.data;
  const Item = ({ icon, t, s, onPress, right, danger }: { icon: IconName; t: string; s?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) => {
    const row = (
      <Row gap={12} style={{ paddingVertical: 13 }}>
        <IconTile icon={icon} size={34} radius={11} color={danger ? p.ne : p.tx} /><View style={{ flex: 1 }}><T v="bodyB" c={danger ? 'ne' : 'tx'}>{t}</T>{s ? <T v="tiny">{s}</T> : null}</View>{right ?? <Icon name="caretRight" size={15} color={p.mu} />}
      </Row>
    );
    return onPress ? <Press onPress={onPress} scaleTo={0.985}>{row}</Press> : row;
  };
  return (
    <SpaceScroll>
      <Rise kind="riseBig">
        <View style={{ borderRadius: 27, padding: 3, borderWidth: 1, borderColor: p.sep }}>
          <LinearGradient colors={p.c1 as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
            <Loop name="sheen" duration={6000} pointerEvents="none" style={{ position: 'absolute', top: -20, bottom: -20, left: 0, width: 90 }}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Loop>
            <Row><Avatar ini="AK" size={54} bg="rgba(0,0,0,.3)" fg={p.ct} ring="rgba(255,255,255,.45)" />
              <View style={{ flex: 1 }}><T v="h2" c={p.ct}>{u?.name ?? 'Arjun Kumar'}</T><T v="mono" c={p.cm}>{u?.phone ?? '+91 98450 12345'}</T></View>
              {sub.data ? <Pill label={sub.data.planName.toUpperCase()} color={p.ai} bg={p.ac} dot={false} /> : null}</Row>
            <Row between style={{ marginTop: 16, backgroundColor: p.glass, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Row gap={8}><Icon name="qr" size={16} color={p.ct} /><T v="mono" c={p.ct}>{u?.upiId ?? 'arjun@okhdfc'}</T></Row>
              <LinkText c={p.ct} label="Copy" onPress={async () => { await Clipboard.setStringAsync(u?.upiId ?? ''); haptic('success'); app.showToast('UPI ID copied'); }} />
            </Row>
          </LinearGradient>
        </View>
      </Rise>
      <Rise delay={80}><Card style={{ marginTop: 12 }} onPress={() => navigation.navigate('Plans')}>
        <Row between><Row gap={8}><Icon name="crown" size={16} color={p.wa} weight="fill" /><T v="bodyB">{sub.data?.planName ?? '…'} plan · manage</T></Row><T v="tiny">{sub.data ? (sub.data.status === 'trial' ? 'Trial ends ' : 'Renews ') + sub.data.renewsOn : ''}</T></Row>
        <Row gap={14} style={{ marginTop: 14 }}>{(usage.data ?? []).map(x => (
          <View key={x.label} style={{ flex: 1 }}><T v="tiny">{x.label.split(' ')[0]}</T><T v="mono" c="tx">{x.used}/{x.limit * 10}</T><View style={{ marginTop: 6 }}><Progress h={3} pct={x.used / (x.limit * 10) * 100} color={x.label === 'Books' ? p.wa : p.ac} /></View></View>
        ))}</Row>
      </Card></Rise>

      <Rise delay={120}><T v="h3" style={{ marginTop: 26, marginBottom: 10 }}>Appearance</T>
        <Row gap={4} style={{ backgroundColor: p.s1, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: p.sep }}>
          {(['dark', 'light'] as const).map(k => <Press key={k} onPress={() => { app.setTheme(k); profileApi.updatePrefs({ ...prefs, darkTheme: k === 'dark' }).catch(() => {}); }} hapticKind="select" scaleTo={0.96} style={[{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: app.theme === k ? p.ac : 'transparent' }, { transitionProperty: 'backgroundColor', transitionDuration: 220 } as any]}>
            <Icon name={k === 'dark' ? 'moon' : 'sun'} size={16} color={app.theme === k ? p.ai : p.tx} /><T v="smallB" c={app.theme === k ? p.ai : p.tx}>{k === 'dark' ? 'Dark' : 'Light'}</T></Press>)}
        </Row>
      </Rise>

      <Rise delay={160}><T v="h3" style={{ marginTop: 26, marginBottom: 8 }}>Security & alerts</T>
        <Card style={{ paddingVertical: 2 }}>
          <Item icon="lock" t="App lock" s="Ask for PIN after 1 minute away" right={<Toggle on={prefs.lock} onPress={() => setPref('lock')} />} /><Divider />
          <Item icon="fingerprint" t="Unlock with fingerprint" right={<Toggle on={prefs.bio} onPress={() => setPref('bio')} />} /><Divider />
          <Item icon="bell" t="Payment alerts" s="When someone adds or settles" right={<Toggle on={prefs.alerts} onPress={() => setPref('alerts')} />} /><Divider />
          <Item icon="sun" t="Daily summary" s="9 PM, one quiet notification" right={<Toggle on={prefs.daily} onPress={() => setPref('daily')} />} /><Divider />
          <Item icon="bell" t="Notifications" s="Channels, quiet hours" onPress={() => navigation.navigate('NotifPrefs')} />
        </Card>
      </Rise>

      <Rise delay={200}><T v="h3" style={{ marginTop: 26, marginBottom: 8 }}>Account</T>
        <Card style={{ paddingVertical: 2 }}>
          <Item icon="userGear" t="Roles & access" s="Who can do what in Site Work" onPress={() => navigation.navigate('Roles')} /><Divider />
          <Item icon="briefcase" t="Admin console" s="Approvals and policies" onPress={() => navigation.navigate('Admin')} /><Divider />
          <Item icon="database" t="Import from Tally / Excel" onPress={() => navigation.navigate('Import')} /><Divider />
          <Item icon="folder" t="Documents" onPress={() => navigation.navigate('Vault')} /><Divider />
          <Item icon="lifebuoy" t="Help & support" onPress={() => navigation.navigate('Help')} /><Divider />
          <Item icon="signOut" t="Sign out" danger onPress={async () => { await authApi.logout(); app.signOut(); navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] }); }} right={<View />} />
        </Card>
      </Rise>

      <Rise delay={240}><T v="h3" style={{ marginTop: 26, marginBottom: 8 }}>Developer</T>
        <Card style={{ paddingVertical: 2 }}>
          <Item icon="cloudWarning" t="Simulate API failures" s="Every placeholder API call fails, to preview error states" right={<Toggle on={app.failMode} onPress={() => app.setFailMode(!app.failMode)} />} /><Divider />
          <Item icon="wifiOff" t="Error screens" s="Offline, server, payment, scan, invite, plan limit" onPress={() => navigation.navigate('Offline')} />
        </Card>
      </Rise>
      <T v="tiny" center style={{ marginTop: 18 }}>Byjan 1.1.0 · mock API mode</T>
    </SpaceScroll>
  );
}
