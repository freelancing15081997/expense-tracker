/**
 * Motion primitives — a direct port of the prototype's CSS keyframes (rise, bump, shake, pop, sheen, glow, bar, grow…)
 * onto Reanimated 4's CSS-animation API, plus gesture-driven pieces (press springs, odometer, count-up).
 * Same curves as the prototype: cubic-bezier(.2,.8,.2,1) for entrances, (.3,1.6,.5,1) for bouncy pops.
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  cubicBezier, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const EASE = {
  out: cubicBezier(0.2, 0.8, 0.2, 1),
  soft: cubicBezier(0.16, 1, 0.3, 1),
  pop: cubicBezier(0.3, 1.6, 0.5, 1),
  spring: cubicBezier(0.2, 0.9, 0.3, 1.3),
  inOut: cubicBezier(0.6, 0, 0.2, 1),
};
export const SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
export const SOFT = { damping: 26, stiffness: 180, mass: 1 };

export function haptic(kind: 'tick' | 'light' | 'medium' | 'success' | 'error' | 'select' = 'light') {
  if (Platform.OS === 'web') { try { if ((navigator as any).userActivation?.hasBeenActive) navigator.vibrate?.(kind === 'error' ? [30, 40, 30] : kind === 'success' ? [10, 40, 20] : 8); } catch { /* noop */ } return; }
  if (kind === 'select' || kind === 'tick') Haptics.selectionAsync();
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

/* ---------- keyframes (prototype names) ---------- */
export const KF = {
  rise: { from: { opacity: 0, transform: [{ translateY: 14 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
  riseBig: { from: { opacity: 0, transform: [{ translateY: 28 }, { scale: 0.98 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
  fade: { from: { opacity: 0 }, to: { opacity: 1 } },
  scrIn: { from: { opacity: 0, transform: [{ translateX: 26 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } },
  slideL: { from: { opacity: 0, transform: [{ translateX: -14 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } },
  tileIn: { from: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.85 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
  pop: { '0%': { opacity: 0, transform: [{ scale: 0.4 }] }, '60%': { opacity: 1, transform: [{ scale: 1.08 }] }, '100%': { opacity: 1, transform: [{ scale: 1 }] } },
  bump: { from: { opacity: 0.4, transform: [{ translateY: 6 }, { scale: 0.92 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
  shake: { '0%': { transform: [{ translateX: 0 }] }, '20%': { transform: [{ translateX: -8 }] }, '40%': { transform: [{ translateX: 8 }] }, '60%': { transform: [{ translateX: -8 }] }, '80%': { transform: [{ translateX: 8 }] }, '100%': { transform: [{ translateX: 0 }] } },
  glow: { '0%': { opacity: 0.55 }, '50%': { opacity: 1 }, '100%': { opacity: 0.55 } },
  float: { '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -6 }] }, '100%': { transform: [{ translateY: 0 }] } },
  sheen: { '0%': { transform: [{ translateX: -140 }, { skewX: '-20deg' }] }, '55%': { transform: [{ translateX: 420 }, { skewX: '-20deg' }] }, '100%': { transform: [{ translateX: 420 }, { skewX: '-20deg' }] } },
  ringOut: { '0%': { opacity: 0.7, transform: [{ scale: 0.62 }] }, '100%': { opacity: 0, transform: [{ scale: 1.3 }] } },
  ringIn: { from: { opacity: 0, transform: [{ scale: 0.35 }, { rotate: '-50deg' }] }, to: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] } },
  toastIn: { from: { opacity: 0, transform: [{ translateY: -14 }, { scale: 0.96 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
  dockUp: { from: { opacity: 0, transform: [{ translateY: 40 }, { scale: 0.96 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
  morph: { from: { opacity: 0, transform: [{ scale: 0.2 }, { translateY: 30 }] }, to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] } },
  shimmer: { '0%': { opacity: 0.45 }, '50%': { opacity: 1 }, '100%': { opacity: 0.45 } },
  spin: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
  caret: { '0%': { opacity: 1 }, '50%': { opacity: 0 }, '100%': { opacity: 1 } },
} as const;

type AnimProps = { delay?: number; duration?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode; pointerEvents?: 'box-none' | 'none' | 'auto' };
const anim = (name: object, duration: number, delay = 0, easing: any = EASE.out, extra: object = {}) =>
  ({ animationName: name, animationDuration: `${duration}ms`, animationDelay: `${delay}ms`, animationTimingFunction: easing, animationFillMode: 'both', ...extra }) as any;

/** Entrance: the prototype's `rise .4s cubic-bezier(.2,.8,.2,1) both` with a stagger delay. */
/** Off-screen spaces pause their decorative loops (sheen, glow, rings) so the GPU only works on what you see. */
export const PlayContext = React.createContext(true);

export function Rise({ delay = 0, duration = 340, style, children, kind = 'rise', pointerEvents }: AnimProps & { kind?: keyof typeof KF }) {
  const reduce = useReducedMotion();
  return <Animated.View pointerEvents={pointerEvents} style={[reduce ? null : anim(KF[kind], duration, delay, kind === 'pop' || kind === 'tileIn' ? EASE.spring : EASE.out), style]}>{children}</Animated.View>;
}
/** Wraps each child in a staggered Rise. */
export function Stagger({ children, step = 50, start = 0, kind }: { children: React.ReactNode; step?: number; start?: number; kind?: keyof typeof KF }) {
  return <>{React.Children.toArray(children).filter(Boolean).map((c, i) => <Rise key={(c as any).key ?? i} delay={start + i * step} kind={kind}>{c}</Rise>)}</>;
}
/** Infinite loops: glow, float, sheen, shimmer, spin, caret, ringOut. */
export function Loop({ name, duration = 1600, delay = 0, style, children, easing = 'ease-in-out', pointerEvents }: AnimProps & { name: keyof typeof KF; easing?: any }) {
  const reduce = useReducedMotion(); const playing = React.useContext(PlayContext);
  return <Animated.View pointerEvents={pointerEvents} style={[reduce ? null : anim(KF[name], duration, delay, easing, { animationIterationCount: 'infinite', animationFillMode: 'none', animationPlayState: playing ? 'running' : 'paused' }), style]}>{children}</Animated.View>;
}
/** Re-runs a one-shot animation every time `trigger` changes (shake on error, bump on digit). */
export function Replay({ trigger, name, duration = 400, style, children, easing }: AnimProps & { trigger: unknown; name: keyof typeof KF; easing?: any }) {
  return <Animated.View key={String(trigger)} style={[trigger ? anim(KF[name], duration, 0, easing ?? EASE.out) : null, style]}>{children}</Animated.View>;
}

/* ---------- Press feedback ---------- */
/** Set by drag gestures (pager, sheets) so the release of a drag never counts as a tap. */
let lastDragAt = 0;
export const markDrag = () => { lastDragAt = Date.now(); };
export const wasDragging = () => Date.now() - lastDragAt < 320;
const APressable = Animated.createAnimatedComponent(Pressable);
/** Every tappable surface: springs to 0.97 on press-in, back on release, with a haptic tick. */
export function Press({ children, style, scaleTo = 0.97, onPress, hapticKind = 'light', disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; hapticKind?: Parameters<typeof haptic>[0] | false; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={e => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 420 }); rest.onPressIn?.(e); }}
      onPressOut={e => { s.value = withSpring(1, { damping: 12, stiffness: 320 }); rest.onPressOut?.(e); }}
      onPress={e => { if (wasDragging()) return; if (hapticKind) haptic(hapticKind); onPress?.(e); }}
      style={[style, a]}
    >{children}</APressable>
  );
}

/* ---------- Numbers ---------- */
/** Rolling digit odometer (prototype `Odo`): each digit column slides to its value, 55 ms stagger. */
export function Odometer({ value, size, color, font, weight, delayBase = 0 }: { value: string; size: number; color: string; font: string; weight?: TextStyle['fontWeight']; delayBase?: number }) {
  const h = Math.round(size * 1.12);
  let di = 0;
  return (
    <View style={{ flexDirection: 'row', height: h, overflow: 'hidden' }}>
      {value.split('').map((ch, i) => /\d/.test(ch)
        ? <OdoDigit key={value.length + '-' + i} d={+ch} h={h} delay={delayBase + (di++) * 55} style={{ fontSize: size, color, fontFamily: font, fontWeight: weight, letterSpacing: -size * 0.04 }} />
        : <Text key={'s' + i} style={{ fontSize: size, lineHeight: h, color, fontFamily: font, letterSpacing: -size * 0.04 }}>{ch}</Text>)}
    </View>
  );
}
function OdoDigit({ d, h, delay, style }: { d: number; h: number; delay: number; style: TextStyle }) {
  const y = useSharedValue(0);
  useEffect(() => { const t = setTimeout(() => { y.value = withTiming(-d * h, { duration: 1200, easing: Easing.bezier(0.16, 1, 0.3, 1) }); }, 40 + delay); return () => clearTimeout(t); }, [d, h, delay, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      <Animated.View style={a}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <Text key={n} style={[style, { height: h, lineHeight: h, fontVariant: ['tabular-nums'] }]}>{n}</Text>)}</Animated.View>
    </View>
  );
}

/** Eased count-up (prototype `CountUp`, 950 ms ease-out-cubic). */
export function useCountUp(to: number, ms = 750) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; let t0 = 0;
    const step = (t: number) => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}
/** Leaf component: only this Text re-renders while counting, never its parent. */
export const CountUp = React.memo(function CountUp({ to, style, prefix = '₹' }: { to: number; style?: StyleProp<TextStyle>; prefix?: string }) {
  const v = useCountUp(to);
  return <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>{prefix}{Math.round(v).toLocaleString('en-IN')}</Text>;
});

/* ---------- Progress that grows in ---------- */
/** Progress that grows in. Animates scaleX (compositor-only, no per-frame layout) like the prototype's `bar` keyframe. */
export const GrowBar = React.memo(function GrowBar({ pct, color, track, h = 4, delay = 300, style }: { pct: number; color: string; track: string; h?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(0);
  useEffect(() => { s.value = 0; s.value = withSequence(withTiming(0, { duration: delay }), withTiming(1, { duration: 800, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); }, [pct, delay, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }] }));
  const w = `${Math.min(100, Math.max(0, pct))}%` as const;
  return <View style={[{ height: h, borderRadius: h, backgroundColor: track, overflow: 'hidden' }, style]}><Animated.View style={[{ height: '100%', width: w, borderRadius: h, backgroundColor: color, transformOrigin: 'left' } as any, a]} /></View>;
});

/** Animated segmented control indicator (prototype bookTabX / flowX). */
export function useSlidingIndex(index: number) {
  const x = useSharedValue(index);
  useEffect(() => { x.value = withSpring(index, { damping: 22, stiffness: 300, mass: 0.7 }); }, [index, x]);
  return x;
}
