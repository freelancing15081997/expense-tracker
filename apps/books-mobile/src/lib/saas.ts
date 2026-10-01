import { apiPost } from './api';
import type { FeatureMap } from './features';

/** Metered "smart" features + team limits. -1 = unlimited (fair use). All values are owner-editable every month. */
export type MeterKey = 'receipt_scans' | 'voice_entries' | 'smart_search' | 'email_captures' | 'ai_insights' | 'books' | 'members_per_book' | 'storage_mb';
export const METERS: Array<{ key: MeterKey; label: string; unit: string; monthly: boolean; feature?: string }> = [
  { key: 'receipt_scans', label: 'Receipt scans & shares', unit: 'scans', monthly: true, feature: 'money_scan' },
  { key: 'voice_entries', label: 'Voice entries', unit: 'entries', monthly: true, feature: 'money_voice' },
  { key: 'smart_search', label: 'Smart search', unit: 'searches', monthly: true, feature: 'money_search' },
  { key: 'email_captures', label: 'Email-in bills', unit: 'emails', monthly: true, feature: 'money_email_mailbox' },
  { key: 'ai_insights', label: 'Smart insights', unit: 'reports', monthly: true, feature: 'money_ai_insights' },
  { key: 'books', label: 'Money books', unit: 'books', monthly: false, feature: 'money_create_book' },
  { key: 'members_per_book', label: 'Members per book', unit: 'people', monthly: false, feature: 'money_people' },
  { key: 'storage_mb', label: 'Receipt storage', unit: 'MB', monthly: false },
];
export const meterLabel = (k: MeterKey) => METERS.find((m) => m.key === k)?.label || k;

export type Cycle = 'monthly' | 'annual';
export type Plan = {
  id: string; name: string; tagline: string; badge?: string; sort: number; visible: boolean; archived?: boolean;
  priceMonthlyPaise: number; priceAnnualPaise: number;
  perSeat: boolean; includedSeats: number; maxSeats: number; seatPriceMonthlyPaise: number; seatPriceAnnualPaise: number;
  trialDays: number; limits: Record<MeterKey, number>; features: FeatureMap; highlights: string[];
};
export type AddOn = { id: string; name: string; meter: MeterKey; quantity: number; pricePaise: number; recurring: boolean; visible: boolean };
export type Offer = {
  id: string; code: string; title: string; description: string; kind: 'percent' | 'flat' | 'extra_days' | 'extra_quota';
  value: number; meter?: MeterKey; planIds: string[]; cycles: Cycle[]; startsAt: string; endsAt: string;
  maxRedemptions: number; perUserLimit: number; firstPaymentOnly: boolean; autoApply: boolean; active: boolean; redemptions?: number;
};
export type SubStatus = 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type Subscription = {
  planId: string; status: SubStatus; cycle: Cycle; seats: number; addons: Array<{ id: string; qty: number }>;
  currentPeriodStart?: string; currentPeriodEnd?: string; trialEndsAt?: string; cancelAtPeriodEnd?: boolean;
  nextAmountPaise?: number; billing?: { name?: string; gstin?: string; state?: string; address?: string; email?: string };
};
export type MeterUsage = { used: number; limit: number; extra: number };
export type Usage = { periodStart: string; periodEnd: string; meters: Record<MeterKey, MeterUsage> };
export type Invoice = { id: string; number: string; date: string; subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number; status: 'paid' | 'refunded' | 'failed' | 'pending'; pdfPath?: string; lines: Array<{ label: string; amountPaise: number }> };
export type Quote = { lines: Array<{ label: string; amountPaise: number }>; subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number; offer?: Offer | null; couponError?: string; prorationNote?: string };
export type CheckoutInput = { kind: 'plan' | 'addon' | 'renewal'; planId?: string; cycle?: Cycle; seats?: number; addons?: Array<{ id: string; qty: number }>; coupon?: string; billing?: Subscription['billing'] };

// ---- Customer side (/api/saas) ----
export const getCatalog = () => apiPost<{ plans: Plan[]; addons: AddOn[]; offers: Offer[]; gstRate: number; currency: string }>('/api/saas', { op: 'catalog' });
export const getMySaas = () => apiPost<{ subscription: Subscription; plan: Plan; usage: Usage; offers: Offer[] }>('/api/saas', { op: 'me' });
export const quote = (input: CheckoutInput) => apiPost<{ quote: Quote }>('/api/saas', { op: 'quote', ...input });
export const createOrder = (input: CheckoutInput) => apiPost<{ orderId: string; paymentSessionId: string; mode: 'sandbox' | 'production'; quote: Quote; free?: boolean }>('/api/saas', { op: 'createOrder', ...input });
export const verifyOrder = (orderId: string) => apiPost<{ status: 'PAID' | 'ACTIVE' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'USER_DROPPED'; subscription?: Subscription; invoice?: Invoice; message?: string }>('/api/saas', { op: 'verifyOrder', orderId });
export const startTrial = (planId: string) => apiPost<{ subscription: Subscription }>('/api/saas', { op: 'startTrial', planId });
export const cancelSubscription = (reason: string) => apiPost<{ subscription: Subscription }>('/api/saas', { op: 'cancel', atPeriodEnd: true, reason });
export const resumeSubscription = () => apiPost<{ subscription: Subscription }>('/api/saas', { op: 'resume' });
export const changeSeats = (seats: number) => apiPost<{ quote: Quote; orderId?: string; paymentSessionId?: string; subscription?: Subscription }>('/api/saas', { op: 'changeSeats', seats });
export const listInvoices = async () => (await apiPost<{ invoices?: Invoice[] }>('/api/saas', { op: 'listInvoices' })).invoices || [];
export const invoicePdfUrl = (id: string) => apiPost<{ url: string }>('/api/saas', { op: 'invoicePdf', id });
export const updateBilling = (billing: Subscription['billing']) => apiPost<{ subscription: Subscription }>('/api/saas', { op: 'updateBilling', billing });
export const validateCoupon = (code: string, planId: string, cycle: Cycle) => apiPost<{ offer?: Offer; error?: string }>('/api/saas', { op: 'validateCoupon', code, planId, cycle });

// ---- Owner side (/api/owner) — server rejects with 403 unless the caller is a Byjan super user ----
export type OwnerUser = {
  uid: string; email: string; displayName: string; createdAt: string; lastActiveAt?: string; status: 'active' | 'suspended' | 'deleted';
  planId: string; subStatus: SubStatus; cycle?: Cycle; seats?: number; mrrPaise: number; books: number; entries: number;
  usage?: Record<MeterKey, MeterUsage>; hasFeatureOverride?: boolean; features?: FeatureMap;
};
export type OwnerOverview = {
  mrrPaise: number; arrPaise: number; revenueThisMonthPaise: number; users: number; payingUsers: number; trialing: number; pastDue: number; churnedThisMonth: number;
  signupsByDay: Array<{ day: string; count: number }>; revenueByMonth: Array<{ month: string; paise: number }>;
  planMix: Array<{ planId: string; name: string; users: number }>; topMeters: Array<{ key: MeterKey; used: number }>;
  failedPayments: number; nearLimitUsers: number;
};
export type Payment = { id: string; orderId: string; uid: string; email: string; amountPaise: number; status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED'; method?: string; createdAt: string; planId?: string; invoiceNumber?: string; failureReason?: string; refundedPaise?: number };
export type AuditRow = { id: string; at: string; actorEmail: string; action: string; target: string; detail?: string; reason?: string };
export type AppConfig = {
  maintenance: boolean; maintenanceMessage: string; announcement: string; announcementTone: 'info' | 'offer' | 'warning';
  minAppVersion: string; defaultPlanId: string; trialPlanId: string; trialDays: number; gstRate: number; sellerName: string; sellerGstin: string;
  sellerState: string; invoicePrefix: string; supportEmail: string; graceDays: number; usageResetDay: number;
};

export const owner = {
  overview: () => apiPost<{ overview: OwnerOverview }>('/api/owner', { op: 'overview' }),
  listUsers: (q: string, filter: { planId?: string; status?: string }, cursor?: string) =>
    apiPost<{ users: OwnerUser[]; next?: string; total: number }>('/api/owner', { op: 'listUsers', q, ...filter, cursor }),
  getUser: (uid: string) => apiPost<{ user: OwnerUser; subscription: Subscription; usage: Usage; payments: Payment[]; bookList: Array<{ id: string; name: string; role: string; entries: number }> }>('/api/owner', { op: 'getUser', uid }),
  setUserFeatures: (uid: string, features: FeatureMap | null, reason: string) => apiPost('/api/owner', { op: 'setUserFeatures', uid, features, reason }),
  setUserPlan: (uid: string, input: { planId: string; cycle: Cycle; seats: number; until?: string; comp: boolean }, reason: string) => apiPost('/api/owner', { op: 'setUserPlan', uid, ...input, reason }),
  grantQuota: (uid: string, meter: MeterKey, amount: number, reason: string) => apiPost('/api/owner', { op: 'grantQuota', uid, meter, amount, reason }),
  resetUsage: (uid: string, meter: MeterKey, reason: string) => apiPost('/api/owner', { op: 'resetUsage', uid, meter, reason }),
  setUserStatus: (uid: string, status: 'active' | 'suspended', reason: string) => apiPost('/api/owner', { op: 'setUserStatus', uid, status, reason }),
  listPlans: () => apiPost<{ plans: Plan[]; addons: AddOn[] }>('/api/owner', { op: 'listPlans' }),
  savePlan: (plan: Plan, reason: string) => apiPost<{ plan: Plan }>('/api/owner', { op: 'savePlan', plan, reason }),
  archivePlan: (id: string, reason: string) => apiPost('/api/owner', { op: 'archivePlan', id, reason }),
  saveAddon: (addon: AddOn, reason: string) => apiPost<{ addon: AddOn }>('/api/owner', { op: 'saveAddon', addon, reason }),
  listOffers: () => apiPost<{ offers: Offer[] }>('/api/owner', { op: 'listOffers' }),
  saveOffer: (offer: Offer, reason: string) => apiPost<{ offer: Offer }>('/api/owner', { op: 'saveOffer', offer, reason }),
  usageReport: (month: string) => apiPost<{ month: string; meters: Array<{ key: MeterKey; used: number; users: number }>; top: Array<{ uid: string; email: string; key: MeterKey; used: number; limit: number }> }>('/api/owner', { op: 'usageReport', month }),
  listPayments: (status: string, cursor?: string) => apiPost<{ payments: Payment[]; next?: string }>('/api/owner', { op: 'listPayments', status, cursor }),
  refund: (paymentId: string, amountPaise: number, reason: string) => apiPost<{ payment: Payment }>('/api/owner', { op: 'refund', paymentId, amountPaise, reason }),
  listAudit: (cursor?: string) => apiPost<{ rows: AuditRow[]; next?: string }>('/api/owner', { op: 'listAudit', cursor }),
  getConfig: () => apiPost<{ config: AppConfig }>('/api/owner', { op: 'getConfig' }),
  saveConfig: (config: AppConfig, reason: string) => apiPost<{ config: AppConfig }>('/api/owner', { op: 'saveConfig', config, reason }),
  sendAnnouncement: (input: { title: string; body: string; audience: 'all' | 'free' | 'paying' | 'trialing'; push: boolean }, reason: string) => apiPost<{ sent: number }>('/api/owner', { op: 'sendAnnouncement', ...input, reason }),
};
