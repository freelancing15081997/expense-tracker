// Pure pricing — no I/O. Unit-tested in scripts/pricing-test.ts.
export type Cycle = 'monthly' | 'annual';
export type PlanRow = {
  id: string; name: string; priceMonthlyPaise: number; priceAnnualPaise: number; perSeat: boolean; includedSeats: number; maxSeats: number;
  seatPriceMonthlyPaise: number; seatPriceAnnualPaise: number; trialDays: number; limits: Record<string, number>; features: Record<string, boolean>;
};
export type AddonRow = { id: string; name: string; meter: string; quantity: number; pricePaise: number; recurring: boolean };
export type OfferRow = {
  id: string; code: string; title: string; kind: 'percent' | 'flat' | 'extra_days' | 'extra_quota'; value: number; meter?: string;
  planIds: string[]; cycles: Cycle[]; startsAt?: string; endsAt?: string; maxRedemptions: number; perUserLimit: number;
  firstPaymentOnly: boolean; autoApply: boolean; active: boolean; redemptions: number;
};
export type Line = { label: string; amountPaise: number };
export type Quote = {
  lines: Line[]; subtotalPaise: number; discountPaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
  totalPaise: number; offer: OfferRow | null; couponError?: string; prorationNote?: string; extraDays: number;
};

const r = (n: number) => Math.round(n);
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GST state codes (first 2 digits of GSTIN) → state name, for place-of-supply. */
const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};
export function buyerState(billing?: { gstin?: string; state?: string }) {
  const g = String(billing?.gstin || '').toUpperCase();
  if (GSTIN_RE.test(g)) return STATE_CODES[g.slice(0, 2)] || '';
  return String(billing?.state || '').trim();
}

export function basePrice(plan: PlanRow, cycle: Cycle, seats: number): Line[] {
  const lines: Line[] = [];
  const price = cycle === 'annual' ? plan.priceAnnualPaise : plan.priceMonthlyPaise;
  lines.push({ label: `${plan.name} · ${cycle === 'annual' ? 'yearly' : 'monthly'}`, amountPaise: r(price) });
  if (plan.perSeat) {
    const extra = Math.max(0, Math.min(seats, plan.maxSeats || seats) - plan.includedSeats);
    if (extra > 0) {
      const each = cycle === 'annual' ? plan.seatPriceAnnualPaise : plan.seatPriceMonthlyPaise;
      lines.push({ label: `${extra} extra seat${extra > 1 ? 's' : ''}`, amountPaise: r(extra * each) });
    }
  }
  return lines;
}

export function offerProblem(o: OfferRow | null | undefined, ctx: { planId?: string; cycle?: Cycle; today: string; userRedemptions: number; hasPaidOrder: boolean }) {
  if (!o) return 'That code is not valid.';
  if (!o.active) return 'That code is no longer active.';
  if (o.startsAt && ctx.today < o.startsAt) return 'That code is not active yet.';
  if (o.endsAt && ctx.today > o.endsAt) return 'That code has expired.';
  if (o.planIds?.length && ctx.planId && !o.planIds.includes(ctx.planId)) return 'That code does not apply to this plan.';
  if (o.cycles?.length && ctx.cycle && !o.cycles.includes(ctx.cycle)) return `That code only works on ${o.cycles.join(' / ')} billing.`;
  if (o.maxRedemptions > 0 && o.redemptions >= o.maxRedemptions) return 'That code has been used up.';
  if (o.perUserLimit > 0 && ctx.userRedemptions >= o.perUserLimit) return 'You have already used that code.';
  if (o.firstPaymentOnly && ctx.hasPaidOrder) return 'That code is only for your first payment.';
  return '';
}

export function offerDiscount(o: OfferRow, subtotal: number) {
  if (o.kind === 'percent') return r(subtotal * Math.min(100, Math.max(0, Number(o.value))) / 100);
  if (o.kind === 'flat') return Math.min(r(Number(o.value)), subtotal);
  return 0;
}

export function prorationCredit(input: { lastPaidSubtotalPaise: number; periodStart?: string | Date | null; periodEnd?: string | Date | null; now: Date }) {
  if (!input.periodStart || !input.periodEnd || !input.lastPaidSubtotalPaise) return 0;
  const s = new Date(input.periodStart).getTime(); const e = new Date(input.periodEnd).getTime(); const n = input.now.getTime();
  if (!(e > s) || n >= e) return 0;
  const DAY = 86400000;
  const total = Math.max(1, Math.round((e - s) / DAY));
  const remaining = Math.max(0, Math.floor((e - Math.max(n, s)) / DAY));
  return r(input.lastPaidSubtotalPaise * remaining / total);
}

export function buildQuote(input: {
  lines: Line[]; credit?: { paise: number; label: string }; offer?: OfferRow | null; couponError?: string;
  gstRate: number; sellerState: string; buyerState: string; prorationNote?: string;
}): Quote {
  const lines = input.lines.map((l) => ({ ...l, amountPaise: r(l.amountPaise) }));
  if (input.credit && input.credit.paise > 0) lines.push({ label: input.credit.label, amountPaise: -r(input.credit.paise) });
  const subtotal = Math.max(0, lines.reduce((a, l) => a + l.amountPaise, 0));
  const offer = input.offer || null;
  const discount = offer ? offerDiscount(offer, subtotal) : 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = r(taxable * input.gstRate / 100);
  const same = !!input.buyerState && input.buyerState.toLowerCase() === input.sellerState.toLowerCase();
  const cgst = same ? Math.floor(tax / 2) : 0;
  const sgst = same ? tax - cgst : 0;
  const igst = same ? 0 : tax;
  return {
    lines, subtotalPaise: subtotal, discountPaise: discount, taxPaise: tax, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst,
    totalPaise: subtotal - discount + tax, offer, couponError: input.couponError || undefined, prorationNote: input.prorationNote,
    extraDays: offer?.kind === 'extra_days' ? Math.max(0, Math.round(Number(offer.value))) : 0,
  };
}

/** Pick the best single auto-apply offer (offers never stack). */
export function bestOffer(candidates: OfferRow[], subtotal: number) {
  let best: OfferRow | null = null; let bestValue = -1;
  for (const o of candidates) {
    const v = o.kind === 'percent' || o.kind === 'flat' ? offerDiscount(o, subtotal) : o.kind === 'extra_days' ? Number(o.value) * subtotal / 3000 : 1;
    if (v > bestValue) { best = o; bestValue = v; }
  }
  return best;
}

export function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
export function periodEndFrom(start: Date, cycle: Cycle) { return addMonths(start, cycle === 'annual' ? 12 : 1); }

/** Indian FY label: April–March → '26-27'. */
export function fyLabel(d: Date) {
  const y = d.getFullYear(); const start = d.getMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
