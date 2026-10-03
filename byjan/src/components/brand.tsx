import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cubicBezier, Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { useColors } from '../state/AppContext';
import { fonts } from '../theme/tokens';
import type { BookSummary } from '../api/types';
import { Avatar, AvatarStack, hexA, Row, T } from './ui';
import { EASE, GrowBar, KF, Loop, Press, Rise } from './motion';

export const SPACES = [
  { key: 'Home', label: 'Home', icon: 'house', sub: 'Overview and recent', metric: '₹48.2k' },
  { key: 'Books', label: 'Books', icon: 'books', sub: '4 active books', metric: '4 active' },
  { key: 'Settle', label: 'Settle', icon: 'swap', sub: "You're up ₹2,050", metric: '+₹2,050' },
  { key: 'Insights', label: 'Insights', icon: 'chartPie', sub: 'Spending down 11%', metric: '−11%' },
  { key: 'Profile', label: 'You', icon: 'userCircle', sub: 'Profile, security, plan', metric: 'Pro' },
] as const;
export type SpaceKey = typeof SPACES[number]['key'];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <LinearGradient colors={['#C4F9E6', '#5EE6B5', '#2FB989']} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#04140E', fontFamily: fonts.black, fontSize: size * 0.62, lineHeight: size * 0.8, marginTop: -size * 0.04 }}>b</Text>
    </LinearGradient>
  );
}

/** The mint orb. Shadow sits on a *round* wrapper, so there's no square halo on web. */
export function FabOrb({ open, size = 62 }: { open: boolean; size?: number }) {
  const p = useColors();
  const r = useSharedValue(0);
  useEffect(() => { r.value = withSpring(open ? 1 : 0, { damping: 11, stiffness: 180, mass: 0.7 }); }, [open, r]);
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 135}deg` }] }));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, shadowColor: p.ac, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
      <LinearGradient colors={p.fab as [string, string, string]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.85, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 1, left: 8, right: 8, height: size * 0.42, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        <Animated.View style={rot}>
          <Svg width={26} height={26} viewBox="0 0 26 26"><Path d="M13 4v18M4 13h18" stroke="#04140E" strokeWidth={2.6} strokeLinecap="round" /></Svg>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const toneMap = (p: ReturnType<typeof useColors>) => ({ po: [p.po, p.pot], ne: [p.ne, p.net], wa: [p.wa, p.wat], mu: [p.mu, p.sk] } as const);

/** Book card, matched to the prototype: metallic gradient, inner highlight, outer ring, travelling sheen, pulsing status dot. */
export const BookCard = React.memo(function BookCard({ b, onPress, width, delay = 0 }: { b: BookSummary; onPress: () => void; width?: number; delay?: number }) {
  const p = useColors(); const [dot, dotT] = toneMap(p)[b.tone];
  const g = p[b.gradient] as string[];
  const pulse = b.tone === 'wa' || b.tone === 'ne';
  return (
    <Rise delay={delay} duration={550} style={{ width }}>
      <Press onPress={onPress} scaleTo={0.97} style={{ borderRadius: 27, padding: 3, borderWidth: 1, borderColor: p.sep }}>
        <View style={{ borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 16 } }}>
          <LinearGradient colors={g as [string, string, ...string[]]} start={{ x: 0, y: 0.1 }} end={{ x: 1, y: 0.9 }} style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.32)' }}>
            <Loop name="sheen" duration={6000} easing="ease-in-out" pointerEvents="none" style={{ position: 'absolute', top: -20, bottom: -20, left: 0, width: 90 }}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Loop>
            <Row between>
              <T v="kicker" c={p.cm} numberOfLines={1} style={{ flex: 1 }}>{b.kind.toUpperCase()} · {b.people === 1 ? 'JUST YOU' : b.people + ' PEOPLE'}{b.pinned ? ' · PINNED' : ''}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 10, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: dotT, alignItems: 'center', justifyContent: 'center' }}>
                  {pulse ? <Loop name="glow" duration={1600}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /></Loop> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
                </View>
                <T v="tiny" c={p.ct} style={{ fontFamily: fonts.bold, fontSize: 11 }}>{b.badge}</T>
              </View>
            </Row>
            <T v="h2" c={p.ct} style={{ marginTop: 4, fontSize: 20 }}>{b.name}</T>
            <Row between center={false} style={{ marginTop: 16, alignItems: 'flex-end' }}>
              <View><T v="tiny" c={p.cm}>{b.label}</T><T c={p.ct} style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 30, letterSpacing: -1, marginTop: 3, fontVariant: ['tabular-nums'] }}>{b.big}</T></View>
              <AvatarStack list={b.members} ring="rgba(255,255,255,0.3)" />
            </Row>
            <GrowBar pct={b.pct} color={dot} track="rgba(0,0,0,0.2)" delay={450 + delay} style={{ marginTop: 12 }} />
            <Row between style={{ marginTop: 7 }}><T v="tiny" c={p.cm} numberOfLines={1} style={{ flex: 1, fontSize: 11 }}>{b.foot}</T><T v="mono" c={p.cm} style={{ fontSize: 11 }}>{b.pct}%</T></Row>
          </LinearGradient>
        </View>
      </Press>
    </Rise>
  );
});

/** Area sparkline that "draws" in left→right, with a pulsing end point. */
export const Sparkline = React.memo(function Sparkline({ data, width, height = 70 }: { data: number[]; width: number; height?: number }) {
  const p = useColors();
  // Reveal left→right by sliding a clip window and counter-sliding the drawing: transforms only, no relayout per frame.
  const w = useSharedValue(0);
  useEffect(() => { w.value = withDelay(200, withTiming(1, { duration: 1300, easing: Easing.bezier(0.16, 1, 0.3, 1) })); }, [width, w]);
  const clip = useAnimatedStyle(() => ({ transform: [{ translateX: -width * (1 - w.value) }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateX: width * (1 - w.value) }] }));
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => [i / (data.length - 1) * width, height - 10 - (v - min) / (max - min || 1) * (height - 22)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const cx = (x0 + x1) / 2; d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`; }
  const [ex, ey] = pts[pts.length - 1];
  return (
    <View style={{ width, height }}>
      <Animated.View style={[{ width, height, overflow: 'hidden' }, clip]}>
        <Animated.View style={inner}>
        <Svg width={width} height={height}>
          <Defs><SvgGrad id="sg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={p.ac} stopOpacity="0.3" /><Stop offset="1" stopColor={p.ac} stopOpacity="0" /></SvgGrad></Defs>
          <Path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#sg)" />
          <Path d={d} stroke={p.ac} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </Svg>
        </Animated.View>
      </Animated.View>
      <Rise delay={1300} kind="pop" style={{ position: 'absolute', left: ex - 9, top: ey - 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <Loop name="ringOut" duration={2000} style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: hexA(p.ac.startsWith('#') ? p.ac : '#5EE6B5', 0.5) }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.ac, borderWidth: 2, borderColor: p.bg }} />
      </Rise>
    </View>
  );
});

/** Donut that spins in (prototype ringIn). */
export function Donut({ parts, size = 150, stroke = 16, center }: { parts: { v: number; color: string }[]; size?: number; stroke?: number; center?: React.ReactNode }) {
  const p = useColors();
  const r = (size - stroke) / 2, C = 2 * Math.PI * r; const tot = parts.reduce((a, x) => a + x.v, 0) || 1;
  let off = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute' }, { animationName: KF.ringIn, animationDuration: '900ms', animationTimingFunction: EASE.soft, animationFillMode: 'both' } as any]}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.s2} strokeWidth={stroke} fill="none" />
          {parts.map((x, i) => { const len = x.v / tot * C; const el = <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={x.color} strokeWidth={stroke} fill="none" strokeLinecap="butt" strokeDasharray={`${Math.max(0, len - 3)} ${C}`} strokeDashoffset={-off} />; off += len; return el; })}
        </Svg>
      </Animated.View>
      <Rise delay={300} kind="pop">{center}</Rise>
    </View>
  );
}

export function Ring({ pct, size = 54 }: { pct: number; size?: number }) {
  const p = useColors(); const s = 5, r = (size - s) / 2, C = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute' }, { animationName: KF.ringIn, animationDuration: '900ms', animationDelay: '200ms', animationTimingFunction: EASE.soft, animationFillMode: 'both' } as any]}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={s} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.ac} strokeWidth={s} fill="none" strokeLinecap="round" strokeDasharray={`${pct / 100 * C} ${C}`} />
        </Svg>
      </Animated.View>
      <T v="smallB" c={p.ct} style={{ fontSize: 12 }}>{pct}%</T>
      <T v="kicker" c={p.cm} style={{ fontSize: 7, letterSpacing: 0.5 }}>budget</T>
    </View>
  );
}

/** Coloured monograms for UPI apps (no trademarked logos). */
export function UpiBadge({ app, size = 34 }: { app: string; size?: number }) {
  const m: Record<string, [string, string, string]> = { GPay: ['#FFFFFF', '#1A73E8', 'G'], PhonePe: ['#5F259F', '#FFFFFF', 'Pe'], Paytm: ['#00BAF2', '#FFFFFF', 'P'], 'Other UPI': ['#FFFFFF', '#097939', 'UPI'], UPI: ['#FFFFFF', '#097939', 'UPI'] };
  const [bg, fg, t] = m[app] ?? m['Other UPI'];
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: fg, fontFamily: fonts.black, fontSize: size * (t.length > 2 ? 0.28 : 0.4) }}>{t}</Text></View>;
}

/** Ticket-style perforation used on receipts (prototype payment success card). */
export function Perforation({ bg }: { bg: string }) {
  const p = useColors();
  return (
    <View style={{ height: 18, justifyContent: 'center', marginHorizontal: -16 }}>
      <View style={{ position: 'absolute', left: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: bg }} />
      <View style={{ position: 'absolute', right: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: bg }} />
      <View style={{ marginHorizontal: 18, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: p.ci2 }} />
    </View>
  );
}
export { Pressable };

/**
 * Flat "book" for the Books list (prototype v2, screen 05): neutral cover, slim spine, two page leaves fanned
 * out behind, and one status colour — the bookmark tab. Motion: bkDeal (rise + scale), pgFan (leaves slide out),
 * bmDrop (bookmark drops with a bounce), bar (2px progress grows).
 */
export const FlatBook = React.memo(function FlatBook({ b, i, onPress, onPressIn, innerRef }: { b: BookSummary; i: number; onPress: () => void; onPressIn?: () => void; innerRef?: React.Ref<View> }) {
  const p = useColors(); const [dot] = toneMap(p)[b.tone];
  const deal = { from: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.97 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } };
  const fan = { from: { opacity: 0, transform: [{ translateX: -10 }] }, to: { transform: [{ translateX: 0 }] } };
  const drop = { from: { transform: [{ scaleY: 0 }] }, to: { transform: [{ scaleY: 1 }] } };
  const A = (name: object, ms: number, delay: number, ease: any) => ({ animationName: name, animationDuration: `${ms}ms`, animationDelay: `${delay}ms`, animationTimingFunction: ease, animationFillMode: 'both' }) as any;
  const leaf = (o: { top: number; left: number; right: number; r: number; op: number; ms: number }) => (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: o.top, bottom: o.top, left: o.left, right: o.right, borderTopRightRadius: o.r, borderBottomRightRadius: o.r, backgroundColor: p.s1, borderWidth: 1, borderColor: p.sep, opacity: o.op }, A(fan, o.ms, 160 + i * 40, BOOK_EASE)]} />
  );
  return (
    <Animated.View style={A(deal, 500, i * 40, BOOK_EASE)}>
      <Press onPress={onPress} onPressIn={onPressIn} scaleTo={0.975} style={{ paddingRight: 8 }}>
        <View ref={innerRef} collapsable={false}>
          {leaf({ top: 9, left: 30, right: -8, r: 16, op: 0.45, ms: 450 })}
          {leaf({ top: 4, left: 24, right: -4, r: 17, op: 0.8, ms: 400 })}
          <View style={{ borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 18, borderBottomRightRadius: 18, overflow: 'hidden', backgroundColor: p.bk, borderWidth: 1, borderColor: p.sep, borderTopColor: p.ci2, paddingTop: 14, paddingBottom: 13, paddingLeft: 30, paddingRight: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } }}>
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']} locations={[0, 0.42]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 14, backgroundColor: 'rgba(0,0,0,0.13)', borderRightWidth: 1, borderRightColor: p.sep }} />
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, right: 18, width: 9, height: 18, transformOrigin: 'top' } as any, A(drop, 500, 260 + i * 40, EASE.pop)]}>
              <Svg width={9} height={18} viewBox="0 0 9 18"><Path d="M0 0H9V18L4.5 13L0 18Z" fill={dot} /></Svg>
            </Animated.View>
            <Row gap={8} style={{ paddingRight: 22, alignItems: 'baseline' }}>
              <T numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.34 }}>{b.name}</T>
              <T v="tiny" style={{ fontFamily: fonts.bold, fontSize: 11 }}>{b.badge}</T>
            </Row>
            <T v="kicker" numberOfLines={1} style={{ fontSize: 9, letterSpacing: 1.26, marginTop: 2 }}>{b.kind.toUpperCase()} · {b.people === 1 ? 'JUST YOU' : b.people + ' PEOPLE'}{b.pinned ? ' · PINNED' : ''}</T>
            <Row between center={false} style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <Row gap={7} style={{ alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                <T style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 24, letterSpacing: -0.66, fontVariant: ['tabular-nums'] }}>{b.big}</T>
                <T v="tiny" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>{b.label}</T>
              </Row>
              <Row gap={0} style={{ paddingLeft: 6 }}>{b.members.map((a, k) => <View key={a} style={{ marginLeft: k ? -6 : 0 }}><Avatar ini={a} size={22} ring={p.bk} /></View>)}</Row>
            </Row>
            <Row gap={8} style={{ marginTop: 10 }}>
              <View style={{ flex: 1 }}><GrowBar pct={b.pct} color={hexA(p.tx, 0.55)} track={p.sep} h={2} delay={300} /></View>
              <T v="mono" c="mu" style={{ fontSize: 9, lineHeight: 12 }}>{b.pct}%</T>
            </Row>
          </View>
        </View>
      </Press>
    </Animated.View>
  );
});
const BOOK_EASE = cubicBezier(0.2, 0.9, 0.25, 1);
