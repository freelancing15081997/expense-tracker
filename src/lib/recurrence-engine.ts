/**
 * Deterministic Recurrence Engine for Byjan Money.
 * AI is never required. Amounts stay as number rupees (display); comparisons use paise integers.
 */

export type Frequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'custom';

export type ConfidenceBand = 'CONFIRMED' | 'LIKELY' | 'POSSIBLE' | 'NOT_RECURRING';

export type PatternStatus = 'active' | 'paused' | 'ignored' | 'stopped';

export type TxRow = {
  id: string;
  amount?: number;
  date?: string;
  merchant?: string;
  description?: string;
  category?: string;
  entryType?: string;
  paymentMethod?: string;
  bookId?: string;
  bookName?: string;
};

export type RegularPayment = {
  id: string;
  merchantKey: string;
  merchant: string;
  category: string;
  bookId?: string;
  bookName?: string;
  entryType: 'in' | 'out';
  paymentMethod?: string;
  frequency: Frequency;
  frequencyLabel: string;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  lastDate: string;
  nextExpected: string;
  occurrences: number;
  confidence: number;
  band: ConfidenceBand;
  confidenceLabel: string;
  status: PatternStatus;
  yearlyEstimate: number;
  amountTrend: 'up' | 'down' | 'stable';
  missed: boolean;
  lateDays: number;
  explanation: string;
  expenseIds: string[];
  userConfirmed?: boolean;
  expectedAmount?: number;
  nextDateOverride?: string;
  frequencyOverride?: Frequency;
};

export type MoneyInsight = {
  id: string;
  kind:
    | 'upcoming'
    | 'missed'
    | 'price_up'
    | 'stopped'
    | 'unusual'
    | 'duplicate'
    | 'category_spike'
    | 'needs_review';
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  href?: string;
  amount?: number;
  bookId?: string;
  patternId?: string;
};

function toPaise(n: unknown) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

function fromPaise(p: number) {
  return Math.round(p) / 100;
}

export function normalizeMerchant(raw: string) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(upi|payment|paid|to|from|via|neft|imps|rtgs)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function displayMerchant(raw: string, key: string) {
  const s = String(raw || '').trim();
  if (s) return s.slice(0, 80);
  if (!key) return 'Unknown';
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDay(d: string) {
  const t = Date.parse(`${String(d || '').slice(0, 10)}T12:00:00`);
  return Number.isFinite(t) ? t : 0;
}

function isoFromMs(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addFrequency(day: string, freq: Frequency) {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  switch (freq) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'half_yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return isoFromMs(d.getTime());
}

function frequencyLabel(freq: Frequency) {
  switch (freq) {
    case 'weekly': return 'week';
    case 'biweekly': return '2 weeks';
    case 'monthly': return 'month';
    case 'quarterly': return 'quarter';
    case 'half_yearly': return '6 months';
    case 'yearly': return 'year';
    default: return 'cycle';
  }
}

function classifyGap(medianDays: number): Frequency {
  if (medianDays >= 5 && medianDays <= 9) return 'weekly';
  if (medianDays >= 12 && medianDays <= 17) return 'biweekly';
  if (medianDays >= 25 && medianDays <= 35) return 'monthly';
  if (medianDays >= 80 && medianDays <= 100) return 'quarterly';
  if (medianDays >= 160 && medianDays <= 200) return 'half_yearly';
  if (medianDays >= 330 && medianDays <= 400) return 'yearly';
  return 'custom';
}

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}

function mean(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = mean(nums.map((n) => (n - m) ** 2));
  return Math.sqrt(v);
}

function bandFromScore(score: number, userConfirmed?: boolean): ConfidenceBand {
  if (userConfirmed) return 'CONFIRMED';
  if (score >= 0.85) return 'CONFIRMED';
  if (score >= 0.65) return 'LIKELY';
  if (score >= 0.45) return 'POSSIBLE';
  return 'NOT_RECURRING';
}

function confidenceLabel(band: ConfidenceBand) {
  switch (band) {
    case 'CONFIRMED': return 'Confirmed';
    case 'LIKELY': return 'Very likely';
    case 'POSSIBLE': return 'Possible';
    default: return 'Not regular';
  }
}

function yearlyMultiplier(freq: Frequency) {
  switch (freq) {
    case 'weekly': return 52;
    case 'biweekly': return 26;
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'half_yearly': return 2;
    case 'yearly': return 1;
    default: return 12;
  }
}

export type UserPatternPref = {
  id: string;
  status?: PatternStatus;
  userConfirmed?: boolean;
  expectedAmount?: number;
  nextDateOverride?: string;
  frequencyOverride?: Frequency;
  merchantKey?: string;
};

/**
 * Detect regular payments from transaction history.
 * Priority when merging: user prefs override detection.
 */
export function detectRegularPayments(
  expenses: TxRow[],
  prefs: UserPatternPref[] = [],
  opts?: { today?: string },
): RegularPayment[] {
  const today = opts?.today || isoFromMs(Date.now());
  const todayMs = parseDay(today);
  const groups = new Map<string, TxRow[]>();

  for (const exp of expenses) {
    const t = String(exp.entryType || 'out');
    if (t === 'transfer') continue;
    const key = normalizeMerchant(String(exp.merchant || exp.description || ''));
    if (!key || key.length < 2) continue;
    const bucket = `${t}|${key}|${String(exp.bookId || '')}`;
    const list = groups.get(bucket) || [];
    list.push(exp);
    groups.set(bucket, list);
  }

  const prefByKey = new Map<string, UserPatternPref>();
  for (const p of prefs) {
    if (p.merchantKey) prefByKey.set(p.merchantKey, p);
    prefByKey.set(p.id, p);
  }

  const out: RegularPayment[] = [];

  for (const [bucket, rows] of groups) {
    const [entryType, merchantKey] = bucket.split('|');
    const dated = rows
      .map((r) => ({ ...r, _ms: parseDay(String(r.date || '')) }))
      .filter((r) => r._ms > 0)
      .sort((a, b) => a._ms - b._ms);

    if (dated.length < 3) continue;

    const gaps: number[] = [];
    for (let i = 1; i < dated.length; i += 1) {
      gaps.push(Math.round((dated[i]._ms - dated[i - 1]._ms) / 86400000));
    }
    const medGap = median(gaps);
    if (medGap < 5 || medGap > 400) continue;
    const gapCv = medGap > 0 ? stdev(gaps) / medGap : 1;
    if (gapCv > 0.55 && dated.length < 5) continue;

    const amounts = dated.map((r) => toPaise(r.amount)).filter((n) => n > 0);
    if (amounts.length < 3) continue;
    const avgP = Math.round(mean(amounts));
    const minP = Math.min(...amounts);
    const maxP = Math.max(...amounts);
    const amtCv = avgP > 0 ? stdev(amounts) / avgP : 1;
    if (amtCv > 0.85) continue;

    let frequency = classifyGap(medGap);
    const pref = prefByKey.get(merchantKey) || prefs.find((p) => p.merchantKey === merchantKey);
    if (pref?.frequencyOverride) frequency = pref.frequencyOverride;

    let score = 0.35;
    score += Math.min(0.35, dated.length * 0.05);
    score += gapCv < 0.25 ? 0.2 : gapCv < 0.4 ? 0.1 : 0;
    score += amtCv < 0.2 ? 0.15 : amtCv < 0.4 ? 0.08 : 0;
    if (frequency !== 'custom') score += 0.08;
    score = Math.max(0, Math.min(0.99, score));

    const last = dated[dated.length - 1];
    const lastDate = String(last.date || '').slice(0, 10);
    let nextExpected = pref?.nextDateOverride || addFrequency(lastDate, frequency);
    const expectedGap = Math.max(1, medGap);
    const lateDays = Math.max(0, Math.round((todayMs - parseDay(nextExpected)) / 86400000));
    const missed = lateDays >= Math.max(3, Math.round(expectedGap * 0.35));

    const recent = amounts.slice(-3);
    const older = amounts.slice(0, Math.max(1, amounts.length - 3));
    const recentAvg = mean(recent);
    const olderAvg = mean(older);
    let amountTrend: 'up' | 'down' | 'stable' = 'stable';
    if (olderAvg > 0 && recentAvg > olderAvg * 1.12) amountTrend = 'up';
    else if (olderAvg > 0 && recentAvg < olderAvg * 0.88) amountTrend = 'down';

    const inactiveDays = Math.round((todayMs - parseDay(lastDate)) / 86400000);
    let status: PatternStatus = 'active';
    if (pref?.status) status = pref.status;
    else if (inactiveDays > expectedGap * 3.2) status = 'stopped';

    const band = bandFromScore(score, pref?.userConfirmed);
    if (band === 'NOT_RECURRING' && !pref?.userConfirmed) continue;

    const merchant = displayMerchant(String(last.merchant || last.description || ''), merchantKey);
    const category = String(last.category || 'Uncategorized');
    const avgAmount = pref?.expectedAmount ?? fromPaise(avgP);
    const id = `rp_${merchantKey}_${entryType}_${String(last.bookId || 'b')}`.replace(/\s+/g, '_').slice(0, 80);

    out.push({
      id,
      merchantKey,
      merchant,
      category,
      bookId: last.bookId ? String(last.bookId) : undefined,
      bookName: last.bookName ? String(last.bookName) : undefined,
      entryType: entryType === 'in' ? 'in' : 'out',
      paymentMethod: last.paymentMethod ? String(last.paymentMethod) : undefined,
      frequency,
      frequencyLabel: frequencyLabel(frequency),
      avgAmount,
      minAmount: fromPaise(minP),
      maxAmount: fromPaise(maxP),
      lastDate,
      nextExpected,
      occurrences: dated.length,
      confidence: Math.round(score * 100),
      band,
      confidenceLabel: confidenceLabel(band),
      status,
      yearlyEstimate: Math.round(avgAmount * yearlyMultiplier(frequency) * 100) / 100,
      amountTrend,
      missed,
      lateDays: missed ? lateDays : 0,
      explanation: `You've paid ${merchant} ${dated.length} times, about once every ${frequencyLabel(frequency)}, with similar amounts.`,
      expenseIds: dated.map((r) => String(r.id)),
      userConfirmed: Boolean(pref?.userConfirmed),
      expectedAmount: pref?.expectedAmount,
      nextDateOverride: pref?.nextDateOverride,
      frequencyOverride: pref?.frequencyOverride,
    });
  }

  return out
    .filter((p) => p.status !== 'ignored')
    .sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? -1 : 1;
      return parseDay(a.nextExpected) - parseDay(b.nextExpected);
    });
}

export function buildMoneyInsights(
  patterns: RegularPayment[],
  expenses: TxRow[],
  opts?: { today?: string; dismissedIds?: string[] },
): MoneyInsight[] {
  const today = opts?.today || isoFromMs(Date.now());
  const todayMs = parseDay(today);
  const dismissed = new Set(opts?.dismissedIds || []);
  const insights: MoneyInsight[] = [];

  const upcoming = patterns.filter((p) => {
    if (p.status !== 'active') return false;
    const days = Math.round((parseDay(p.nextExpected) - todayMs) / 86400000);
    return days >= 0 && days <= 7;
  });
  if (upcoming.length) {
    const total = upcoming.reduce((s, p) => s + p.avgAmount, 0);
    insights.push({
      id: 'ins_upcoming_week',
      kind: 'upcoming',
      title: 'Upcoming',
      detail: `${upcoming.length} regular payment${upcoming.length === 1 ? '' : 's'} expected this week · ₹${Math.round(total).toLocaleString('en-IN')} estimated`,
      priority: 'medium',
      actionLabel: 'View',
      href: '/regular-payments',
      amount: total,
    });
  }

  for (const p of patterns.filter((x) => x.missed && x.status === 'active').slice(0, 5)) {
    insights.push({
      id: `ins_missed_${p.id}`,
      kind: 'missed',
      title: 'Needs attention',
      detail: `${p.merchant} payment appears ${p.lateDays} day${p.lateDays === 1 ? '' : 's'} late.`,
      priority: 'high',
      actionLabel: 'Review',
      href: `/regular-payments?focus=${encodeURIComponent(p.id)}`,
      amount: p.avgAmount,
      bookId: p.bookId,
      patternId: p.id,
    });
  }

  for (const p of patterns.filter((x) => x.amountTrend === 'up' && x.status === 'active').slice(0, 4)) {
    insights.push({
      id: `ins_price_${p.id}`,
      kind: 'price_up',
      title: 'Good to know',
      detail: `${p.merchant} looks more expensive lately (usually ₹${Math.round(p.minAmount)}–₹${Math.round(p.maxAmount)}).`,
      priority: 'medium',
      actionLabel: 'Review',
      href: `/regular-payments?focus=${encodeURIComponent(p.id)}`,
      patternId: p.id,
      bookId: p.bookId,
    });
  }

  for (const p of patterns.filter((x) => x.status === 'stopped').slice(0, 3)) {
    insights.push({
      id: `ins_stopped_${p.id}`,
      kind: 'stopped',
      title: 'Good to know',
      detail: `${p.merchant} regular payment may have stopped.`,
      priority: 'low',
      actionLabel: 'Review',
      href: `/regular-payments?focus=${encodeURIComponent(p.id)}`,
      patternId: p.id,
    });
  }

  // Category spike vs prior month
  const month = today.slice(0, 7);
  const prev = (() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const catNow = new Map<string, number>();
  const catPrev = new Map<string, number>();
  for (const e of expenses) {
    if (String(e.entryType || 'out') !== 'out') continue;
    const d = String(e.date || '').slice(0, 7);
    const cat = String(e.category || 'Uncategorized');
    const amt = Number(e.amount || 0);
    if (d === month) catNow.set(cat, (catNow.get(cat) || 0) + amt);
    if (d === prev) catPrev.set(cat, (catPrev.get(cat) || 0) + amt);
  }
  for (const [cat, nowAmt] of catNow) {
    const was = catPrev.get(cat) || 0;
    if (was >= 500 && nowAmt > was * 1.25) {
      const pct = Math.round(((nowAmt - was) / was) * 100);
      insights.push({
        id: `ins_cat_${cat}`,
        kind: 'category_spike',
        title: 'Spending pattern',
        detail: `${cat} spending is ${pct}% higher than your usual monthly level.`,
        priority: pct >= 40 ? 'high' : 'medium',
        actionLabel: 'View',
        href: '/reports',
        amount: nowAmt,
      });
    }
  }

  // Duplicate same-day clusters
  const clusters = new Map<string, number>();
  for (const e of expenses) {
    if (String(e.entryType || 'out') !== 'out') continue;
    const key = `${String(e.date || '').slice(0, 10)}|${toPaise(e.amount)}|${normalizeMerchant(String(e.merchant || e.description || ''))}`;
    clusters.set(key, (clusters.get(key) || 0) + 1);
  }
  for (const [key, count] of clusters) {
    if (count < 2) continue;
    const [date, , merchant] = key.split('|');
    insights.push({
      id: `ins_dup_${key}`.slice(0, 80),
      kind: 'duplicate',
      title: 'Needs attention',
      detail: `Possible duplicate on ${date} for ${merchant || 'a merchant'} (${count} similar entries).`,
      priority: 'high',
      actionLabel: 'Review',
      href: '/expenses',
    });
    break;
  }

  return insights
    .filter((i) => !dismissed.has(i.id))
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    })
    .slice(0, 12);
}

export function summarizeRegularPayments(patterns: RegularPayment[], today?: string) {
  const day = today || isoFromMs(Date.now());
  const month = day.slice(0, 7);
  const active = patterns.filter((p) => p.status === 'active' && p.entryType === 'out');
  const monthly = active
    .filter((p) => ['monthly', 'weekly', 'biweekly'].includes(p.frequency))
    .reduce((s, p) => {
      if (p.frequency === 'weekly') return s + p.avgAmount * 4.33;
      if (p.frequency === 'biweekly') return s + p.avgAmount * 2.17;
      return s + p.avgAmount;
    }, 0);
  const upcomingMonth = active.filter((p) => String(p.nextExpected).startsWith(month));
  const yearly = active.reduce((s, p) => s + p.yearlyEstimate, 0);
  const changed = active.filter((p) => p.amountTrend !== 'stable' || p.missed).length;
  return {
    monthlyCommitments: Math.round(monthly * 100) / 100,
    upcomingThisMonth: upcomingMonth.length,
    upcomingAmount: Math.round(upcomingMonth.reduce((s, p) => s + p.avgAmount, 0) * 100) / 100,
    yearlyEstimate: Math.round(yearly * 100) / 100,
    recentlyChanged: changed,
  };
}

/** Map a confirmed regular payment into legacy RecurringRule shape for posting. */
export function patternToRecurringRule(p: RegularPayment) {
  const cadence = p.frequency === 'weekly' || p.frequency === 'biweekly' ? 'weekly' as const : 'monthly' as const;
  return {
    id: p.id,
    description: p.merchant,
    amount: p.expectedAmount ?? p.avgAmount,
    category: p.category,
    entryType: p.entryType,
    merchant: p.merchant,
    paymentMethod: p.paymentMethod,
    cadence,
    nextDate: p.nextDateOverride || p.nextExpected,
    active: p.status === 'active',
  };
}
