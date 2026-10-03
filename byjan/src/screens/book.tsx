import React, { useMemo, useState } from 'react';
import { Pressable, View , Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useApp, useColors } from '../state/AppContext';
import { booksApi, entriesApi, Entry, Role } from '../api';
import { usePeople } from '../hooks/usePeople';
import { useMutation, useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { Avatar, Button, Card, Chip, ChipRow, CircleBtn, ErrorBox, Gap, Header, Icon, IconTile, Input, Label, LinkText, Loading, Pill, Row, Screen, Segmented, Sheet, T } from '../components/ui';
import { Donut, Ring } from '../components/brand';
import { BookMorph } from '../components/BookMorph';
import type { IconName } from '../components/icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { CountUp, Loop, markDrag, Press, Replay, Rise } from '../components/motion';
import type { ScreenProps } from '../navigation/types';

const CAT_ICON: Record<string, IconName> = { utensils: 'utensils', bike: 'bike', fuel: 'fuel', cart: 'cart', palm: 'palm' };

/* ---------- 09 Book detail ---------- */
export function BookScreen({ navigation, route }: ScreenProps<'Book'>) {
  const p = useColors(); const { showToast } = useApp();
  const id = route.params?.id ?? 'goa';
  const morph = route.params?.origin;
  const book = useQuery(() => booksApi.get(id), [id], 'book:' + id);
  const ents = useQuery(() => booksApi.entries(id), [id], 'entries:' + id);
  const bal = useQuery(() => booksApi.balances(id), [id], 'bal:' + id);
  const [tab, setTab] = useState('Entries');
  const [invite, setInvite] = useState(!!route.params?.invite);
  const b = book.data;
  const catColor: Record<string, [string, string]> = { Food: [p.wa, p.wat], Travel: [p.a2, p.a2t], Groceries: [p.ac, p.act] };
  const TABS = ['Entries', 'Balances', 'Stats'];
  // Swipe ←/→ on the content to change tab (prototype gesture); short drag or a flick is enough.
  const shift = (d: number) => { const n = TABS.indexOf(tab) + d; if (n >= 0 && n < TABS.length) setTab(TABS[n]); else if (d < 0) navigation.goBack(); };
  const tabSwipe = Gesture.Pan().activeOffsetX([-16, 16]).failOffsetY([-12, 12]).onStart(() => runOnJS(markDrag)())
    .onEnd(e => { if (e.translationX < -40 || e.velocityX < -350) runOnJS(shift)(1); else if (e.translationX > 40 || e.velocityX > 350) runOnJS(shift)(-1); });

  return (
    <BookMorph origin={morph}>
    <Screen enter={!morph}>
      <Header center title={b?.name ?? ''} right={<CircleBtn icon="dots" onPress={() => navigation.navigate('Admin')} />} />
      {book.error ? <ErrorBox message={book.error.message} onRetry={book.reload} /> : !b ? <Loading /> : <>
        <Rise kind={morph ? 'fade' : 'pop'} duration={morph ? 1 : 500}>
        <View style={{ borderRadius: 27, padding: 3, borderWidth: 1, borderColor: p.sep }}>
        <LinearGradient colors={p[b.gradient] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
          <Loop name="sheen" duration={6000} pointerEvents="none" style={{ position: 'absolute', top: -20, bottom: -20, left: 0, width: 90 }}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Loop>
          <Row between center={false}>
            <View><T v="kicker" c={p.cm}>{b.hk}</T><T v="small" c={p.cm} style={{ marginTop: 6 }}>Total spent</T><CountUp to={b.totalSpent} style={{ fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1.6, color: p.ct }} /></View>
            <Ring pct={b.budgetPct} />
          </Row>
          <Row style={{ marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: p.glass, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 12 }}><T v="tiny" c={p.cm} numberOfLines={1}>{b.label}</T><T style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 23, color: p.ct, marginTop: 2, fontVariant: ['tabular-nums'] }}>{b.big}</T></View>
            <View style={{ flex: 1, backgroundColor: p.glass, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 12 }}><T v="tiny" c={p.cm}>{b.l2}</T><CountUp to={b.v2} style={{ fontFamily: fonts.bold, fontSize: 19, color: p.ct, marginTop: 2 }} /></View>
          </Row>
        </LinearGradient>
        </View>
        </Rise>
        <Rise delay={100}><Row style={{ marginTop: 12 }}>
          <Button label="Add" icon="plus" style={{ flex: 1 }} onPress={() => navigation.navigate('AddEntry')} />
          <Button kind="secondary" label="Settle" style={{ flex: 1 }} onPress={() => navigation.navigate('Spaces', { space: 'Settle', at: Date.now() })} />
          <Button kind="secondary" label="Invite" style={{ flex: 1 }} onPress={() => setInvite(true)} />
        </Row></Rise>
        <Rise delay={150}><Segmented options={['Entries', 'Balances', 'Stats']} value={tab} onChange={setTab} style={{ marginTop: 14 }} /></Rise>
        <Gap h={14} />
        <GestureDetector gesture={tabSwipe}>
        <View key={tab}>
        {tab === 'Entries' && <EntriesTab list={ents.data} loading={ents.loading} catColor={catColor} onOpen={e => navigation.navigate('Entry', { id: e.id })} />}
        {tab === 'Balances' && (bal.data ? (
          <Card style={{ paddingVertical: 4 }}>
            {bal.data.map((x, i) => (
              <Rise key={x.initials} delay={i * 50} kind="slideL"><Row style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
                <Avatar ini={x.initials} size={36} />
                <View style={{ flex: 1 }}><T v="bodyB">{x.name}</T><T v="tiny">Paid {inr(x.paid)} · share {inr(x.share)}</T></View>
                <T v="smallB" c={Math.abs(x.net) < 1 ? 'mu' : x.net > 0 ? 'po' : 'ne'}>{Math.abs(x.net) < 1 ? 'Even' : (x.net > 0 ? 'Gets ' : 'Owes ') + inr(Math.abs(x.net))}</T>
              </Row></Rise>
            ))}
            <Button kind="accent" label="Settle up" style={{ marginVertical: 12 }} onPress={() => navigation.navigate('Spaces', { space: 'Settle', at: Date.now() })} />
          </Card>
        ) : <Loading />)}
        {tab === 'Stats' && ents.data && <StatsTab list={ents.data} catColor={catColor} bal={bal.data ?? []} />}
        </View>
        </GestureDetector>
      </>}
      <InviteSheet open={invite} onClose={() => setInvite(false)} bookId={id} bookName={b?.name ?? ''} link={b?.inviteLink ?? ''} onSent={(n, r) => { setInvite(false); showToast(`${n} ${n === 1 ? 'invite' : 'invites'} sent as ${r}`); }} />
    </Screen>
    </BookMorph>
  );
}

function EntriesTab({ list, loading, catColor, onOpen }: { list?: Entry[]; loading: boolean; catColor: Record<string, [string, string]>; onOpen: (e: Entry) => void }) {
  const p = useColors(); const [q, setQ] = useState(''); const [f, setF] = useState('All'); const { short } = usePeople();
  const FIL: Record<string, (e: Entry) => boolean> = { All: () => true, 'You paid': e => e.paidBy === 'AK', 'You owe': e => e.yourNet < 0, Receipts: e => !!e.hasReceipt, Pending: e => !!e.pending };
  const vis = (list ?? []).filter(e => FIL[f](e) && (!q || `${e.title} ${e.category} ${short(e.paidBy)} ${e.amount}`.toLowerCase().includes(q.toLowerCase())));
  const groups = useMemo(() => { const g: { d: string; sub?: string; list: Entry[] }[] = []; vis.forEach(e => { let x = g.find(y => y.d === e.dayLabel); if (!x) g.push(x = { d: e.dayLabel, sub: e.dayLabel === e.daySub ? undefined : e.daySub, list: [] }); x.list.push(e); }); return g; }, [vis]);
  const net = vis.reduce((a, e) => a + e.yourNet, 0);
  if (loading || !list) return <Loading />;
  return (
    <View>
      <Input value={q} onChangeText={t => setQ(t.slice(0, 40))} placeholder="Search entries, people, amounts" left={<Icon name="search" size={16} color={p.mu} />} />
      <Gap h={10} />
      <ChipRow>{Object.keys(FIL).map(n => <Chip key={n} label={n} count={list.filter(FIL[n]).length} on={f === n} onPress={() => setF(n)} />)}</ChipRow>
      <Card style={{ marginTop: 12, flexDirection: 'row', padding: 0 }}>
        <View style={{ flex: 1, padding: 14, borderRightWidth: 1, borderColor: p.sep }}><T v="kicker">{vis.length} {vis.length === 1 ? 'ENTRY' : 'ENTRIES'}</T><Replay trigger={vis.length} name="bump" duration={240}><T v="h3" style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{inr(vis.reduce((a, e) => a + e.amount, 0))}</T></Replay></View>
        <View style={{ flex: 1, padding: 14 }}><T v="kicker">YOUR NET</T><Replay trigger={net.toFixed(0)} name="bump" duration={240}><T v="h3" c={net >= 0 ? 'po' : 'ne'} style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{(net >= 0 ? '+' : '−') + inr(Math.abs(net))}</T></Replay></View>
      </Card>
      {!vis.length ? <Card style={{ marginTop: 12, alignItems: 'center', gap: 6 }}><T v="bodyB">Nothing matches</T><LinkText label="Reset filters" onPress={() => { setQ(''); setF('All'); }} /></Card> : null}
      {groups.map((g, gi) => (
        <Rise key={g.d + f + q} delay={gi * 70} style={{ marginTop: 16 }}>
          <Row between style={{ marginBottom: 8 }}><Row gap={6}><T v="bodyB">{g.d}</T>{g.sub ? <T v="tiny">{g.sub}</T> : null}</Row><T v="mono" c="mu">{inr(g.list.reduce((a, e) => a + e.amount, 0))}</T></Row>
          <Card style={{ paddingVertical: 2 }}>
            {g.list.map((e, i) => (
              <Press key={e.id} onPress={() => onOpen(e)} scaleTo={0.985}>
                <Row center={false} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
                  <View><IconTile icon={CAT_ICON[e.icon] ?? 'receipt'} bg={catColor[e.category]?.[1]} color={catColor[e.category]?.[0]} size={40} /><View style={{ position: 'absolute', bottom: -4, left: -4 }}><Avatar ini={e.paidBy} size={18} ring={p.s1} /></View></View>
                  <View style={{ flex: 1 }}><T v="bodyB" numberOfLines={1}>{e.title}</T><Row gap={4}><T v="tiny">{short(e.paidBy)} paid · {e.splitWith.length} ways · {e.time}</T>{e.hasReceipt ? <Icon name="paperclip" size={12} color={p.mu} /> : null}</Row></View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T v="amount">{inr(e.amount)}</T>
                    <Row gap={4}>{e.pending ? <Pill label="Pending" color={p.wa} bg={p.wat} /> : null}
                      <View style={{ backgroundColor: e.yourNet >= 0 ? p.pot : p.net, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}><T v="tiny" c={e.yourNet >= 0 ? 'po' : 'ne'} style={{ fontFamily: fonts.bold, fontSize: 11 }}>{e.yourNet >= 0 ? 'You get ' + inr(e.yourNet) : 'You owe ' + inr(-e.yourNet)}</T></View></Row>
                  </View>
                </Row>
              </Press>
            ))}
          </Card>
        </Rise>
      ))}
    </View>
  );
}

function StatsTab({ list, catColor, bal }: { list: Entry[]; catColor: Record<string, [string, string]>; bal: { initials: string; name: string; paid: number; net: number }[] }) {
  const p = useColors(); const [sel, setSel] = useState(-1);
  const tot = list.reduce((a, e) => a + e.amount, 0);
  const cats = Object.keys(catColor).map(n => ({ n, v: list.filter(e => e.category === n).reduce((a, e) => a + e.amount, 0) }));
  const S = sel >= 0 ? cats[sel] : null;
  return (
    <View style={{ gap: 12 }}>
      <Card><Row gap={18}>
        <Donut size={130} stroke={13} parts={cats.map((c, k) => ({ v: c.v, color: sel < 0 || sel === k ? catColor[c.n][0] : p.s2 }))}
          center={<View style={{ alignItems: 'center' }}><T v="kicker">{S ? S.n.toUpperCase() : 'TOTAL'}</T><T v="h3">{inr(S ? S.v : tot)}</T><T v="tiny">{S ? Math.round(S.v / tot * 100) + '% of trip' : list.length + ' entries'}</T></View>} />
        <View style={{ flex: 1, gap: 6 }}>{cats.map((c, k) => (
          <Pressable key={c.n} onPress={() => setSel(sel === k ? -1 : k)} style={{ padding: 6, borderRadius: 8, backgroundColor: sel === k ? p.s2 : 'transparent', opacity: sel < 0 || sel === k ? 1 : 0.45 }}>
            <Row between><Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: catColor[c.n][0] }} /><T v="small" c="tx">{c.n}</T></Row><T v="tiny">{Math.round(c.v / tot * 100)}%</T></Row>
          </Pressable>
        ))}</View>
      </Row></Card>
      <Row>{[['AVG / DAY', inr(tot / 3), 'over 3 days'], ['BIGGEST', '₹4,800', 'Dinner at Toit'], ['BUDGET LEFT', '₹28,500', '71% remaining']].map(([k, v, s]) => (
        <Card key={k} style={{ flex: 1, padding: 12 }}><T v="kicker" style={{ fontSize: 9 }}>{k}</T><T v="title" style={{ marginTop: 4 }}>{v}</T><T v="tiny" numberOfLines={1}>{s}</T></Card>
      ))}</Row>
      <Card>
        <T v="bodyB" style={{ marginBottom: 6 }}>Who paid what</T>
        {bal.map(x => (
          <View key={x.initials} style={{ paddingVertical: 8 }}>
            <Row between><Row gap={8}><Avatar ini={x.initials} size={24} /><T v="small" c="tx">{x.name}</T></Row><T v="tiny" c={Math.abs(x.net) < 1 ? 'mu' : x.net > 0 ? 'po' : 'ne'}>{Math.abs(x.net) < 1 ? 'Even' : (x.net > 0 ? 'Gets ' : 'Owes ') + inr(Math.abs(x.net))}</T></Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: p.s2, marginTop: 6 }}><View style={{ width: `${x.paid / tot * 100}%`, height: 6, borderRadius: 3, backgroundColor: p.a2 }} /></View>
          </View>
        ))}
      </Card>
    </View>
  );
}

export function InviteSheet({ open, onClose, bookId, bookName, link, onSent }: { open: boolean; onClose: () => void; bookId: string; bookName: string; link: string; onSent: (n: number, role: Role) => void }) {
  const p = useColors(); const { showToast } = useApp();
  const [v, setV] = useState(''); const [list, setList] = useState<string[]>([]); const [err, setErr] = useState(''); const [role, setRole] = useState<Role>('Contributor'); const [copied, setCopied] = useState(false);
  const [send, busy] = useMutation(booksApi.invite);
  const RH: Record<string, string> = { Admin: 'Add, edit and approve entries, and invite others', Contributor: "Add entries and split bills. Can't delete others' entries", Viewer: 'See entries and balances only' };
  const add = () => {
    const x = v.trim(); const em = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x); const ph = /^\d{10}$/.test(x.replace(/\D/g, '')) && !/[a-z@]/i.test(x);
    if (!x) return setErr('Type an email or a mobile number'); if (!em && !ph) return setErr("That doesn't look like an email or a 10-digit number");
    if (list.includes(x)) return setErr('Already added'); setList([...list, x]); setV(''); setErr('');
  };
  return (
    <Sheet open={open} onClose={onClose} title={'Invite to ' + bookName} sub="They'll see entries and balances in this book only.">
      <Gap h={10} />
      <Row center={false}>
        <View style={{ flex: 1 }}><Input value={v} onChangeText={t => { setV(t); setErr(''); }} placeholder="Email or 10-digit mobile" autoCapitalize="none" error={err} hint={list.length ? list.length + ' ready to invite' : undefined} hintColor={p.po} style={{ backgroundColor: p.s2 }} /></View>
        <Button small label="Add" onPress={add} style={{ height: 52, borderRadius: 14 }} />
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>{list.map(x => <Chip key={x} label={x + '  ×'} onPress={() => setList(list.filter(y => y !== x))} />)}</Row>
      <Label>They can</Label>
      <Segmented options={['Admin', 'Contributor', 'Viewer']} value={role} onChange={r => setRole(r as Role)} style={{ backgroundColor: p.s2 }} />
      <T v="tiny" style={{ marginTop: 8 }}>{RH[role]}</T>
      <Row between style={{ backgroundColor: p.s2, borderRadius: 14, paddingHorizontal: 16, height: 50, marginTop: 14 }}>
        <T v="mono">{link}</T><LinkText label={copied ? 'Copied' : 'Copy'} onPress={async () => { await Clipboard.setStringAsync('https://' + link); setCopied(true); showToast('Invite link copied'); }} />
      </Row>
      <Gap h={16} />
      <Button label={list.length ? `Send ${list.length} ${list.length === 1 ? 'invite' : 'invites'}` : 'Send invites'} disabled={!list.length} busy={busy} onPress={async () => { await send(bookId, list, role); onSent(list.length, role); setList([]); }} />
    </Sheet>
  );
}

/* ---------- F2 Entry detail ---------- */
export function EntryScreen({ navigation, route }: ScreenProps<'Entry'>) {
  const p = useColors(); const { showToast } = useApp();
  const id = route.params?.id ?? 'e1';
  const { data: e, error, reload } = useQuery(() => entriesApi.get(id), [id], 'entry:' + id);
  const { short, name } = usePeople();
  const books = useQuery(booksApi.list, [], 'books');
  const bookName = books.data?.find(x => x.id === e?.bookId)?.name ?? 'this book';
  const shareEntry = async () => {
    try { const c = await entriesApi.shareCard(id); await Share.share({ message: `${c.text}\n${c.url}`, url: c.url }); }
    catch { showToast("Couldn't prepare the share card. Try again"); }
  };
  const [note, setNote] = useState(''); const [del, setDel] = useState(false);
  const [save, saving] = useMutation(entriesApi.addNote);
  const [remove, removing] = useMutation(entriesApi.remove);
  if (error) return <Screen><Header title="Entry" /><ErrorBox message={error.message} onRetry={reload} /></Screen>;
  if (!e) return <Screen><Header title="Entry" /><Loading /></Screen>;
  const each = e.amount / e.splitWith.length;
  return (
    <Screen footer={<Row><Button kind="secondary" label="Delete" style={{ flex: 1 }} onPress={() => setDel(true)} /><Button label="Edit entry" style={{ flex: 2 }} onPress={() => navigation.navigate('AddEntry', { amount: String(e.amount), editId: e.id })} /></Row>}>
      <Header title="Entry" right={<CircleBtn icon="share" onPress={shareEntry} />} />
      <View style={{ alignItems: 'center' }}>
        <IconTile icon={CAT_ICON[e.icon] ?? 'receipt'} size={56} radius={18} bg={p.wat} color={p.wa} />
        <T v="h2" style={{ marginTop: 12 }}>{e.title}</T>
        <T v="small">{bookName} · {e.dayLabel}, {e.time} · {e.category}</T>
        <T c="tx" style={{ fontFamily: fonts.bold, fontSize: 44, letterSpacing: -1.5, marginTop: 8 }}>{inr(e.amount)}</T>
        <View style={{ backgroundColor: p.s1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}><T v="tiny" c="tx">{short(e.paidBy)} paid · split {e.splitWith.length} ways{e.hasReceipt ? ' · receipt attached' : ''}</T></View>
      </View>
      <Card style={{ marginTop: 18 }}>
        <Row between><View><T v="bodyB">{e.yourNet < 0 ? `You owe ${short(e.paidBy)} ${inr(-e.yourNet)}` : `You get back ${inr(e.yourNet)}`}</T><T v="tiny">Your share of this entry</T></View>
          {e.yourNet < 0 ? <Button small label="Settle" onPress={() => navigation.navigate('Pay', { to: e.paidBy, amount: -e.yourNet })} /> : null}</Row>
      </Card>
      <T v="bodyB" style={{ marginTop: 20, marginBottom: 8 }}>Split equally · {inr(each)} each</T>
      <Card style={{ paddingVertical: 2 }}>
        {e.splitWith.map((x, i) => (
          <Row key={x} style={{ paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
            <Avatar ini={x} size={30} /><T v="small" c="tx" style={{ flex: 1 }}>{x === 'AK' ? 'You' : name(x)}</T>
            {x === e.paidBy ? <Pill label={'PAID ' + inr(e.amount)} color={p.tx} bg={p.s2} dot={false} /> : null}
            <T v="mono" c="mu">{inr(each)}</T>
          </Row>
        ))}
      </Card>
      <T v="bodyB" style={{ marginTop: 20, marginBottom: 8 }}>Note</T>
      <Row center={false}>
        <View style={{ flex: 1 }}><Input value={note} onChangeText={t => setNote(t.slice(0, 140))} placeholder="Add a note for everyone in this book" /></View>
        <Button small kind={note.trim() ? 'accent' : 'secondary'} label="Save" busy={saving} style={{ height: 52, borderRadius: 14 }} onPress={async () => { if (!note.trim()) return showToast('Write something first'); await save(e.id, note); setNote(''); showToast(`Note added. Everyone in ${bookName} can see it`); }} />
      </Row>
      <Sheet open={del} onClose={() => setDel(false)} title={`Delete ${e.title}?`} sub={`Everyone's balances in ${bookName} will update. You can undo for a few seconds.`}>
        <Gap h={16} />
        <Button kind="danger" label={'Delete ' + inr(e.amount)} busy={removing} onPress={async () => {
          await remove(e.id); setDel(false); navigation.goBack();
          showToast(`Deleted ${e.title} · ${inr(e.amount)}`, () => { entriesApi.restore(e.id); });
        }} />
        <Gap h={8} />
        <Button kind="secondary" label="Keep it" onPress={() => setDel(false)} />
      </Sheet>
    </Screen>
  );
}
