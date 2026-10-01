import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';
import { Home as HomeIcon, PieChart, Inbox as InboxIcon, Settings as Cog, ScanLine, ShieldCheck } from 'lucide-react';
import { SessionProvider, useSession } from './lib/session';
import { UiProvider, useToast, OfflineBanner } from './ui';
import { AnimatePresence, motion, BrandLoader, spring } from './motion';
import { startShareListener, onPending, peekPending, handleCaptureUrl } from './lib/share';
import { startOfflineSync } from './lib/offline';
import { registerPushToken } from './lib/books';
import { isNative } from './lib/api';
import { Welcome, SignIn, SignUp, Forgot, VerifyEmail } from './screens/Auth';
import Home from './screens/Home';
import BookView from './screens/Book';
import EntryForm from './screens/EntryForm';
import EntryDetail from './screens/EntryDetail';
import { CaptureFlow, CaptureSheet } from './screens/Capture';
import Reports from './screens/Reports';
import { Inbox, Notifications } from './screens/Inbox';
import { Settings, InviteAccept, AppLockGate } from './screens/Settings';
import { BookPeople, BookSettings } from './screens/People';
import { SettleUp } from './screens/Settle';
import { Plans, Checkout, PaymentResult, Billing, MyUsage, PaywallSheet, AnnouncementBar } from './screens/Saas';
import { OwnerHome, OwnerUsers, OwnerUser } from './screens/Owner';
import { OwnerPlans, OwnerPlanEdit, OwnerOffers, OwnerOfferEdit } from './screens/OwnerCatalog';
import { OwnerUsage, OwnerPayments, OwnerAudit, OwnerConfig } from './screens/OwnerOps';

/** Older link invites were shared as /join/<code>; send them to the invite screen. */
function JoinRedirect() {
  const loc = useLocation();
  return <Navigate to={loc.pathname.replace(/^\/join\//, '/invite/')} replace />;
}

export default function App() {
  return (
    <UiProvider>
      <SessionProvider>
        <AppLockGate>
          <Shell />
        </AppLockGate>
      </SessionProvider>
    </UiProvider>
  );
}

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '#capture', label: 'Capture', icon: ScanLine },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon },
  { to: '/settings', label: 'More', icon: Cog },
];
const NAV_ROUTES = ['/', '/reports', '/inbox', '/settings', '/notifications'];

function Shell() {
  const s = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    const back = CapApp.addListener('backButton', ({ canGoBack }) => { if (canGoBack) nav(-1); else void CapApp.minimizeApp(); });
    const url = CapApp.addListener('appUrlOpen', (e) => {
      if (handleCaptureUrl(e.url)) return;
      const m = e.url.match(/payment\?order_id=([^&]+)/); if (m) nav(`/payment/${decodeURIComponent(m[1])}`);
      const inv = e.url.match(/(?:invite|join)\/([^?&#]+)/); if (inv) nav(`/invite/${inv[1]}`);
    });
    return () => { void back.then((h) => h.remove()); void url.then((h) => h.remove()); };
  }, [nav]);

  // Shares: Android share sheet → capture flow (after sign-in)
  useEffect(() => {
    let stop: (() => void) | undefined;
    void startShareListener((m) => toast({ text: m, tone: 'error' })).then((f) => { stop = f; });
    const off = onPending(() => { if (s.user) nav('/capture', { state: { fromShare: Date.now() } }); });
    return () => { stop?.(); off(); };
  }, [s.user]);
  useEffect(() => { if (s.user && peekPending() && loc.pathname !== '/capture') nav('/capture', { state: { fromShare: Date.now() } }); }, [s.user]);

  useEffect(() => { if (s.user) return startOfflineSync((n) => toast({ text: `${n} offline ${n === 1 ? 'entry' : 'entries'} synced` })); }, [s.user]);

  useEffect(() => {
    if (!s.user || !isNative() || !s.can('app_notifications_push')) return;
    void (async () => {
      const p = await PushNotifications.requestPermissions();
      if (p.receive !== 'granted') return;
      await PushNotifications.register();
    })();
    const reg = PushNotifications.addListener('registration', (t) => { void registerPushToken(t.value, 'android'); });
    const act = PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const d = a.notification.data || {};
      if (d.bookId && d.expenseId) nav(`/book/${d.bookId}/entry/${d.expenseId}`); else if (d.bookId) nav(`/book/${d.bookId}`); else if (d.route) nav(String(d.route));
    });
    return () => { void reg.then((h) => h.remove()); void act.then((h) => h.remove()); };
  }, [s.user]);

  if (!s.ready) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'var(--navy)' }}><BrandLoader /></div>;

  if (s.config.maintenance && !s.isOwner) {
    return (
      <div className="screen no-nav pad" style={{ justifyContent: 'center', gap: 14 }}>
        <img src="/brand/byjan-logo.svg" alt="Byjan" style={{ height: 28, width: 'auto', alignSelf: 'flex-start' }} />
        <h1 className="h-display">We’ll be right back</h1>
        <p style={{ color: 'var(--ink-2)' }}>{s.config.maintenanceMessage || 'Byjan is getting an upgrade. Your data is safe.'}</p>
      </div>
    );
  }

  const authed = !!s.user;
  const verified = !!s.user?.emailVerified || s.user?.providerData.some((p) => p.providerId === 'google.com');
  const showNav = authed && NAV_ROUTES.includes(loc.pathname);

  return (
    <>
      <OfflineBanner />
      {authed && <AnnouncementBar />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={loc.pathname} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} style={{ minHeight: '100%' }}>
          <Routes location={loc}>
            {!authed ? (
              <>
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot" element={<Forgot />} />
                <Route path="/invite/:code" element={<Navigate to="/signin" state={{ returnTo: loc.pathname }} replace />} />
                <Route path="/join/:code" element={<Navigate to="/signin" state={{ returnTo: loc.pathname.replace(/^\/join\//, '/invite/') }} replace />} />
                <Route path="*" element={<Navigate to="/welcome" replace />} />
              </>
            ) : !verified ? (
              <Route path="*" element={<VerifyEmail />} />
            ) : (
              <>
                <Route path="/" element={<Home onCapture={() => setCaptureOpen(true)} />} />
                <Route path="/book/:bookId" element={<BookView onCapture={() => setCaptureOpen(true)} />} />
                <Route path="/book/:bookId/new" element={<EntryForm />} />
                <Route path="/book/:bookId/entry/:entryId" element={<EntryDetail />} />
                <Route path="/book/:bookId/entry/:entryId/edit" element={<EntryForm />} />
                <Route path="/book/:bookId/people" element={<BookPeople />} />
                <Route path="/book/:bookId/settings" element={<BookSettings />} />
                <Route path="/book/:bookId/settle" element={<SettleUp />} />
                <Route path="/capture" element={<CaptureFlow />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/invite/:code" element={<InviteAccept />} />
                {/* Older link invites were issued as /join/<code>. */}
                <Route path="/join/:code" element={<JoinRedirect />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/payment/:orderId" element={<PaymentResult />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/usage" element={<MyUsage />} />
                {s.isOwner && (
                  <>
                    <Route path="/owner" element={<OwnerHome />} />
                    <Route path="/owner/users" element={<OwnerUsers />} />
                    <Route path="/owner/users/:uid" element={<OwnerUser />} />
                    <Route path="/owner/plans" element={<OwnerPlans />} />
                    <Route path="/owner/plans/:planId" element={<OwnerPlanEdit />} />
                    <Route path="/owner/offers" element={<OwnerOffers />} />
                    <Route path="/owner/offers/:offerId" element={<OwnerOfferEdit />} />
                    <Route path="/owner/usage" element={<OwnerUsage />} />
                    <Route path="/owner/payments" element={<OwnerPayments />} />
                    <Route path="/owner/audit" element={<OwnerAudit />} />
                    <Route path="/owner/config" element={<OwnerConfig />} />
                  </>
                )}
                <Route path="/welcome" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </motion.div>
      </AnimatePresence>

      {showNav && (
        <nav className="bottomnav" aria-label="Main">
          {NAV.map((n) => {
            const Icon = n.icon;
            if (n.to === '#capture') {
              return (
                <a key="cap" href="#capture" onClick={(e) => { e.preventDefault(); setCaptureOpen(true); }} aria-label="Capture a receipt">
                  <motion.span whileTap={{ scale: 0.9 }} transition={spring} style={{ width: 52, height: 40, marginTop: -2, borderRadius: 12, background: 'var(--teal-700)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px rgba(13,107,85,.7)' }}><Icon size={22} /></motion.span>
                  <span style={{ marginTop: -1 }}>Capture</span>
                </a>
              );
            }
            const on = loc.pathname === n.to;
            return (
              <NavLink key={n.to} to={n.to} className={on ? 'on' : ''} end>
                {on && <motion.span layoutId="navpill" className="pill" transition={spring} />}
                <Icon size={21} strokeWidth={on ? 2.3 : 1.8} />
                <span>{n.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
      {showNav && s.isOwner && loc.pathname === '/settings' && (
        <NavLink to="/owner" className="fab" style={{ bottom: 'calc(84px + var(--safe-b))' }}><ShieldCheck size={20} />Owner console</NavLink>
      )}
      <CaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <PaywallSheet />
    </>
  );
}
