import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useColors } from '../state/AppContext';
import {
  accountsApi, authApi, billsApi, captureApi, dashboardApi, notificationsApi, paymentsApi, recurringApi, reviewApi, templatesApi, vaultApi,
  ApiError, NotifPrefs, SearchResult,
} from '../api';
import { useMutation, useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { Avatar, Button, Card, Chip, ChipRow, CircleBtn, Divider, ErrorBox, Gap, Header, Icon, IconTile, Input, Label, LinkText, Loading, Mono, Row, Screen, Segmented, Sheet, T, Toggle } from '../components/ui';
import type { IconName } from '../components/icons';
import type { ScreenProps } from '../navigation/types';
import { openUpiAndWait, pickDocument, pickImage } from '../native/device';

const ICON: Record<string, IconName> = { money: 'money', bank: 'bank', card: 'card', lightning: 'lightning', house: 'house', tv: 'tv', car: 'car', handCoins: 'handCoins', shieldWarning: 'shieldWarning', calendarCheck: 'calendarCheck', sealCheck: 'sealCheck', chat: 'chat', receipt: 'receipt', file: 'file', shield: 'shield', user: 'user', milk: 'milk', fuel: 'fuel', coins: 'coins', hand: 'hand', bike: 'bike', utensils: 'utensils', bag: 'bag', books: 'books' };

/* ---------- T3 Accounts & transfer ---------- */
export function AccountsScreen({ navigation, route }: ScreenProps<'Accounts'>) {
  const p = useColors(); const { showToast } = useApp();
  const { data, error, reload } = useQuery(accountsApi.list);
  const [sheet, setSheet] = useState(!!route.params?.transfer);
  const [from, setFrom] = useState('hdfc'); const [to, setTo] = useState('cash'); const [amt, setAmt] = useState(''); const [err, setErr] = useState('');
  const [transfer, busy] = useMutation(accountsApi.transfer);
  const [stmtId, setStmtId] = useState<string | null>(null);
  const stmt = useQuery(() => (stmtId ? accountsApi.statement(stmtId) : Promise.resolve([])), [stmtId], 'stmt:' + stmtId);
  const net = (data ?? []).reduce((a, x) => a + x.balance, 0);
  const A = (id: string) => data?.find(x => x.id === id);
  const n = parseInt(amt || '0', 10);
  const go = async () => {
    if (from === to) return setErr('Pick two different accounts'); if (!n) return setErr('Enter an amount to move');
    if (n > (A(from)?.balance ?? 0)) return setErr(`Only ${inr(A(from)!.balance)} available in ${A(from)!.name}`);
    await transfer(from, to, n); setSheet(false); setAmt(''); reload(); showToast(`Moved ${inr(n)} to ${A(to)?.name}`);
  };
  return (
    <Screen>
      <Header title="Accounts" right={<CircleBtn icon="refresh" onPress={reload} />} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : <>
        <T v="small">Net worth across {data.length} accounts</T>
        <T v="big" style={{ fontSize: 44 }}>{inr(net)}</T>
        <Row gap={3} style={{ marginTop: 8 }}>{data.map((x, i) => <View key={x.id} style={{ flex: Math.abs(x.balance), height: 6, borderRadius: 3, backgroundColor: [p.wa, p.a2, p.wa, p.ne][i] }} />)}</Row>
        <Row style={{ marginTop: 16 }}><Button label="Transfer" style={{ flex: 1 }} onPress={() => setSheet(true)} /><Button kind="secondary" label="Add cash" style={{ flex: 1 }} onPress={async () => { await accountsApi.addCash(500); reload(); showToast('Added ₹500 to Cash in hand'); }} /></Row>
        <Card style={{ marginTop: 14, paddingVertical: 2 }}>
          {data.map((x, i) => (
            <Pressable key={x.id} onPress={() => setStmtId(x.id)}>
              <Row style={{ paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
                <IconTile icon={ICON[x.icon]} size={40} />
                <View style={{ flex: 1 }}><T v="bodyB">{x.name}</T><T v="tiny">{x.sub}</T></View>
                <View style={{ alignItems: 'flex-end' }}><T v="bodyB" c={x.balance < 0 ? 'ne' : 'tx'}>{(x.balance < 0 ? '−' : '') + inr(Math.abs(x.balance))}</T><T v="tiny">{x.note}</T></View>
              </Row>
            </Pressable>
          ))}
        </Card>
        <T v="tiny" style={{ marginTop: 12 }}>Bank balances update from your SMS. Byjan never asks for netbanking passwords.</T>
      </>}
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Move money">
        <Label>From</Label><Row gap={8}>{['cash', 'hdfc', 'icici'].map(k => <Chip key={k} label={A(k)?.name.split(' ')[0] ?? k} on={from === k} onPress={() => { setFrom(k); setErr(''); }} />)}</Row>
        <Label>To</Label><Row gap={8}>{['cash', 'hdfc', 'icici'].map(k => <Chip key={k} label={A(k)?.name.split(' ')[0] ?? k} on={to === k} onPress={() => { setTo(k); setErr(''); }} />)}</Row>
        <Label>Amount</Label>
        <Input value={amt} onChangeText={t => { setAmt(t.replace(/\D/g, '').slice(0, 8)); setErr(''); }} keyboardType="number-pad" left={<T c="mu">₹</T>} style={{ backgroundColor: p.s2 }} error={err}
          hint={n ? `${A(from)?.name} → ${A(to)?.name}` : `Available in ${A(from)?.name}: ${inr(A(from)?.balance ?? 0)}`} />
        <Gap h={16} /><Button label="Move money" busy={busy} onPress={go} />
      </Sheet>
      <Sheet open={!!stmtId} onClose={() => setStmtId(null)} title={A(stmtId ?? '')?.name ?? 'Statement'} sub={A(stmtId ?? '')?.sub}>
        {stmt.loading && !stmt.data?.length ? <Loading h={120} /> : !stmt.data?.length ? <T v="small" style={{ marginTop: 12 }}>No transactions yet.</T> : (
          <View style={{ marginTop: 8 }}>{stmt.data.map((t, k) => (
            <Row key={t.id} between style={{ paddingVertical: 12, borderTopWidth: k ? 1 : 0, borderColor: p.sep }}>
              <View><T v="bodyB">{t.title}</T><T v="tiny">{t.when}</T></View>
              <T v="amount" c={t.amount < 0 ? 'tx' : 'po'}>{(t.amount < 0 ? '−' : '+') + inr(Math.abs(t.amount))}</T>
            </Row>
          ))}</View>
        )}
      </Sheet>
    </Screen>
  );
}

/* ---------- T4 Bills & dues ---------- */
export function BillsScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const { data, setData, error, reload } = useQuery(billsApi.list, [], 'bills');
  const [sel, setSel] = useState(1);
  const unpaid = (data ?? []).filter(d => !d.paid).reduce((a, d) => a + d.amount, 0);
  const setPaid = (id: string, v: boolean) => setData(d => d?.map(x => (x.id === id ? { ...x, paid: v } : x)));
  const WD = ['W', 'T', 'F', 'S', 'S', 'M', 'T'];
  // Calendar dots come from each bill's due day: red if overdue, amber if unpaid, mint once paid.
  const dots: Record<number, string> = {};
  (data ?? []).forEach(d => { if (d.dueDay) dots[d.dueDay] = d.paid ? p.ac : d.overdue ? p.ne : (dots[d.dueDay] === p.ne ? p.ne : p.wa); });
  const [addOpen, setAddOpen] = useState(false); const [bn, setBn] = useState(''); const [ba, setBa] = useState(''); const [bd, setBd] = useState(''); const [berr, setBerr] = useState('');
  const [create, creating] = useMutation(billsApi.create);
  const addBill = async () => {
    const amount = parseInt(ba || '0', 10); const day = parseInt(bd || '0', 10);
    if (!bn.trim()) return setBerr('Name the bill'); if (!amount) return setBerr('Add the amount'); if (day < 1 || day > 31) return setBerr('Due day is 1 to 31');
    const d = await create({ title: bn.trim(), amount, dueDay: day }); setData(x => [...(x ?? []), d]); setAddOpen(false); setBn(''); setBa(''); setBd(''); showToast('Added ' + d.title);
  };
  const [paying, setPaying] = useState<string | null>(null);
  const payBill = async (id: string, amount: number, title: string) => {
    setPaying(id);
    try {
      const i = await billsApi.pay(id, amount);
      const r = await openUpiAndWait(i.intentUrl, i.paymentId, { amount, app: 'UPI', to: 'biller@bbps' }, () => showToast('Waiting for UPI…'));
      setPaid(id, true); navigation.navigate('Success', { amount, app: 'UPI', to: 'biller@bbps', utr: r.utr, time: r.time, paymentId: i.paymentId, name: title });
    } catch (e) { navigation.navigate('PayFail', { amount, reason: (e as ApiError).message, code: (e as ApiError).code }); }
    finally { setPaying(null); }
  };
  return (
    <Screen>
      <Header title="Bills & dues" right={<CircleBtn icon="plus" onPress={() => { setBerr(''); setAddOpen(true); }} />} />
      <Card>
        <Row between><T v="bodyB">October</T><T v="small">{inr(unpaid)} due</T></Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 6 }}>
          {Array.from({ length: 14 }, (_, i) => i + 1).map(d => (
            <Pressable key={d} onPress={() => setSel(d)} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: sel === d ? p.pb : 'transparent' }}>
              <T v="tiny" c={sel === d ? p.pf : 'mu'} style={{ fontSize: 9 }}>{WD[(d - 1) % 7]}</T>
              <T v="bodyB" c={sel === d ? p.pf : 'tx'}>{d}</T>
              <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: dots[d] ?? 'transparent' }} />
            </Pressable>
          ))}
        </View>
      </Card>
      <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Coming up</T>
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : (
        <View style={{ gap: 10 }}>{data.map(d => (
          <Card key={d.id} edge={d.overdue && !d.paid ? p.ne : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: d.paid ? 0.55 : 1 }}>
            <IconTile icon={ICON[d.icon]} size={40} />
            <View style={{ flex: 1 }}><T v="bodyB">{d.title}</T><T v="tiny" c={d.paid ? 'po' : d.overdue ? 'ne' : 'mu'}>{d.paid ? 'Paid · thanks!' : d.when}</T></View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <T v="bodyB">{inr(d.amount)}</T>
              <Pressable onPress={async () => {
                if (d.paid) return;
                if (d.overdue) { if (!paying) payBill(d.id, d.amount, d.title); return; }
                setPaid(d.id, true); await billsApi.markPaid(d.id);
                showToast(`${d.title} marked paid · ${inr(d.amount)}`, () => { setPaid(d.id, false); billsApi.unmarkPaid(d.id); });
              }} style={{ backgroundColor: d.paid ? p.pot : d.overdue ? p.pb : p.s2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T v="tiny" c={d.paid ? p.po : d.overdue ? p.pf : p.tx} style={{ fontFamily: fonts.bold }}>{d.paid ? '✓ Paid' : d.overdue ? (paying === d.id ? 'Paying…' : 'Pay now') : 'Mark paid'}</T>
              </Pressable>
            </View>
          </Card>
        ))}</View>
      )}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a bill" sub="We'll remind you 2 days before it's due.">
        <Gap h={10} />
        <Input value={bn} onChangeText={t => { setBn(t.slice(0, 40)); setBerr(''); }} placeholder="e.g. Broadband" style={{ backgroundColor: p.s2 }} />
        <Gap h={10} />
        <Row center={false}>
          <View style={{ flex: 1 }}><Input value={ba} onChangeText={t => { setBa(t.replace(/\D/g, '').slice(0, 7)); setBerr(''); }} keyboardType="number-pad" placeholder="Amount" left={<T c="mu">₹</T>} style={{ backgroundColor: p.s2 }} /></View>
          <View style={{ width: 120 }}><Input value={bd} onChangeText={t => { setBd(t.replace(/\D/g, '').slice(0, 2)); setBerr(''); }} keyboardType="number-pad" placeholder="Due day" style={{ backgroundColor: p.s2 }} /></View>
        </Row>
        {berr ? <T v="tiny" c="ne" style={{ marginTop: 8 }}>{berr}</T> : null}
        <Gap h={14} />
        <Button label="Add bill" busy={creating} onPress={addBill} />
      </Sheet>
    </Screen>
  );
}

/* ---------- T5 Activity ---------- */
export function ActivityScreen() {
  const p = useColors();
  const { data, error, reload } = useQuery(dashboardApi.activity);
  const [mine, setMine] = useState(false);
  const list = (data ?? []).filter(a => !mine || a.mine);
  const days = [...new Set(list.map(a => a.day))];
  return (
    <Screen>
      <Header title="Activity" />
      <Segmented options={['Everyone', 'Just me']} value={mine ? 'Just me' : 'Everyone'} onChange={v => setMine(v === 'Just me')} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : days.map(d => (
        <View key={d} style={{ marginTop: 18 }}>
          <T v="smallB" c="mu" style={{ marginBottom: 8 }}>{d}</T>
          {list.filter(a => a.day === d).map(a => (
            <Row key={a.id} gap={10} style={{ paddingVertical: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p[a.dot] }} />
              <Avatar ini={a.who} size={34} />
              <View style={{ flex: 1 }}><T v="small" c="tx"><T v="smallB">{a.name}</T> {a.text}</T><T v="tiny">{a.sub}</T></View>
            </Row>
          ))}
        </View>
      ))}
    </Screen>
  );
}

/* ---------- F6 Notifications ---------- */
export function InboxScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const { data, error, reload } = useQuery(notificationsApi.list);
  const [f, setF] = useState('All'); const [done, setDone] = useState<Record<string, boolean>>({}); const [read, setRead] = useState(false);
  const left = (data ?? []).filter(n => !done[n.id]);
  const vis = left.filter(n => f === 'All' || n.kind === f);
  const finish = async (id: string, msg: string) => { setDone(d => ({ ...d, [id]: true })); await notificationsApi.dismiss(id); showToast(msg); };
  const act = async (id: string, yes: boolean) => {
    if (id === 'req') { if (yes) return navigation.navigate('Pay', { to: 'KS', amount: 1250 }); await paymentsApi.declineRequest(id); return finish(id, 'Declined. Kabir will be told politely'); }
    if (id === 'sec') { if (yes) { await authApi.revokeOtherSessions(); return finish(id, 'Signed out other devices. Change your PIN next'); } return finish(id, 'Thanks. Marked as you'); }
    if (id === 'bill') { if (yes) { await billsApi.markPaid('bescom'); return finish(id, 'Marked BESCOM as paid'); } await billsApi.snooze('bescom'); return finish(id, 'Snoozed until tomorrow'); }
  };
  return (
    <Screen>
      <Header title="Notifications" right={<LinkText label="Mark all read" onPress={async () => { await notificationsApi.markAllRead(); setRead(true); showToast('All marked as read'); }} />} />
      <ChipRow>{['All', 'Requests', 'Reminders', 'Security'].map(n => <Chip key={n} label={n} on={f === n} count={n !== 'All' && !read ? left.filter(x => x.kind === n).length || undefined : undefined} onPress={() => setF(n)} />)}</ChipRow>
      <Gap h={14} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : !vis.length ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}><Icon name="checks" size={32} color={p.ac} /><T v="bodyB">You're all caught up</T></Card>
      ) : <View style={{ gap: 10 }}>{vis.map((n, i) => (
        <Card key={n.id}>
          <Row center={false} gap={12}>
            {!read && i < 3 ? <View style={{ position: 'absolute', left: -8, top: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: p.ac }} /> : null}
            <IconTile icon={ICON[n.icon]} size={38} />
            <View style={{ flex: 1 }}><Row between><T v="bodyB" style={{ flex: 1 }}>{n.title}</T><T v="tiny">{n.when}</T></Row><T v="small">{n.sub}</T></View>
          </Row>
          {n.actions ? <Row style={{ marginTop: 12 }}>
            <Button small kind="secondary" label={n.actions[0]} style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => act(n.id, false)} />
            <Button small kind={n.id === 'sec' ? 'danger' : 'accent'} label={n.actions[1]} style={{ flex: 1 }} onPress={() => act(n.id, true)} />
          </Row> : null}
        </Card>
      ))}</View>}
    </Screen>
  );
}

/* ---------- F3 Search ---------- */
export function SearchScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp(); const recent = useQuery(dashboardApi.recentSearches, [], 'recentSearches');
  const [q, setQ] = useState(''); const [f, setF] = useState('All'); const [res, setRes] = useState<SearchResult[]>([]);
  useEffect(() => { let live = true; dashboardApi.search(q, f).then(r => live && setRes(r)).catch(() => {}); return () => { live = false; }; }, [q, f]);
  return (
    <Screen>
      <Row gap={10}>
        <CircleBtn icon="back" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}><Input autoFocus value={q} onChangeText={setQ} placeholder="Search entries, books, people…" style={{ borderColor: p.ac }} left={<Icon name="search" size={16} color={p.mu} />} /></View>
      </Row>
      <Gap h={12} />
      <ChipRow>{['All', 'Entries', 'Books', 'People'].map(n => <Chip key={n} label={n} on={f === n} onPress={() => setF(n)} />)}</ChipRow>
      {!q ? <>
        <T v="h3" style={{ marginTop: 20 }}>Recent</T>
        {(recent.data ?? []).map(n => <Pressable key={n} onPress={() => setQ(n)}><Row style={{ paddingVertical: 10 }}><Icon name="clock" size={16} color={p.mu} /><T v="small" c="tx">{n}</T></Row></Pressable>)}
        <T v="h3" style={{ marginTop: 16, marginBottom: 8 }}>Or ask in plain words</T>
        <View style={{ gap: 8 }}>{['What did I spend on food in September?', 'Who owes me the most?', 'Biggest bill this month'].map(n => (
          <Card key={n} onPress={async () => { const r = await dashboardApi.ask(n); showToast(r.answer); }} style={{ paddingVertical: 12 }}><Row><Icon name="sparkle" size={16} color={p.ac} /><T v="small" c="tx">{n}</T></Row></Card>
        ))}</View>
      </> : res.length ? <>
        <T v="kicker" style={{ marginTop: 18, marginBottom: 6 }}>{res.length} {res.length === 1 ? 'RESULT' : 'RESULTS'}</T>
        <Card style={{ paddingVertical: 2 }}>{res.map((r, i) => (
          <Pressable key={r.id} onPress={() => (navigation as any).navigate(r.target.screen, r.target.params)}>
            <Row style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
              {r.initials ? <Avatar ini={r.initials} size={38} /> : <IconTile icon={ICON[r.icon ?? 'books']} size={38} />}
              <View style={{ flex: 1 }}><T v="bodyB">{r.title}</T><T v="tiny">{r.sub}</T></View>
              {r.amount ? <T v="bodyB">{r.amount}</T> : null}
            </Row>
          </Pressable>
        ))}</Card>
      </> : <Card style={{ marginTop: 20, alignItems: 'center', gap: 6 }}><Icon name="search" size={28} color={p.mu} /><T v="bodyB">Nothing for “{q}”</T><T v="small">Try an amount like 4800, or a person's name.</T></Card>}
    </Screen>
  );
}

/* ---------- F5 Needs a look ---------- */
export function AttentionScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const { data, error, reload } = useQuery(reviewApi.attention);
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const resolve = async (k: 'duplicate' | 'highAmount' | 'category', action: string, msg: string) => {
    setGone(g => ({ ...g, [k]: true })); await reviewApi.resolve(k, action); showToast(msg, () => setGone(g => ({ ...g, [k]: false })));
  };
  const all = data && ['duplicate', 'highAmount', 'category'].every(k => gone[k] || !(data as any)[k]);
  return (
    <Screen>
      <Header title="Needs a look" />
      <T v="small" style={{ marginTop: -6, marginBottom: 14 }}>Byjan checks every entry. Clearing these keeps everyone's balances right.</T>
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : all ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}><Icon name="sealCheck" size={36} color={p.ac} /><T v="bodyB">All clear</T><T v="small">Nothing needs a look right now.</T></Card>
      ) : <View style={{ gap: 12 }}>
        {data.duplicate && !gone.duplicate ? <Card>
          <Row center={false} gap={12}><IconTile icon="copy" size={38} color={p.wa} /><View style={{ flex: 1 }}><T v="bodyB">Possible duplicate</T><T v="small">{data.duplicate.text}</T></View></Row>
          <Row style={{ marginTop: 12 }}><Button small kind="secondary" label="Keep both" style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => resolve('duplicate', 'keep', 'Kept both Swiggy entries')} /><Button small label="Merge into one" style={{ flex: 1 }} onPress={() => resolve('duplicate', 'merge', 'Merged into one ₹1,240 entry')} /></Row>
        </Card> : null}
        {data.highAmount && !gone.highAmount ? <Card>
          <Row center={false} gap={12}><IconTile icon="warning" size={38} color={p.ne} /><View style={{ flex: 1 }}><T v="bodyB">Unusually high bill</T><T v="small">{data.highAmount.text}</T></View></Row>
          <Row gap={4} center={false} style={{ marginTop: 12, height: 26, alignItems: 'flex-end' }}>{[40, 45, 38, 42, 44, 100].map((h, i) => <View key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 3, backgroundColor: i === 5 ? p.ne : p.s2 }} />)}</Row>
          <Row style={{ marginTop: 12 }}><Button small kind="secondary" label="It's correct" style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => resolve('highAmount', 'confirm', 'Marked BESCOM ₹4,860 as correct')} /><Button small label="Fix amount" style={{ flex: 1 }} onPress={() => navigation.navigate('AddEntry', { amount: '4860', editId: 'e_bescom', bookId: 'home' })} /></Row>
        </Card> : null}
        {data.category && !gone.category ? <Card>
          <Row center={false} gap={12}><IconTile icon="bag" size={38} /><View style={{ flex: 1 }}><T v="bodyB">Needs a category</T><T v="small">{data.category.text}</T></View></Row>
          <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>{data.category.options.map(o => <Chip key={o} label={o} onPress={() => resolve('category', o, `Saved. Amazon goes to ${o} from now on`)} />)}</Row>
        </Card> : null}
      </View>}
    </Screen>
  );
}

/* ---------- M4 Documents vault ---------- */
export function VaultScreen() {
  const p = useColors(); const { showToast } = useApp();
  const { data, error, reload } = useQuery(vaultApi.list);
  const [f, setF] = useState('All'); const [q, setQ] = useState('');
  const [up, busy] = useMutation(vaultApi.upload);
  const vis = (data ?? []).filter(d => (f === 'All' || d.folder === f) && (!q || (d.name + d.sub).toLowerCase().includes(q.toLowerCase())));
  return (
    <Screen>
      <Header title="Documents" right={<Button small label={busy ? 'Uploading…' : 'Upload'} busy={busy} onPress={async () => {
        try {
          const file = await pickDocument(['application/pdf', 'image/*']) || await pickImage('library') || { uri: 'file://warranty.pdf', name: 'warranty.pdf', type: 'application/pdf' };
          await up(file); reload(); showToast('Saved to Warranties · reminder set 30 days before expiry');
        }
        catch { showToast("Couldn't upload: files must be under 10 MB"); }
      }} />} />
      <Input value={q} onChangeText={setQ} placeholder="Search receipts, warranties, IDs" left={<Icon name="search" size={16} color={p.mu} />} />
      <Gap h={10} />
      <ChipRow>{['All', 'Receipts', 'Bills', 'Warranties', 'IDs', 'Tax'].map(n => <Chip key={n} label={n} on={f === n} onPress={() => setF(n)} />)}</ChipRow>
      <Gap h={14} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : !vis.length ? <Card style={{ alignItems: 'center' }}><T v="bodyB">No documents here yet</T></Card> : (
        <Card style={{ paddingVertical: 2 }}>{vis.map((d, i) => (
          <Pressable key={d.id} onPress={async () => { await vaultApi.url(d.id); showToast('Opening ' + d.name); }}>
            <Row style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
              <View><IconTile icon={ICON[d.icon]} size={40} /><T v="kicker" style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 7 }}>{d.ext}</T></View>
              <View style={{ flex: 1 }}><T v="bodyB">{d.name}</T><T v="tiny">{d.sub}</T>{d.expiry ? <T v="tiny" c={/Due|29 days/.test(d.expiry) ? 'wa' : 'mu'} style={{ fontFamily: fonts.bold }}>{d.expiry}</T> : null}</View>
            </Row>
          </Pressable>
        ))}</Card>
      )}
    </Screen>
  );
}

/* ---------- M5 Bank SMS review ---------- */
export function SmsReviewScreen() {
  const p = useColors(); const { showToast } = useApp();
  const { data, error, reload } = useQuery(captureApi.smsQueue);
  const [f, setF] = useState('All'); const [done, setDone] = useState<Record<string, boolean>>({});
  const left = (data ?? []).filter(m => !done[m.id]);
  const vis = left.filter(m => f === 'All' || (f === 'Spent' && m.debit) || (f === 'Received' && !m.debit) || (f === 'Duplicates' && m.duplicate));
  const act = async (id: string, a: 'add' | 'ignore', msg: string) => { setDone(d => ({ ...d, [id]: true })); await captureApi.smsAction(id, a); showToast(msg, () => setDone(d => ({ ...d, [id]: false }))); };
  return (
    <Screen>
      <Header title="From your bank SMS" right={<Button small label={left.length ? `Add all ${left.length}` : 'Done'} disabled={!left.length} onPress={async () => { const r = await captureApi.smsAddAll(left.map(m => m.id)); setDone(Object.fromEntries((data ?? []).map(m => [m.id, true]))); showToast(`Added ${r.added} entries from SMS`); }} />} />
      <T v="tiny" style={{ marginTop: -8, marginBottom: 12 }}>Read on this phone only. Raw messages never leave it.</T>
      <ChipRow>{['All', 'Spent', 'Received', 'Duplicates'].map(n => <Chip key={n} label={n} on={f === n} onPress={() => setF(n)} />)}</ChipRow>
      <Gap h={14} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : !vis.length ? <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}><Icon name="checks" size={30} color={p.ac} /><T v="bodyB">Inbox zero</T></Card> : (
        <View style={{ gap: 12 }}>{vis.map(m => (
          <Card key={m.id}>
            <Row between><T v="smallB">{m.bank}</T><T v="tiny">{m.when}</T></Row>
            <View style={{ backgroundColor: p.s2, borderRadius: 10, padding: 10, marginTop: 8 }}><T v="mono" c="mu" style={{ fontSize: 11.5 }}>{m.raw}</T></View>
            <Row between style={{ marginTop: 10 }}><View><T v="bodyB">{m.merchant}</T><T v="tiny">{m.meta}</T></View><T v="h3" c={m.debit ? 'tx' : 'po'}>{(m.debit ? '−' : '+') + inr(m.amount)}</T></Row>
            {m.duplicate ? <T v="tiny" c="wa" center style={{ marginTop: 8, fontFamily: fonts.bold }}>Looks like a duplicate of an entry you added</T> : null}
            <Row style={{ marginTop: 10 }}><Button small kind="secondary" label="Ignore" style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => act(m.id, 'ignore', 'Ignored ' + m.merchant)} /><Button small label={m.duplicate ? 'Add anyway' : 'Add entry'} style={{ flex: 1 }} onPress={() => act(m.id, 'add', `Added ${m.merchant} · ${inr(m.amount)}`)} /></Row>
          </Card>
        ))}</View>
      )}
    </Screen>
  );
}

/* ---------- M7 Usuals (templates) ---------- */
export function TemplatesScreen() {
  const p = useColors(); const { showToast } = useApp();
  const { data, setData, error, reload } = useQuery(templatesApi.list);
  const [form, setForm] = useState(false); const [n, setN] = useState(''); const [a, setA] = useState(''); const [err, setErr] = useState('');
  const save = async () => {
    if (!n.trim()) return setErr('Give it a name'); if (!parseInt(a || '0', 10)) return setErr('Add the usual amount');
    const t = await templatesApi.create({ name: n.trim(), amount: parseInt(a, 10), meta: 'Personal · UPI', icon: 'lightning' });
    setData(d => [t, ...(d ?? [])]); setForm(false); setN(''); setA(''); showToast('Saved ' + t.name + ' to your usuals');
  };
  return (
    <Screen>
      <Header title="Usuals" right={<CircleBtn icon={form ? 'x' : 'plus'} onPress={() => { setForm(!form); setErr(''); }} />} />
      <T v="small" style={{ marginTop: -6, marginBottom: 14 }}>Things you pay often. Tap to add in one go.</T>
      {form ? <Card style={{ marginBottom: 12, gap: 10 }}>
        <Input value={n} onChangeText={t => { setN(t.slice(0, 30)); setErr(''); }} placeholder="Name, e.g. Chai" style={{ backgroundColor: p.s2 }} />
        <Input value={a} onChangeText={t => { setA(t.replace(/\D/g, '').slice(0, 7)); setErr(''); }} placeholder="Usual amount" keyboardType="number-pad" left={<T c="mu">₹</T>} style={{ backgroundColor: p.s2 }} error={err} />
        <Row><Button small kind="secondary" label="Cancel" style={{ flex: 1, backgroundColor: p.s2 }} onPress={() => setForm(false)} /><Button small label="Save usual" style={{ flex: 1 }} onPress={save} /></Row>
      </Card> : null}
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : (
        <Card style={{ paddingVertical: 2 }}>{data.map((t, i) => (
          <Row key={t.id} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
            <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={async () => { await templatesApi.use(t.id); showToast(`Added ${t.name} · ${inr(t.amount)}`); }}>
              <IconTile icon={ICON[t.icon] ?? 'lightning'} size={38} /><View style={{ flex: 1 }}><T v="bodyB">{t.name}</T><T v="tiny">{t.meta}</T></View><T v="bodyB">{inr(t.amount)}</T>
            </Pressable>
            <Pressable hitSlop={8} onPress={async () => { const prev = data; setData(data.filter(x => x.id !== t.id)); await templatesApi.remove(t.id); showToast('Deleted ' + t.name, () => setData(prev)); }}><Icon name="trash" size={17} color={p.mu} /></Pressable>
          </Row>
        ))}</Card>
      )}
    </Screen>
  );
}

/* ---------- M8 Recurring ---------- */
export function RecurringScreen() {
  const p = useColors(); const { showToast } = useApp();
  const { data, setData, error, reload } = useQuery(recurringApi.list);
  const total = useMemo(() => (data?.items ?? []).filter(r => !r.paused).reduce((t, r) => t + (r.meta.startsWith('Weekly') ? r.amount * 4 : r.meta.startsWith('Yearly') ? Math.round(r.amount / 12) : r.amount), 0), [data]);
  return (
    <Screen>
      <Header title="Recurring" />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : <>
        <T v="small">Every month you commit</T><T v="big" style={{ fontSize: 42 }}>{inr(total)}</T>
        {data.suggestion ? <Card style={{ marginTop: 14 }}>
          <Row center={false} gap={12}><Mono ch="S" bg="#FC8019" fg="#fff" /><View style={{ flex: 1 }}><T v="bodyB">{data.suggestion.name} looks weekly</T><T v="small">{data.suggestion.text}</T></View></Row>
          <Row style={{ marginTop: 12 }}>
            <Button small kind="secondary" label="Not recurring" style={{ flex: 1, backgroundColor: p.s2 }} onPress={async () => { await recurringApi.suggestion('Swiggy', 'ignore'); setData({ ...data, suggestion: null }); showToast("Got it. We won't suggest Swiggy again"); }} />
            <Button small label="Track weekly" style={{ flex: 1 }} onPress={async () => { await recurringApi.suggestion('Swiggy', 'track'); setData({ suggestion: null, items: [{ id: 'sw', name: 'Swiggy', meta: 'Weekly · next Fri', amount: 1200, mono: 'S', bg: '#FC8019', fg: '#FFFFFF' }, ...data.items] }); showToast('Tracking Swiggy weekly · ~₹4,800/month'); }} />
          </Row>
        </Card> : null}
        <Card style={{ marginTop: 14, paddingVertical: 2 }}>{data.items.map((r, i) => (
          <Row key={r.id} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: p.sep, opacity: r.paused ? 0.5 : 1 }}>
            <Mono ch={r.mono} bg={r.bg} fg={r.fg} /><View style={{ flex: 1 }}><T v="bodyB">{r.name}</T><T v="tiny">{r.paused ? 'Paused' : r.meta}</T></View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}><T v="bodyB">{inr(r.amount)}</T>
              <Toggle on={!r.paused} onPress={async () => { setData({ ...data, items: data.items.map(x => (x.id === r.id ? { ...x, paused: !x.paused } : x)) }); await recurringApi.setPaused(r.id, !r.paused); showToast((r.paused ? 'Resumed ' : 'Paused ') + r.name); }} /></View>
          </Row>
        ))}</Card>
        <T v="tiny" style={{ marginTop: 10 }}>Paused items stop reminders but stay in your history.</T>
      </>}
    </Screen>
  );
}

/* ---------- N3 Notification preferences ---------- */
export function NotifPrefsScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const { data, setData, error, reload } = useQuery(notificationsApi.prefs);
  const update = (n: NotifPrefs) => { setData(n); notificationsApi.savePrefs(n).catch(() => showToast("Couldn't save. Try again")); };
  const CATS: [keyof NotifPrefs['channels'], string, string, IconName, string, boolean][] = [
    ['pay', 'Payments & settlements', 'Received, failed, refunded', 'money', p.po, true], ['apr', 'Approvals', 'Entries waiting on you', 'checkCircle', p.wa, false],
    ['rem', 'Reminders', 'Dues and nudges from friends', 'alarm', p.ne, false], ['bill', 'Bills & recurring', '2 days before each due date', 'receipt', p.a2, false],
    ['dig', 'Weekly summary', 'Sunday 8 pm recap', 'chartPie', p.mu, false], ['sec', 'Security', 'Sign-ins, PIN and device changes', 'shield', p.ac, true],
  ];
  return (
    <Screen>
      <Header title="Notifications" right={<Button small kind="secondary" label="Test" onPress={async () => { await notificationsApi.sendTest(); showToast('Test sent: this is how Byjan alerts look'); }} />} />
      {error ? <ErrorBox message={error.message} onRetry={reload} /> : !data ? <Loading /> : <>
        <Card edge={p.ac} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.po }} /><View style={{ flex: 1 }}><T v="bodyB">Push is on for this phone</T><T v="tiny">Registered for this device</T></View><LinkText label="Ask again" onPress={() => navigation.navigate('PushPermission')} /></Card>
        <Row between style={{ marginTop: 20, marginBottom: 8 }}><T v="bodyB">What you hear about</T><Row gap={14}>{['PUSH', 'MAIL', 'WA'].map(x => <T key={x} v="kicker" style={{ width: 34, textAlign: 'center' }}>{x}</T>)}</Row></Row>
        <Card style={{ paddingVertical: 2 }}>{CATS.map(([k, n, s, ic, col, lock], ci) => (
          <Row key={k} style={{ paddingVertical: 12, borderTopWidth: ci ? 1 : 0, borderColor: p.sep }}>
            <Icon name={ic} size={18} color={col} /><View style={{ flex: 1 }}><T v="smallB">{n}</T><T v="tiny">{s}</T></View>
            <Row gap={8}>{(['bell', 'mail', 'chatCircle'] as IconName[]).map((ii, j) => { const on = data.channels[k][j]; const locked = lock && j < 2; return (
              <Pressable key={j} onPress={() => { if (locked) return showToast('Security-critical alerts stay on'); const ch = { ...data.channels, [k]: data.channels[k].map((v, z) => (z === j ? !v : v)) as [boolean, boolean, boolean] }; update({ ...data, channels: ch }); }}
                style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: on ? p.ac : p.ci2, backgroundColor: on ? p.act : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.7 : 1 }}>
                <Icon name={ii} size={15} color={on ? p.ac : p.mu} />
              </Pressable>); })}</Row>
          </Row>
        ))}</Card>
        <T v="tiny" style={{ marginTop: 8 }}>Security and payment alerts always reach you. That's how we protect your money.</T>
        <T v="bodyB" style={{ marginTop: 20, marginBottom: 6 }}>Privacy & timing</T>
        <Card style={{ paddingVertical: 2 }}>
          <Row style={{ paddingVertical: 12 }}><View style={{ flex: 1 }}><T v="smallB">Hide amounts on lock screen</T><T v="tiny">Shows “You received a payment” instead</T></View><Toggle on={data.hideAmounts} onPress={() => update({ ...data, hideAmounts: !data.hideAmounts })} /></Row><Divider />
          <Row style={{ paddingVertical: 12 }}><View style={{ flex: 1 }}><T v="smallB">Quiet hours</T><T v="tiny">{data.quietHours ? '10 pm — 7 am · security still comes through' : 'Off'}</T></View><Toggle on={data.quietHours} onPress={() => update({ ...data, quietHours: !data.quietHours })} /></Row><Divider />
          <Row style={{ paddingVertical: 12 }}><View style={{ flex: 1 }}><T v="smallB">Bundle small updates</T><T v="tiny">One summary instead of many pings</T></View><Toggle on={data.bundle} onPress={() => update({ ...data, bundle: !data.bundle })} /></Row>
        </Card>
      </>}
    </Screen>
  );
}
