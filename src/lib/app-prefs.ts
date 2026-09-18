export type DateFormat = 'iso' | 'dmy' | 'mdy';
export type NumberLocale = 'en-IN' | 'en-US' | 'en-GB';
export type UiDensity = 'comfortable' | 'compact';
export type UiIconSize = 'sm' | 'md' | 'lg';
export type UiFontSize = 'sm' | 'md' | 'lg';
export type UiRadius = 'sharp' | 'soft' | 'round';
export type ListPageSize = 10 | 25 | 50 | 100;

export const UI_CHROME_BOUNDS = {
  iconPx: { min: 14, max: 40, fallback: 22 },
  typeScale: { min: 80, max: 145, fallback: 100 },
  radiusPx: { min: 0, max: 32, fallback: 14 },
} as const;

export type OrgUiChrome = {
  iconPx: number;
  typeScale: number;
  radiusPx: number;
  uiDensity: UiDensity;
};

export type AppPrefs = {
  dateFormat: DateFormat;
  numberFormat: NumberLocale;
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  weekStartsOn: 0 | 1;
  uiDensity: UiDensity;
  iconPx: number;
  typeScale: number;
  radiusPx: number;
  uiOverride: boolean;
  iconSize: UiIconSize;
  fontSize: UiFontSize;
  cornerRadius: UiRadius;
  listPageSize: ListPageSize;
  confirmPosting: boolean;
  confirmDeletes: boolean;
  showToasts: boolean;
  autoRefreshBooks: boolean;
  defaultPaymentTermsDays: number;
  interstateDefault: boolean;
  showAccountCodes: boolean;
  showZeroBalances: boolean;
  defaultCashAccount: 'bank' | 'cash';
  notifyOverdue: boolean;
  notifyApprovals: boolean;
  printShowLogo: boolean;
  printShowGstin: boolean;
  keyboardShortcuts: boolean;
  roundHalfUp: boolean;
};

export const DEFAULT_APP_PREFS: AppPrefs = {
  dateFormat: 'iso',
  numberFormat: 'en-IN',
  defaultCurrency: 'INR',
  fiscalYearStartMonth: 4,
  weekStartsOn: 1,
  uiDensity: 'comfortable',
  iconPx: 22,
  typeScale: 104,
  radiusPx: 14,
  uiOverride: false,
  iconSize: 'md',
  fontSize: 'md',
  cornerRadius: 'soft',
  listPageSize: 10,
  confirmPosting: false,
  confirmDeletes: true,
  showToasts: true,
  autoRefreshBooks: true,
  defaultPaymentTermsDays: 30,
  interstateDefault: false,
  showAccountCodes: true,
  showZeroBalances: false,
  defaultCashAccount: 'bank',
  notifyOverdue: true,
  notifyApprovals: true,
  printShowLogo: true,
  printShowGstin: true,
  keyboardShortcuts: true,
  roundHalfUp: true,
};

const STORAGE_KEY = 'byjan.appPrefs';
let runtime: AppPrefs = loadLocal();

function asBool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNum(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function iconPxFromLegacy(src: Record<string, unknown>, fallback: number) {
  if (typeof src.iconPx === 'number' || typeof src.iconPx === 'string') {
    return asNum(src.iconPx, fallback, UI_CHROME_BOUNDS.iconPx.min, UI_CHROME_BOUNDS.iconPx.max);
  }
  if (src.iconSize === 'sm') return 16;
  if (src.iconSize === 'lg') return 26;
  return fallback;
}

function typeScaleFromLegacy(src: Record<string, unknown>, fallback: number) {
  if (typeof src.typeScale === 'number' || typeof src.typeScale === 'string') {
    return asNum(src.typeScale, fallback, UI_CHROME_BOUNDS.typeScale.min, UI_CHROME_BOUNDS.typeScale.max);
  }
  if (src.fontSize === 'sm') return 88;
  if (src.fontSize === 'lg') return 118;
  return fallback;
}

function radiusPxFromLegacy(src: Record<string, unknown>, fallback: number) {
  if (typeof src.radiusPx === 'number' || typeof src.radiusPx === 'string') {
    return asNum(src.radiusPx, fallback, UI_CHROME_BOUNDS.radiusPx.min, UI_CHROME_BOUNDS.radiusPx.max);
  }
  if (src.cornerRadius === 'sharp') return 6;
  if (src.cornerRadius === 'round') return 24;
  return fallback;
}

export function iconLabel(px: number): UiIconSize {
  if (px <= 17) return 'sm';
  if (px >= 26) return 'lg';
  return 'md';
}

export function typeLabel(scale: number): UiFontSize {
  if (scale <= 90) return 'sm';
  if (scale >= 112) return 'lg';
  return 'md';
}

export function radiusLabel(px: number): UiRadius {
  if (px <= 7) return 'sharp';
  if (px >= 20) return 'round';
  return 'soft';
}

export function normalizeOrgChrome(raw: unknown): OrgUiChrome | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  return {
    iconPx: iconPxFromLegacy(src, DEFAULT_APP_PREFS.iconPx),
    typeScale: typeScaleFromLegacy(src, DEFAULT_APP_PREFS.typeScale),
    radiusPx: radiusPxFromLegacy(src, DEFAULT_APP_PREFS.radiusPx),
    uiDensity: src.uiDensity === 'compact' ? 'compact' : 'comfortable',
  };
}

export function applyOrgChrome(prefs: AppPrefs, org: OrgUiChrome | null | undefined): AppPrefs {
  if (!org || prefs.uiOverride) return prefs;
  return normalizeAppPrefs({
    ...prefs,
    iconPx: org.iconPx,
    typeScale: org.typeScale,
    radiusPx: org.radiusPx,
    uiDensity: org.uiDensity,
    uiOverride: false,
  });
}

export function chromePatch(prefs: AppPrefs): OrgUiChrome {
  return {
    iconPx: prefs.iconPx,
    typeScale: prefs.typeScale,
    radiusPx: prefs.radiusPx,
    uiDensity: prefs.uiDensity,
  };
}

export function normalizeAppPrefs(raw: unknown): AppPrefs {
  const src = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const dateFormat = src.dateFormat === 'dmy' || src.dateFormat === 'mdy' ? src.dateFormat : 'iso';
  const numberFormat = src.numberFormat === 'en-US' || src.numberFormat === 'en-GB' ? src.numberFormat : 'en-IN';
  const uiDensity = src.uiDensity === 'compact' ? 'compact' : 'comfortable';
  const iconPx = iconPxFromLegacy(src, DEFAULT_APP_PREFS.iconPx);
  const typeScale = typeScaleFromLegacy(src, DEFAULT_APP_PREFS.typeScale);
  const radiusPx = radiusPxFromLegacy(src, DEFAULT_APP_PREFS.radiusPx);
  const listPageSize = src.listPageSize === 25 || src.listPageSize === 50 || src.listPageSize === 100 ? src.listPageSize : 10;
  const defaultCashAccount = src.defaultCashAccount === 'cash' ? 'cash' : 'bank';
  return {
    dateFormat,
    numberFormat,
    defaultCurrency: String(src.defaultCurrency || DEFAULT_APP_PREFS.defaultCurrency),
    fiscalYearStartMonth: asNum(src.fiscalYearStartMonth, 4, 1, 12),
    weekStartsOn: src.weekStartsOn === 0 ? 0 : 1,
    uiDensity,
    iconPx,
    typeScale,
    radiusPx,
    uiOverride: src.uiOverride === true,
    iconSize: iconLabel(iconPx),
    fontSize: typeLabel(typeScale),
    cornerRadius: radiusLabel(radiusPx),
    listPageSize,
    confirmPosting: asBool(src.confirmPosting, true),
    confirmDeletes: asBool(src.confirmDeletes, true),
    showToasts: asBool(src.showToasts, true),
    autoRefreshBooks: asBool(src.autoRefreshBooks, true),
    defaultPaymentTermsDays: asNum(src.defaultPaymentTermsDays, 30, 0, 365),
    interstateDefault: asBool(src.interstateDefault, false),
    showAccountCodes: asBool(src.showAccountCodes, true),
    showZeroBalances: asBool(src.showZeroBalances, false),
    defaultCashAccount,
    notifyOverdue: asBool(src.notifyOverdue, true),
    notifyApprovals: asBool(src.notifyApprovals, true),
    printShowLogo: asBool(src.printShowLogo, true),
    printShowGstin: asBool(src.printShowGstin, true),
    keyboardShortcuts: asBool(src.keyboardShortcuts, true),
    roundHalfUp: asBool(src.roundHalfUp, true),
  };
}

function loadLocal(): AppPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_PREFS };
    return normalizeAppPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_PREFS };
  }
}

export function getRuntimePrefs() {
  return runtime;
}

export function setRuntimePrefs(next: AppPrefs) {
  runtime = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* private mode */ }
  applyUiChrome(next);
}

export function applyUiChrome(prefs: AppPrefs) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const iconPx = asNum(prefs.iconPx, 22, UI_CHROME_BOUNDS.iconPx.min, UI_CHROME_BOUNDS.iconPx.max);
  const typePct = asNum(prefs.typeScale, 104, UI_CHROME_BOUNDS.typeScale.min, UI_CHROME_BOUNDS.typeScale.max);
  const radiusPx = asNum(prefs.radiusPx, 14, UI_CHROME_BOUNDS.radiusPx.min, UI_CHROME_BOUNDS.radiusPx.max);
  const type = String(Math.round((typePct / 100) * 1000) / 1000);
  const radius = `${radiusPx}px`;
  const btnRadius = radiusPx <= 6 ? '4px' : radiusPx >= 22 ? '999px' : `${Math.max(8, Math.round(radiusPx * 0.72))}px`;
  const tw = {
    sm: `${Math.max(0, Math.round(radiusPx * 0.35))}px`,
    md: `${Math.max(2, Math.round(radiusPx * 0.55))}px`,
    lg: `${Math.max(4, Math.round(radiusPx * 0.8))}px`,
    xl: `${radiusPx}px`,
    '2xl': `${Math.round(radiusPx * 1.15)}px`,
    '3xl': `${Math.round(radiusPx * 1.4)}px`,
  };

  root.dataset.density = prefs.uiDensity;
  root.dataset.icon = iconLabel(iconPx);
  root.dataset.type = typeLabel(typePct);
  root.dataset.radius = radiusLabel(radiusPx);
  root.style.setProperty('--ui-icon', `${iconPx}px`);
  root.style.setProperty('--ui-type', type);
  root.style.setProperty('--ui-radius', radius);
  root.style.setProperty('--ui-btn-radius', btnRadius);
  root.style.setProperty('--radius-sm', tw.sm);
  root.style.setProperty('--radius-md', tw.md);
  root.style.setProperty('--radius-lg', tw.lg);
  root.style.setProperty('--radius-xl', tw.xl);
  root.style.setProperty('--radius-2xl', tw['2xl']);
  root.style.setProperty('--radius-3xl', tw['3xl']);
}

export function formatDisplayDate(iso: string | null | undefined) {
  const raw = String(iso || '');
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return raw || '—';
  const [, y, m, d] = day.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  if (runtime.dateFormat === 'dmy') return `${d}/${m}/${y}`;
  if (runtime.dateFormat === 'mdy') return `${m}/${d}/${y}`;
  return day;
}

export function formatMajor(amount: number, fractionDigits = 2) {
  try {
    return amount.toLocaleString(runtime.numberFormat, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return amount.toFixed(fractionDigits);
  }
}

export function moneyLocale() {
  return runtime.numberFormat;
}

if (typeof document !== 'undefined') applyUiChrome(runtime);
