import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootParams } from './types';
import * as A from '../screens/auth';
import { SpacesScreen } from '../screens/SpacesScreen';
import * as B from '../screens/book';
import * as C from '../screens/capture';
import * as P from '../screens/pay';
import * as TL from '../screens/tools';
import * as BZ from '../screens/business';
import * as E from '../screens/errors';
import { useColors } from '../state/AppContext';

const Stack = createNativeStackNavigator<RootParams>();

export function RootNavigator({ initial = 'Splash' }: { initial?: keyof RootParams }) {
  const p = useColors();
  return (
    <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'slide_from_right', animationDuration: 280, fullScreenGestureEnabled: true }}>
      {/* Onboarding & auth */}
      <Stack.Screen name="Splash" component={A.SplashScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Onboarding" component={A.OnboardingScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="SignIn" component={A.SignInScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Otp" component={A.OtpScreen} />
      <Stack.Screen name="Forgot" component={A.ForgotScreen} />
      <Stack.Screen name="Setup" component={A.SetupScreen} />
      <Stack.Screen name="Lock" component={A.LockScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Join" component={A.JoinScreen} />
      <Stack.Screen name="PushPermission" component={A.PushPermissionScreen} />
      {/* Spaces: one gesture-driven pager (Home, Books, Settle, Insights, You) */}
      <Stack.Screen name="Spaces" component={SpacesScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      {/* Flows */}
      <Stack.Screen name="Book" component={B.BookScreen} options={({ route }) => (route.params?.origin
        ? { presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } } // macOS-style open from the Books list; list stays underneath
        : { animation: 'slide_from_right' })} />
      <Stack.Screen name="Entry" component={B.EntryScreen} />
      <Stack.Screen name="AddEntry" component={C.AddEntryScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Split" component={C.SplitScreen} />
      <Stack.Screen name="Scan" component={C.ScanScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Voice" component={C.VoiceScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ShareIn" component={C.ShareInScreen} />
      <Stack.Screen name="Pay" component={P.PayScreen} />
      <Stack.Screen name="Success" component={P.SuccessScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="ScanPay" component={P.ScanPayScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Request" component={P.RequestScreen} />
      {/* Tools */}
      <Stack.Screen name="Accounts" component={TL.AccountsScreen} />
      <Stack.Screen name="Bills" component={TL.BillsScreen} />
      <Stack.Screen name="Activity" component={TL.ActivityScreen} />
      <Stack.Screen name="Inbox" component={TL.InboxScreen} />
      <Stack.Screen name="Search" component={TL.SearchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Attention" component={TL.AttentionScreen} />
      <Stack.Screen name="Vault" component={TL.VaultScreen} />
      <Stack.Screen name="SmsReview" component={TL.SmsReviewScreen} />
      <Stack.Screen name="Templates" component={TL.TemplatesScreen} />
      <Stack.Screen name="Recurring" component={TL.RecurringScreen} />
      <Stack.Screen name="NotifPrefs" component={TL.NotifPrefsScreen} />
      {/* Business & plans */}
      <Stack.Screen name="Plans" component={BZ.PlansScreen} />
      <Stack.Screen name="Checkout" component={BZ.CheckoutScreen} />
      <Stack.Screen name="Help" component={BZ.HelpScreen} />
      <Stack.Screen name="Roles" component={BZ.RolesScreen} />
      <Stack.Screen name="Admin" component={BZ.AdminScreen} />
      <Stack.Screen name="Import" component={BZ.ImportScreen} />
      {/* Error states */}
      <Stack.Screen name="Offline" component={E.OfflineScreen} />
      <Stack.Screen name="PayFail" component={E.PayFailScreen} />
      <Stack.Screen name="ServerError" component={E.ServerErrorScreen} />
      <Stack.Screen name="ScanFail" component={E.ScanFailScreen} />
      <Stack.Screen name="Expired" component={E.ExpiredScreen} />
      <Stack.Screen name="Limit" component={E.LimitScreen} />
    </Stack.Navigator>
  );
}
