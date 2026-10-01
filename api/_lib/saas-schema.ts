// Byjan Books SaaS schema + first-run seed. Idempotent; safe to call on every cold start.
import { getLedgerSql } from '../_pg-tables.js';

export const METER_KEYS = ['receipt_scans', 'voice_entries', 'smart_search', 'email_captures', 'ai_insights', 'books', 'members_per_book', 'storage_mb'] as const;
export type MeterKey = typeof METER_KEYS[number];
export const MONTHLY_METERS: MeterKey[] = ['receipt_scans', 'voice_entries', 'smart_search', 'email_captures', 'ai_insights'];
export const METER_LABEL: Record<MeterKey, string> = {
  receipt_scans: 'receipt scans', voice_entries: 'voice entries', smart_search: 'smart searches', email_captures: 'email-in bills',
  ai_insights: 'smart insights', books: 'money books', members_per_book: 'members per book', storage_mb: 'receipt storage',
};
export const METER_FEATURE: Partial<Record<MeterKey, string>> = {
  receipt_scans: 'money_scan', voice_entries: 'money_voice', smart_search: 'money_search', email_captures: 'money_email_mailbox',
  ai_insights: 'money_ai_insights', books: 'money_create_book', members_per_book: 'money_people',
};

/** Same keys as byjan-books-mobile/src/lib/features.ts (parent → children). */
export const FEATURE_PARENTS: Record<string, string | null> = {
  money: null, money_capture: 'money', money_add: 'money_capture', money_scan: 'money_capture', money_voice: 'money_capture',
  money_duplicate: 'money_capture', money_flag: 'money_capture', money_delete: 'money_capture', money_team: 'money',
  money_people: 'money_team', money_settle: 'money_team', money_split: 'money', money_split_tab: 'money_split',
  money_split_entry: 'money_split', money_split_equal: 'money_split', money_email: 'money', money_email_mailbox: 'money_email',
  money_email_report: 'money_email', money_insight: 'money', money_reports: 'money_insight', money_book_analytics: 'money_insight',
  money_history: 'money_insight', money_export: 'money_insight', money_ai_insights: 'money_insight', money_live: 'money',
  money_activity: 'money_live', money_inbox: 'money_live', money_recurring: 'money_live', money_setup: 'money',
  money_create_book: 'money_setup', money_delete_book: 'money_setup', money_purpose: 'money_setup', money_search: 'money_setup',
  money_pin: 'money_setup', money_budget: 'money_setup', money_filters: 'money_setup', app_notifications: null,
  app_notifications_push: 'app_notifications', app_notifications_email: 'app_notifications', app_lock: null, app_search: null, business: null,
};
export const allOn = () => Object.fromEntries(Object.keys(FEATURE_PARENTS).map((k) => [k, true])) as Record<string, boolean>;
export function normaliseFeatures(raw: unknown): Record<string, boolean> {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(FEATURE_PARENTS)) out[k] = src[k] === undefined ? true : Boolean(src[k]);
  // parents gate children
  for (const k of Object.keys(FEATURE_PARENTS)) {
    let p = FEATURE_PARENTS[k];
    while (p) { if (!out[p]) { out[k] = false; break; } p = FEATURE_PARENTS[p]; }
  }
  return out;
}

export const DEFAULT_CONFIG = {
  maintenance: false, maintenanceMessage: '', announcement: '', announcementTone: 'info', minAppVersion: '2.0.0',
  defaultPlanId: 'free', trialPlanId: 'pro', trialDays: 14, gstRate: 18, sellerName: 'Byjan', sellerGstin: '', sellerState: 'Karnataka',
  invoicePrefix: 'BYJ', supportEmail: 'byjanbooks@gmail.com', graceDays: 7, usageResetDay: 1,
};
export type AppConfig = typeof DEFAULT_CONFIG;

const L = (scans: number, voice: number, search: number, email: number, insights: number, books: number, members: number, storage: number) =>
  ({ receipt_scans: scans, voice_entries: voice, smart_search: search, email_captures: email, ai_insights: insights, books, members_per_book: members, storage_mb: storage });

const SEED_PLANS = [
  { id: 'free', name: 'Free', tagline: 'Everything, with monthly limits', badge: '', sort: 0, pm: 0, pa: 0, perSeat: false, inc: 1, max: 1, spm: 0, spa: 0, trial: 0,
    limits: L(30, 20, 20, 30, 3, 5, 3, 500), highlights: ['30 receipt scans a month', '5 books, 3 people each', 'All features included'] },
  { id: 'plus', name: 'Plus', tagline: 'For busy households', badge: '', sort: 1, pm: 9900, pa: 99900, perSeat: false, inc: 1, max: 1, spm: 0, spa: 0, trial: 14,
    limits: L(300, 200, 200, 300, 20, 20, 8, 3000), highlights: ['300 scans a month', '20 books, 8 people each', '3 GB receipts'] },
  { id: 'pro', name: 'Pro', tagline: 'For power users and small teams', badge: 'Most popular', sort: 2, pm: 24900, pa: 249900, perSeat: false, inc: 1, max: 1, spm: 0, spa: 0, trial: 14,
    limits: L(1500, -1, -1, 1500, 100, -1, 20, 15000), highlights: ['1,500 scans a month', 'Unlimited voice and smart search', 'Unlimited books'] },
  { id: 'business', name: 'Business', tagline: 'Per-seat for teams', badge: '', sort: 3, pm: 59900, pa: 599000, perSeat: true, inc: 3, max: 100, spm: 14900, spa: 149000, trial: 14,
    limits: L(5000, -1, -1, 5000, -1, -1, 100, 100000), highlights: ['3 seats included', '5,000 pooled scans', '100 people per book'] },
];

let ready: Promise<void> | null = null;
export function ensureSaasSchema() {
  if (!ready) ready = migrate().catch((e) => { ready = null; throw e; });
  return ready;
}

export async function saasSql(): Promise<any> {
  await ensureSaasSchema();
  return getLedgerSql();
}

async function migrate() {
  const sql: any = await getLedgerSql();
  await sql`CREATE TABLE IF NOT EXISTS plans (id text PRIMARY KEY, name text NOT NULL, tagline text DEFAULT '', badge text DEFAULT '', sort int DEFAULT 0,
    visible bool DEFAULT true, archived bool DEFAULT false, price_monthly_paise int DEFAULT 0, price_annual_paise int DEFAULT 0, per_seat bool DEFAULT false,
    included_seats int DEFAULT 1, max_seats int DEFAULT 1, seat_price_monthly_paise int DEFAULT 0, seat_price_annual_paise int DEFAULT 0, trial_days int DEFAULT 0,
    limits jsonb DEFAULT '{}'::jsonb, features jsonb DEFAULT '{}'::jsonb, highlights jsonb DEFAULT '[]'::jsonb, updated_at timestamptz DEFAULT now(), updated_by text)`;
  await sql`CREATE TABLE IF NOT EXISTS addons (id text PRIMARY KEY, name text, meter text, quantity int, price_paise int, recurring bool DEFAULT false,
    visible bool DEFAULT true, updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS offers (id text PRIMARY KEY, code text UNIQUE, title text, description text DEFAULT '',
    kind text CHECK (kind IN ('percent','flat','extra_days','extra_quota')), value numeric DEFAULT 0, meter text, plan_ids jsonb DEFAULT '[]'::jsonb,
    cycles jsonb DEFAULT '[]'::jsonb, starts_at date, ends_at date, max_redemptions int DEFAULT 0, per_user_limit int DEFAULT 1,
    first_payment_only bool DEFAULT false, auto_apply bool DEFAULT false, active bool DEFAULT true, redemptions int DEFAULT 0, updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS offer_redemptions (id text PRIMARY KEY, offer_id text, uid text, order_id text, at timestamptz DEFAULT now(), UNIQUE (offer_id, order_id))`;
  await sql`CREATE TABLE IF NOT EXISTS subscriptions (uid text PRIMARY KEY, plan_id text, status text CHECK (status IN ('free','trialing','active','past_due','cancelled','expired')),
    cycle text DEFAULT 'monthly', seats int DEFAULT 1, addons jsonb DEFAULT '[]'::jsonb, current_period_start timestamptz, current_period_end timestamptz,
    trial_ends_at timestamptz, trial_used bool DEFAULT false, cancel_at_period_end bool DEFAULT false, cancel_reason text, comp_until date, comp bool DEFAULT false,
    pending_seats int, billing jsonb DEFAULT '{}'::jsonb, next_amount_paise int DEFAULT 0, last_paid_subtotal_paise int DEFAULT 0,
    reminders jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS usage_counters (uid text, period text, meter text, used int DEFAULT 0, extra int DEFAULT 0, extra_recurring int DEFAULT 0,
    PRIMARY KEY (uid, period, meter))`;
  await sql`CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, uid text, kind text, plan_id text, cycle text, seats int, addons jsonb DEFAULT '[]'::jsonb,
    coupon text, quote jsonb, billing jsonb, cf_order_id text, payment_session_id text, status text DEFAULT 'CREATED', idempotency_key text UNIQUE,
    activated_at timestamptz, created_at timestamptz DEFAULT now(), paid_at timestamptz)`;
  await sql`CREATE TABLE IF NOT EXISTS payments (id text PRIMARY KEY, order_id text, uid text, cf_payment_id text UNIQUE, amount_paise int, status text, method text,
    failure_reason text, refunded_paise int DEFAULT 0, raw jsonb, created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS invoices (id text PRIMARY KEY, number text UNIQUE, uid text, order_id text, date date, lines jsonb, subtotal_paise int,
    discount_paise int, tax_paise int, cgst_paise int, sgst_paise int, igst_paise int, total_paise int, status text, seller jsonb, buyer jsonb, pdf_path text, credit_note_of text)`;
  await sql`CREATE TABLE IF NOT EXISTS invoice_seq (fy text PRIMARY KEY, seq int DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS owner_audit (id text PRIMARY KEY, at timestamptz DEFAULT now(), actor_uid text, actor_email text, action text, target text, detail jsonb, reason text)`;
  await sql`CREATE TABLE IF NOT EXISTS app_config (id int PRIMARY KEY DEFAULT 1, config jsonb, updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS inbox_items (id text PRIMARY KEY, uid text, book_id text, kind text, preview jsonb, at timestamptz DEFAULT now(), dismissed_at timestamptz, done_at timestamptz)`;
  await sql`CREATE TABLE IF NOT EXISTS devices (token text PRIMARY KEY, uid text, platform text, updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS capture_corrections (id text PRIMARY KEY, uid text, book_id text, capture_id text, merchant_key text, before jsonb, after jsonb, at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS user_status (uid text PRIMARY KEY, status text, reason text, at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS rate_hits (key text, at timestamptz DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS orders_uid ON orders(uid)`;
  await sql`CREATE INDEX IF NOT EXISTS payments_uid_at ON payments(uid, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS invoices_uid_date ON invoices(uid, date)`;
  await sql`CREATE INDEX IF NOT EXISTS usage_period_meter ON usage_counters(period, meter)`;
  await sql`CREATE INDEX IF NOT EXISTS owner_audit_at ON owner_audit(at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS inbox_uid ON inbox_items(uid, dismissed_at)`;
  await sql`CREATE INDEX IF NOT EXISTS corrections_key ON capture_corrections(uid, merchant_key)`;
  await sql`CREATE INDEX IF NOT EXISTS rate_hits_key ON rate_hits(key, at)`;

  const existing = await sql`SELECT count(*)::int AS n FROM plans`;
  if (Number(existing[0]?.n || 0) === 0) {
    const features = JSON.stringify(allOn());
    for (const p of SEED_PLANS) {
      await sql`INSERT INTO plans (id, name, tagline, badge, sort, visible, price_monthly_paise, price_annual_paise, per_seat, included_seats, max_seats,
        seat_price_monthly_paise, seat_price_annual_paise, trial_days, limits, features, highlights)
        VALUES (${p.id}, ${p.name}, ${p.tagline}, ${p.badge}, ${p.sort}, true, ${p.pm}, ${p.pa}, ${p.perSeat}, ${p.inc}, ${p.max}, ${p.spm}, ${p.spa}, ${p.trial},
        ${JSON.stringify(p.limits)}::jsonb, ${features}::jsonb, ${JSON.stringify(p.highlights)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    }
    await sql`INSERT INTO addons (id, name, meter, quantity, price_paise, recurring) VALUES
      ('scans100', '+100 receipt scans', 'receipt_scans', 100, 4900, false),
      ('storage5g', '+5 GB receipt storage', 'storage_mb', 5000, 7900, true),
      ('members5', '+5 members per book', 'members_per_book', 5, 9900, true) ON CONFLICT (id) DO NOTHING`;
  }
  await sql`INSERT INTO app_config (id, config) VALUES (1, ${JSON.stringify(DEFAULT_CONFIG)}::jsonb) ON CONFLICT (id) DO NOTHING`;
}
