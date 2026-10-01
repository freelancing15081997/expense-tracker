// Quotes, orders, activation, invoices. Used by saas-handlers, owner-handlers and the Cashfree webhook.
import { createHmac } from 'node:crypto';
import { ApiError, ledgerGetUser, ledgerAddNotification } from '../_pg-tables.js';
import { saasSql } from './saas-schema.js';
import { getConfig, getSubscriptionRow, planFromRow, offerFromRow, addonFromRow, subFromRow, periodBounds, newId } from './entitlements.js';
import {
  basePrice, buildQuote, bestOffer, offerProblem, prorationCredit, buyerState, periodEndFrom, fyLabel,
  type Cycle, type Line, type OfferRow, type Quote,
} from './pricing.js';

export type CheckoutInput = {
  kind: 'plan' | 'addon' | 'renewal' | 'seats'; planId?: string; cycle?: Cycle; seats?: number;
  addons?: Array<{ id: string; qty: number }>; coupon?: string; billing?: Record<string, string>;
};

const today = () => new Date().toISOString().slice(0, 10);

async function userOfferCtx(uid: string, offerId?: string) {
  const sql = await saasSql();
  const paid = await sql`SELECT 1 FROM orders WHERE uid = ${uid} AND status = 'PAID' LIMIT 1`;
  const used = offerId ? await sql`SELECT count(*)::int AS n FROM offer_redemptions WHERE uid = ${uid} AND offer_id = ${offerId}` : [{ n: 0 }];
  return { hasPaidOrder: !!paid[0], userRedemptions: Number(used[0]?.n || 0) };
}

export async function findOffer(code: string) {
  const sql = await saasSql();
  const rows = await sql`SELECT * FROM offers WHERE upper(code) = ${String(code || '').trim().toUpperCase()}`;
  return rows[0] ? offerFromRow(rows[0]) : null;
}

export async function validateCoupon(uid: string, code: string, planId?: string, cycle?: Cycle) {
  const offer = await findOffer(code);
  const ctx = await userOfferCtx(uid, offer?.id);
  const problem = offerProblem(offer, { planId, cycle, today: today(), ...ctx });
  return problem ? { error: problem } : { offer };
}

export async function quoteFor(uid: string, input: CheckoutInput): Promise<{ quote: Quote; planId: string; cycle: Cycle; seats: number; addons: Array<{ id: string; qty: number }> }> {
  const sql = await saasSql();
  const cfg = await getConfig();
  const sub = await getSubscriptionRow(uid);
  const kind = input.kind || 'plan';
  const cycle: Cycle = input.cycle === 'annual' ? 'annual' : input.cycle === 'monthly' ? 'monthly' : (sub.cycle || 'monthly');
  const lines: Line[] = [];
  let planId = String(input.planId || sub.plan_id || cfg.defaultPlanId);
  let seats = Math.max(1, Number(input.seats || sub.seats || 1));
  let credit: { paise: number; label: string } | undefined; let prorationNote: string | undefined;
  const addonsIn = Array.isArray(input.addons) ? input.addons.filter((a) => a && a.id && Number(a.qty) > 0) : [];

  if (kind === 'plan' || kind === 'renewal' || kind === 'seats') {
    if (kind === 'renewal') planId = sub.plan_id;
    const rows = await sql`SELECT * FROM plans WHERE id = ${planId} AND archived = false`;
    if (!rows[0]) throw new ApiError(404, 'That plan is not available.', { code: 'PLAN_NOT_FOUND' });
    const plan = planFromRow(rows[0]);
    if (plan.priceMonthlyPaise === 0 && kind !== 'seats') throw new ApiError(400, 'The free plan does not need checkout.', { code: 'FREE_PLAN' });
    seats = plan.perSeat ? Math.min(plan.maxSeats, Math.max(plan.includedSeats, seats)) : 1;
    if (kind === 'seats') {
      // prorated charge for added seats only
      const current = Number(sub.seats || 1);
      const add = Math.max(0, seats - Math.max(current, plan.includedSeats));
      const each = cycle === 'annual' ? plan.seatPriceAnnualPaise : plan.seatPriceMonthlyPaise;
      const full = add * each;
      const ratio = sub.current_period_end ? Math.max(0, (new Date(sub.current_period_end).getTime() - Date.now()) / (new Date(sub.current_period_end).getTime() - new Date(sub.current_period_start).getTime())) : 1;
      lines.push({ label: `${add} extra seat${add === 1 ? '' : 's'} · rest of this period`, amountPaise: Math.round(full * Math.min(1, ratio)) });
      prorationNote = 'Charged for the days left in this period. Renews at the full seat price.';
    } else {
      lines.push(...basePrice(plan, cycle, seats));
      const isChange = kind === 'plan' && sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > new Date();
      if (isChange) {
        const paise = prorationCredit({ lastPaidSubtotalPaise: Number(sub.last_paid_subtotal_paise || 0), periodStart: sub.current_period_start, periodEnd: sub.current_period_end, now: new Date() });
        const oldPlan = await sql`SELECT name FROM plans WHERE id = ${sub.plan_id}`;
        if (paise > 0) { credit = { paise, label: `Credit for unused ${oldPlan[0]?.name || 'plan'}` }; prorationNote = 'Your new plan starts today. Unused days on your current plan are credited.'; }
      }
    }
  }
  if (addonsIn.length) {
    const rows = await sql`SELECT * FROM addons WHERE visible = true`;
    for (const a of addonsIn) {
      const row = rows.find((r: any) => r.id === a.id);
      if (!row) throw new ApiError(404, 'That top-up is not available.', { code: 'ADDON_NOT_FOUND' });
      const ad = addonFromRow(row);
      lines.push({ label: `${ad.name}${a.qty > 1 ? ` × ${a.qty}` : ''}${ad.recurring ? ' · monthly' : ''}`, amountPaise: ad.pricePaise * Number(a.qty) });
    }
  }
  if (!lines.length) throw new ApiError(400, 'Nothing to buy.', { code: 'EMPTY_ORDER' });

  // offer: explicit coupon wins, else best auto-apply
  let offer: OfferRow | null = null; let couponError: string | undefined;
  const ctxBase = await userOfferCtx(uid);
  if (input.coupon) {
    const v = await validateCoupon(uid, input.coupon, planId, cycle);
    if ('offer' in v) offer = v.offer as OfferRow; else couponError = v.error;
  }
  if (!offer && !input.coupon) {
    const rows = await sql`SELECT * FROM offers WHERE active = true AND auto_apply = true`;
    const ok: OfferRow[] = [];
    for (const r of rows) {
      const o = offerFromRow(r);
      const ctx = { ...ctxBase, userRedemptions: (await userOfferCtx(uid, o.id)).userRedemptions };
      if (!offerProblem(o, { planId, cycle, today: today(), ...ctx })) ok.push(o);
    }
    const sub0 = lines.reduce((a, l) => a + l.amountPaise, 0) - (credit?.paise || 0);
    offer = bestOffer(ok, Math.max(0, sub0));
  }
  const quote = buildQuote({
    lines, credit, offer, couponError, gstRate: Number(cfg.gstRate), sellerState: cfg.sellerState,
    buyerState: buyerState(input.billing || sub.billing), prorationNote,
  });
  return { quote, planId, cycle, seats, addons: addonsIn };
}

// ---------- activation (idempotent on order id) ----------
export async function activate(orderId: string) {
  const sql = await saasSql();
  const claimed = await sql`UPDATE orders SET status = 'PAID', paid_at = COALESCE(paid_at, now()), activated_at = now()
    WHERE id = ${orderId} AND activated_at IS NULL RETURNING *`;
  if (!claimed[0]) {
    const inv = await sql`SELECT * FROM invoices WHERE order_id = ${orderId} AND credit_note_of IS NULL LIMIT 1`;
    const o = await sql`SELECT uid FROM orders WHERE id = ${orderId}`;
    return { already: true, invoice: inv[0] ? invoiceOut(inv[0]) : undefined, subscription: o[0] ? subFromRow(await getSubscriptionRow(o[0].uid)) : undefined };
  }
  const order = claimed[0];
  const uid = order.uid as string;
  const quote = order.quote as Quote;
  const sub = await getSubscriptionRow(uid);
  const now = new Date();
  const cycle = (order.cycle || 'monthly') as Cycle;

  if (order.kind === 'plan' || order.kind === 'renewal') {
    let start = now;
    if (order.kind === 'renewal' && sub.current_period_end && new Date(sub.current_period_end) > now) start = new Date(sub.current_period_end);
    let end = periodEndFrom(start, cycle);
    if (quote.extraDays) end = new Date(end.getTime() + quote.extraDays * 86400000);
    const periodStart = order.kind === 'renewal' && start > now ? sub.current_period_start : start.toISOString();
    const planSubtotal = quote.lines.filter((l) => l.amountPaise > 0 && !/top-up|\+/.test(l.label)).reduce((a, l) => a + l.amountPaise, 0);
    const recurringAddons = await mergeRecurringAddons(sub.addons, order.addons);
    await sql`UPDATE subscriptions SET plan_id = ${order.plan_id}, status = 'active', cycle = ${cycle}, seats = ${order.seats || 1},
      addons = ${JSON.stringify(recurringAddons)}::jsonb, current_period_start = ${periodStart}, current_period_end = ${end.toISOString()},
      cancel_at_period_end = false, cancel_reason = NULL, trial_ends_at = NULL, comp = false, comp_until = NULL, pending_seats = NULL,
      billing = ${JSON.stringify(order.billing || sub.billing || {})}::jsonb, last_paid_subtotal_paise = ${planSubtotal},
      next_amount_paise = ${quote.totalPaise}, reminders = '{}'::jsonb, updated_at = now() WHERE uid = ${uid}`;
  } else if (order.kind === 'seats') {
    await sql`UPDATE subscriptions SET seats = ${order.seats}, pending_seats = NULL, updated_at = now() WHERE uid = ${uid}`;
  } else if (order.kind === 'addon') {
    const recurringAddons = await mergeRecurringAddons(sub.addons, order.addons);
    await sql`UPDATE subscriptions SET addons = ${JSON.stringify(recurringAddons)}::jsonb, updated_at = now() WHERE uid = ${uid}`;
  }

  // one-time add-ons + extra_quota offers → this period's extra
  const { key } = await periodBounds();
  const addRows = await sql`SELECT * FROM addons`;
  for (const a of (Array.isArray(order.addons) ? order.addons : []) as Array<{ id: string; qty: number }>) {
    const row = addRows.find((r: any) => r.id === a.id);
    if (!row || row.recurring) continue;
    const amount = Number(row.quantity) * Number(a.qty || 1);
    await sql`INSERT INTO usage_counters (uid, period, meter, extra) VALUES (${uid}, ${key}, ${row.meter}, ${amount})
      ON CONFLICT (uid, period, meter) DO UPDATE SET extra = usage_counters.extra + ${amount}`;
  }
  if (quote.offer?.kind === 'extra_quota' && quote.offer.meter) {
    const amount = Math.round(Number(quote.offer.value));
    await sql`INSERT INTO usage_counters (uid, period, meter, extra) VALUES (${uid}, ${key}, ${quote.offer.meter}, ${amount})
      ON CONFLICT (uid, period, meter) DO UPDATE SET extra = usage_counters.extra + ${amount}`;
  }
  if (quote.offer?.id) {
    const ins = await sql`INSERT INTO offer_redemptions (id, offer_id, uid, order_id) VALUES (${newId('red_')}, ${quote.offer.id}, ${uid}, ${orderId}) ON CONFLICT DO NOTHING RETURNING id`;
    if (ins[0]) await sql`UPDATE offers SET redemptions = redemptions + 1 WHERE id = ${quote.offer.id}`;
  }
  const invoice = await createInvoice(order, quote);
  const planRow = await sql`SELECT name FROM plans WHERE id = ${order.plan_id}`;
  await notifyUser(uid, 'Payment received', order.kind === 'addon' ? 'Your top-up is ready to use.' : `You're on ${planRow[0]?.name || 'your new plan'}.`, '/#/billing');
  emailInvoice(uid, invoice).catch((e) => console.error('invoice email failed', e));
  return { already: false, invoice: invoiceOut(invoice), subscription: subFromRow(await getSubscriptionRow(uid)) };
}

async function mergeRecurringAddons(current: unknown, incoming: unknown) {
  const sql = await saasSql();
  const rec = new Set((await sql`SELECT id FROM addons WHERE recurring = true`).map((r: any) => r.id));
  const out: Array<{ id: string; qty: number }> = Array.isArray(current) ? [...current as any] : [];
  for (const a of (Array.isArray(incoming) ? incoming : []) as Array<{ id: string; qty: number }>) {
    if (!rec.has(a.id)) continue;
    const ex = out.find((o) => o.id === a.id);
    if (ex) ex.qty += Number(a.qty || 1); else out.push({ id: a.id, qty: Number(a.qty || 1) });
  }
  return out;
}

// ---------- invoices ----------
async function nextInvoiceNumber(prefix: string, d = new Date()) {
  const sql = await saasSql();
  const fy = fyLabel(d);
  const rows = await sql`INSERT INTO invoice_seq (fy, seq) VALUES (${fy}, 1) ON CONFLICT (fy) DO UPDATE SET seq = invoice_seq.seq + 1 RETURNING seq`;
  return `${prefix}/${fy}/${String(rows[0].seq).padStart(6, '0')}`;
}

export async function createInvoice(order: any, quote: Quote, creditNoteOf?: string, overrideTotal?: number) {
  const sql = await saasSql();
  const cfg = await getConfig();
  const profile = await ledgerGetUser(order.uid).catch(() => null) as any;
  const buyer = { name: order.billing?.name || profile?.displayName || '', email: order.billing?.email || profile?.email || '', gstin: order.billing?.gstin || '', state: buyerState(order.billing), address: order.billing?.address || '' };
  const seller = { name: cfg.sellerName, gstin: cfg.sellerGstin, state: cfg.sellerState, email: cfg.supportEmail };
  const id = newId('inv_');
  const number = await nextInvoiceNumber(creditNoteOf ? `${cfg.invoicePrefix}-CN` : cfg.invoicePrefix);
  const sign = creditNoteOf ? -1 : 1;
  const total = overrideTotal ?? quote.totalPaise;
  const scale = quote.totalPaise ? total / quote.totalPaise : 0;
  const s = (n: number) => sign * Math.round(n * (creditNoteOf ? scale : 1));
  const lines = (creditNoteOf ? [{ label: `Refund against ${creditNoteOf}`, amountPaise: s(quote.subtotalPaise - quote.discountPaise) }] : quote.lines);
  const rows = await sql`INSERT INTO invoices (id, number, uid, order_id, date, lines, subtotal_paise, discount_paise, tax_paise, cgst_paise, sgst_paise, igst_paise, total_paise, status, seller, buyer, credit_note_of)
    VALUES (${id}, ${number}, ${order.uid}, ${order.id}, ${today()}, ${JSON.stringify(lines)}::jsonb, ${s(quote.subtotalPaise)}, ${s(quote.discountPaise)},
      ${s(quote.taxPaise)}, ${s(quote.cgstPaise)}, ${s(quote.sgstPaise)}, ${s(quote.igstPaise)}, ${sign * total}, ${creditNoteOf ? 'refunded' : 'paid'},
      ${JSON.stringify(seller)}::jsonb, ${JSON.stringify(buyer)}::jsonb, ${creditNoteOf || null}) RETURNING *`;
  return rows[0];
}

export const invoiceOut = (i: any) => ({
  id: i.id, number: i.number, date: new Date(i.date).toISOString().slice(0, 10), subtotalPaise: i.subtotal_paise, discountPaise: i.discount_paise,
  taxPaise: i.tax_paise, totalPaise: i.total_paise, status: i.status, lines: i.lines || [], creditNoteOf: i.credit_note_of || undefined,
});

const rupees = (p: number) => `Rs ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export async function invoicePdfBytes(inv: any): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const s = inv.seller || {}; const b = inv.buyer || {};
  let y = 56;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(inv.credit_note_of ? 'Credit note' : 'Tax invoice', 48, y);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${inv.number}  ·  ${new Date(inv.date).toISOString().slice(0, 10)}`, 48, (y += 18));
  y += 24; doc.setFont('helvetica', 'bold'); doc.text('From', 48, y); doc.text('Bill to', 300, y); doc.setFont('helvetica', 'normal');
  const from = [s.name, s.gstin ? `GSTIN ${s.gstin}` : '', s.state, s.email].filter(Boolean);
  const to = [b.name, b.email, b.gstin ? `GSTIN ${b.gstin}` : '', b.state, b.address].filter(Boolean);
  for (let i = 0; i < Math.max(from.length, to.length); i++) { y += 14; if (from[i]) doc.text(String(from[i]), 48, y); if (to[i]) doc.text(String(to[i]).slice(0, 60), 300, y); }
  y += 30; doc.setLineWidth(2); doc.line(48, y, 547, y); y += 18;
  for (const l of inv.lines || []) { doc.text(String(l.label).slice(0, 70), 48, y); doc.text(rupees(l.amountPaise), 547, y, { align: 'right' }); y += 16; }
  y += 6; doc.setLineWidth(1); doc.line(48, y, 547, y); y += 18;
  const row = (k: string, v: number, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(k, 360, y); doc.text(rupees(v), 547, y, { align: 'right' }); y += 16; };
  row('Subtotal', inv.subtotal_paise); if (inv.discount_paise) row('Discount', -inv.discount_paise);
  if (inv.cgst_paise || inv.sgst_paise) { row('CGST', inv.cgst_paise); row('SGST', inv.sgst_paise); } else row('IGST', inv.igst_paise);
  row('Total', inv.total_paise, true);
  y += 24; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Byjan Books subscription. This is a computer-generated invoice.', 48, y);
  return Buffer.from(doc.output('arraybuffer'));
}

function invoiceSigningSecret() {
  const secret = process.env.INVOICE_SIGNING_SECRET || process.env.CRON_SECRET || process.env.CASHFREE_SECRET_KEY || '';
  if (!secret) throw new Error('Invoice links need INVOICE_SIGNING_SECRET, CRON_SECRET, or CASHFREE_SECRET_KEY');
  return secret;
}
export function signedInvoiceUrl(id: string, ttlSec = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac('sha256', invoiceSigningSecret()).update(`${id}.${exp}`).digest('hex').slice(0, 32);
  const base = String(process.env.PUBLIC_APP_URL || 'https://www.easypado.com').replace(/\/+$/, '');
  return `${base}/api/payments/cashfree-page?op=invoice&id=${encodeURIComponent(id)}&exp=${exp}&sig=${sig}`;
}
export function checkInvoiceSig(id: string, exp: string, sig: string) {
  if (Number(exp) < Date.now() / 1000) return false;
  let secret = '';
  try { secret = invoiceSigningSecret(); } catch { return false; }
  const want = createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex').slice(0, 32);
  return want === sig;
}

async function emailInvoice(uid: string, inv: any) {
  const to = inv.buyer?.email; if (!to) return;
  const { sendTracedMail } = await import('./smtp-mail.js');
  const pdf = await invoicePdfBytes(inv);
  await sendTracedMail({
    to, subject: `Your Byjan invoice ${inv.number}`, kind: 'email.invoice',
    text: `Thanks for your payment of ${rupees(inv.total_paise)}. Your invoice ${inv.number} is attached.`,
    attachments: [{ filename: `${inv.number.replace(/\//g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}

// ---------- notify ----------
export async function notifyUser(uid: string, title: string, body: string, link = '/', opts: { push?: boolean; email?: boolean } = { push: true }) {
  await ledgerAddNotification({ userId: uid, bookId: '', bookName: 'Byjan', kind: 'system', action: title, detail: body, link, createdAt: new Date().toISOString(), read: false }).catch(() => undefined);
  const profile = await ledgerGetUser(uid).catch(() => null) as any;
  if (opts.push !== false && profile?.pushToken && profile?.appPrefs?.pushOn !== false) {
    const { sendFcm } = await import('./fcm.js');
    await sendFcm(String(profile.pushToken), { title, body, data: { url: `/#${link.replace(/^\/#/, '')}`, kind: 'billing' } }).catch(() => undefined);
  }
  if (opts.email && profile?.email && profile?.appPrefs?.emailOn !== false) {
    const { sendTracedMail } = await import('./smtp-mail.js');
    await sendTracedMail({ to: profile.email, subject: title, text: body, kind: 'email.billing' }).catch(() => undefined);
  }
}
