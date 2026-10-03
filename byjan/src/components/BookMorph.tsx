/**
 * macOS-style window open/close (prototype v2 `macOpen` / `macClose`).
 * Opening a book from the Books list: the detail grows out of the tapped book — it starts at the book's centre,
 * scale 0.14, radius 48 — and expands to full screen in 440 ms with cubic-bezier(.16,1,.3,1) and a soft shadow.
 * Any way of leaving (back button, Android back, swipe, goBack()) is intercepted and plays the reverse into the
 * same book in 300 ms with cubic-bezier(.4,0,.7,.2). Everything runs on the UI thread (transform + opacity only).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../state/AppContext';

export type Origin = { cx: number; cy: number };

/** Measure a view's centre in window coordinates (call on press, pass as the `origin` route param). */
export function measureOrigin(ref: React.RefObject<View | null>, cb: (o: Origin | undefined) => void) {
  const node = ref.current;
  if (!node) return cb(undefined);
  node.measureInWindow((x, y, w, h) => cb(w ? { cx: x + w / 2, cy: y + h / 2 } : undefined));
}

export function BookMorph({ origin, children }: { origin?: Origin; children: React.ReactNode }) {
  const p = useColors();
  const nav = useNavigation<any>();
  const box = useRef<View>(null);
  const pr = useSharedValue(origin ? 0 : 1);
  const dx = useSharedValue(0); const dy = useSharedValue(0);
  const [ready, setReady] = useState(!origin);
  const closing = useRef(false);

  const start = useCallback(() => {
    if (!origin || ready) return;
    box.current?.measureInWindow((x, y, w, h) => {
      dx.value = origin.cx - (x + w / 2); dy.value = origin.cy - (y + h / 2);
      setReady(true);
      pr.value = withTiming(1, { duration: 440, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    });
  }, [origin, ready, dx, dy, pr]);

  useEffect(() => {
    if (!origin) return;
    return nav.addListener('beforeRemove', (e: any) => {
      if (closing.current) return;
      e.preventDefault(); closing.current = true;
      pr.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.4, 0, 0.7, 0.2) }, done => { if (done) runOnJS(nav.dispatch)(e.data.action); });
    });
  }, [nav, origin, pr]);

  const a = useAnimatedStyle(() => {
    const t = pr.value;
    return {
      opacity: Math.min(1, t / 0.35),
      borderRadius: 48 * (1 - t),
      transform: [{ translateX: dx.value * (1 - t) }, { translateY: dy.value * (1 - t) }, { scale: 0.14 + 0.86 * t }],
    };
  });
  if (!origin) return <>{children}</>;
  return (
    <View ref={box} collapsable={false} onLayout={start} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: p.bg, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 30 } }, ready ? a : { opacity: 0 }]}>
        {children}
      </Animated.View>
    </View>
  );
}
