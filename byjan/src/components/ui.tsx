import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp, useColors } from '../state/AppContext';
import { avatarColors, fonts, Palette } from '../theme/tokens';
import { ICONS, IconName } from './icons';
import { EASE, GrowBar, haptic, KF, Loop, markDrag, Press, Replay, Rise, useSlidingIndex, wasDragging } from './motion';
import { Portal } from './portal';

/** Back-compat haptic helper used across screens. */
export const tap = (kind: 'light' | 'medium' | 'error' | 'success' = 'light') => haptic(kind);
export { Rise, Press } from './motion';

/* ---------- Text ---------- */
type TV = 'display' | 'big' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyB' | 'small' | 'smallB' | 'tiny' | 'kicker' | 'mono' | 'amount';
const tv: Record<TV, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 56, letterSpacing: -2.6, lineHeight: 62 },
  big: { fontFamily: fonts.bold, fontSize: 46, letterSpacing: -2, lineHeight: 52 },
  h1: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1, lineHeight: 35 },
  h2: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.6, lineHeight: 27 },
  h3: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.36, lineHeight: 23 },
  title: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.16, lineHeight: 21 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodyB: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.15, lineHeight: 20 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  smallB: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17 },
  tiny: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, lineHeight: 14 },
  mono: { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 17 },
  amount: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2, lineHeight: 20, fontVariant: ['tabular-nums'] },
};
export function T({ v = 'body', c, style, children, numberOfLines, center }: {
  v?: TV; c?: keyof Palette | string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number; center?: boolean;
}) {
  const p = useColors();
  const color = c ? ((p as unknown as Record<string, string>)[c] ?? c) : (v === 'small' || v === 'tiny' || v === 'kicker' ? p.mu : p.tx);
  const own = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const lh = own.fontSize && !own.lineHeight ? { lineHeight: Math.round(own.fontSize * 1.16) } : null;
  return <Text numberOfLines={numberOfLines} style={[tv[v], { color }, center && { textAlign: 'center' }, style, lh]}>{children}</Text>;
}

/* ---------- Icon ---------- */
export function Icon({ name, size = 20, color, weight = 'regular' }: { name: IconName; size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }) {
  const p = useColors();
  const C = ICONS[name];
  return <C size={size} color={color ?? p.tx} weight={weight} />;
}

/* ---------- Layout ---------- */
/** Standard screen. On web it plays the prototype's scrIn (fade + 26px slide) on mount. */
export function Screen({ children, scroll = true, pad = true, footer, style, onScroll, bg, overlay, glow, enter = true }: {
  children: React.ReactNode; scroll?: boolean; pad?: boolean; footer?: React.ReactNode; style?: StyleProp<ViewStyle>;
  onScroll?: (y: number) => void; bg?: string; overlay?: React.ReactNode; glow?: boolean; enter?: boolean;
}) {
  const p = useColors(); const ins = useSafeAreaInsets();
  const inner = [pad && { paddingHorizontal: 20 }, { paddingTop: ins.top + 8 }, style];
  return (
    <Animated.View style={[{ flex: 1, backgroundColor: bg ?? p.bg }, enter && Platform.OS === 'web' ? { animationName: KF.scrIn, animationDuration: '280ms', animationTimingFunction: EASE.out, animationFillMode: 'both' } as any : null]}>
      {glow ? <RadialGlow color={p.ac} /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingBottom: footer ? 130 : ins.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={onScroll ? e => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        >{children}</ScrollView>
      ) : <View style={[{ flex: 1 }, inner]}>{children}</View>}
      {footer ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <LinearGradient pointerEvents="none" colors={[hexA(bg ?? p.bg, 0), bg ?? p.bg]} locations={[0, 0.45]} style={{ position: 'absolute', left: 0, right: 0, top: -30, bottom: 0 }} />
          <Rise delay={120} kind="riseBig" style={{ paddingHorizontal: 20, paddingBottom: ins.bottom + 14, paddingTop: 10 }}>{footer}</Rise>
        </View>
      ) : null}
      {overlay}
    </Animated.View>
  );
}
/** `#RRGGBB` → rgba with alpha. */
export const hexA = (hex: string, a: number) => {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
/** Soft radial glow at the top of a screen (prototype `--gl`). */
export function RadialGlow({ color, top = -160, size = 520, opacity = 0.16 }: { color: string; top?: number; size?: number; opacity?: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: '50%', marginLeft: -size / 2, width: size, height: size, borderRadius: size / 2, overflow: 'hidden', opacity }}>
      <LinearGradient colors={[color, hexA(color.startsWith('#') ? color : '#5EE6B5', 0)]} start={{ x: 0.5, y: 0.5 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, borderRadius: size / 2 }} />
    </View>
  );
}

export function Row({ children, style, gap = 10, between, center = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; between?: boolean; center?: boolean }) {
  return <View style={[{ flexDirection: 'row', gap }, center && { alignItems: 'center' }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}
export const Gap = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />;

/** Surface card. Hairline inner ring like the prototype (`--sh2`), springs when tappable. */
export function Card({ children, style, onPress, edge, flat }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; edge?: string; flat?: boolean }) {
  const p = useColors();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: p.s1, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: edge ?? (flat ? 'transparent' : p.sep) }, style];
  return onPress ? <Press onPress={onPress} scaleTo={0.985} style={s}>{children}</Press> : <View style={s}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = useColors();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: p.sep }, style]} />;
}

/* ---------- Header ---------- */
export function CircleBtn({ icon, onPress, bg, color, size = 40, label }: { icon: IconName; onPress?: () => void; bg?: string; color?: string; size?: number; label?: string }) {
  const p = useColors();
  return (
    <Press hitSlop={8} accessibilityLabel={label ?? icon} onPress={onPress} scaleTo={0.9} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? p.s1, borderWidth: 1, borderColor: bg ? 'transparent' : p.sep, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={color} />
    </Press>
  );
}

export function Header({ title, right, onBack, center, sub }: { title?: string; right?: React.ReactNode; onBack?: () => void; center?: boolean; sub?: string }) {
  const nav = useNavigation();
  const back = onBack ?? (() => (nav.canGoBack() ? nav.goBack() : (nav as any).navigate('Spaces')));
  return (
    <Row between style={{ marginBottom: 20, minHeight: 40 }}>
      <Row gap={12} style={{ flex: 1 }}>
        <CircleBtn icon="back" onPress={back} label="Back" />
        {!center && title ? <View style={{ flex: 1 }}><T v="h3" numberOfLines={1}>{title}</T>{sub ? <T v="tiny">{sub}</T> : null}</View> : null}
      </Row>
      {center && title ? <View pointerEvents="none" style={{ position: 'absolute', left: 52, right: 52, alignItems: 'center' }}><T v="title" numberOfLines={1}>{title}</T>{sub ? <T v="tiny">{sub}</T> : null}</View> : null}
      <View>{right}</View>
    </Row>
  );
}

/* ---------- Buttons ---------- */
export function Button({ label, onPress, kind = 'primary', busy, disabled, icon, style, small }: {
  label: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'; busy?: boolean; disabled?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const p = useColors();
  const bg = { primary: p.pb, secondary: p.s1, accent: p.ac, danger: p.ne, ghost: 'transparent' }[kind];
  const fg = { primary: p.pf, secondary: p.tx, accent: p.ai, danger: '#fff', ghost: p.tx }[kind];
  return (
    <Press
      disabled={disabled || busy}
      hapticKind="medium"
      onPress={onPress}
      scaleTo={0.97}
      style={[{ height: small ? 38 : 56, borderRadius: small ? 19 : 18, backgroundColor: bg, borderWidth: kind === 'secondary' ? 1 : 0, borderColor: p.sep, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: small ? 14 : 18, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {busy ? <Loop name="spin" duration={800} easing="linear"><Icon name="refresh" size={18} color={fg} weight="bold" /></Loop> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} weight="bold" /> : null}
      <T v={small ? 'smallB' : 'title'} c={fg}>{label}</T>
    </Press>
  );
}

export function LinkText({ label, onPress, c = 'ac' }: { label: string; onPress: () => void; c?: string }) {
  return <Press hitSlop={10} onPress={onPress} scaleTo={0.94}><T v="smallB" c={c}>{label}</T></Press>;
}

/* ---------- Chips & segmented ---------- */
export function Chip({ label, on, onPress, count, dot, icon }: { label: string; on?: boolean; onPress?: () => void; count?: number; dot?: string; icon?: IconName }) {
  const p = useColors();
  return (
    <Press onPress={onPress} hapticKind="select" scaleTo={0.94}
      style={[{ height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: on ? p.pb : p.s1, borderWidth: 1, borderColor: on ? p.pb : p.ci2, flexDirection: 'row', alignItems: 'center', gap: 6 },
        { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 180 } as any]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
      {icon ? <Icon name={icon} size={15} color={on ? p.pf : p.tx} /> : null}
      <T v="smallB" c={on ? p.pf : p.tx}>{label}</T>
      {count !== undefined ? <T v="tiny" c={on ? p.pf : p.mu} style={{ opacity: 0.7, fontFamily: fonts.mono }}>{count}</T> : null}
    </Press>
  );
}
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -20, flexGrow: 0 }, style]} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>{children}</ScrollView>;
}

/** Segmented control with a spring-driven sliding pill (prototype bookTabX). */
export function Segmented({ options, value, onChange, style, track }: { options: string[]; value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle>; track?: string }) {
  const p = useColors(); const [w, setW] = useState(0);
  const idx = Math.max(0, options.indexOf(value)); const x = useSlidingIndex(idx);
  const seg = (w - 8) / options.length;
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * seg }] }));
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', backgroundColor: track ?? p.s1, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: p.sep }, style]}>
      {w ? <Animated.View style={[{ position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: 12, backgroundColor: p.s2, borderWidth: 1, borderColor: p.ci2 }, a]} /> : null}
      {options.map(o => (
        <Pressable key={o} onPress={() => { if (wasDragging()) return; haptic('select'); onChange(o); }} style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' }}>
          <T v="smallB" c={value === o ? p.tx : p.mu}>{o}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** Toggle with a springy thumb and colour transition. */
export function Toggle({ on, onPress, disabled }: { on: boolean; onPress: () => void; disabled?: boolean }) {
  const p = useColors();
  const x = useSharedValue(on ? 1 : 0);
  useEffect(() => { x.value = withSpring(on ? 1 : 0, { damping: 16, stiffness: 320, mass: 0.6 }); }, [on, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 18 }, { scaleX: 1 + 0.18 * Math.sin(x.value * Math.PI) }] }));
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => { if (wasDragging()) return; haptic('select'); onPress(); }}
      style={[{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? p.ac : p.s2, borderWidth: 1, borderColor: on ? 'transparent' : p.ci2, justifyContent: 'center', opacity: disabled ? 0.55 : 1 }, { transitionProperty: 'backgroundColor', transitionDuration: 200 } as any]}>
      <Animated.View style={[{ width: 20, height: 20, borderRadius: 10, backgroundColor: on ? p.ai : p.mu }, thumb]} />
    </Pressable>
  );
}

/* ---------- Avatars ---------- */
export function Avatar({ ini, size = 36, bg, fg, ring }: { ini: string; size?: number; bg?: string; fg?: string; ring?: string }) {
  const [b, f] = avatarColors[ini] ?? ['#E8E0FF', '#2A1F55'];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? b, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring }}>
      <T v="smallB" c={fg ?? f} style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.42) }}>{ini}</T>
    </View>
  );
}
export function AvatarStack({ list, size = 26, ring }: { list: string[]; size?: number; ring: string }) {
  return <Row gap={0}>{list.map((a, i) => <View key={a} style={{ marginLeft: i ? -7 : 0, zIndex: list.length - i }}><Avatar ini={a} size={size} ring={ring} /></View>)}</Row>;
}
export function IconTile({ icon, size = 42, bg, color, radius = 14, ring }: { icon: IconName; size?: number; bg?: string; color?: string; radius?: number; ring?: boolean }) {
  const p = useColors();
  return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg ?? p.s2, borderWidth: ring ? 1 : 0, borderColor: p.ci2, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={Math.round(size * 0.46)} color={color} /></View>;
}
export function Mono({ ch, bg, fg, size = 40 }: { ch: string; bg: string; fg: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><T v="smallB" c={fg}>{ch}</T></View>;
}

/* ---------- Progress & pills ---------- */
export function Progress({ pct, color, track, h = 4, delay }: { pct: number; color?: string; track?: string; h?: number; delay?: number }) {
  const p = useColors();
  return <GrowBar pct={pct} color={color ?? p.ac} track={track ?? p.s2} h={h} delay={delay} />;
}
export function Pill({ label, color, bg, dot = true, pulse }: { label: string; color: string; bg: string; dot?: boolean; pulse?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {dot ? (pulse ? <Loop name="glow"><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /></Loop> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />) : null}
      <T v="tiny" c={color} style={{ fontFamily: fonts.bold, fontSize: 11 }}>{label}</T>
    </View>
  );
}

/* ---------- Inputs ---------- */
export function Input({ error, hint, hintColor, left, right, style, inputStyle, ...rest }: TextInputProps & { error?: string; hint?: string; hintColor?: string; left?: React.ReactNode; right?: React.ReactNode; inputStyle?: TextStyle }) {
  const p = useColors(); const [focus, setFocus] = useState(false);
  return (
    <View>
      <Replay trigger={error || ''} name="shake" duration={400}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.s1, borderRadius: 16, paddingHorizontal: 16, minHeight: 52, borderWidth: 1.5, borderColor: error ? p.ne : focus ? p.ac : p.sep },
          { transitionProperty: 'borderColor', transitionDuration: 180 } as any, style as ViewStyle]}>
          {left}
          <TextInput placeholderTextColor={p.mu} onFocus={e => { setFocus(true); rest.onFocus?.(e); }} onBlur={e => { setFocus(false); rest.onBlur?.(e); }}
            style={[{ flex: 1, color: p.tx, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 14, outlineStyle: 'none' } as unknown as TextStyle, inputStyle]} {...rest} />
          {right}
        </View>
      </Replay>
      {error || hint ? <Rise key={error || hint} duration={260}><T v="tiny" c={error ? p.ne : hintColor ?? p.mu} style={{ marginTop: 6, marginLeft: 4 }}>{error || hint}</T></Rise> : null}
    </View>
  );
}
export function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <Row between style={{ marginBottom: 10, marginTop: 22 }}><T v="kicker">{typeof children === 'string' ? children.toUpperCase() : children}</T>{right}</Row>;
}

/* ---------- Keypad ---------- */
function Key({ k, round, onKey }: { k: string; round?: boolean; onKey: (k: string) => void }) {
  const p = useColors(); const s = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 - s.value * 0.08 }], backgroundColor: round ? p.s1 : `rgba(127,127,127,${s.value * 0.14})` }));
  return (
    <Pressable onPressIn={() => { s.value = withTiming(1, { duration: 60 }); }} onPressOut={() => { s.value = withSpring(0, { damping: 14, stiffness: 300 }); }}
      onPress={() => { if (wasDragging()) return; haptic('tick'); onKey(k); }} accessibilityLabel={k === 'del' ? 'Delete' : k === 'bio' ? 'Use fingerprint' : k}>
      <Animated.View style={[{ width: round ? 70 : 96, height: round ? 70 : 54, borderRadius: round ? 35 : 16, alignItems: 'center', justifyContent: 'center', borderWidth: round && k.length === 1 ? 1 : 0, borderColor: p.sep }, round && k.length !== 1 ? { backgroundColor: 'transparent' } : null, a]}>
        {k === 'del' ? <Icon name="backspace" size={24} /> : k === 'bio' ? <Icon name="fingerprint" size={30} color={p.ac} /> : <T style={{ fontFamily: fonts.medium, fontSize: 26, lineHeight: 30 }} c={k === '.' ? 'mu' : 'tx'}>{k}</T>}
      </Animated.View>
    </Pressable>
  );
}
export function Keypad({ onKey, keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'], round, style }: { onKey: (k: string) => void; keys?: string[]; round?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', rowGap: round ? 14 : 2 }, style]}>
      {keys.map((k, i) => <View key={i} style={{ width: '33.33%', alignItems: 'center' }}>{k === '' ? <View style={{ height: round ? 70 : 54 }} /> : <Key k={k} round={round} onKey={onKey} />}</View>)}
    </View>
  );
}

/* ---------- List rows ---------- */
export function ListRow({ left, title, sub, right, onPress, border = true, subColor }: { left?: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; border?: boolean; subColor?: string }) {
  const p = useColors();
  const body = (
    <Row gap={12} style={{ paddingVertical: 13, borderTopWidth: border ? StyleSheet.hairlineWidth : 0, borderColor: p.sep }}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}><T v="bodyB" numberOfLines={1}>{title}</T>{sub ? <T v="small" c={subColor} numberOfLines={2}>{sub}</T> : null}</View>
      {right}
    </Row>
  );
  return onPress ? <Press onPress={onPress} scaleTo={0.985}>{body}</Press> : body;
}

/* ---------- Bottom sheet: springs up, follows your finger down, flick to dismiss ---------- */
export function Sheet({ open, onClose, children, title, sub }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string; sub?: string }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  if (!mounted) return null;
  return <Portal><SheetBody open={open} onClose={onClose} onGone={() => setMounted(false)} title={title} sub={sub}>{children}</SheetBody></Portal>;
}
function SheetBody({ open, onClose, onGone, children, title, sub }: { open: boolean; onClose: () => void; onGone: () => void; children: React.ReactNode; title?: string; sub?: string }) {
  const p = useColors(); const ins = useSafeAreaInsets();
  const y = useSharedValue(700); const h = useSharedValue(600);
  useEffect(() => {
    if (open) y.value = withSpring(0, { damping: 28, stiffness: 340, mass: 0.8 });
    else y.value = withTiming(h.value + 40, { duration: 200, easing: Easing.in(Easing.cubic) }, f => { if (f) runOnJS(onGone)(); });
  }, [open, y, h, onGone]);
  const pan = Gesture.Pan().activeOffsetY(6).failOffsetX([-20, 20])
    .onStart(() => runOnJS(markDrag)()).onChange(e => { y.value = Math.max(e.translationY > 0 ? e.translationY : e.translationY * 0.15, -30); })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 600) { runOnJS(onClose)(); }
      else y.value = withSpring(0, { damping: 20, stiffness: 260 });
    });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, h.value], [1, 0], 'clamp') }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }, scrim]}><Pressable style={{ flex: 1 }} onPress={onClose} /></Animated.View>
      <Animated.View onLayout={e => { h.value = e.nativeEvent.layout.height; }} style={[{ position: 'absolute', left: 10, right: 10, bottom: 10, maxHeight: '88%', backgroundColor: p.s1, borderRadius: 32, borderWidth: 1, borderColor: p.ci2, paddingHorizontal: 20, paddingBottom: ins.bottom + 16, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } }, sheet]}>
        <GestureDetector gesture={pan}>
          <View style={{ paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: p.mu, opacity: 0.35, marginBottom: 14 }} />
            {title ? <T v="h2">{title}</T> : null}
            {sub ? <T v="small" style={{ marginTop: 4 }}>{sub}</T> : null}
          </View>
        </GestureDetector>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </Animated.View>
    </View>
  );
}

/* ---------- Loading / error ---------- */
export function Loading({ h = 200 }: { h?: number }) {
  return <View style={{ height: h, gap: 10, justifyContent: 'center' }}>{[0.9, 0.7, 0.8].map((w, i) => <Skeleton key={i} h={54} w={`${w * 100}%` as `${number}%`} r={16} />)}</View>;
}
export function Skeleton({ h = 16, w = '100%', r = 8, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const p = useColors();
  return <Loop name="shimmer" duration={1400} style={[{ height: h, width: w, borderRadius: r, backgroundColor: p.sk }, style]} />;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Rise><Card style={{ alignItems: 'center', gap: 10, marginVertical: 12, paddingVertical: 22 }}>
      <Icon name="cloudWarning" size={28} />
      <T v="bodyB" center>{message}</T>
      <Button small kind="secondary" label="Try again" icon="refresh" onPress={onRetry} />
    </Card></Rise>
  );
}

/* ---------- Toast: drops in, swipe up to dismiss, drains like the prototype ---------- */
export function ToastHost() {
  const { toast, hideToast, c: p } = useApp(); const ins = useSafeAreaInsets();
  const y = useSharedValue(0);
  useEffect(() => { y.value = 0; }, [toast?.key, y]);
  const pan = Gesture.Pan().onChange(e => { y.value = Math.min(0, e.translationY); }).onEnd(e => {
    if (e.translationY < -24 || e.velocityY < -300) { y.value = withTiming(-140, { duration: 180 }, () => runOnJS(hideToast)()); }
    else y.value = withSpring(0);
  });
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: interpolate(y.value, [-90, 0], [0, 1], 'clamp') }));
  if (!toast) return null;
  const isErr = /n't|fail|Only|Enter|Pick|Add at|Write|Type|exist|expired|required|capped|offline/i.test(toast.msg);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 6, left: 12, right: 12, zIndex: 100 }}>
      <GestureDetector gesture={pan}>
        <Animated.View key={toast.key} style={[a, { animationName: KF.toastIn, animationDuration: '380ms', animationTimingFunction: EASE.spring } as any]}>
          <View style={{ backgroundColor: p.pb, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
            <Row style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: isErr ? p.ne : p.ac, alignItems: 'center', justifyContent: 'center' }}><Icon name={isErr ? 'x' : 'check'} size={14} color={isErr ? '#fff' : '#04140E'} weight="bold" /></View>
              <T v="smallB" c={p.pf} style={{ flex: 1 }}>{toast.msg}</T>
              {toast.undo ? <Press onPress={() => { toast.undo?.(); hideToast(); }} style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: hexA(p.pf, 0.08), justifyContent: 'center' }}><T v="smallB" c={p.pf}>Undo</T></Press> : null}
            </Row>
            <Animated.View style={[{ height: 3, backgroundColor: isErr ? p.ne : p.ac, transformOrigin: 'left' } as any, { animationName: { from: { transform: [{ scaleX: 1 }] }, to: { transform: [{ scaleX: 0 }] } }, animationDuration: '2800ms', animationTimingFunction: 'linear', animationFillMode: 'both' } as any]} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ---------- Error/empty state page ---------- */
export function StatePage({ icon, ring, title, body, children, primary, secondary, help = true }: {
  icon: IconName; ring: string; title: string; body: string; children?: React.ReactNode;
  primary: { label: string; onPress: () => void; busy?: boolean }; secondary?: { label: string; onPress: () => void }; help?: boolean;
}) {
  const p = useColors(); const nav = useNavigation<any>();
  return (
    <Screen footer={<View style={{ gap: 10 }}><Button {...primary} />{secondary ? <Button kind="secondary" {...secondary} /> : null}</View>}>
      <Header right={help ? <Button small kind="secondary" icon="lifebuoy" label="Get help" onPress={() => nav.navigate('Help')} /> : undefined} />
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <Loop name="ringOut" duration={2400} easing={EASE.out} pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, borderColor: ring }} />
          <Loop name="ringOut" duration={2400} delay={1200} easing={EASE.out} pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, borderColor: ring }} />
          <Rise kind="pop" duration={600}>
            <View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 1.5, borderColor: ring, backgroundColor: p.s1, alignItems: 'center', justifyContent: 'center' }}>
              <Loop name="float" duration={3200}><Icon name={icon} size={40} color={ring} /></Loop>
            </View>
          </Rise>
        </View>
        <Rise delay={120}><T v="h2" center style={{ marginTop: 18 }}>{title}</T></Rise>
        <Rise delay={180}><T v="small" center style={{ marginTop: 8, paddingHorizontal: 10 }}>{body}</T></Rise>
      </View>
      <Gap h={22} />
      <Rise delay={240}>{children}</Rise>
    </Screen>
  );
}

export function KV({ k, v, vc, border = true, mono }: { k: string; v: string; vc?: string; border?: boolean; mono?: boolean }) {
  const p = useColors();
  return (
    <Row between style={{ paddingVertical: 12, borderTopWidth: border ? StyleSheet.hairlineWidth : 0, borderColor: p.sep }}>
      <T v="small">{k}</T><T v={mono ? 'mono' : 'smallB'} c={vc} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

/** Amount with the paise subdued, fintech style: ₹48,210.40 */
export function Money({ value, size = 15, color, sign, dim }: { value: number; size?: number; color?: string; sign?: boolean; dim?: boolean }) {
  const p = useColors();
  const neg = value < 0; const abs = Math.abs(value);
  const [i, d] = abs.toFixed(2).split('.');
  const c = color ?? p.tx;
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: -size * 0.02, color: c, fontVariant: ['tabular-nums'] }}>
      {sign ? (neg ? '−' : '+') : neg ? '−' : ''}₹{Number(i).toLocaleString('en-IN')}{dim && d !== '00' ? <Text style={{ color: p.mu, fontSize: size * 0.72 }}>.{d}</Text> : null}
    </Text>
  );
}
