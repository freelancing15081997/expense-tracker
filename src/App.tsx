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
import Layout from './components/Layout';

import { peekReturnTo } from './lib/return-to';

const BooksApp = lazy(() => import('./books/app/BooksApp'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader title="Byjan" message="Checking your session." />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader title="Byjan" message="Checking your session." />;
  if (currentUser) return <Navigate to={peekReturnTo()} replace />;
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
              <Route path="/invite/:inviteId" element={<InviteAccept />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="expenses" element={<Dashboard />} />
                <Route path="book/:bookId" element={<BookView />} />
                <Route path="settings" element={<Settings />} />
                <Route path="books/*" element={<Suspense fallback={<AppLoader title="Books" message="Opening your company workspace." />}><BooksApp /></Suspense>} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </AppPrefsProvider>
    </AuthProvider>
  );
}
