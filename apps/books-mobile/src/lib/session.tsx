import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { watchAuth } from './firebase';
import { apiPost, ApiError } from './api';
import { getMySaas, type MeterKey, type Plan, type Subscription, type Usage, type Offer } from './saas';
import { on as featureOn, allOn, type FeatureMap } from './features';
import { getAppConfigPublic } from './publicConfig';

export type Me = {
  uid: string; email?: string; displayName?: string; photoURL?: string; defaultCurrency?: string; upiId?: string; upiDisplayName?: string;
  features?: FeatureMap; isSuperUser?: boolean; status?: string; appPrefs?: Record<string, unknown>; onboarded?: boolean;
};

type SessionValue = {
  ready: boolean; user: User | null; me: Me | null; features: FeatureMap; isOwner: boolean;
  sub: Subscription | null; plan: Plan | null; usage: Usage | null; offers: Offer[];
  config: { maintenance?: boolean; maintenanceMessage?: string; announcement?: string; announcementTone?: string; minAppVersion?: string };
  refreshMe: () => Promise<void>; refreshSaas: () => Promise<void>; saveMe: (patch: Partial<Me>) => Promise<void>;
  can: (featureKey: string) => boolean;
  remaining: (m: MeterKey) => number; // Infinity when unlimited
  /** true when the action may proceed; otherwise opens the paywall and returns false */
  guard: (m: MeterKey) => boolean;
  /** call after a successful metered action so the meter moves without a refetch */
  bump: (m: MeterKey, by?: number) => void;
  /** route ApiError 402 to the paywall; returns true when handled */
  handleQuotaError: (e: unknown) => boolean;
  paywall: { meter: MeterKey | null; reason?: string } ; openPaywall: (m: MeterKey | null, reason?: string) => void; closePaywall: () => void;
};

const Ctx = createContext<SessionValue | null>(null);
export const useSession = () => { const v = useContext(Ctx); if (!v) throw new Error('SessionProvider missing'); return v; };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [config, setConfig] = useState<SessionValue['config']>({});
  const [paywall, setPaywall] = useState<SessionValue['paywall']>({ meter: null });
  const uidRef = useRef('');

  const refreshMe = useCallback(async () => {
    const r = await apiPost<{ user?: Me }>('/api/me', { op: 'get' });
    if (r.user && r.user.uid === uidRef.current) setMe(r.user);
  }, []);
  const refreshSaas = useCallback(async () => {
    try {
      const r = await getMySaas();
      setSub(r.subscription); setPlan(r.plan); setUsage(r.usage); setOffers(r.offers || []);
    } catch { /* older API: everything stays open, server still enforces */ }
  }, []);

  useEffect(() => {
    void getAppConfigPublic().then(setConfig).catch(() => undefined);
    return watchAuth(async (u) => {
      uidRef.current = u?.uid || '';
      setUser(u);
      if (!u) { setMe(null); setSub(null); setPlan(null); setUsage(null); setReady(true); return; }
      try {
        await apiPost('/api/me', { op: 'upsert', patch: { email: u.email, displayName: u.displayName || u.email?.split('@')[0], photoURL: u.photoURL || undefined } }).catch(() => undefined);
        await Promise.all([refreshMe(), refreshSaas()]);
      } finally { setReady(true); }
    });
  }, [refreshMe, refreshSaas]);

  const saveMe = useCallback(async (patch: Partial<Me>) => {
    const { isSuperUser: _a, features: _b, ...safe } = patch;
    const r = await apiPost<{ user: Me }>('/api/me', { op: 'upsert', patch: safe });
    if (r.user) setMe(r.user);
  }, []);

  const isOwner = me?.isSuperUser === true;
  const features = useMemo(() => (isOwner ? allOn() : me?.features || {}), [isOwner, me?.features]);

  const remaining = useCallback((m: MeterKey) => {
    if (isOwner) return Infinity;
    const u = usage?.meters?.[m];
    if (!u || u.limit < 0) return Infinity;
    return Math.max(0, u.limit + (u.extra || 0) - u.used);
  }, [usage, isOwner]);

  const openPaywall = useCallback((meter: MeterKey | null, reason?: string) => setPaywall({ meter, reason }), []);
  const guard = useCallback((m: MeterKey) => { if (remaining(m) > 0) return true; openPaywall(m); return false; }, [remaining, openPaywall]);
  const bump = useCallback((m: MeterKey, by = 1) => setUsage((u) => (u && u.meters[m] ? { ...u, meters: { ...u.meters, [m]: { ...u.meters[m], used: u.meters[m].used + by } } } : u)), []);
  const handleQuotaError = useCallback((e: unknown) => {
    if (e instanceof ApiError && (e.status === 402 || e.code === 'QUOTA_EXCEEDED' || e.code === 'PLAN_REQUIRED')) {
      openPaywall((e.extra.meter as MeterKey) || null, e.message);
      void refreshSaas();
      return true;
    }
    return false;
  }, [openPaywall, refreshSaas]);

  const value: SessionValue = {
    ready, user, me, features, isOwner, sub, plan, usage, offers, config, refreshMe, refreshSaas, saveMe,
    can: (k) => isOwner || featureOn(features, k), remaining, guard, bump, handleQuotaError,
    paywall, openPaywall, closePaywall: () => setPaywall({ meter: null }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
