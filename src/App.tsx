import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RbacProvider, useRbac } from './context/RbacContext';
import AppLoader from './components/AppLoader';
import { ToastProvider } from './context/ToastContext';
import { AppPrefsProvider } from './context/AppPrefsContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ActivateAccount from './pages/ActivateAccount';
import AuthAction from './pages/AuthAction';
import Dashboard from './pages/Dashboard';
import BookView from './pages/BookView';
import InviteAccept from './pages/InviteAccept';
import Settings from './pages/Settings';
import AdminAccess from './pages/AdminAccess';
import Layout from './components/Layout';

import { peekReturnTo } from './lib/return-to';
import { needsEmailActivation } from './lib/account-security';

const BooksApp = lazy(() => import('./books/app/BooksApp'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader title="Byjan" message="Checking your session." />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (needsEmailActivation(currentUser)) return <Navigate to="/activate" replace />;
  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader title="Byjan" message="Checking your session." />;
  if (currentUser) {
    if (needsEmailActivation(currentUser)) return <Navigate to="/activate" replace />;
    return <Navigate to={peekReturnTo()} replace />;
  }
  return <>{children}</>;
};

const PermissionRoute: React.FC<{ anyOf: string[]; children: React.ReactNode }> = ({ anyOf, children }) => {
  const { loading, canAny } = useRbac();
  if (loading) return <AppLoader title="Byjan" message="Loading your access." />;
  if (!canAny(anyOf)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <AppPrefsProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/activate" element={<ActivateAccount />} />
              <Route path="/auth/action" element={<AuthAction />} />
              <Route path="/invite/:inviteId" element={<InviteAccept />} />
              <Route path="/" element={<ProtectedRoute><RbacProvider><Layout /></RbacProvider></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="expenses" element={<Dashboard />} />
                <Route path="book/:bookId" element={<BookView />} />
                <Route path="settings" element={<Settings />} />
                <Route path="admin" element={<PermissionRoute anyOf={['admin.access']}><AdminAccess /></PermissionRoute>} />
                <Route path="books/*" element={<Suspense fallback={<AppLoader title="Books" message="Opening your company workspace." />}><BooksApp /></Suspense>} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </AppPrefsProvider>
    </AuthProvider>
  );
}
