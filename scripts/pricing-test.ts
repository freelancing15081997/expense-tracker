// npm run test:pricing — pure unit tests, no DB.
import assert from 'node:assert/strict';
import { basePrice, buildQuote, offerProblem, offerDiscount, prorationCredit, buyerState, fyLabel, bestOffer, GSTIN_RE, type PlanRow, type OfferRow } from '../api/_lib/pricing.js';

const plan = (o: Partial<PlanRow> = {}): PlanRow => ({
  id: 'pro', name: 'Pro', priceMonthlyPaise: 24900, priceAnnualPaise: 249900, perSeat: false, includedSeats: 1, maxSeats: 1,
  seatPriceMonthlyPaise: 0, seatPriceAnnualPaise: 0, trialDays: 14, limits: {}, features: {}, ...o,
});
const offer = (o: Partial<OfferRow> = {}): OfferRow => ({
  id: 'o1', code: 'SAVE20', title: '20% off', kind: 'percent', value: 20, planIds: [], cycles: [], maxRedemptions: 0, perUserLimit: 1,
  firstPaymentOnly: false, autoApply: false, active: true, redemptions: 0, ...o,
});
let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log('✓', name); };

t('monthly base price', () => assert.equal(basePrice(plan(), 'monthly', 1)[0].amountPaise, 24900));
t('annual base price', () => assert.equal(basePrice(plan(), 'annual', 1)[0].amountPaise, 249900));
t('per-seat: extra seats above included', () => {
  const biz = plan({ id: 'business', name: 'Business', priceMonthlyPaise: 59900, perSeat: true, includedSeats: 3, maxSeats: 100, seatPriceMonthlyPaise: 14900 });
  const lines = basePrice(biz, 'monthly', 5);
  assert.equal(lines.length, 2); assert.equal(lines[1].amountPaise, 2 * 14900);
  assert.equal(basePrice(biz, 'monthly', 2).length, 1);
});
t('IGST when buyer state differs', () => {
  const q = buildQuote({ lines: [{ label: 'Pro', amountPaise: 24900 }], gstRate: 18, sellerState: 'Karnataka', buyerState: 'Maharashtra' });
  assert.equal(q.taxPaise, 4482); assert.equal(q.igstPaise, 4482); assert.equal(q.cgstPaise, 0); assert.equal(q.totalPaise, 29382);
});
t('CGST+SGST when same state', () => {
  const q = buildQuote({ lines: [{ label: 'Pro', amountPaise: 24900 }], gstRate: 18, sellerState: 'Karnataka', buyerState: 'karnataka' });
  assert.equal(q.cgstPaise + q.sgstPaise, q.taxPaise); assert.equal(q.igstPaise, 0);
});
t('unknown buyer state → IGST', () => {
  const q = buildQuote({ lines: [{ label: 'x', amountPaise: 10000 }], gstRate: 18, sellerState: 'Karnataka', buyerState: '' });
  assert.equal(q.igstPaise, 1800);
});
t('percent offer discounts before GST', () => {
  const q = buildQuote({ lines: [{ label: 'Pro', amountPaise: 24900 }], offer: offer(), gstRate: 18, sellerState: 'Karnataka', buyerState: '' });
  assert.equal(q.discountPaise, 4980); assert.equal(q.taxPaise, Math.round(19920 * 0.18)); assert.equal(q.totalPaise, 19920 + q.taxPaise);
});
t('flat offer capped at subtotal', () => assert.equal(offerDiscount(offer({ kind: 'flat', value: 999999 }), 9900), 9900));
t('100% coupon → zero total', () => {
  const q = buildQuote({ lines: [{ label: 'Plus', amountPaise: 9900 }], offer: offer({ value: 100 }), gstRate: 18, sellerState: 'K', buyerState: '' });
  assert.equal(q.totalPaise, 0);
});
t('extra_days offer: no price change, days carried', () => {
  const q = buildQuote({ lines: [{ label: 'Plus', amountPaise: 9900 }], offer: offer({ kind: 'extra_days', value: 30 }), gstRate: 18, sellerState: 'K', buyerState: '' });
  assert.equal(q.discountPaise, 0); assert.equal(q.extraDays, 30);
});
t('offer validation rules', () => {
  const ctx = { planId: 'pro', cycle: 'monthly' as const, today: '2026-10-01', userRedemptions: 0, hasPaidOrder: false };
  assert.equal(offerProblem(offer(), ctx), '');
  assert.match(offerProblem(null, ctx), /not valid/);
  assert.match(offerProblem(offer({ active: false }), ctx), /no longer/);
  assert.match(offerProblem(offer({ endsAt: '2026-09-30' }), ctx), /expired/);
  assert.match(offerProblem(offer({ startsAt: '2026-11-01' }), ctx), /not active yet/);
  assert.match(offerProblem(offer({ planIds: ['plus'] }), ctx), /plan/);
  assert.match(offerProblem(offer({ cycles: ['annual'] }), ctx), /annual/);
  assert.match(offerProblem(offer({ maxRedemptions: 5, redemptions: 5 }), ctx), /used up/);
  assert.match(offerProblem(offer(), { ...ctx, userRedemptions: 1 }), /already used/);
  assert.match(offerProblem(offer({ firstPaymentOnly: true }), { ...ctx, hasPaidOrder: true }), /first payment/);
});
t('proration credit for half period', () => {
  const now = new Date('2026-10-16T00:00:00Z');
  const c = prorationCredit({ lastPaidSubtotalPaise: 9900, periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-10-31T00:00:00Z', now });
  assert.equal(c, Math.round(9900 * 15 / 30));
  assert.equal(prorationCredit({ lastPaidSubtotalPaise: 9900, periodStart: '2026-09-01', periodEnd: '2026-09-30', now }), 0);
});
t('credit line reduces subtotal, never below zero', () => {
  const q = buildQuote({ lines: [{ label: 'Pro', amountPaise: 24900 }], credit: { paise: 4950, label: 'Credit for unused Plus' }, gstRate: 18, sellerState: 'K', buyerState: '' });
  assert.equal(q.subtotalPaise, 19950); assert.equal(q.lines.at(-1)!.amountPaise, -4950);
  const z = buildQuote({ lines: [{ label: 'x', amountPaise: 100 }], credit: { paise: 5000, label: 'c' }, gstRate: 18, sellerState: 'K', buyerState: '' });
  assert.equal(z.totalPaise, 0);
});
t('GSTIN regex + state from GSTIN', () => {
  assert.ok(GSTIN_RE.test('29ABCDE1234F1Z5')); assert.ok(!GSTIN_RE.test('29ABCDE1234F1X5'));
  assert.equal(buyerState({ gstin: '27ABCDE1234F1Z5' }), 'Maharashtra'); assert.equal(buyerState({ state: 'Goa' }), 'Goa');
});
t('FY label April–March', () => { assert.equal(fyLabel(new Date('2026-04-01')), '26-27'); assert.equal(fyLabel(new Date('2027-03-31')), '26-27'); assert.equal(fyLabel(new Date('2026-03-31')), '25-26'); });
t('best auto offer picks the larger discount', () => {
  const b = bestOffer([offer({ id: 'a', value: 10 }), offer({ id: 'b', kind: 'flat', value: 5000 })], 24900);
  assert.equal(b?.id, 'b');
});
console.log(`\n${n} pricing tests passed`);
