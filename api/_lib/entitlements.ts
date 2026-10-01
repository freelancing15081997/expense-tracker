// One place for plan, limits, features, quotas, maintenance and suspension.
import { ApiError, ledgerGetUser, ledgerListBooksForUser, ledgerGet } from '../_pg-tables.js';
import { emailIsSuperUser } from './super-users.js';
import { saasSql, DEFAULT_CONFIG, METER_LABEL, METER_FEATURE, MONTHLY_METERS, normaliseFeatures, allOn, type AppConfig, type MeterKey } from './saas-schema.js';
import type { PlanRow, AddonRow, OfferRow, Cycle } from './pricing.js';

export const newId = (p = '') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);

// ---------- config ----------
let cfgCache: { at: number; value: AppConfig } | null = null;
export async function getConfig(fresh = false): Promise<AppConfig> {
  if (!fresh && cfgCache && Date.now() - cfgCache.at < 30_000) return cfgCache.value;
  const sql = await saasSql();
  const rows = await sql`SELECT config FROM app_config WHERE id = 1`;
  const value = { ...DEFAULT_CONFIG, ...(rows[0]?.config || {}) } as AppConfig;
  cfgCache = { at: Date.now(), value };
  return value;
}
export function bustConfig() { cfgCache = null; }

// ---------- row mappers ----------
export function planFromRow(p: any): PlanRow & Record<string, any> {
  return {
    id: p.id, name: p.name, tagline: p.tagline || '', badge: p.badge || '', sort: Number(p.sort || 0), visible: !!p.visible, archived: !!p.archived,
    priceMonthlyPaise: Number(p.price_monthly_paise || 0), priceAnnualPaise: Number(p.price_annual_paise || 0), perSeat: !!p.per_seat,
    includedSeats: Number(p.included_seats || 1), maxSeats: Number(p.max_seats || 1), seatPriceMonthlyPaise: Number(p.seat_price_monthly_paise || 0),
    seatPriceAnnualPaise: Number(p.seat_price_annual_paise || 0), trialDays: Number(p.trial_days || 0), limits: p.limits || {},
    features: normaliseFeatures(p.features), highlights: Array.isArray(p.highlights) ? p.highlights : [],
  };
}
export const addonFromRow = (a: any): AddonRow & { visible: boolean } => ({
  id: a.id, name: a.name, meter: a.meter, quantity: Number(a.quantity || 0), pricePaise: Number(a.price_paise || 0), recurring: !!a.recurring, visible: !!a.visible,
});
export const offerFromRow = (o: any): OfferRow & { description: string } => ({
  id: o.id, code: o.code, title: o.title || '', description: o.description || '', kind: o.kind, value: Number(o.value || 0), meter: o.meter || undefined,
  planIds: Array.isArray(o.plan_ids) ? o.plan_ids : [], cycles: Array.isArray(o.cycles) ? o.cycles : [],
  startsAt: o.starts_at ? new Date(o.starts_at).toISOString().slice(0, 10) : '', endsAt: o.ends_at ? new Date(o.ends_at).toISOString().slice(0, 10) : '',
  maxRedemptions: Number(o.max_redemptions || 0), perUserLimit: Number(o.per_user_limit || 0), firstPaymentOnly: !!o.first_payment_only,
  autoApply: !!o.auto_apply, active: !!o.active, redemptions: Number(o.redemptions || 0),
});
export function subFromRow(s: any) {
  return {
    planId: s.plan_id, status: s.status, cycle: (s.cycle || 'monthly') as Cycle, seats: Number(s.seats || 1), addons: Array.isArray(s.addons) ? s.addons : [],
    currentPeriodStart: iso(s.current_period_start), currentPeriodEnd: iso(s.current_period_end), trialEndsAt: iso(s.trial_ends_at),
    cancelAtPeriodEnd: !!s.cancel_at_period_end, comp: !!s.comp, compUntil: s.comp_until ? new Date(s.comp_until).toISOString().slice(0, 10) : undefined,
    pendingSeats: s.pending_seats ?? undefined, nextAmountPaise: Number(s.next_amount_paise || 0), billing: s.billing || {},
  };
}

export async function getPlan(id: string) {
  const sql = await saasSql();
  const rows = await sql`SELECT * FROM plans WHERE id = ${id}`;
  return rows[0] ? planFromRow(rows[0]) : null;
}

// ---------- subscription ----------
export async function getSubscriptionRow(uid: string): Promise<any> {
  const sql = await saasSql();
  let rows = await sql`SELECT * FROM subscriptions WHERE uid = ${uid}`;
  if (rows[0]) return rows[0];
  const cfg = await getConfig();
  const profile = await ledgerGetUser(uid).catch(() => null) as Record<string, unknown> | null;
  const createdAt = Date.parse(String(profile?.createdAt || '')) || Date.now();
  const isNew = Date.now() - createdAt < 5 * 60_000;
  const trialPlan = cfg.trialPlanId && cfg.trialDays > 0 && isNew ? await getPlan(cfg.trialPlanId) : null;
  if (trialPlan) {
    const ends = new Date(Date.now() + cfg.trialDays * 86400000);
    await sql`INSERT INTO subscriptions (uid, plan_id, status, cycle, seats, trial_ends_at, trial_used) VALUES (${uid}, ${trialPlan.id}, 'trialing', 'monthly', 1, ${ends.toISOString()}, true) ON CONFLICT (uid) DO NOTHING`;
  } else {
    await sql`INSERT INTO subscriptions (uid, plan_id, status, cycle, seats) VALUES (${uid}, ${cfg.defaultPlanId}, 'free', 'monthly', 1) ON CONFLICT (uid) DO NOTHING`;
  }
  rows = await sql`SELECT * FROM subscriptions WHERE uid = ${uid}`;
  return rows[0];
}

/** Which plan's limits apply right now. */
export async function effectivePlan(uid: string) {
  const cfg = await getConfig();
  const sub = await getSubscriptionRow(uid);
  const now = Date.now();
  let planId = cfg.defaultPlanId;
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  const graceEnd = end + cfg.graceDays * 86400000;
  if (sub.comp && (!sub.comp_until || new Date(sub.comp_until).getTime() + 86400000 > now)) planId = sub.plan_id;
  else if (sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now) planId = sub.plan_id;
  else if (sub.status === 'active' || (sub.status === 'cancelled' && end > now)) planId = sub.plan_id;
  else if (sub.status === 'past_due' && graceEnd > now) planId = sub.plan_id;
  const plan = (await getPlan(planId)) || (await getPlan(cfg.defaultPlanId));
  return { plan: plan!, sub };
}

// ---------- periods ----------
export async function periodBounds(now = new Date()) {
  const cfg = await getConfig();
  const day = Math.min(28, Math.max(1, Number(cfg.usageResetDay || 1)));
  let start = new Date(now.getFullYear(), now.getMonth(), day);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { key, start, end };
}
export async function periodKey() { return (await periodBounds()).key; }

// ---------- limits ----------
export async function effectiveLimits(uid: string) {
  const { plan, sub } = await effectivePlan(uid);
  const sql = await saasSql();
  const { key } = await periodBounds();
  const limits: Record<string, number> = { ...plan.limits };
  // recurring add-ons on the subscription
  const owned = Array.isArray(sub.addons) ? sub.addons as Array<{ id: string; qty: number }> : [];
  if (owned.length) {
    const rows = await sql`SELECT * FROM addons WHERE recurring = true`;
    for (const a of rows) {
      const qty = Number(owned.find((o) => o.id === a.id)?.qty || 0);
      if (qty > 0 && limits[a.meter] !== -1) limits[a.meter] = Number(limits[a.meter] || 0) + qty * Number(a.quantity || 0);
    }
  }
  // per-seat plans pool scans etc. by seat count beyond included
  if (plan.perSeat && sub.seats > plan.includedSeats) {
    const ratio = Number(sub.seats) / plan.includedSeats;
    for (const m of MONTHLY_METERS) if (limits[m] > 0) limits[m] = Math.round(limits[m] * ratio);
  }
  const counters = await sql`SELECT meter, used, extra FROM usage_counters WHERE uid = ${uid} AND period = ${key}`;
  const extra: Record<string, number> = {}; const used: Record<string, number> = {};
  for (const c of counters) { extra[c.meter] = Number(c.extra || 0); used[c.meter] = Number(c.used || 0); }
  return { plan, sub, limits, extra, used, period: key };
}

export async function isSuper(uid: string, email?: string) {
  if (email) return emailIsSuperUser(email);
  const p = await ledgerGetUser(uid).catch(() => null) as any;
  return emailIsSuperUser(p?.email);
}

function quotaError(meter: MeterKey, used: number, limit: number, resetsAt?: string) {
  return new ApiError(402, `You’ve used this month’s ${METER_LABEL[meter]}. Upgrade or add a top-up to keep going.`, {
    code: 'QUOTA_EXCEEDED', meter, used, limit, resetsAt,
  });
}

/** Atomic consume for monthly meters. Super users are never limited; -1 still counts. */
export async function consume(uid: string, meter: MeterKey, n = 1, email?: string) {
  const sql = await saasSql();
  const { key, end } = await periodBounds();
  const superUser = await isSuper(uid, email);
  const { limits } = await effectiveLimits(uid);
  const limit = Number(limits[meter] ?? 0);
  if (superUser || limit === -1) {
    await sql`INSERT INTO usage_counters (uid, period, meter, used) VALUES (${uid}, ${key}, ${meter}, ${n})
      ON CONFLICT (uid, period, meter) DO UPDATE SET used = usage_counters.used + ${n}`;
    return { used: -1, limit: -1 };
  }
  await sql`INSERT INTO usage_counters (uid, period, meter, used) VALUES (${uid}, ${key}, ${meter}, 0) ON CONFLICT DO NOTHING`;
  const rows = await sql`UPDATE usage_counters SET used = used + ${n}
    WHERE uid = ${uid} AND period = ${key} AND meter = ${meter} AND used + ${n} <= ${limit} + extra RETURNING used, extra`;
  if (!rows[0]) {
    const cur = await sql`SELECT used, extra FROM usage_counters WHERE uid = ${uid} AND period = ${key} AND meter = ${meter}`;
    throw quotaError(meter, Number(cur[0]?.used || 0), limit + Number(cur[0]?.extra || 0), end.toISOString());
  }
  return { used: Number(rows[0].used), limit: limit + Number(rows[0].extra || 0) };
}

export async function refund(uid: string, meter: MeterKey, n = 1) {
  const sql = await saasSql();
  const key = await periodKey();
  await sql`UPDATE usage_counters SET used = GREATEST(0, used - ${n}) WHERE uid = ${uid} AND period = ${key} AND meter = ${meter}`;
}

/** Non-monthly meters: compare the live count. `ownerUid` decides (book owner for members). */
export async function checkCount(ownerUid: string, meter: MeterKey, current: number, adding = 1) {
  if (await isSuper(ownerUid)) return;
  const { limits, extra } = await effectiveLimits(ownerUid);
  const limit = Number(limits[meter] ?? 0);
  if (limit === -1) return;
  const cap = limit + Number(extra[meter] || 0);
  if (current + adding > cap) throw quotaError(meter, current, cap);
}

export async function countOwnedBooks(uid: string) {
  const books = await ledgerListBooksForUser(uid);
  return books.filter((b: any) => String(b.ownerId || '') === uid && !b.deleted).length;
}
export async function countBookMembers(bookId: string) {
  const book = await ledgerGet(`books/${bookId}`) as any;
  const roles = book?.roles && typeof book.roles === 'object' ? Object.keys(book.roles) : [];
  const ids = new Set(roles); if (book?.ownerId) ids.add(String(book.ownerId));
  return { count: ids.size, ownerUid: String(book?.ownerId || '') };
}

// ---------- features ----------
/** super → all on; person override → absolute; else plan.features ∧ role features. */
export async function effectiveFeatures(uid: string, email: string, roleFeatures?: Record<string, boolean>) {
  if (emailIsSuperUser(email)) return allOn();
  const profile = await ledgerGetUser(uid).catch(() => null) as any;
  const override = profile?.features && typeof profile.features === 'object' && Object.keys(profile.features).length ? profile.features : null;
  if (override) return normaliseFeatures(override);
  const { plan } = await effectivePlan(uid);
  const base = plan.features;
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(base)) out[k] = base[k] && (roleFeatures ? roleFeatures[k] !== false : true);
  return normaliseFeatures(out);
}

export async function requireFeature(uid: string, email: string, key: string) {
  const f = await effectiveFeatures(uid, email);
  if (f[key] === false) throw new ApiError(403, 'This feature is turned off for your account.', { code: 'FEATURE_OFF', feature: key });
}

/** Feature gate + quota consume in one call. Returns a refund function. */
export async function gateMeter(uid: string, email: string, meter: MeterKey, n = 1) {
  const feature = METER_FEATURE[meter];
  if (feature) await requireFeature(uid, email, feature);
  const usage = await consume(uid, meter, n, email);
  return { usage: { feature: meter, ...usage }, undo: () => refund(uid, meter, n).catch(() => undefined) };
}

// ---------- usage snapshot for /api/saas me and owner ----------
export async function usageSnapshot(uid: string) {
  const { limits, extra, used } = await effectiveLimits(uid);
  const { start, end } = await periodBounds();
  const meters: Record<string, { used: number; limit: number; extra: number }> = {};
  for (const m of MONTHLY_METERS) meters[m] = { used: used[m] || 0, limit: Number(limits[m] ?? 0), extra: extra[m] || 0 };
  const books = await countOwnedBooks(uid).catch(() => 0);
  meters.books = { used: books, limit: Number(limits.books ?? 0), extra: extra.books || 0 };
  meters.members_per_book = { used: 0, limit: Number(limits.members_per_book ?? 0), extra: extra.members_per_book || 0 };
  const sql = await saasSql();
  const st = await sql`SELECT used FROM usage_counters WHERE uid = ${uid} AND period = 'all' AND meter = 'storage_mb'`;
  meters.storage_mb = { used: Number(st[0]?.used || 0), limit: Number(limits.storage_mb ?? 0), extra: extra.storage_mb || 0 };
  return { periodStart: start.toISOString(), periodEnd: end.toISOString(), meters };
}

// ---------- request gate: maintenance + suspension ----------
export async function requestGate(user: { uid: string; email: string }, path: string, op = '') {
  if (emailIsSuperUser(user.email)) return;
  const sql = await saasSql();
  const st = await sql`SELECT status FROM user_status WHERE uid = ${user.uid}`;
  if (st[0]?.status === 'suspended') throw new ApiError(403, 'Your account is paused. Contact support.', { code: 'SUSPENDED' });
  if (op === 'publicConfig' || op === 'cron' || /[?&]op=(publicConfig|cron)/.test(path)) return;
  const cfg = await getConfig();
  if (cfg.maintenance) throw new ApiError(503, cfg.maintenanceMessage || 'Byjan is getting an upgrade. Please try again shortly.', { code: 'MAINTENANCE', maintenanceMessage: cfg.maintenanceMessage });
}

// ---------- rate limit (per key, sliding minute) ----------
export async function rateLimit(key: string, perMinute = 30) {
  const sql = await saasSql();
  const rows = await sql`SELECT count(*)::int AS n FROM rate_hits WHERE key = ${key} AND at > now() - interval '1 minute'`;
  if (Number(rows[0]?.n || 0) >= perMinute) throw new ApiError(429, 'Too many requests. Try again in a moment.', { code: 'RATE_LIMITED' });
  await sql`INSERT INTO rate_hits (key) VALUES (${key})`;
  if (Math.random() < 0.02) await sql`DELETE FROM rate_hits WHERE at < now() - interval '10 minutes'`;
}
