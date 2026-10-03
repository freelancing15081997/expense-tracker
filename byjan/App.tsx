import React, { useEffect } from 'react';
import { AppState, Platform, Pressable, ScrollView, useWindowDimensions, View, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost } from './src/components/portal';
import { AppProvider, useApp } from './src/state/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastHost } from './src/components/ui';
import type { RootParams } from './src/navigation/types';
import { USE_MOCKS } from './src/api/client';
import { deviceFlags } from './src/native/device';

const linking = {
  prefixes: ['byjan://', 'https://byjan.app', 'https://www.byjan.app'],
  config: { screens: { Join: 'j/:code', ShareIn: 'share' } },
};

export const navRef = createNavigationContainerRef<RootParams>();

function Shell() {
  const { theme, c, user } = useApp();
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  useEffect(() => {
    let hiddenAt = 0;
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background') hiddenAt = Date.now();
      if (st === 'active' && hiddenAt && Date.now() - hiddenAt > 60000 && deviceFlags.lock && user && navRef.isReady()) {
        navRef.reset({ index: 0, routes: [{ name: 'Lock' }] });
      }
    });
    const openShare = (url: string) => {
      const parsed = Linking.parse(url);
      const host = parsed.hostname || parsed.path || '';
      if (host !== 'share' || !navRef.isReady()) return;
      const q = parsed.queryParams || {};
      navRef.navigate('ShareIn', { file: { uri: String(q.uri || 'file://shared.png'), name: String(q.name || 'shared.png'), type: String(q.mime || 'image/png') } });
    };
    Linking.getInitialURL().then(u => { if (u) openShare(u); }).catch(() => {});
    const link = Linking.addEventListener('url', e => openShare(e.url));
    return () => { sub.remove(); link.remove(); };
  }, [user]);
  return (
    <NavigationContainer ref={navRef} linking={linking} theme={{ ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.tx, border: c.sep, primary: c.ac } }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <RootNavigator />
        <PortalHost />
        <ToastHost />
      </View>
    </NavigationContainer>
  );
}

/* ---------- Web-only preview chrome: phone frame + screen index (like the design file) ---------- */
const INDEX: [string, [string, keyof RootParams, object?][]][] = [
  ['ONBOARDING', [['Splash', 'Splash'], ['Welcome slides', 'Onboarding'], ['Sign in', 'SignIn'], ['Email · forgot password', 'Forgot'], ['Verify code', 'Otp'], ['Profile setup', 'Setup'], ['PIN lock', 'Lock']]],
  ['SPACES · SWIPE ← → ANYWHERE', [['Home', 'Spaces', { space: 'Home' }], ['Books', 'Spaces', { space: 'Books' }], ['Settle up', 'Spaces', { space: 'Settle' }], ['Insights', 'Spaces', { space: 'Insights' }], ['You · settings', 'Spaces', { space: 'Profile' }], ['New book (sheet)', 'Spaces', { space: 'Books', newBook: true }]]],
  ['FLOWS', [['Book detail', 'Book'], ['Entry detail', 'Entry'], ['Add entry', 'AddEntry'], ['Split', 'Split'], ['Scan receipt', 'Scan'], ['Voice entry', 'Voice'], ['Pay on UPI', 'Pay'], ['Payment success', 'Success', { amount: 800, app: 'GPay', to: 'meera@okaxis' }], ['Scan & pay', 'ScanPay'], ['Request money', 'Request'], ['Share to Byjan', 'ShareIn']]],
  ['TOOLS', [['Accounts & transfer', 'Accounts'], ['Bills & dues', 'Bills'], ['Activity', 'Activity'], ['Notifications', 'Inbox'], ['Search', 'Search'], ['Needs a look', 'Attention'], ['Documents vault', 'Vault'], ['Bank SMS review', 'SmsReview'], ['Usuals', 'Templates'], ['Recurring', 'Recurring'], ['Push · permission', 'PushPermission'], ['Push · preferences', 'NotifPrefs'], ['Join invite', 'Join'], ['Join · already member', 'Join', { member: true }]]],
  ['BUSINESS & PLANS', [['Import (Excel / Tally)', 'Import'], ['Help & support', 'Help'], ['Plans', 'Plans'], ['Checkout · Cashfree', 'Checkout'], ['Roles & access', 'Roles'], ['Admin console', 'Admin']]],
  ['ERROR STATES', [['No internet', 'Offline'], ['Payment failed', 'PayFail'], ['Server error', 'ServerError'], ['Scan failed', 'ScanFail'], ['Invite expired', 'Expired'], ['Plan limit', 'Limit'], ['Wrong OTP', 'Otp', { preset: '123456' }]]],
];

function WebPreview({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const app = useApp();
  if (width < 760) return <>{children}</>;
  const ph = Math.min(844, height - 40);
  const go = (name: keyof RootParams, params?: object) => {
    if (!navRef.isReady()) return;
    const root = ['Spaces', 'Splash', 'Onboarding', 'SignIn', 'Lock'].includes(name);
    navRef.reset({ index: root ? 0 : 1, routes: root ? [{ name, params } as never] : [{ name: 'Spaces' } as never, { name, params } as never] });
  };
  const mono = { fontFamily: 'JetBrainsMono_500Medium' };
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#07090B', justifyContent: 'center', gap: 48, paddingVertical: 20 }}>
      <View style={{ width: 260, height: ph }}>
        <Text style={[mono, { color: '#5EE6B5', fontSize: 11, letterSpacing: 2 }]}>BYJAN · REACT NATIVE</Text>
        <Text style={{ color: '#F2F5F7', fontFamily: 'Satoshi-Bold', fontSize: 26, marginTop: 8, lineHeight: 30 }}>Every screen, live</Text>
        <Text style={{ color: '#8C95A1', fontFamily: 'Satoshi-Regular', fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          The Expo app running on web. All data comes from placeholder APIs {USE_MOCKS ? '(mock mode)' : ''}. Jump to any screen, or use the app like a phone.
        </Text>
        <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#0E1A16', borderWidth: 1, borderColor: 'rgba(94,230,181,0.18)', gap: 4 }}>
          {[['Drag ← →', 'switch spaces'], ['Tap / swipe ↑ dock', 'Go to'], ['Tap orb', 'quick add'], ['Swipe ↑ orb', 'scan a bill'], ['Drag sheet ↓', 'close'], ['Hold an entry', 'actions']].map(([a, b]) => (
            <Text key={a} style={{ color: '#8C95A1', fontFamily: 'Satoshi-Medium', fontSize: 12 }}><Text style={{ color: '#5EE6B5', fontFamily: 'Satoshi-Bold' }}>{a}</Text>  {b}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {(['dark', 'light'] as const).map(t => (
            <Pressable key={t} onPress={() => app.setTheme(t)} style={{ flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: app.theme === t ? '#F2F5F7' : '#12151A' }}>
              <Text style={{ fontFamily: 'Satoshi-Bold', color: app.theme === t ? '#0A0C0F' : '#8C95A1' }}>{t === 'dark' ? 'Dark' : 'Light'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => app.setFailMode(!app.failMode)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#12151A' }}>
          <Text style={{ color: '#C9CFD6', fontFamily: 'Satoshi-Medium', fontSize: 13 }}>Simulate API failures</Text>
          <View style={{ width: 34, height: 20, borderRadius: 10, padding: 2, backgroundColor: app.failMode ? '#FF8A80' : '#2B3036', alignItems: app.failMode ? 'flex-end' : 'flex-start' }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' }} /></View>
        </Pressable>
        <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
          {INDEX.map(([h, items]) => (
            <View key={h} style={{ marginBottom: 14 }}>
              <Text style={[mono, { color: '#5D6872', fontSize: 10, letterSpacing: 1.6, marginBottom: 4 }]}>{h}</Text>
              {items.map(([label, name, params]) => (
                <Pressable key={label} onPress={() => go(name, params)} style={({ hovered }: any) => ({ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: hovered ? '#1C2026' : 'transparent' })}>
                  <Text style={{ color: '#C9CFD6', fontFamily: 'Satoshi-Medium', fontSize: 13.5 }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={{ width: 390 + 20, height: ph, borderRadius: 54, padding: 10, backgroundColor: '#1A1D21', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 40 }}>
        <View style={{ flex: 1, borderRadius: 44, overflow: 'hidden', transform: [{ translateZ: 0 }] as any, userSelect: 'none' } as any}>
          <SafeAreaInsetsContext.Provider value={{ top: 46, bottom: 14, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 }}>
            <Text style={{ color: app.c.tx, fontFamily: 'Satoshi-Bold', fontSize: 15 }}>9:41</Text>
            <View style={{ position: 'absolute', left: 145, top: 11, width: 100, height: 28, borderRadius: 14, backgroundColor: '#000' }} />
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <View style={{ width: 18, height: 10, borderRadius: 3, borderWidth: 1, borderColor: app.c.tx, padding: 1 }}><View style={{ flex: 1, borderRadius: 1, backgroundColor: app.c.tx }} /></View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const [loaded] = useFonts({
    'Satoshi-Regular': require('./assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('./assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('./assets/fonts/Satoshi-Bold.ttf'),
    'Satoshi-Black': require('./assets/fonts/Satoshi-Black.ttf'),
    JetBrainsMono_500Medium,
  });
  if (!loaded && Platform.OS !== 'web') return null;
  const app = <Shell />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          {Platform.OS === 'web' ? <WebPreview>{app}</WebPreview> : app}
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
