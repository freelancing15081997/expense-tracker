// /api/saas — customer billing + hourly cron. Routed from api/tracker.ts (domain=saas).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, apiJson, withDomainApi, applyApiCors, ledgerGetUser, ledgerUpsertUser } from '../_pg-tables.js';
import { saasSql, MONTHLY_METERS } from './saas-schema.js';
import {
  getConfig, getSubscriptionRow, effectivePlan, planFromRow, addonFromRow, offerFromRow, subFromRow, usageSnapshot, rateLimit, newId, periodBounds,
} from './entitlements.js';
import { quoteFor, validateCoupon, activate, invoiceOut, signedInvoiceUrl, notifyUser, type CheckoutInput } from './billing.js';
import { cfCreateOrder, cfGetOrder, cfGetPayments, pickPayment, methodOf, cfMode } from './cashfree.js';
import { GSTIN_RE } from './pricing.js';

const appUrl = () => String(process.env.PUBLIC_APP_URL || 'https://www.easypado.com').replace(/\/+$/, '');
const q = (req: VercelRequest, k: string) => { const v = req.query?.[k]; return String(Array.isArray(v) ? v[0] : v || ''); };

export async function handleSaas(req: VercelRequest, res: VercelResponse) {
  const op0 = q(req, 'op') || String((req.body as any)?.op || '');
  if (op0 === 'publicConfig') {
    applyApiCors(req as any, res as any);
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    let c: Awaited<ReturnType<typeof getConfig>>;
    try { c = await getConfig(); } catch (e) {
      // Called on every app launch without sign-in: never let a database hiccup escape as an unhandled error.
      console.error('saas.publicConfig', e);
      apiJson(res as any, 503, { error: 'Service is busy. Try again shortly.', code: 'UNAVAILABLE' });
      return;
    }
    res.setHeader('cache-control', 'public, max-age=60');
    apiJson(res as any, 200, { config: { maintenance: c.maintenance, maintenanceMessage: c.maintenanceMessage, announcement: c.announcement, announcementTone: c.announcementTone, minAppVersion: c.minAppVersion } });
    return;
  }
  if (op0 === 'cron') {
    const auth = String(req.headers.authorization || '');
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) { apiJson(res as any, 401, { error: 'Unauthorized', code: 'UNAUTHORIZED' }); return; }
    apiJson(res as any, 200, await runCron());
    return;
  }

  await withDomainApi(req as any, res as any, async (user: { uid: string; email: string }, body: Record<string, any>) => {
    const op = String(body.op || '');
    const sql = await saasSql();

    if (op === 'catalog') {
      const cfg = await getConfig();
      const plans = (await sql`SELECT * FROM plans WHERE visible = true AND archived = false ORDER BY sort, price_monthly_paise`).map(planFromRow);
      const addons = (await sql`SELECT * FROM addons WHERE visible = true ORDER BY price_paise`).map(addonFromRow);
      const day = new Date().toISOString().slice(0, 10);
      const offers = (await sql`SELECT * FROM offers WHERE active = true AND auto_apply = true
        AND (starts_at IS NULL OR starts_at <= ${day}) AND (ends_at IS NULL OR ends_at >= ${day})`).map(offerFromRow);
      apiJson(res as any, 200, { plans, addons, offers, gstRate: cfg.gstRate, currency: 'INR' });
      return;
    }

    if (op === 'me') {
      await getSubscriptionRow(user.uid);
      const { plan, sub } = await effectivePlan(user.uid);
      const subPlan = planFromRow((await sql`SELECT * FROM plans WHERE id = ${sub.plan_id}`)[0] || {});
      const day = new Date().toISOString().slice(0, 10);
      const offers = (await sql`SELECT * FROM offers WHERE active = true AND auto_apply = true
        AND (starts_at IS NULL OR starts_at <= ${day}) AND (ends_at IS NULL OR ends_at >= ${day})`).map(offerFromRow);
      apiJson(res as any, 200, { subscription: subFromRow(sub), plan: sub.status === 'free' ? plan : (subPlan.id ? subPlan : plan), effectivePlanId: plan.id, usage: await usageSnapshot(user.uid), offers });
      return;
    }

    if (op === 'quote') {
      const r = await quoteFor(user.uid, body as CheckoutInput);
      apiJson(res as any, 200, { quote: r.quote });
      return;
    }

    if (op === 'validateCoupon') {
      apiJson(res as any, 200, await validateCoupon(user.uid, String(body.code || ''), body.planId, body.cycle));
      return;
    }

    if (op === 'createOrder' || op === 'changeSeats') {
      await rateLimit(`order:${user.uid}`, 10);
      let input = body as CheckoutInput;
      const sub = await getSubscriptionRow(user.uid);
      if (op === 'changeSeats') {
        const seats = Math.max(1, Math.floor(Number(body.seats || 1)));
        const plan = planFromRow((await sql`SELECT * FROM plans WHERE id = ${sub.plan_id}`)[0] || {});
        if (!plan.perSeat) throw new ApiError(400, 'Your plan does not have seats.', { code: 'NOT_PER_SEAT' });
        if (seats > plan.maxSeats) throw new ApiError(400, `This plan allows up to ${plan.maxSeats} seats.`, { code: 'MAX_SEATS' });
        if (seats < plan.includedSeats) throw new ApiError(400, `This plan includes ${plan.includedSeats} seats minimum.`, { code: 'MIN_SEATS' });
        if (seats <= Number(sub.seats || 1) || sub.status !== 'active') {
          await sql`UPDATE subscriptions SET pending_seats = ${seats}, updated_at = now() WHERE uid = ${user.uid}`;
          const q2 = await quoteFor(user.uid, { kind: 'renewal', seats });
          apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(user.uid)), quote: q2.quote });
          return;
        }
        input = { kind: 'seats', planId: sub.plan_id, cycle: sub.cycle, seats, billing: sub.billing };
      }
      const billing = { ...(sub.billing || {}), ...(input.billing || {}) } as Record<string, string>;
      if (billing.gstin) {
        billing.gstin = billing.gstin.toUpperCase().trim();
        if (!GSTIN_RE.test(billing.gstin)) throw new ApiError(400, 'That GSTIN doesn’t look right. Check the 15 characters.', { code: 'BAD_GSTIN' });
      }
      const { quote, planId, cycle, seats, addons } = await quoteFor(user.uid, { ...input, billing });
      if (input.coupon && quote.couponError) throw new ApiError(400, quote.couponError, { code: 'BAD_COUPON' });
      const idem = String(body.idempotencyKey || '') || null;
      if (idem) {
        const prev = await sql`SELECT * FROM orders WHERE idempotency_key = ${idem}`;
        if (prev[0]) { apiJson(res as any, 200, { orderId: prev[0].id, paymentSessionId: prev[0].payment_session_id, mode: cfMode(), quote: prev[0].quote, free: prev[0].status === 'PAID' && !prev[0].payment_session_id }); return; }
      }
      const orderId = `byj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const kind = input.kind || 'plan';
      await sql`INSERT INTO orders (id, uid, kind, plan_id, cycle, seats, addons, coupon, quote, billing, status, idempotency_key)
        VALUES (${orderId}, ${user.uid}, ${kind}, ${planId}, ${cycle}, ${seats}, ${JSON.stringify(addons)}::jsonb, ${input.coupon || null},
        ${JSON.stringify(quote)}::jsonb, ${JSON.stringify(billing)}::jsonb, 'CREATED', ${idem})`;
      if (billing && Object.keys(billing).length) await sql`UPDATE subscriptions SET billing = ${JSON.stringify(billing)}::jsonb WHERE uid = ${user.uid}`;
      if (quote.totalPaise <= 0) {
        const r = await activate(orderId);
        apiJson(res as any, 200, { orderId, free: true, quote, subscription: r.subscription, invoice: r.invoice });
        return;
      }
      const profile = await ledgerGetUser(user.uid).catch(() => null) as any;
      const cf = await cfCreateOrder({
        orderId, amountPaise: quote.totalPaise, uid: user.uid, email: billing.email || user.email, phone: profile?.phone, name: billing.name || profile?.displayName,
        kind, returnUrl: `${appUrl()}/pay/return?order_id={order_id}`, notifyUrl: `${appUrl()}/api/payments/cashfree/webhook`,
      });
      await sql`UPDATE orders SET cf_order_id = ${cf.cf_order_id}, payment_session_id = ${cf.payment_session_id}, status = 'ACTIVE' WHERE id = ${orderId}`;
      apiJson(res as any, 200, { orderId, paymentSessionId: cf.payment_session_id, mode: cfMode(), quote });
      return;
    }

    if (op === 'verifyOrder') {
      const orderId = String(body.orderId || '');
      const rows = await sql`SELECT * FROM orders WHERE id = ${orderId} AND uid = ${user.uid}`;
      if (!rows[0]) throw new ApiError(404, 'We could not find that payment.', { code: 'ORDER_NOT_FOUND' });
      if (rows[0].activated_at) {
        const r = await activate(orderId);
        apiJson(res as any, 200, { status: 'PAID', subscription: r.subscription, invoice: r.invoice });
        return;
      }
      const cfo = await cfGetOrder(orderId);
      if (cfo.order_status === 'PAID') {
        const pays = await cfGetPayments(orderId).catch(() => []);
        const p = pickPayment(pays);
        if (p) await upsertPayment(orderId, user.uid, p);
        const r = await activate(orderId);
        apiJson(res as any, 200, { status: 'PAID', subscription: r.subscription, invoice: r.invoice });
        return;
      }
      const pays = await cfGetPayments(orderId).catch(() => []);
      const p = pickPayment(pays);
      if (p) await upsertPayment(orderId, user.uid, p);
      const ps = String(p?.payment_status || '');
      let status = 'PENDING'; let message = 'We’re waiting for your bank to confirm. This can take a minute.';
      if (cfo.order_status === 'EXPIRED') { status = 'EXPIRED'; message = 'This payment link expired. Please try again.'; }
      else if (ps === 'FAILED') { status = 'FAILED'; message = p?.payment_message ? `The payment didn’t go through: ${String(p.payment_message).slice(0, 80)}` : 'The payment didn’t go through. No money was taken.'; }
      else if (ps === 'USER_DROPPED' || (!p && cfo.order_status === 'ACTIVE' && body.closed)) { status = 'USER_DROPPED'; message = 'Payment cancelled.'; }
      await sql`UPDATE orders SET status = ${status === 'PENDING' ? 'ACTIVE' : status} WHERE id = ${orderId} AND activated_at IS NULL`;
      apiJson(res as any, 200, { status, message });
      return;
    }

    if (op === 'startTrial') {
      const planId = String(body.planId || '');
      const plan = planFromRow((await sql`SELECT * FROM plans WHERE id = ${planId} AND archived = false`)[0] || {});
      if (!plan.id || plan.trialDays <= 0) throw new ApiError(400, 'This plan has no free trial.', { code: 'NO_TRIAL' });
      const sub = await getSubscriptionRow(user.uid);
      if (sub.trial_used) throw new ApiError(409, 'You’ve already used your free trial.', { code: 'TRIAL_USED' });
      if (sub.status === 'active') throw new ApiError(409, 'You already have a paid plan.', { code: 'ALREADY_PAID' });
      const ends = new Date(Date.now() + plan.trialDays * 86400000);
      await sql`UPDATE subscriptions SET plan_id = ${plan.id}, status = 'trialing', trial_ends_at = ${ends.toISOString()}, trial_used = true, reminders = '{}'::jsonb, updated_at = now() WHERE uid = ${user.uid}`;
      apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(user.uid)) });
      return;
    }

    if (op === 'cancel') {
      const sub = await getSubscriptionRow(user.uid);
      if (!['active', 'past_due', 'trialing'].includes(sub.status)) throw new ApiError(400, 'There is no paid plan to cancel.', { code: 'NOTHING_TO_CANCEL' });
      if (sub.status === 'trialing') {
        const cfg = await getConfig();
        await sql`UPDATE subscriptions SET status = 'free', plan_id = ${cfg.defaultPlanId}, trial_ends_at = NULL, cancel_reason = ${String(body.reason || '')}, updated_at = now() WHERE uid = ${user.uid}`;
      } else {
        await sql`UPDATE subscriptions SET cancel_at_period_end = true, cancel_reason = ${String(body.reason || '').slice(0, 500)}, updated_at = now() WHERE uid = ${user.uid}`;
      }
      apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(user.uid)) });
      return;
    }

    if (op === 'resume') {
      const sub = await getSubscriptionRow(user.uid);
      if (!sub.cancel_at_period_end) throw new ApiError(400, 'Your plan is not set to cancel.', { code: 'NOT_CANCELLING' });
      if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) throw new ApiError(400, 'This period already ended. Choose a plan to start again.', { code: 'PERIOD_ENDED' });
      await sql`UPDATE subscriptions SET cancel_at_period_end = false, cancel_reason = NULL, updated_at = now() WHERE uid = ${user.uid}`;
      apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(user.uid)) });
      return;
    }

    if (op === 'listInvoices') {
      const rows = await sql`SELECT * FROM invoices WHERE uid = ${user.uid} ORDER BY date DESC, number DESC LIMIT 100`;
      apiJson(res as any, 200, { invoices: rows.map(invoiceOut) });
      return;
    }

    if (op === 'invoicePdf') {
      const rows = await sql`SELECT id FROM invoices WHERE id = ${String(body.id || '')} AND uid = ${user.uid}`;
      if (!rows[0]) throw new ApiError(404, 'Invoice not found.', { code: 'INVOICE_NOT_FOUND' });
      apiJson(res as any, 200, { url: signedInvoiceUrl(rows[0].id) });
      return;
    }

    if (op === 'updateBilling') {
      const b = body.billing && typeof body.billing === 'object' ? { ...body.billing } as Record<string, string> : {};
      if (b.gstin) { b.gstin = String(b.gstin).toUpperCase().trim(); if (!GSTIN_RE.test(b.gstin)) throw new ApiError(400, 'That GSTIN doesn’t look right. Check the 15 characters.', { code: 'BAD_GSTIN' }); }
      for (const k of Object.keys(b)) b[k] = String(b[k] || '').slice(0, 200);
      await getSubscriptionRow(user.uid);
      await sql`UPDATE subscriptions SET billing = ${JSON.stringify(b)}::jsonb, updated_at = now() WHERE uid = ${user.uid}`;
      apiJson(res as any, 200, { subscription: subFromRow(await getSubscriptionRow(user.uid)) });
      return;
    }

    throw new ApiError(400, 'Unknown billing operation', { code: 'UNKNOWN_OP' });
  });
}

export async function upsertPayment(orderId: string, uid: string, p: any) {
  const sql = await saasSql();
  const cfId = String(p.cf_payment_id || '');
  if (!cfId) return;
  const status = String(p.payment_status || 'PENDING');
  const amount = Math.round(Number(p.payment_amount || 0) * 100);
  await sql`INSERT INTO payments (id, order_id, uid, cf_payment_id, amount_paise, status, method, failure_reason, raw)
    VALUES (${newId('pay_')}, ${orderId}, ${uid}, ${cfId}, ${amount}, ${status}, ${methodOf(p)}, ${p.payment_message || null}, ${JSON.stringify(p)}::jsonb)
    ON CONFLICT (cf_payment_id) DO UPDATE SET status = EXCLUDED.status, failure_reason = EXCLUDED.failure_reason, raw = EXCLUDED.raw`;
}

// ---------- hourly cron (each step idempotent via subscriptions.reminders flags) ----------
export async function runCron() {
  const sql = await saasSql();
  const cfg = await getConfig(true);
  const out: Record<string, number> = {};
  const flag = async (uid: string, key: string) => {
    const r = await sql`UPDATE subscriptions SET reminders = reminders || ${JSON.stringify({ [key]: new Date().toISOString() })}::jsonb
      WHERE uid = ${uid} AND NOT (reminders ? ${key}) RETURNING uid`;
    return !!r[0];
  };
  const bump = (k: string) => { out[k] = (out[k] || 0) + 1; };

  // 1. trial reminders + expiry
  for (const s of await sql`SELECT uid, trial_ends_at FROM subscriptions WHERE status = 'trialing' AND trial_ends_at IS NOT NULL`) {
    const left = (new Date(s.trial_ends_at).getTime() - Date.now()) / 86400000;
    if (left <= 0) {
      await sql`UPDATE subscriptions SET status = 'free', plan_id = ${cfg.defaultPlanId}, updated_at = now() WHERE uid = ${s.uid} AND status = 'trialing'`;
      await notifyUser(s.uid, 'Your trial ended', 'You’re back on Free. Your data is safe. Upgrade any time to get your limits back.', '/#/plans', { push: true, email: true }); bump('trialEnded');
    } else if (left <= 1 && await flag(s.uid, 'trial1')) { await notifyUser(s.uid, 'Your trial ends tomorrow', 'Pick a plan to keep your higher limits.', '/#/plans', { push: true, email: true }); bump('trialReminder'); }
    else if (left <= 3 && await flag(s.uid, 'trial3')) { await notifyUser(s.uid, 'Your trial ends in 3 days', 'Pick a plan to keep your higher limits.', '/#/plans', { push: true, email: true }); bump('trialReminder'); }
  }
  // 2. renewal reminders
  for (const s of await sql`SELECT uid FROM subscriptions WHERE status = 'active' AND comp = false AND cancel_at_period_end = false
      AND current_period_end BETWEEN now() AND now() + interval '3 days'`) {
    if (await flag(s.uid, 'renew3')) { await notifyUser(s.uid, 'Your plan renews in 3 days', 'Tap to pay now and keep everything running.', '/#/checkout?kind=renewal', { push: true, email: true }); bump('renewalReminder'); }
  }
  // 3. period end
  for (const s of await sql`SELECT uid, cancel_at_period_end FROM subscriptions WHERE status = 'active' AND comp = false AND current_period_end < now()`) {
    if (s.cancel_at_period_end) {
      await sql`UPDATE subscriptions SET status = 'free', plan_id = ${cfg.defaultPlanId}, cancel_at_period_end = false, updated_at = now() WHERE uid = ${s.uid}`;
      await notifyUser(s.uid, 'Your plan has ended', 'You’re on Free now. Your books and entries are safe.', '/#/plans'); bump('cancelled');
    } else {
      await sql`UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE uid = ${s.uid}`;
      await notifyUser(s.uid, 'Payment due', `Pay within ${cfg.graceDays} days to keep your plan.`, '/#/checkout?kind=renewal', { push: true, email: true }); bump('pastDue');
    }
  }
  for (const s of await sql`SELECT uid FROM subscriptions WHERE status = 'past_due' AND current_period_end < now() - make_interval(days => ${Number(cfg.graceDays)})`) {
    await sql`UPDATE subscriptions SET status = 'free', plan_id = ${cfg.defaultPlanId}, updated_at = now() WHERE uid = ${s.uid}`;
    await notifyUser(s.uid, 'You’re on Free now', 'We couldn’t collect your renewal. Upgrade any time.', '/#/plans', { push: true, email: true }); bump('graceEnded');
  }
  // 4. comp end
  for (const s of await sql`SELECT uid FROM subscriptions WHERE comp = true AND comp_until IS NOT NULL AND comp_until < current_date`) {
    await sql`UPDATE subscriptions SET comp = false, comp_until = NULL, status = CASE WHEN current_period_end > now() THEN 'active' ELSE 'free' END,
      plan_id = CASE WHEN current_period_end > now() THEN plan_id ELSE ${cfg.defaultPlanId} END, updated_at = now() WHERE uid = ${s.uid}`;
    await notifyUser(s.uid, 'Your free months have ended', 'Pick a plan to keep your limits.', '/#/plans'); bump('compEnded');
  }
  // 5. seat decreases scheduled for renewal are applied by activate(); carry recurring extra is computed live. Clear stale one-time extra:
  const { key } = await periodBounds();
  await sql`DELETE FROM usage_counters WHERE period < ${key} AND period < to_char(now() - interval '13 months', 'YYYY-MM')`;
  // 6. purge accounts deleted > 30 days ago
  try {
    const { deleteFirebaseAuthUser } = await import('./fcm.js');
    const users = await sql`SELECT uid FROM user_status WHERE status = 'deleted' AND at < now() - interval '30 days'`;
    for (const u of users) {
      await ledgerUpsertUser(u.uid, { email: '', displayName: 'Deleted user', phone: '', upiId: '', pushToken: '', purgedAt: new Date().toISOString() }, true).catch(() => undefined);
      await deleteFirebaseAuthUser(u.uid).catch(() => undefined);
      await sql`UPDATE user_status SET status = 'purged' WHERE uid = ${u.uid}`; bump('purged');
    }
  } catch (e) { console.error('purge failed', e); }
  return { ok: true, ...out, meters: MONTHLY_METERS.length };
}
