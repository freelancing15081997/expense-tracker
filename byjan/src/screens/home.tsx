import React, { useState } from 'react';
import { RefreshControl, ScrollView, View, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp, useColors } from '../state/AppContext';
import { billsApi, booksApi, dashboardApi, entriesApi, settleApi } from '../api';
import { useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { Avatar, Button, Card, ErrorBox, Gap, Icon, IconTile, LinkText, Mono, Row, Sheet, Skeleton, T } from '../components/ui';
import { BookCard, Sparkline } from '../components/brand';
import { haptic, Loop, Odometer, Press, Replay, Rise } from '../components/motion';
import { HScroll, useSpaces } from './SpacesScreen';

export function HomeScreen() {
  const p = useColors(); const { showToast, masked, setMasked } = useApp(); const ins = useSafeAreaInsets();
  const navigation = useNavigation<any>(); const spaces = useSpaces();
  const [w, setW] = useState(390);
  const home = useQuery(dashboardApi.home);
  const books = useQuery(booksApi.list);
  const bills = useQuery(billsApi.list);
  const [refreshing, setRefreshing] = useState(false);
  const [nudge, setNudge] = useState(true);
  const [actions, setActions] = useState<null | { id: string; title: string; amount: string }>(null);
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const h = home.data;
  const due = (bills.data ?? []).filter(d => !d.paid).slice(0, 3);
  const dueTotal = due.reduce((a, d) => a + d.amount, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    try { const r = await dashboardApi.sync(); await Promise.all([home.reload(), books.reload()]); haptic('success'); showToast(`Synced · ${r.books} books up to date`); }
    catch { navigation.navigate('Offline'); } finally { setRefreshing(false); }
  };
  const [int, dec] = h ? h.spent.toFixed(2).split('.') : ['0', '00'];
  const cardW = Math.min(w, 430) - 104;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <LinearGradient pointerEvents="none" colors={[p.gl ?? 'rgba(94,230,181,0.14)', 'rgba(94,230,181,0)']} start={{ x: 0.7, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420 }} />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingBottom: ins.bottom + 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.ac} />}>
        <Rise style={{ paddingHorizontal: 20 }}>
          <Row gap={10}>
            <Press onPress={() => spaces.go('Profile')} scaleTo={0.9}><Avatar ini="AK" size={42} bg={p.s1} fg={p.tx} ring={p.ac} /></Press>
            <Press onPress={() => navigation.navigate('Search')} scaleTo={0.98} style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }}>
              <Icon name="search" size={17} color={p.mu} /><T v="small" style={{ flex: 1 }}>Search or ask</T><Icon name="sparkle" size={15} color={p.ac} />
            </Press>
            <Press onPress={() => navigation.navigate('Inbox')} scaleTo={0.9} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bell" size={19} />
              <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: p.ac, borderWidth: 2, borderColor: p.s1 }} />
            </Press>
          </Row>
        </Rise>

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Row between>
            <T v="body" c="mu">Spent in {h?.monthLabel ?? 'September'}</T>
            <Press onPress={() => setMasked(!masked)} hitSlop={10} scaleTo={0.9}><Row gap={6} style={{ backgroundColor: p.s1, borderRadius: 13, height: 26, paddingHorizontal: 10 }}><Icon name={masked ? 'eye' : 'eyeOff'} size={14} color={p.mu} /><T v="tiny">{masked ? 'Show' : 'Hide'}</T></Row></Press>
          </Row>
          {home.error ? <ErrorBox message={home.error.message} onRetry={home.reload} /> : !h ? <Skeleton h={62} w="72%" r={14} style={{ marginTop: 6 }} /> : (
            <Replay trigger={masked ? 'm' : 'v'} name="bump" duration={260}>
              <Row gap={2} center={false} style={{ alignItems: 'flex-end', marginTop: 2 }}>
                <T c="mu" style={{ fontFamily: fonts.medium, fontSize: 28, lineHeight: 34, marginBottom: 10, marginRight: 2 }}>₹</T>
                {masked ? <T v="display" c="mu">••,•••</T> : <Odometer value={Number(int).toLocaleString('en-IN')} size={58} color={p.tx} font={fonts.bold} />}
                {!masked ? <T c="mu" style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, marginBottom: 9, letterSpacing: -0.8 }}>.{dec}</T> : null}
              </Row>
            </Replay>
          )}
          {h ? (
            <Rise delay={250}>
              <Row style={{ marginTop: 8 }} gap={8}>
                <View style={{ backgroundColor: p.pot, borderRadius: 13, paddingHorizontal: 10, height: 26, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="trendDown" size={13} color={p.po} weight="bold" /><T v="tiny" c="po" style={{ fontFamily: fonts.bold }}>{inr(Math.abs(h.vsLastMonth))} vs Aug</T>
                </View>
                <T v="tiny">{h.budgetUsedPct}% of your ₹70k budget used</T>
              </Row>
            </Rise>
          ) : null}
        </View>

        <View style={{ marginTop: 14 }}>{h ? <Sparkline data={h.trend} width={w} height={78} /> : <Gap h={78} />}</View>

        <Row between style={{ paddingHorizontal: 20, marginTop: 18 }}>
          {([['plus', 'Add', 'AddEntry'], ['scan', 'Scan', 'Scan'], ['split', 'Split', 'Split'], ['qr', 'Scan & pay', 'ScanPay']] as const).map(([i, n, sc], k) => (
            <Rise key={n} kind="tileIn" delay={80 + k * 50}>
              <Press onPress={() => navigation.navigate(sc)} scaleTo={0.9} hapticKind="medium" style={{ alignItems: 'center', gap: 8, width: 78 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: p.s1, borderWidth: 1, borderColor: p.ci2, alignItems: 'center', justifyContent: 'center' }}><Icon name={i} size={24} /></View>
                <T v="tiny" c="tx" style={{ fontFamily: fonts.bold }}>{n}</T>
              </Press>
            </Rise>
          ))}
        </Row>

        <View style={{ paddingHorizontal: 20, marginTop: 22, gap: 10 }}>
          {h && h.attentionCount > 0 ? (
            <Rise delay={350}>
              <Card onPress={() => navigation.navigate('Attention')} style={{ paddingVertical: 14, backgroundColor: p.s2, borderColor: 'transparent' }}>
                <Row between><Row gap={10}><Loop name="glow"><Icon name="warning" size={18} color={p.wa} weight="fill" /></Loop><T v="bodyB">{h.attentionCount} things need a quick look</T></Row><Row gap={2}><T v="smallB" c="wa">Review</T><Icon name="caretRight" size={13} color={p.wa} weight="bold" /></Row></Row>
              </Card>
            </Rise>
          ) : null}
          {h?.nudge && nudge ? (
            <Rise delay={400}>
              <Card>
                <Row><Avatar ini={h.nudge.who} size={38} /><View style={{ flex: 1 }}><T v="bodyB">{h.nudge.name} owes you {inr(h.nudge.amount)}</T><T v="tiny">{h.nudge.book} · 6 days ago</T></View>
                  <Press onPress={() => { setNudge(false); settleApi.dismissNudge(h.nudge!.who).catch(() => setNudge(true)); }} hitSlop={10} scaleTo={0.85}><Icon name="x" size={16} color={p.mu} /></Press></Row>
                <Row style={{ marginTop: 12 }}>
                  <Button small kind="accent" icon="whatsapp" label="Remind" style={{ flex: 1 }} onPress={async () => { await settleApi.remind([h.nudge!.who]); setNudge(false); showToast(`Reminder sent to ${h.nudge!.name} on WhatsApp`); }} />
                  <Button small kind="secondary" label="Mark settled" style={{ flex: 1, backgroundColor: p.s2 }} onPress={async () => { await settleApi.markSettled(h.nudge!.who, h.nudge!.amount, 'cash'); setNudge(false); showToast(`Marked ${inr(h.nudge!.amount)} from ${h.nudge!.name} as settled`, () => setNudge(true)); }} />
                </Row>
              </Card>
            </Rise>
          ) : null}
        </View>

        <Row between style={{ paddingHorizontal: 20, marginTop: 28, marginBottom: 10 }}><T v="h3">Your books</T><LinkText label="See all" onPress={() => spaces.go('Books')} /></Row>
        <HScroll snapToInterval={cardW + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 6 }}>
          {books.data ? books.data.slice(0, 3).map((b, i) => <BookCard key={b.id} b={b} width={cardW} delay={250 + i * 70} onPress={() => navigation.navigate('Book', { id: b.id })} />)
            : [0, 1].map(i => <Skeleton key={i} h={190} w={cardW} r={26} />)}
        </HScroll>

        {due.length ? (
          <Rise delay={300} style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Card onPress={() => navigation.navigate('Bills')} style={{ paddingVertical: 14 }}>
              <Row between><Row gap={10}><IconTile icon="calendar" size={36} radius={12} /><View><T v="bodyB">Due this week</T><T v="tiny">{due.length} bills · tap to pay or mark paid</T></View></Row><T v="amount" c="wa">{inr(dueTotal)}</T></Row>
              <Row gap={6} style={{ marginTop: 12 }}>
                {due.map(d => <View key={d.id} style={{ flex: 1, backgroundColor: d.overdue ? p.net : p.s2, borderRadius: 12, padding: 10 }}><T v="tiny" c={d.overdue ? 'ne' : 'mu'} numberOfLines={1}>{d.overdue ? 'Overdue' : d.when.split(' · ')[0]}</T><T v="smallB" numberOfLines={1}>{d.title.split(' ')[0]}</T><T v="mono" c="tx" style={{ fontSize: 11.5 }}>{inr(d.amount)}</T></View>)}
              </Row>
            </Card>
          </Rise>
        ) : null}

        <View style={{ paddingHorizontal: 20, marginTop: 26 }}>
          <Row between style={{ marginBottom: 10 }}><T v="h3">Today</T><LinkText label="Activity" onPress={() => navigation.navigate('Activity')} /></Row>
          <Card style={{ paddingVertical: 2 }}>
            {h ? h.today.filter(e => !gone[e.id]).map((e, i) => (
              <Rise key={e.id} delay={420 + i * 70} kind="slideL">
                <Press onPress={() => (e.tone === 'po' ? spaces.go('Settle') : navigation.navigate('Entry', { id: e.id }))}
                  onLongPress={() => { haptic('medium'); setActions({ id: e.id, title: e.title, amount: e.amount }); }} delayLongPress={350} scaleTo={0.985}>
                  <Row gap={12} style={{ paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderColor: p.sep }}>
                    <Mono ch={e.mono} bg={e.monoBg} fg={e.monoFg} />
                    <View style={{ flex: 1, minWidth: 0 }}><T v="bodyB" numberOfLines={1}>{e.title}</T><T v="tiny" numberOfLines={1}>{e.sub}</T></View>
                    <View style={{ alignItems: 'flex-end' }}><T v="amount" c={e.tone}>{e.amount}</T><T v="tiny">{e.note}</T></View>
                  </Row>
                </Press>
              </Rise>
            )) : <Skeleton h={160} />}
          </Card>
          <T v="tiny" center style={{ marginTop: 10 }}>Press and hold an entry for quick actions</T>
        </View>
      </ScrollView>
      <Sheet open={!!actions} onClose={() => setActions(null)} title={actions?.title} sub={actions?.amount}>
        <View style={{ gap: 4, marginTop: 10 }}>
          {([['split', 'Split this', () => navigation.navigate('Split', { amount: actions?.amount.replace(/[^\d]/g, '') })], ['receipt', 'Open entry', () => navigation.navigate('Entry', { id: actions!.id })], ['share', 'Share', async () => { try { const c = await entriesApi.shareCard(actions!.id); await Share.share({ message: `${c.text}\n${c.url}`, url: c.url }); } catch { showToast("Couldn't prepare the share card"); } }],
            ['trash', 'Delete', async () => {
              const id = actions!.id; const title = actions!.title; setGone(g => ({ ...g, [id]: true }));
              try { await entriesApi.remove(id); showToast('Deleted ' + title, () => { setGone(g => ({ ...g, [id]: false })); entriesApi.restore(id); }); }
              catch { setGone(g => ({ ...g, [id]: false })); showToast("Couldn't delete. Try again"); }
            }]] as const).map(([i, n, fn], k) => (
            <Rise key={n} delay={k * 40}>
              <Press onPress={() => { setActions(null); setTimeout(fn, 120); }} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 56, paddingHorizontal: 8, borderRadius: 14 }}>
                <IconTile icon={i} size={38} radius={12} color={i === 'trash' ? p.ne : undefined} /><T v="bodyB" c={i === 'trash' ? 'ne' : 'tx'}>{n}</T>
              </Press>
            </Rise>
          ))}
        </View>
      </Sheet>
    </View>
  );
}
