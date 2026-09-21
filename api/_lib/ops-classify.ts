/** Classify ops/trace failures so Trace can surface free-tier / quota issues by feature. */

export type OpsFeature =
  | 'email'
  | 'database'
  | 'storage'
  | 'ai'
  | 'push'
  | 'auth'
  | 'api'
  | 'other';

export type QuotaKind =
  | 'daily_quota'
  | 'rate_limit'
  | 'free_tier'
  | 'storage_quota'
  | 'compute'
  | null;

const FEATURE_FROM_KIND: Array<{ re: RegExp; feature: OpsFeature }> = [
  { re: /^email\.|^mail\.|smtp/i, feature: 'email' },
  { re: /^db\.|^kv\.|^postgres|^neon|^store/i, feature: 'database' },
  { re: /^r2\.|^blob\.|^storage|^file/i, feature: 'storage' },
  { re: /^ai\.|^gemini|^scan|^voice/i, feature: 'ai' },
  { re: /^fcm|^push|^notify/i, feature: 'push' },
  { re: /^auth|^firebase\.auth/i, feature: 'auth' },
];

export function featureFromKind(kind: string): OpsFeature {
  const k = String(kind || '');
  for (const row of FEATURE_FROM_KIND) {
    if (row.re.test(k)) return row.feature;
  }
  return 'other';
}

export function classifyQuota(errorText: string): QuotaKind {
  const t = String(errorText || '').toLowerCase();
  if (!t) return null;
  if (/daily.?limit|day.?limit|quota.?exceeded|sending.?quota|free.?credits.?exhausted|limit.?reached|daily.?user.?sending.?limit|sending.?limit.?exceeded/i.test(t)) {
    return 'daily_quota';
  }
  if (/429|rate.?limit|too many|throttl/i.test(t)) return 'rate_limit';
  if (/resource-exhausted|free.?tier|plan.?limit|billing|upgrade/i.test(t)) return 'free_tier';
  if (/storage.?quota|disk.?quota|blob.?limit|r2/i.test(t)) return 'storage_quota';
  if (/function.?timeout|memory.?limit|cpu.?limit|compute/i.test(t)) return 'compute';
  return null;
}

export function enrichOpsDetail(kind: string, detail: Record<string, unknown>) {
  const error = String(detail.error || detail.message || '');
  const feature = String(detail.feature || featureFromKind(kind));
  const quota = (detail.quota as QuotaKind) || classifyQuota(error);
  const next: Record<string, unknown> = {
    ...detail,
    feature,
  };
  if (quota) {
    next.quota = quota;
    next.alert = true;
    next.alertTitle =
      quota === 'daily_quota'
        ? `${feature} daily quota exhausted`
        : quota === 'rate_limit'
          ? `${feature} rate limit hit`
          : quota === 'free_tier'
            ? `${feature} free-tier limit`
            : `${feature} capacity limit`;
  }
  return next;
}

/** Short user-facing copy for API responses (never expose SMTP/stack details). */
export function publicServiceError(err: unknown, fallback = 'Could not complete that request. Please try again.') {
  const text = String((err as { message?: string })?.message || err || '');
  const quota = classifyQuota(text);
  if (quota === 'daily_quota' || quota === 'free_tier') {
    return 'Email delivery is temporarily unavailable. Please try again later.';
  }
  if (quota === 'rate_limit') {
    return 'Too many requests right now. Please wait a minute and try again.';
  }
  if (/daily.?user.?sending.?limit|sending.?limit.?exceeded/i.test(text)) {
    return 'Email delivery hit today\u2019s send limit. Please try again in a few hours.';
  }
  if (/smtp|not configured/i.test(text)) {
    return 'Email is temporarily unavailable. Please try again later.';
  }
  return fallback;
}
