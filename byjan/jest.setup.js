jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView } = require('react-native');
  const pass = (value) => value;
  const Animated = { View, Text, ScrollView, createAnimatedComponent: (Component) => Component };
  return {
    __esModule: true,
    default: Animated,
    Easing: { linear: pass, ease: pass, in: () => pass, out: () => pass, inOut: () => pass, bezier: () => pass },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (fn) => { try { return fn(); } catch { return {}; } },
    useAnimatedReaction: () => {},
    useReducedMotion: () => false,
    withSpring: pass,
    withTiming: pass,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[0],
    interpolate: () => 0,
    runOnJS: (fn) => fn,
    cubicBezier: () => pass,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = new Proxy(function gesture() { return chain; }, { get: () => chain, apply: () => chain });
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children ?? null,
    Gesture: new Proxy({}, { get: () => chain }),
  };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: async () => {},
  notificationAsync: async () => {},
  impactAsync: async () => {},
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
