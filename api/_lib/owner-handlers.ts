// /api/owner — Byjan super user console. Every op re-checks super user; every write needs a reason and is audited.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError, apiJson, withDomainApi, ledgerGetUser, ledgerUpsertUser, ledgerListAllUsers, ledgerListBooksForUser, ledgerListLiveExpenses, ledgerAddNotification,
} from '../_pg-tables.js';
import { emailIsSuperUser } from './super-users.js';
import { saasSql, METER_KEYS, MONTHLY_METERS, normaliseFeatures, type MeterKey } from './saas-schema.js';
import {
  getConfig, bustConfig, getSubscriptionRow, planFromRow, addonFromRow, offerFromRow, subFromRow, usageSnapshot, effectiveFeatures, periodBounds, newId,
} from './entitlements.js';
import { createInvoice, notifyUser } from './billing.js';
import { cfRefund } from './cashfree.js';
import { GSTIN_RE, type Quote } from './pricing.js';

type U = { uid: string; email: string };
const PAGE = 50;

async function audit(actor: U, action: string, target: string, detail: unknown, reason: string) {
  const sql = await saasSql();
  await sql`INSERT INTO owner_audit (id, actor_uid, actor_email, action, target, detail, reason)
    VALUES (${newId('aud_')}, ${actor.uid}, ${actor.email}, ${action}, ${target}, ${JSON.stringify(detail ?? {})}::jsonb, ${reason})`;
}
function needReason(body: any) {
  const reason = String(body.reason || '').trim();
  if (reason.length < 4) throw new ApiError(400, 'Add a short reason (at least 4 characters).', { code: 'REASON_REQUIRED' });
  return reason.slice(0, 500);
}
const int = (v: unknown, min = -1) => { const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n < min) throw new ApiError(400, 'Numbers must be whole and not below their minimum.', { code: 'BAD_NUMBER' }); return n; };

async function mrrOf(sub: any, plansById: Record<string, any>) {
  if (!sub || sub.comp || !['active', 'past_due'].includes(sub.status)) return 0;
  const p = plansById[sub.plan_id]; if (!p) return 0;
  const extraSeats = p.per_seat ? Math.max(0, Number(sub.seats || 1) - Number(p.included_seats || 1)) : 0;
  return sub.cycle === 'annual'
    ? Math.round((Number(p.price_annual_paise) + extraSeats * Number(p.seat_price_annual_paise)) / 12)
    : Number(p.price_monthly_paise) + extraSeats * Number(p.seat_price_monthly_paise);
}

export async function handleOwner(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req as any, res as any, async (user: U, body: Record<string, any>) => {
    if (!emailIsSuperUser(user.email)) throw new ApiError(403, 'Only the Byjan owner can do that.', { code: 'NOT_OWNER' });
    const op = String(body.op || '');
    const sql = await saasSql();
    const plansRows = await sql`SELECT * FROM plans`;
    const plansById: Record<string, any> = Object.fromEntries(plansRows.map((p: any) => [p.id, p]));

    if (op === 'overview') {
      const subs = await sql`SELECT * FROM subscriptions`;
      const allUsers = await ledgerListAllUsers(20000).catch(() => [] as any[]);
      let mrr = 0; let paying = 0; let trialing = 0; let pastDue = 0;
      const mix: Record<string, number> = {};
      for (const s of subs) {
        const m = await mrrOf(s, plansById); mrr += m; if (m > 0) paying++;
        if (s.status === 'trialing') trialing++; if (s.status === 'past_due') pastDue++;
        mix[s.plan_id] = (mix[s.plan_id] || 0) + 1;
      }
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const rev = await sql`SELECT COALESCE(sum(amount_paise - refunded_paise), 0)::int AS p FROM payments WHERE status = 'SUCCESS' AND created_at >= ${monthStart.toISOString()}`;
      const revByMonth = await sql`SELECT to_char(created_at, 'YYYY-MM') AS month, sum(amount_paise - refunded_paise)::int AS paise FROM payments
        WHERE status = 'SUCCESS' AND created_at > now() - interval '12 months' GROUP BY 1 ORDER BY 1`;
      const churn = await sql`SELECT count(*)::int AS n FROM subscriptions WHERE status IN ('free','cancelled') AND cancel_reason IS NOT NULL AND updated_at >= ${monthStart.toISOString()}`;
      const failed = await sql`SELECT count(*)::int AS n FROM payments WHERE status = 'FAILED' AND created_at > now() - interval '30 days'`;
      const { key } = await periodBounds();
      const top = await sql`SELECT meter, sum(used)::int AS used FROM usage_counters WHERE period = ${key} GROUP BY meter ORDER BY 2 DESC`;
      const signups: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) signups[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
      for (const u of allUsers) { const d = String((u as any).createdAt || '').slice(0, 10); if (d in signups) signups[d]++; }
      // near limit: any monthly meter ≥ 80%
      const near = await sql`SELECT count(DISTINCT uc.uid)::int AS n FROM usage_counters uc JOIN subscriptions s ON s.uid = uc.uid JOIN plans p ON p.id = s.plan_id
        WHERE uc.period = ${key} AND (p.limits->>uc.meter)::int > 0 AND uc.used >= 0.8 * ((p.limits->>uc.meter)::int + uc.extra)`;
      apiJson(res as any, 200, { overview: {
        mrrPaise: mrr, arrPaise: mrr * 12, revenueThisMonthPaise: Number(rev[0]?.p || 0), users: Math.max(allUsers.length, subs.length), payingUsers: paying,
        trialing, pastDue, churnedThisMonth: Number(churn[0]?.n || 0),
        signupsByDay: Object.entries(signups).map(([day, count]) => ({ day, count })),
        revenueByMonth: revByMonth.map((r: any) => ({ month: r.month, paise: Number(r.paise || 0) })),
        planMix: Object.entries(mix).map(([planId, users]) => ({ planId, name: plansById[planId]?.name || planId, users })),
        topMeters: top.map((t: any) => ({ key: t.meter, used: Number(t.used) })), failedPayments: Number(failed[0]?.n || 0), nearLimitUsers: Number(near[0]?.n || 0),
      } });
      return;
    }

    if (op === 'listUsers') {
      const qq = String(body.q || '').trim().toLowerCase();
      const all = await ledgerListAllUsers(20000).catch(() => [] as any[]);
      const subs = Object.fromEntries((await sql`SELECT * FROM subscriptions`).map((s: any) => [s.uid, s]));
      const statuses = Object.fromEntries((await sql`SELECT uid, status FROM user_status`).map((s: any) => [s.uid, s.status]));
      let rows = all.filter((u: any) => !qq || [u.uid, u.email, u.displayName].some((v) => String(v || '').toLowerCase().includes(qq)));
      if (body.planId) rows = rows.filter((u: any) => (subs[u.uid]?.plan_id || 'free') === body.planId);
      if (body.status === 'suspended') rows = rows.filter((u: any) => statuses[u.uid] === 'suspended');
      else if (body.status === 'override') rows = rows.filter((u: any) => u.features && Object.keys(u.features).length);
      else if (body.status) rows = rows.filter((u: any) => (subs[u.uid]?.status || 'free') === body.status);
      const start = Math.max(0, Number(body.cursor || 0));
      const page = rows.slice(start, start + PAGE);
      const users = await Promise.all(page.map(async (u: any) => {
        const s = subs[u.uid];
        const books = await ledgerListBooksForUser(u.uid).catch(() => [] as any[]);
        return {
          uid: u.uid, email: u.email || '', displayName: u.displayName || String(u.email || '').split('@')[0] || 'Person', createdAt: u.createdAt || '',
          lastActiveAt: u.lastActiveAt || u.updatedAt || '', status: statuses[u.uid] === 'suspended' ? 'suspended' : (u.status === 'deleted' ? 'deleted' : 'active'),
          planId: s?.plan_id || 'free', subStatus: s?.status || 'free', cycle: s?.cycle, seats: s?.seats, mrrPaise: await mrrOf(s, plansById),
          books: books.filter((b: any) => b.ownerId === u.uid).length, entries: 0, hasFeatureOverride: !!(u.features && Object.keys(u.features).length),
        };
      }));
      apiJson(res as any, 200, { users, next: start + PAGE < rows.length ? String(start + PAGE) : undefined, total: rows.length });
      return;
    }

    if (op === 'getUser') {
      const uid = String(body.uid || '');
      const profile = await ledgerGetUser(uid) as any;
      if (!profile) throw new ApiError(404, 'User not found.', { code: 'USER_NOT_FOUND' });
      const sub = await getSubscriptionRow(uid);
      const st = await sql`SELECT status FROM user_status WHERE uid = ${uid}`;
      const books = await ledgerListBooksForUser(uid).catch(() => [] as any[]);
      const bookList = await Promise.all(books.map(async (b: any) => ({
        id: b.id, name: b.name, role: b.ownerId === uid ? 'owner' : String(b.roles?.[uid]?.role || 'member'),
        entries: (await ledgerListLiveExpenses(b.id).catch(() => [])).length,
      })));
      const payments = await sql`SELECT p.*, o.plan_id FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.uid = ${uid} ORDER BY p.created_at DESC LIMIT 50`;
      apiJson(res as any, 200, {
        user: {
          uid, email: profile.email || '', displayName: profile.displayName || '', createdAt: profile.createdAt || '', lastActiveAt: profile.updatedAt || '',
          status: st[0]?.status === 'suspended' ? 'suspended' : (profile.status === 'deleted' ? 'deleted' : 'active'), planId: sub.plan_id, subStatus: sub.status,
          cycle: sub.cycle, seats: sub.seats, mrrPaise: await mrrOf(sub, plansById), books: bookList.filter((b) => b.role === 'owner').length,
          entries: bookList.reduce((a, b) => a + b.entries, 0), hasFeatureOverride: !!(profile.features && Object.keys(profile.features).length),
          features: await effectiveFeatures(uid, profile.email || ''),
        },
        subscription: subFromRow(sub), usage: await usageSnapshot(uid), payments: payments.map(paymentOut(profile.email)), bookList,
      });
      return;
    }

    if (op === 'setUserFeatures') {
      const reason = needReason(body); const uid = String(body.uid || '');
      if (body.features === null) {
        await ledgerUpsertUser(uid, { features: null, updatedAt: new Date().toISOString() }, true);
      } else {
        await ledgerUpsertUser(uid, { features: normaliseFeatures(body.features), updatedAt: new Date().toISOString() }, true);
      }
      await audit(user, 'user.features', uid, { features: body.features === null ? 'plan default' : 'custom' }, reason);
      apiJson(res as any, 200, { ok: true });
      return;
    }

    if (op === 'setUserPlan') {
      const reason = needReason(body); const uid = String(body.uid || '');
      const plan = plansById[String(body.planId || '')]; if (!plan) throw new ApiError(404, 'Plan not found.', { code: 'PLAN_NOT_FOUND' });
      await getSubscriptionRow(uid);
      const cycle = body.cycle === 'annual' ? 'annual' : 'monthly';
      const seats = plan.per_seat ? Math.min(Number(plan.max_seats), Math.max(Number(plan.included_seats), int(body.seats || 1, 1))) : 1;
      if (body.comp) {
        const until = String(body.until || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new ApiError(400, 'Pick the date free access ends.', { code: 'UNTIL_REQUIRED' });
        await sql`UPDATE subscriptions SET plan_id = ${plan.id}, cycle = ${cycle}, seats = ${seats}, status = 'active', comp = true, comp_until = ${until},
          cancel_at_period_end = false, updated_at = now() WHERE uid = ${uid}`;
        await notifyUser(uid, 'A gift from Byjan', `You’re on ${plan.name} free until ${until}.`, '/#/billing');
      } else {
        const free = Number(plan.price_monthly_paise) === 0;
        await sql`UPDATE subscriptions SET plan_id = ${plan.id}, cycle = ${cycle}, seats = ${seats}, comp = false, comp_until = NULL,
          status = ${free ? 'free' : 'active'}, current_period_start = COALESCE(current_period_start, now()),
          current_period_end = COALESCE(current_period_end, now() + interval '1 month'), updated_at = now() WHERE uid = ${uid}`;
      }
      await audit(user, 'user.plan', uid, { planId: plan.id, cycle, seats, comp: !!body.comp, until: body.until }, reason);
      apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(uid)) });
      return;
    }

    if (op === 'grantQuota' || op === 'resetUsage') {
      const reason = needReason(body); const uid = String(body.uid || ''); const meter = String(body.meter || '') as MeterKey;
      if (!METER_KEYS.includes(meter)) throw new ApiError(400, 'Unknown meter.', { code: 'BAD_METER' });
      const { key } = await periodBounds();
      if (op === 'grantQuota') {
        const amount = int(body.amount, 1);
        await sql`INSERT INTO usage_counters (uid, period, meter, extra) VALUES (${uid}, ${key}, ${meter}, ${amount})
          ON CONFLICT (uid, period, meter) DO UPDATE SET extra = usage_counters.extra + ${amount}`;
        await audit(user, 'user.grant_quota', uid, { meter, amount }, reason);
      } else {
        await sql`UPDATE usage_counters SET used = 0 WHERE uid = ${uid} AND period = ${key} AND meter = ${meter}`;
        await audit(user, 'user.reset_usage', uid, { meter }, reason);
      }
      apiJson(res as any, 200, { usage: await usageSnapshot(uid) });
      return;
    }

    if (op === 'setUserStatus') {
      const reason = needReason(body); const uid = String(body.uid || ''); const status = body.status === 'suspended' ? 'suspended' : 'active';
      const target = await ledgerGetUser(uid) as any;
      if (uid === user.uid) throw new ApiError(400, 'You can’t suspend yourself.', { code: 'SELF' });
      if (status === 'suspended' && emailIsSuperUser(target?.email)) throw new ApiError(400, 'Owners can’t be suspended.', { code: 'SUPER_USER' });
      await sql`INSERT INTO user_status (uid, status, reason, at) VALUES (${uid}, ${status}, ${reason}, now())
        ON CONFLICT (uid) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, at = now()`;
      if (status === 'suspended') await revokeTokens(uid);
      await audit(user, `user.${status === 'suspended' ? 'suspend' : 'restore'}`, uid, {}, reason);
      apiJson(res as any, 200, { ok: true, status });
      return;
    }

    if (op === 'listPlans') {
      apiJson(res as any, 200, {
        plans: [...plansRows].sort((a: any, b: any) => a.sort - b.sort).map(planFromRow),
        addons: (await sql`SELECT * FROM addons ORDER BY price_paise`).map(addonFromRow),
      });
      return;
    }

    if (op === 'savePlan') {
      const reason = needReason(body); const p = body.plan || {};
      const id = String(p.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (!id || !String(p.name || '').trim()) throw new ApiError(400, 'Plan needs an id and a name.', { code: 'BAD_PLAN' });
      const pm = int(p.priceMonthlyPaise, 0); const pa = int(p.priceAnnualPaise, 0);
      if (pa > pm * 12) throw new ApiError(400, 'Yearly price can’t be more than 12 × monthly.', { code: 'BAD_PRICE' });
      const inc = int(p.includedSeats || 1, 1); const max = int(p.maxSeats || inc, 1);
      if (max < inc) throw new ApiError(400, 'Max seats must be at least the included seats.', { code: 'BAD_SEATS' });
      const limits: Record<string, number> = {};
      for (const k of METER_KEYS) limits[k] = int(p.limits?.[k] ?? 0, -1);
      const features = normaliseFeatures(p.features);
      const highlights = (Array.isArray(p.highlights) ? p.highlights : []).map((h: unknown) => String(h).slice(0, 80)).slice(0, 6);
      await sql`INSERT INTO plans (id, name, tagline, badge, sort, visible, archived, price_monthly_paise, price_annual_paise, per_seat, included_seats, max_seats,
          seat_price_monthly_paise, seat_price_annual_paise, trial_days, limits, features, highlights, updated_at, updated_by)
        VALUES (${id}, ${String(p.name).slice(0, 40)}, ${String(p.tagline || '').slice(0, 120)}, ${String(p.badge || '').slice(0, 24)}, ${int(p.sort || 0, 0)},
          ${p.visible !== false}, ${!!p.archived}, ${pm}, ${pa}, ${!!p.perSeat}, ${inc}, ${max}, ${int(p.seatPriceMonthlyPaise || 0, 0)}, ${int(p.seatPriceAnnualPaise || 0, 0)},
          ${int(p.trialDays || 0, 0)}, ${JSON.stringify(limits)}::jsonb, ${JSON.stringify(features)}::jsonb, ${JSON.stringify(highlights)}::jsonb, now(), ${user.uid})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, badge = EXCLUDED.badge, sort = EXCLUDED.sort, visible = EXCLUDED.visible,
          archived = EXCLUDED.archived, price_monthly_paise = EXCLUDED.price_monthly_paise, price_annual_paise = EXCLUDED.price_annual_paise, per_seat = EXCLUDED.per_seat,
          included_seats = EXCLUDED.included_seats, max_seats = EXCLUDED.max_seats, seat_price_monthly_paise = EXCLUDED.seat_price_monthly_paise,
          seat_price_annual_paise = EXCLUDED.seat_price_annual_paise, trial_days = EXCLUDED.trial_days, limits = EXCLUDED.limits, features = EXCLUDED.features,
          highlights = EXCLUDED.highlights, updated_at = now(), updated_by = EXCLUDED.updated_by`;
      const before = plansById[id];
      await audit(user, before ? 'plan.update' : 'plan.create', id, {
        price: before ? { from: [before.price_monthly_paise, before.price_annual_paise], to: [pm, pa] } : [pm, pa], limits,
      }, reason);
      apiJson(res as any, 200, { plan: planFromRow((await sql`SELECT * FROM plans WHERE id = ${id}`)[0]) });
      return;
    }

    if (op === 'archivePlan') {
      const reason = needReason(body); const id = String(body.id || '');
      const cfg = await getConfig();
      if (id === cfg.defaultPlanId) throw new ApiError(400, 'You can’t archive the default plan.', { code: 'DEFAULT_PLAN' });
      await sql`UPDATE plans SET archived = true, visible = false, updated_at = now(), updated_by = ${user.uid} WHERE id = ${id}`;
      await audit(user, 'plan.archive', id, {}, reason);
      apiJson(res as any, 200, { ok: true });
      return;
    }

    if (op === 'saveAddon') {
      const reason = needReason(body); const a = body.addon || {};
      const id = String(a.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || newId('ad_');
      if (!METER_KEYS.includes(a.meter)) throw new ApiError(400, 'Pick what the top-up adds.', { code: 'BAD_METER' });
      await sql`INSERT INTO addons (id, name, meter, quantity, price_paise, recurring, visible, updated_at)
        VALUES (${id}, ${String(a.name || '').slice(0, 60)}, ${a.meter}, ${int(a.quantity, 1)}, ${int(a.pricePaise, 0)}, ${!!a.recurring}, ${a.visible !== false}, now())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, meter = EXCLUDED.meter, quantity = EXCLUDED.quantity, price_paise = EXCLUDED.price_paise,
          recurring = EXCLUDED.recurring, visible = EXCLUDED.visible, updated_at = now()`;
      await audit(user, 'addon.save', id, a, reason);
      apiJson(res as any, 200, { addon: addonFromRow((await sql`SELECT * FROM addons WHERE id = ${id}`)[0]) });
      return;
    }

    if (op === 'listOffers') {
      apiJson(res as any, 200, { offers: (await sql`SELECT * FROM offers ORDER BY updated_at DESC`).map(offerFromRow) });
      return;
    }

    if (op === 'saveOffer') {
      const reason = needReason(body); const o = body.offer || {};
      const code = String(o.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new ApiError(400, 'Code must be 3–20 letters, numbers, - or _.', { code: 'BAD_CODE' });
      if (!['percent', 'flat', 'extra_days', 'extra_quota'].includes(o.kind)) throw new ApiError(400, 'Pick an offer type.', { code: 'BAD_KIND' });
      const value = Number(o.value);
      if (o.kind === 'percent' && !(value >= 1 && value <= 100)) throw new ApiError(400, 'Percent must be 1–100.', { code: 'BAD_VALUE' });
      if (!(value > 0)) throw new ApiError(400, 'Value must be more than 0.', { code: 'BAD_VALUE' });
      if (o.kind === 'extra_quota' && !METER_KEYS.includes(o.meter)) throw new ApiError(400, 'Pick which limit the offer adds to.', { code: 'BAD_METER' });
      if (o.startsAt && o.endsAt && o.endsAt < o.startsAt) throw new ApiError(400, 'End date must be after the start date.', { code: 'BAD_DATES' });
      const id = String(o.id || '') || newId('off_');
      const dup = await sql`SELECT id FROM offers WHERE upper(code) = ${code} AND id <> ${id}`;
      if (dup[0]) throw new ApiError(409, 'That code is already used by another offer.', { code: 'DUPLICATE_CODE' });
      await sql`INSERT INTO offers (id, code, title, description, kind, value, meter, plan_ids, cycles, starts_at, ends_at, max_redemptions, per_user_limit,
          first_payment_only, auto_apply, active, updated_at)
        VALUES (${id}, ${code}, ${String(o.title || code).slice(0, 80)}, ${String(o.description || '').slice(0, 300)}, ${o.kind}, ${value}, ${o.meter || null},
          ${JSON.stringify(o.planIds || [])}::jsonb, ${JSON.stringify(o.cycles || [])}::jsonb, ${o.startsAt || null}, ${o.endsAt || null},
          ${int(o.maxRedemptions || 0, 0)}, ${int(o.perUserLimit ?? 1, 0)}, ${!!o.firstPaymentOnly}, ${!!o.autoApply}, ${o.active !== false}, now())
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, description = EXCLUDED.description, kind = EXCLUDED.kind, value = EXCLUDED.value,
          meter = EXCLUDED.meter, plan_ids = EXCLUDED.plan_ids, cycles = EXCLUDED.cycles, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
          max_redemptions = EXCLUDED.max_redemptions, per_user_limit = EXCLUDED.per_user_limit, first_payment_only = EXCLUDED.first_payment_only,
          auto_apply = EXCLUDED.auto_apply, active = EXCLUDED.active, updated_at = now()`;
      await audit(user, 'offer.save', code, o, reason);
      apiJson(res as any, 200, { offer: offerFromRow((await sql`SELECT * FROM offers WHERE id = ${id}`)[0]) });
      return;
    }

    if (op === 'usageReport') {
      const month = /^\d{4}-\d{2}$/.test(String(body.month || '')) ? String(body.month) : (await periodBounds()).key;
      const meters = await sql`SELECT meter AS key, sum(used)::int AS used, count(DISTINCT uid)::int AS users FROM usage_counters WHERE period = ${month} AND used > 0 GROUP BY meter`;
      const rows = await sql`SELECT uc.uid, uc.meter, uc.used, uc.extra, s.plan_id FROM usage_counters uc LEFT JOIN subscriptions s ON s.uid = uc.uid WHERE uc.period = ${month} AND uc.used > 0`;
      const scored = rows.map((r: any) => {
        const lim = Number(plansById[r.plan_id || 'free']?.limits?.[r.meter] ?? 0);
        const limit = lim === -1 ? -1 : lim + Number(r.extra || 0);
        return { uid: r.uid, key: r.meter, used: Number(r.used), limit, pct: limit > 0 ? r.used / limit : 0 };
      }).sort((a: any, b: any) => b.pct - a.pct).slice(0, 50);
      const top = await Promise.all(scored.map(async (s: any) => ({ ...s, email: String(((await ledgerGetUser(s.uid).catch(() => null)) as any)?.email || '') })));
      apiJson(res as any, 200, { month, meters: meters.map((m: any) => ({ key: m.key, used: Number(m.used), users: Number(m.users) })), top });
      return;
    }

    if (op === 'listPayments') {
      const status = String(body.status || 'ALL'); const offset = Math.max(0, Number(body.cursor || 0));
      const rows = status === 'REFUNDED'
        ? await sql`SELECT p.*, o.plan_id, i.number AS invoice_number FROM payments p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN invoices i ON i.order_id = p.order_id AND i.credit_note_of IS NULL
            WHERE p.refunded_paise > 0 ORDER BY p.created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`
        : status === 'ALL'
          ? await sql`SELECT p.*, o.plan_id, i.number AS invoice_number FROM payments p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN invoices i ON i.order_id = p.order_id AND i.credit_note_of IS NULL
              ORDER BY p.created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`
          : await sql`SELECT p.*, o.plan_id, i.number AS invoice_number FROM payments p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN invoices i ON i.order_id = p.order_id AND i.credit_note_of IS NULL
              WHERE p.status = ${status} ORDER BY p.created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`;
      const emails: Record<string, string> = {};
      for (const r of rows) if (!(r.uid in emails)) emails[r.uid] = String(((await ledgerGetUser(r.uid).catch(() => null)) as any)?.email || '');
      apiJson(res as any, 200, { payments: rows.slice(0, PAGE).map((r: any) => paymentOut(emails[r.uid])(r)), next: rows.length > PAGE ? String(offset + PAGE) : undefined });
      return;
    }

    if (op === 'refund') {
      const reason = needReason(body);
      const rows = await sql`SELECT * FROM payments WHERE id = ${String(body.paymentId || '')}`;
      const p = rows[0]; if (!p) throw new ApiError(404, 'Payment not found.', { code: 'PAYMENT_NOT_FOUND' });
      if (p.status !== 'SUCCESS') throw new ApiError(400, 'Only successful payments can be refunded.', { code: 'NOT_REFUNDABLE' });
      const amount = int(body.amountPaise, 1);
      const left = Number(p.amount_paise) - Number(p.refunded_paise || 0);
      if (amount > left) throw new ApiError(400, `You can refund up to ₹${(left / 100).toFixed(2)}.`, { code: 'OVER_REFUND' });
      const refundId = newId('rf_');
      await cfRefund(p.order_id, refundId, amount, reason);
      await sql`UPDATE payments SET refunded_paise = refunded_paise + ${amount} WHERE id = ${p.id}`;
      const order = (await sql`SELECT * FROM orders WHERE id = ${p.order_id}`)[0];
      const inv = (await sql`SELECT number FROM invoices WHERE order_id = ${p.order_id} AND credit_note_of IS NULL LIMIT 1`)[0];
      if (order) await createInvoice(order, order.quote as Quote, inv?.number || p.order_id, amount);
      await audit(user, 'payment.refund', p.id, { amountPaise: amount, orderId: p.order_id, refundId }, reason);
      await notifyUser(p.uid, 'Refund on its way', `₹${(amount / 100).toFixed(2)} will reach your account in 5–7 working days.`, '/#/billing', { push: true, email: true });
      const fresh = (await sql`SELECT p.*, o.plan_id FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.id = ${p.id}`)[0];
      apiJson(res as any, 200, { payment: paymentOut('')(fresh) });
      return;
    }

    if (op === 'listAudit') {
      const offset = Math.max(0, Number(body.cursor || 0));
      const rows = await sql`SELECT * FROM owner_audit ORDER BY at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`;
      apiJson(res as any, 200, {
        rows: rows.slice(0, PAGE).map((r: any) => ({ id: r.id, at: new Date(r.at).toISOString(), actorEmail: r.actor_email, action: r.action, target: r.target, detail: JSON.stringify(r.detail || {}).slice(0, 300), reason: r.reason })),
        next: rows.length > PAGE ? String(offset + PAGE) : undefined,
      });
      return;
    }

    if (op === 'getConfig') {
      apiJson(res as any, 200, { config: await getConfig(true) });
      return;
    }

    if (op === 'saveConfig') {
      const reason = needReason(body); const c = { ...(await getConfig(true)), ...(body.config || {}) };
      if (c.sellerGstin && !GSTIN_RE.test(String(c.sellerGstin).toUpperCase())) throw new ApiError(400, 'Seller GSTIN doesn’t look right.', { code: 'BAD_GSTIN' });
      c.sellerGstin = String(c.sellerGstin || '').toUpperCase();
      c.gstRate = Number(c.gstRate); if (!(c.gstRate >= 0 && c.gstRate <= 28)) throw new ApiError(400, 'GST rate must be 0–28.', { code: 'BAD_GST' });
      c.usageResetDay = int(c.usageResetDay, 1); if (c.usageResetDay > 28) throw new ApiError(400, 'Reset day must be 1–28.', { code: 'BAD_RESET_DAY' });
      c.trialDays = int(c.trialDays, 0); c.graceDays = int(c.graceDays, 0);
      if (!plansById[c.defaultPlanId]) throw new ApiError(400, 'Default plan doesn’t exist.', { code: 'BAD_PLAN' });
      if (c.trialPlanId && !plansById[c.trialPlanId]) throw new ApiError(400, 'Trial plan doesn’t exist.', { code: 'BAD_PLAN' });
      c.maintenance = !!c.maintenance;
      await sql`UPDATE app_config SET config = ${JSON.stringify(c)}::jsonb, updated_at = now() WHERE id = 1`;
      bustConfig();
      await audit(user, 'config.save', 'app', { maintenance: c.maintenance, announcement: c.announcement, gstRate: c.gstRate }, reason);
      apiJson(res as any, 200, { config: c });
      return;
    }

    if (op === 'sendAnnouncement') {
      const reason = needReason(body);
      const title = String(body.title || '').trim().slice(0, 80); const text = String(body.body || '').trim().slice(0, 400);
      if (!title || !text) throw new ApiError(400, 'Add a title and a message.', { code: 'EMPTY' });
      const audience = String(body.audience || 'all');
      const all = await ledgerListAllUsers(20000).catch(() => [] as any[]);
      const subs = Object.fromEntries((await sql`SELECT uid, status FROM subscriptions`).map((s: any) => [s.uid, s.status]));
      const targets = all.filter((u: any) => {
        const s = subs[u.uid] || 'free';
        if (u.status === 'deleted') return false;
        if (audience === 'free') return s === 'free'; if (audience === 'paying') return s === 'active' || s === 'past_due'; if (audience === 'trialing') return s === 'trialing';
        return true;
      });
      let sent = 0;
      const { sendFcm } = body.push ? await import('./fcm.js') : { sendFcm: null as any };
      for (const u of targets as any[]) {
        await ledgerAddNotification({ userId: u.uid, bookId: '', bookName: 'Byjan', kind: 'announcement', action: title, detail: text, link: '/', createdAt: new Date().toISOString(), read: false }).catch(() => undefined);
        if (sendFcm && u.pushToken) await sendFcm(String(u.pushToken), { title, body: text, data: { url: '/#/', kind: 'announcement' } }).catch(() => undefined);
        sent++;
      }
      await audit(user, 'announcement.send', audience, { title, push: !!body.push, sent }, reason);
      apiJson(res as any, 200, { sent });
      return;
    }

    throw new ApiError(400, 'Unknown owner operation', { code: 'UNKNOWN_OP' });
  });
}

const paymentOut = (email: string) => (r: any) => ({
  id: r.id, orderId: r.order_id, uid: r.uid, email, amountPaise: Number(r.amount_paise || 0),
  status: Number(r.refunded_paise || 0) >= Number(r.amount_paise || 0) && r.refunded_paise > 0 ? 'REFUNDED' : Number(r.refunded_paise || 0) > 0 ? 'PARTIALLY_REFUNDED' : r.status,
  method: r.method || '', createdAt: new Date(r.created_at).toISOString(), planId: r.plan_id || undefined, invoiceNumber: r.invoice_number || undefined,
  failureReason: r.failure_reason || undefined, refundedPaise: Number(r.refunded_paise || 0),
});

/** Revoke Firebase refresh tokens so a suspended user is signed out on next refresh. */
async function revokeTokens(uid: string) {
  try {
    const { googleIdentityToken } = await import('./fcm.js');
    const access = await googleIdentityToken(); if (!access) return;
    const project = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0616065043';
    await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`, {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({ localId: uid, validSince: String(Math.floor(Date.now() / 1000)) }),
    });
  } catch (e) { console.error('revoke failed', e); }
}
