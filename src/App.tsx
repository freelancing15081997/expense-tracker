import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLoader from './components/AppLoader';
import { ToastProvider } from './context/ToastContext';
import { AppPrefsProvider } from './context/AppPrefsContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookView from './pages/BookView';
import InviteAccept from './pages/InviteAccept';
import Settings from './pages/Settings';
import HelpPage from './pages/HelpPage';
import AccessControl from './pages/AccessControl';
import TraceOps from './pages/TraceOps';
import MoneyReports from './pages/MoneyReports';
import Activity from './pages/Activity';
import RegularPayments from './pages/RegularPayments';
import Layout from './components/Layout';
import NotificationsPage from './pages/NotificationsPage';
import FeatureGate, { SuperUserGate } from './components/FeatureGate';
import ShareIntentListener from './components/ShareIntentListener';
import AppLockGate from './components/AppLockGate';

import { peekReturnTo } from './lib/return-to';

const BooksApp = lazy(() => import('./books/app/BooksApp'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader overlay title="Byjan" message="Checking your session." />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <AppLockGate>{children}</AppLockGate>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader overlay title="Byjan" message="Checking your session." />;
  if (currentUser) return <Navigate to={peekReturnTo()} replace />;
  return <>{children}</>;
};

const InviteRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader overlay title="Byjan" message="Checking your session." />;
  // Signed-in users must unlock before invite accept (BUG-007).
  if (currentUser) return <AppLockGate><InviteAccept /></AppLockGate>;
  return <InviteAccept />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppPrefsProvider>
        <ToastProvider>
          <HashRouter>
            <ShareIntentListener />
            <Routes>
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/invite/:inviteId" element={<InviteRoute />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="access" element={<SuperUserGate><AccessControl /></SuperUserGate>} />
                <Route path="trace" element={<SuperUserGate><TraceOps /></SuperUserGate>} />
                <Route path="expenses" element={<FeatureGate feature="money"><Dashboard /></FeatureGate>} />
                <Route path="activity" element={<FeatureGate feature="money_activity"><Activity /></FeatureGate>} />
                <Route path="notifications" element={<FeatureGate feature="app_notifications"><NotificationsPage /></FeatureGate>} />
                <Route path="regular-payments" element={<FeatureGate feature="money_recurring"><RegularPayments /></FeatureGate>} />
                <Route path="book/:bookId" element={<FeatureGate feature="money"><BookView /></FeatureGate>} />
                <Route path="reports" element={<FeatureGate feature="money_reports"><MoneyReports /></FeatureGate>} />
                <Route path="settings" element={<Settings />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="books/*" element={<FeatureGate feature="business"><Suspense fallback={<AppLoader title="Business" message="Opening your company accounts." />}><BooksApp /></Suspense></FeatureGate>} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </AppPrefsProvider>
    </AuthProvider>
  );
}
