/** Device app lock: hashed PIN in localStorage + optional native biometric. Never stores raw PIN. */

const KEY = 'byjan.lock.v1';
const FAIL_LIMIT = 5;
const LOCKOUT_MS = 60_000;

export type LockOptions = {
  autoLockMs: number;
  idleLockMs: number;
  shufflePad: boolean;
  bioFirst: boolean;
  hideContent: boolean;
};

const DEFAULT_OPTIONS: LockOptions = {
  autoLockMs: 8_000,
  idleLockMs: 0,
  shufflePad: false,
  bioFirst: true,
  hideContent: false,
};

type LockRecord = {
  uid: string;
  salt: string;
  pinHash: string;
  enabled: boolean;
  biometric: boolean;
  fails: number;
  lockUntil: number;
  updatedAt: string;
  lastUnlockAt?: string;
  options?: Partial<LockOptions>;
};

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readRecord(): LockRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(row: LockRecord) {
  localStorage.setItem(KEY, JSON.stringify(row));
}

export function lockOptions(): LockOptions {
  const row = readRecord();
  return { ...DEFAULT_OPTIONS, ...(row?.options || {}) };
}

export function lockConfig() {
  const row = readRecord();
  const options = lockOptions();
  return {
    enabled: Boolean(row?.enabled && row.pinHash),
    biometric: Boolean(row?.biometric),
    uid: String(row?.uid || ''),
    fails: Number(row?.fails || 0),
    lockUntil: Number(row?.lockUntil || 0),
    lastUnlockAt: String(row?.lastUnlockAt || ''),
    options,
  };
}

export function lockIsEnabledFor(uid: string) {
  const row = readRecord();
  return Boolean(row?.enabled && row.pinHash && row.uid === uid);
}

export function remainingLockMs() {
  const until = Number(readRecord()?.lockUntil || 0);
  return Math.max(0, until - Date.now());
}

export async function setLockPin(uid: string, pin: string, biometric: boolean) {
  const digits = String(pin || '').replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 8) throw new Error('PIN must be 4–8 digits');
  const prev = readRecord();
  const salt = randomSalt();
  const pinHash = await sha256Hex(`${salt}:${digits}`);
  writeRecord({
    uid,
    salt,
    pinHash,
    enabled: true,
    biometric,
    fails: 0,
    lockUntil: 0,
    updatedAt: new Date().toISOString(),
    lastUnlockAt: prev?.lastUnlockAt,
    options: { ...DEFAULT_OPTIONS, ...(prev?.options || {}) },
  });
}

export function updateLockOptions(patch: Partial<LockOptions> & { biometric?: boolean }) {
  const row = readRecord();
  if (!row?.enabled) throw new Error('Turn on app lock first');
  const { biometric, ...opts } = patch;
  writeRecord({
    ...row,
    biometric: typeof biometric === 'boolean' ? biometric : row.biometric,
    options: { ...DEFAULT_OPTIONS, ...(row.options || {}), ...opts },
    updatedAt: new Date().toISOString(),
  });
}

export function disableLock() {
  const row = readRecord();
  if (!row) return;
  writeRecord({
    ...row,
    enabled: false,
    pinHash: '',
    salt: '',
    fails: 0,
    lockUntil: 0,
    biometric: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function verifyLockPin(pin: string) {
  const row = readRecord();
  if (!row?.enabled || !row.pinHash) return { ok: false, message: 'Lock is not set' };
  if (Date.now() < Number(row.lockUntil || 0)) {
    const wait = Math.ceil((Number(row.lockUntil) - Date.now()) / 1000);
    return { ok: false, locked: true, message: `Too many attempts — wait ${wait}s` };
  }
  const digits = String(pin || '').replace(/\D/g, '');
  const hash = await sha256Hex(`${row.salt}:${digits}`);
  if (hash !== row.pinHash) {
    const fails = Number(row.fails || 0) + 1;
    const lockUntil = fails >= FAIL_LIMIT ? Date.now() + LOCKOUT_MS : 0;
    writeRecord({ ...row, fails, lockUntil, updatedAt: new Date().toISOString() });
    const left = FAIL_LIMIT - fails;
    return {
      ok: false,
      locked: lockUntil > 0,
      message: lockUntil > 0 ? 'Too many attempts — wait a minute' : `Wrong PIN · ${left} left`,
    };
  }
  writeRecord({
    ...row,
    fails: 0,
    lockUntil: 0,
    lastUnlockAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function biometricUnlock(reason = 'Unlock Byjan') {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return { ok: false, available: false, message: 'Biometrics only on the Android app' };
    const AppLock = registerPlugin<{
      isAvailable: () => Promise<{ available?: boolean }>;
      authenticate: (opts: { reason?: string }) => Promise<{ ok?: boolean; cancelled?: boolean; message?: string }>;
    }>('AppLock');
    const avail = await AppLock.isAvailable();
    if (!avail.available) return { ok: false, available: false, message: 'This device has no biometric enrolled' };
    const res = await AppLock.authenticate({ reason });
    if (res.ok) {
      const row = readRecord();
      if (row?.enabled) {
        writeRecord({
          ...row,
          fails: 0,
          lockUntil: 0,
          lastUnlockAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return { ok: Boolean(res.ok), available: true, cancelled: Boolean(res.cancelled), message: res.message };
  } catch (err) {
    return { ok: false, available: false, message: err instanceof Error ? err.message : 'Biometric failed' };
  }
}

export async function biometricAvailable() {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    const AppLock = registerPlugin<{ isAvailable: () => Promise<{ available?: boolean }> }>('AppLock');
    const res = await AppLock.isAvailable();
    return Boolean(res.available);
  } catch {
    return false;
  }
}
