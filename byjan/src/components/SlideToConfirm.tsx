/** Slide-to-pay (prototype Scan & pay knob). Drag the knob ≥ 80% across to confirm; it springs back otherwise. */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../state/AppContext';
import { fonts } from '../theme/tokens';
import { Icon, T } from './ui';
import { haptic, Loop, markDrag } from './motion';

export function SlideToConfirm({ label, busyLabel = 'Paying…', busy, disabled, onConfirm, onBlocked }: { label: string; busyLabel?: string; busy?: boolean; disabled?: boolean; onConfirm: () => void; onBlocked?: () => void }) {
  const p = useColors();
  const [w, setW] = useState(0);
  const K = 52; const max = Math.max(1, w - K - 8);
  const x = useSharedValue(0);
  const fire = () => { haptic('success'); onConfirm(); };
  const pan = Gesture.Pan().enabled(!busy)
    .onStart(() => runOnJS(markDrag)())
    .onChange(e => { if (disabled) return; x.value = Math.min(max, Math.max(0, e.translationX)); })
    .onEnd(() => {
      if (disabled) { runOnJS(onBlocked ?? (() => {}))(); return; }
      if (x.value > max * 0.8) { x.value = withTiming(max, { duration: 120 }); runOnJS(fire)(); }
      else x.value = withSpring(0, { damping: 16, stiffness: 260 });
    });
  const tap = Gesture.Tap().onEnd(() => { if (disabled) runOnJS(onBlocked ?? (() => {}))(); else runOnJS(haptic)('light'); });
  React.useEffect(() => { if (!busy) x.value = withSpring(0, { damping: 18, stiffness: 220 }); }, [busy, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${interpolate(x.value, [0, max], [0, 360])}deg` }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value + K + 4 }));
  const text = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.6], [1, 0], 'clamp') }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: 60, borderRadius: 30, backgroundColor: p.s1, borderWidth: 1, borderColor: p.ci2, justifyContent: 'center', overflow: 'hidden', opacity: disabled ? 0.7 : 1 }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 30, overflow: 'hidden' }, fill]}>
          <LinearGradient colors={[p.act, p.ac]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }, text]}>
          <T style={{ fontFamily: fonts.bold, fontSize: 16 }}>{busy ? busyLabel : label}</T>
          {!busy && !disabled ? <Loop name="float" duration={1400}><Icon name="arrowRight" size={16} color={p.mu} weight="bold" /></Loop> : null}
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 4, width: K, height: K, borderRadius: K / 2, shadowColor: p.ac, shadowOpacity: 0.5, shadowRadius: 12 }, knob]}>
          <LinearGradient colors={p.fab as [string, string, string]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.85, y: 1 }} style={{ width: K, height: K, borderRadius: K / 2, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <Loop name="spin" duration={800} easing="linear"><Icon name="refresh" size={20} color="#04140E" weight="bold" /></Loop> : <Icon name="arrowRight" size={22} color="#04140E" weight="bold" />}
          </LinearGradient>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
