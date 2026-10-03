import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootParams = {
  Splash: undefined; Onboarding: undefined; SignIn: undefined; Forgot: undefined; Setup: undefined; Lock: undefined;
  Otp: { requestId?: string; phone?: string; preset?: string } | undefined;
  Spaces: { space?: 'Home' | 'Books' | 'Settle' | 'Insights' | 'Profile'; at?: number; newBook?: boolean } | undefined;
  Book: { id?: string; invite?: boolean; origin?: { cx: number; cy: number } } | undefined; Entry: { id?: string } | undefined;
  AddEntry: { flow?: 'out' | 'in'; amount?: string; editId?: string; bookId?: string } | undefined;
  Split: { amount?: string; entryId?: string; bookId?: string; title?: string } | undefined; Scan: undefined; Voice: undefined; ShareIn: { file?: { uri: string; name: string; type: string } } | undefined;
  Pay: { to?: string; amount?: number; billId?: string } | undefined; Success: { amount: number; app: string; to: string; utr?: string; time?: string; from?: string; paymentId?: string; name?: string } | undefined;
  ScanPay: undefined; Request: undefined; Accounts: { transfer?: boolean } | undefined; Bills: undefined; Activity: undefined;
  Inbox: undefined; Search: undefined; Attention: undefined; Vault: undefined; SmsReview: undefined; Templates: undefined; Recurring: undefined;
  Plans: undefined; Checkout: { plan?: string; cycle?: 'monthly' | 'annual' } | undefined; Help: undefined; Roles: undefined; Admin: undefined; Import: undefined;
  Join: { code?: string; member?: boolean } | undefined; PushPermission: undefined; NotifPrefs: undefined;
  
  Offline: undefined; PayFail: { amount?: number; reason?: string; code?: string } | undefined; ServerError: undefined; ScanFail: undefined; Expired: { code?: string } | undefined; Limit: undefined;
};

export type ScreenProps<K extends keyof RootParams = keyof RootParams> = NativeStackScreenProps<RootParams, K>;
