export type DateFormat = 'iso' | 'dmy' | 'mdy';
export type NumberLocale = 'en-IN' | 'en-US' | 'en-GB';
export type UiDensity = 'comfortable' | 'compact';
export type UiIconSize = 'sm' | 'md' | 'lg';
export type UiFontSize = 'sm' | 'md' | 'lg';
export type UiRadius = 'sharp' | 'soft' | 'round';
export type ListPageSize = 10 | 25 | 50 | 100;

export type AppPrefs = {
  dateFormat: DateFormat;
  numberFormat: NumberLocale;
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  weekStartsOn: 0 | 1;
  uiDensity: UiDensity;
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

export function normalizeAppPrefs(raw: unknown): AppPrefs {
  const src = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const dateFormat = src.dateFormat === 'dmy' || src.dateFormat === 'mdy' ? src.dateFormat : 'iso';
  const numberFormat = src.numberFormat === 'en-US' || src.numberFormat === 'en-GB' ? src.numberFormat : 'en-IN';
  const uiDensity = src.uiDensity === 'compact' ? 'compact' : 'comfortable';
  const iconSize = src.iconSize === 'sm' || src.iconSize === 'lg' ? src.iconSize : 'md';
  const fontSize = src.fontSize === 'sm' || src.fontSize === 'lg' ? src.fontSize : 'md';
  const cornerRadius = src.cornerRadius === 'sharp' || src.cornerRadius === 'round' ? src.cornerRadius : 'soft';
  const listPageSize = src.listPageSize === 25 || src.listPageSize === 50 || src.listPageSize === 100 ? src.listPageSize : 10;
  const defaultCashAccount = src.defaultCashAccount === 'cash' ? 'cash' : 'bank';
  return {
    dateFormat,
    numberFormat,
    defaultCurrency: String(src.defaultCurrency || DEFAULT_APP_PREFS.defaultCurrency),
    fiscalYearStartMonth: asNum(src.fiscalYearStartMonth, 4, 1, 12),
    weekStartsOn: src.weekStartsOn === 0 ? 0 : 1,
    uiDensity,
    iconSize,
    fontSize,
    cornerRadius,
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
  const icon = prefs.iconSize === 'sm' ? '16px' : prefs.iconSize === 'lg' ? '26px' : '20px';
  const type = prefs.fontSize === 'sm' ? '0.88' : prefs.fontSize === 'lg' ? '1.18' : '1';
  const radius = prefs.cornerRadius === 'sharp' ? '6px' : prefs.cornerRadius === 'round' ? '24px' : '14px';
  const btnRadius = prefs.cornerRadius === 'sharp' ? '4px' : prefs.cornerRadius === 'round' ? '999px' : '10px';
  const tw = prefs.cornerRadius === 'sharp'
    ? { sm: '4px', md: '6px', lg: '8px', xl: '8px', '2xl': '10px', '3xl': '12px' }
    : prefs.cornerRadius === 'round'
      ? { sm: '10px', md: '14px', lg: '18px', xl: '22px', '2xl': '28px', '3xl': '32px' }
      : { sm: '6px', md: '8px', lg: '12px', xl: '14px', '2xl': '16px', '3xl': '24px' };

  root.dataset.density = prefs.uiDensity;
  root.dataset.icon = prefs.iconSize;
  root.dataset.type = prefs.fontSize;
  root.dataset.radius = prefs.cornerRadius;
  root.style.setProperty('--ui-icon', icon);
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
