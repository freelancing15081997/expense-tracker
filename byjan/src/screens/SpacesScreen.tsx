/**
 * The five "spaces" (Home, Books, Settle, Insights, You) live in one gesture-driven pager.
 *  - Drag anywhere horizontally: the page follows your finger 1:1 and tilts in 3D (prototype spIn/spOut).
 *  - ~40px or a light flick (≥300 px/s) commits; otherwise it springs back. Wraps around like the prototype.
 *  - The dock label track slides with your finger; dots stretch; a tick haptic fires as you cross half-way.
 *  - Swipe up on the dock (or tap it) opens Go to. Tap the orb for Quick add; swipe up on the orb to scan.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, runOnJS, SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureType } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp, useColors } from '../state/AppContext';
import { booksApi, templatesApi } from '../api';
import { useQuery } from '../hooks/useApi';
import { fonts, inr } from '../theme/tokens';
import { hexA, Icon, IconTile, Input, Row, Sheet, T } from '../components/ui';
import { FabOrb, SPACES, SpaceKey } from '../components/brand';
import { EASE, haptic, KF, markDrag, PlayContext, Press, Rise } from '../components/motion';
import type { IconName } from '../components/icons';
import type { ScreenProps } from '../navigation/types';
import { HomeScreen } from './home';
import { BooksScreen, InsightsScreen, ProfileScreen, SettleScreen } from './spaces';

// Memoised once: switching spaces never re-renders the pages themselves, only their transforms move.
const PAGES = [HomeScreen, BooksScreen, SettleScreen, InsightsScreen, ProfileScreen].map(C => React.memo(C));
/** Snappy but soft settle: lands in ~280 ms, no overshoot wobble. */
const PAGER_SPRING = { damping: 30, stiffness: 380, mass: 0.75, overshootClamping: false } as const;

const N = SPACES.length;
const wrapRel = (i: number, pos: number) => { 'worklet'; const r = i - pos; return ((((r % N) + N) % N) + N / 2) % N - N / 2; };
const mod = (n: number) => ((Math.round(n) % N) + N) % N;

type SpacesCtx = { go: (k: SpaceKey) => void; pager: GestureType | null; openQuick: () => void; openGoTo: () => void };
const Ctx = createContext<SpacesCtx>({ go: () => {}, pager: null, openQuick: () => {}, openGoTo: () => {} });
export const useSpaces = () => useContext(Ctx);

/** Horizontal scroller inside a space. On native it blocks the pager while you scroll it (iOS-style); on web it just scrolls. */
export function HScroll(props: ScrollViewProps & { children: React.ReactNode }) {
  const { pager } = useSpaces();
  const native = useMemo(() => (pager && Platform.OS !== 'web' ? Gesture.Native().blocksExternalGesture(pager) : null), [pager]);
  const sv = <ScrollView horizontal showsHorizontalScrollIndicator={false} {...props} />;
  return native ? <GestureDetector gesture={native}>{sv}</GestureDetector> : sv;
}

export function SpacesScreen({ navigation, route }: ScreenProps<'Spaces'>) {
  const p = useColors(); const ins = useSafeAreaInsets();
  const startKey = (route.params?.space ?? 'Home') as SpaceKey;
  const start = SPACES.findIndex(s => s.key === startKey);
  const [W, setW] = useState(390); const [H, setH] = useState(844);
  const [idx, setIdx] = useState(start);
  const [visited, setVisited] = useState<Record<number, boolean>>({ [start]: true });
  const [quick, setQuick] = useState(false);
  const [goTo, setGoTo] = useState(false);
  const pos = useSharedValue(start);
  const anchor = useSharedValue(start);

  const commit = (target: number) => { const m = mod(target); setIdx(m); setVisited(v => (v[m] ? v : { ...v, [m]: true })); };
  const animateTo = (target: number, velocity = 0) => {
    'worklet';
    pos.value = withSpring(target, { ...PAGER_SPRING, velocity }, done => {
      if (done) { const m = ((Math.round(target) % N) + N) % N; pos.value = m; anchor.value = m; }
    });
  };

  // External navigation (dock menu, deep links, other screens) → glide to that space by the shortest way round.
  useEffect(() => {
    const k = route.params?.space; if (!k) return;
    const t = SPACES.findIndex(s => s.key === k); if (t < 0) return;
    const cur = Math.round(pos.value); let d = t - mod(cur); if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    if (d !== 0) { animateTo(cur + d); commit(cur + d); }
     
  }, [route.params?.space, route.params?.at]);

  // Tick as the page crosses half-way, like a detent.
  useAnimatedReaction(() => Math.round(pos.value), (c, prev) => { if (prev !== null && c !== prev) runOnJS(haptic)('tick'); });

  const makePan = () => Gesture.Pan()
    .activeOffsetX([-12, 12]).failOffsetY([-14, 14])
    .onBegin(() => { anchor.value = Math.round(pos.value); })
    .onStart(() => { runOnJS(markDrag)(); })
    .onChange(e => { pos.value = anchor.value - e.translationX / W; })
    .onEnd(e => {
      runOnJS(markDrag)();
      const v = -e.velocityX / W; const dx = -e.translationX;
      let target = anchor.value;
      if (Math.abs(dx) > 40 || Math.abs(e.velocityX) > 300) target = anchor.value + (Math.abs(e.velocityX) > 300 ? Math.sign(v) : Math.sign(dx));
      animateTo(target, v);
      runOnJS(commit)(target);
    });
  const pager = useMemo(makePan, [W]);  
  const dockPan = useMemo(makePan, [W]);  

  const goRef = useRef<(k: SpaceKey) => void>(() => {});
  goRef.current = (k: SpaceKey) => {
    const t = SPACES.findIndex(s => s.key === k); const cur = Math.round(pos.value);
    let d = t - mod(cur); if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    if (d) { animateTo(cur + d); commit(cur + d); }
  };
  const go = useCallback((k: SpaceKey) => goRef.current(k), []);
  // Stable context value: pages that read it don't re-render when the pager moves.
  const ctx = useMemo<SpacesCtx>(() => ({ go, pager, openQuick: () => setQuick(true), openGoTo: () => setGoTo(true) }), [go, pager]);

  return (
    <Ctx.Provider value={ctx}>
      <View style={{ flex: 1, backgroundColor: p.bg, overflow: 'hidden' }} onLayout={e => { setW(e.nativeEvent.layout.width); setH(e.nativeEvent.layout.height); }}>
        <GestureDetector gesture={pager}>
          <View style={{ flex: 1 }}>
            {PAGES.map((Page, i) => (
              <SpacePage key={i} i={i} pos={pos} W={W}>
                <PlayContext.Provider value={i === idx && !quick}>{visited[i] || i === idx ? <Page /> : null}</PlayContext.Provider>
              </SpacePage>
            ))}
          </View>
        </GestureDetector>
        {/* fade behind the dock, as in the prototype */}
        <LinearGradient pointerEvents="none" colors={[hexA(p.bg, 0), p.bg]} locations={[0, 0.62]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 + ins.bottom }} />
        <QuickAdd open={quick} onClose={() => setQuick(false)} W={W} H={H} />
        <Dock pos={pos} idx={idx} pager={dockPan} quick={quick} onTap={() => setGoTo(true)} onFab={() => setQuick(q => !q)} onFabUp={() => { setQuick(false); navigation.navigate('Scan'); }} />
        <GoToSheet open={goTo} onClose={() => setGoTo(false)} idx={idx} onSpace={k => { setGoTo(false); go(k); }} />
      </View>
    </Ctx.Provider>
  );
}

const SpacePage = React.memo(function SpacePage({ i, pos, W, children }: { i: number; pos: SharedValue<number>; W: number; children: React.ReactNode }) {
  const p = useColors();
  // Transform + opacity only (compositor work, no layout). zIndex flips once at the half-way point.
  const a = useAnimatedStyle(() => {
    const r = wrapRel(i, pos.value); const ar = Math.min(1, Math.abs(r));
    return {
      transform: [{ perspective: 1200 }, { translateX: r * W * 0.92 }, { rotateY: `${-r * 12}deg` }, { scale: 1 - 0.12 * ar }],
      opacity: Math.abs(r) > 1.15 ? 0 : 1 - 0.55 * ar,
      zIndex: Math.abs(r) < 0.5 ? 2 : 1,
    };
  });
  const dim = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(wrapRel(i, pos.value))) * 0.6 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: p.bg }, a]}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }, dim]} />
    </Animated.View>
  );
});

/* ---------------- Dock ---------------- */
function Dock({ pos, idx, pager, quick, onTap, onFab, onFabUp }: { pos: SharedValue<number>; idx: number; pager: GestureType; quick: boolean; onTap: () => void; onFab: () => void; onFabUp: () => void }) {
  const p = useColors(); const ins = useSafeAreaInsets();
  const press = useSharedValue(1);
  // Horizontal drag on the dock drives the same pager; swipe up or tap opens Go to.
  const bar = Gesture.Race(
    pager,
    Gesture.Pan().activeOffsetY(-10).failOffsetX([-16, 16]).onEnd(e => { if (e.translationY < -24 || e.velocityY < -350) runOnJS(onTap)(); }),
    Gesture.Tap().maxDuration(400)
      .onBegin(() => { press.value = withTiming(0.97, { duration: 90 }); })
      .onFinalize(() => { press.value = withSpring(1, { damping: 12, stiffness: 300 }); })
      .onEnd(() => runOnJS(onTap)()),
  );
  const fab = Gesture.Exclusive(
    Gesture.Pan().activeOffsetY(-10).onEnd(e => { if (e.translationY < -30 || e.velocityY < -400) runOnJS(onFabUp)(); }),
    Gesture.Tap().onEnd(() => runOnJS(onFab)()),
  );
  const fabScale = useSharedValue(1);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: ins.bottom + 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 30 }}>
      <GestureDetector gesture={bar}>
        <Animated.View style={[{ flex: 1, height: 62, borderRadius: 31, backgroundColor: p.s1, borderWidth: 1, borderColor: p.ci2, borderTopColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', paddingRight: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } }, barStyle,
          { animationName: KF.dockUp, animationDuration: '500ms', animationTimingFunction: EASE.out, animationFillMode: 'both' } as any]}>
          <View style={{ flex: 1, alignSelf: 'stretch', overflow: 'hidden' }}>
            {SPACES.map((s, i) => <DockLabel key={s.key} i={i} pos={pos} label={s.label} icon={s.icon as IconName} />)}
            <LinearGradient pointerEvents="none" colors={[p.s1, hexA(p.s1, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18 }} />
            <LinearGradient pointerEvents="none" colors={[hexA(p.s1, 0), p.s1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 70 }} />
          </View>
          <Row gap={4} style={{ marginRight: 8 }}>{SPACES.map((s, i) => <DockDot key={s.key} i={i} pos={pos} />)}</Row>
          <Icon name="caretDown" size={14} color={p.mu} weight="bold" />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={fab}>
        <Animated.View accessibilityRole="button" accessibilityLabel={quick ? 'Close quick add' : 'Quick add'} style={fabStyle}>
          <FabOrb open={quick} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
function DockLabel({ i, pos, label, icon }: { i: number; pos: SharedValue<number>; label: string; icon: IconName }) {
  const p = useColors();
  const a = useAnimatedStyle(() => {
    const r = wrapRel(i, pos.value); const ar = Math.min(1, Math.abs(r));
    return { transform: [{ translateX: 22 + r * 170 }, { scale: 1 - 0.16 * ar }], opacity: Math.abs(r) > 1 ? 0 : Math.pow(1 - ar, 1.6) };
  });
  const ic = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(wrapRel(i, pos.value))) }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 9, transformOrigin: 'left center' } as any, a]}>
      <View style={{ width: 20, height: 20 }}>
        <View style={{ position: 'absolute' }}><Icon name={icon} size={20} color={p.mu} /></View>
        <Animated.View style={[{ position: 'absolute' }, ic]}><Icon name={icon} size={20} color={p.ac} weight="fill" /></Animated.View>
      </View>
      <T style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3 }}>{label}</T>
    </Animated.View>
  );
}
function DockDot({ i, pos }: { i: number; pos: SharedValue<number> }) {
  const p = useColors();
  const a = useAnimatedStyle(() => {
    const ar = Math.min(1, Math.abs(wrapRel(i, pos.value)));
    return { width: interpolate(ar, [0, 1], [16, 5], Extrapolation.CLAMP), backgroundColor: ar < 0.5 ? p.ac : p.s2 };
  });
  return <Animated.View style={[{ height: 5, borderRadius: 3 }, a]} />;
}

/* ---------------- Quick add orbit ---------------- */
function QuickAdd({ open, onClose, W, H }: { open: boolean; onClose: () => void; W: number; H: number }) {
  const p = useColors(); const ins = useSafeAreaInsets(); const nav = useNavigation<any>();
  const { showToast } = useApp();
  const usuals = useQuery(templatesApi.list, [], 'templates');
  const books = useQuery(booksApi.list, [], 'books');
  const cur = books.data?.find(b => b.pinned) ?? books.data?.[0];
  const [focus, setFocus] = useState(-1);
  const [mounted, setMounted] = useState(open);
  const v = useSharedValue(0);
  useEffect(() => {
    if (open) { setMounted(true); setFocus(-1); v.value = withTiming(1, { duration: 260 }); }
    else v.value = withTiming(0, { duration: 200 }, f => { if (f) runOnJS(setMounted)(false); });
  }, [open, v]);
  const drag = useSharedValue(0);
  const pan = Gesture.Pan().activeOffsetY(10).onChange(e => { drag.value = Math.max(0, e.translationY); }).onEnd(e => {
    if (e.translationY > 80 || e.velocityY > 600) runOnJS(onClose)(); drag.value = withSpring(0);
  });
  const scrim = useAnimatedStyle(() => ({ opacity: v.value * (1 - Math.min(0.7, drag.value / 400)) }));
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value * 0.6 }], opacity: v.value * (1 - Math.min(0.75, drag.value / 380)) }));
  if (!mounted) return null;
  const goTo = (fn: () => void) => { onClose(); setTimeout(fn, 60); };
  const ORB: [IconName, string, string, () => void][] = [
    ['arrowUpRight', 'Expense', 'Log money you paid', () => nav.navigate('AddEntry', { flow: 'out', bookId: cur?.id })],
    ['split', 'Split', 'Share a bill fairly', () => nav.navigate('Split', { bookId: cur?.id })],
    ['handCoins', 'Request', 'Ask someone to pay you', () => nav.navigate('Request')],
    ['qr', 'Scan & pay', 'Pay any UPI QR code', () => nav.navigate('ScanPay')],
    ['scan', 'Scan bill', 'Read a receipt in a second', () => nav.navigate('Scan')],
    ['swap', 'Transfer', 'Move between your accounts', () => nav.navigate('Accounts', { transfer: true })],
    ['mic', 'Voice', 'Just say what you spent', () => nav.navigate('Voice')],
    ['arrowDownLeft', 'Income', 'Log money you received', () => nav.navigate('AddEntry', { flow: 'in', bookId: cur?.id })],
  ];
  const cx = W / 2, cy = 338, R = 118;
  const fabX = W - 16 - 31, fabY = H - ins.bottom - 16 - 31 - ins.top - 10; // orbit items fly out of the orb (bottom-right)
  const F = focus >= 0 ? ORB[focus] : null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: hexA(p.bg, 0.985) }, scrim]}><Pressable style={{ flex: 1 }} onPress={onClose} /></Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: ins.top + 10 }, body]}>
          <Rise duration={380}>
            <Row between center={false} style={{ paddingHorizontal: 20 }}>
              <View><T v="kicker" c="ac">QUICK ADD</T><T v="h1" style={{ fontSize: 34, lineHeight: 37, marginTop: 4 }}>What{'\n'}happened?</T>
                <Row gap={6} style={{ marginTop: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.ac }} /><T v="tiny" key={F ? F[1] : 'x'}>{F ? F[2] : 'Tap an option, or the core for a quick expense'}</T></Row></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, paddingHorizontal: 12, height: 36, borderRadius: 18 }}><LinearGradient colors={p[cur?.gradient ?? 'c1'] as [string, string]} style={{ width: 18, height: 18, borderRadius: 6 }} /><T v="smallB">{cur?.name ?? '…'}</T></View>
            </Row>
          </Rise>
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: cy + R + 80 }}>
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - R - 44, top: cy - R - 44, width: (R + 44) * 2, height: (R + 44) * 2, borderRadius: R + 44, borderWidth: 1, borderColor: p.sep }, { animationName: KF.ringIn, animationDuration: '700ms', animationTimingFunction: EASE.soft, animationFillMode: 'both' } as any]} />
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: R, borderWidth: 1, borderColor: p.ci2, borderStyle: 'dashed' }, { animationName: KF.ringIn, animationDuration: '700ms', animationDelay: '60ms', animationTimingFunction: EASE.soft, animationFillMode: 'both' } as any]} />
            {ORB.map(([i, n, , fn], k) => {
              const a = (-90 + k * 45) * Math.PI / 180; const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
              const from = { opacity: 0, transform: [{ translateX: fabX - x }, { translateY: fabY - y }, { scale: 0.2 }, { rotate: '-120deg' }] };
              return (
                <Animated.View key={n} style={[{ position: 'absolute', left: x - 42, top: y - 30, width: 84, alignItems: 'center' },
                  { animationName: { from, '55%': { opacity: 1 }, to: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] } }, animationDuration: '620ms', animationDelay: `${60 + k * 40}ms`, animationTimingFunction: EASE.spring, animationFillMode: 'both' } as any]}>
                  <Press onPressIn={() => setFocus(k)} onPress={() => goTo(fn)} hapticKind="medium" scaleTo={0.88} style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: focus === k ? p.pb : p.s1, borderWidth: 1, borderColor: focus === k ? p.pb : p.ci2, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={i} size={22} color={focus === k ? p.pf : p.tx} />
                    </View>
                    <T v="tiny" c="tx" style={{ fontFamily: fonts.bold }}>{n}</T>
                  </Press>
                </Animated.View>
              );
            })}
            <Animated.View style={[{ position: 'absolute', left: cx - 50, top: cy - 50 }, { animationName: KF.pop, animationDuration: '600ms', animationTimingFunction: EASE.spring, animationFillMode: 'both' } as any]}>
              <Press onPress={() => goTo(F ? F[3] : ORB[0][3])} hapticKind="medium" scaleTo={0.92} style={{ width: 100, height: 100, borderRadius: 50, shadowColor: p.ac, shadowOpacity: 0.5, shadowRadius: 30 }}>
                <LinearGradient colors={p.fab as [string, string, string]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.85, y: 1 }} style={{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Icon name={F ? F[0] : 'plus'} size={24} color="#04140E" weight="bold" /><T v="smallB" c="#04140E">{F ? F[1] : 'Expense'}</T>
                </LinearGradient>
              </Press>
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 96 }}>
            <Row between style={{ paddingHorizontal: 20, marginBottom: 10 }}><T v="kicker">ONE TAP · YOUR USUALS</T><T v="tiny">Swipe down to close</T></Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {(usuals.data ?? []).map((t, k) => (
                <Rise key={t.id} delay={360 + k * 40}>
                  <Press onPress={async () => { await templatesApi.use(t.id); onClose(); showToast(`Added ${t.name} · ${inr(t.amount)}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, borderRadius: 19, paddingHorizontal: 14, height: 38 }}>
                    <T v="smallB">{t.name}</T><T v="mono" c="mu">{inr(t.amount)}</T>
                  </Press>
                </Rise>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ---------------- Go to (dock menu) ---------------- */
function GoToSheet({ open, onClose, idx, onSpace }: { open: boolean; onClose: () => void; idx: number; onSpace: (k: SpaceKey) => void }) {
  const p = useColors(); const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const TOOLS: [IconName, string, string][] = [['wallet', 'Accounts', 'Accounts'], ['calendar', 'Bills', 'Bills'], ['pulse', 'Activity', 'Activity'], ['bell', 'Alerts', 'Inbox'], ['handCoins', 'Request', 'Request'], ['scan', 'Scan', 'Scan'], ['warning', 'Review', 'Attention'], ['folder', 'Documents', 'Vault'], ['chatDots', 'Bank SMS', 'SmsReview'], ['lightning', 'Usuals', 'Templates'], ['repeat', 'Recurring', 'Recurring'], ['lock', 'Lock app', 'Lock']];
  const ql = q.toLowerCase();
  return (
    <Sheet open={open} onClose={onClose} title="Go to">
      <Input value={q} onChangeText={setQ} placeholder="Search screens, books, people" left={<Icon name="search" size={16} color={p.mu} />} style={{ backgroundColor: p.s2, marginTop: 8 }} />
      <View style={{ marginTop: 8 }}>
        {SPACES.filter(s => !q || s.label.toLowerCase().includes(ql)).map((s, i) => (
          <Rise key={s.key} delay={i * 40}>
            <Press onPress={() => onSpace(s.key)} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 62, paddingHorizontal: 10, borderRadius: 18, backgroundColor: i === idx ? p.s2 : 'transparent' }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: i === idx ? p.pb : p.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon as IconName} size={21} color={i === idx ? p.pf : p.tx} /></View>
              <View style={{ flex: 1 }}><T v="title">{s.label}</T><T v="tiny">{s.sub}</T></View>
              <T v="smallB" c={i === idx ? 'ac' : s.key === 'Settle' || s.key === 'Insights' ? 'po' : 'mu'}>{i === idx ? 'Here' : s.metric}</T>
            </Press>
          </Rise>
        ))}
      </View>
      <T v="kicker" style={{ marginTop: 14, marginBottom: 12, marginLeft: 4 }}>TOOLS</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
        {TOOLS.filter(t => !q || t[1].toLowerCase().includes(ql)).map(([i, n, sc], k) => (
          <Rise key={n} kind="tileIn" delay={200 + k * 30} style={{ width: '25%' }}>
            <Press onPress={() => { onClose(); setTimeout(() => nav.navigate(sc), 60); }} scaleTo={0.9} style={{ alignItems: 'center', gap: 7 }}>
              <IconTile icon={i} size={52} radius={17} bg={p.s2} /><T v="tiny" c="tx">{n}</T>
            </Press>
          </Rise>
        ))}
      </View>
    </Sheet>
  );
}
