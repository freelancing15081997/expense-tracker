import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookView from './pages/BookView';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import BrandLogo from './components/BrandLogo';

const BooksApp = lazy(() => import('./books/app/BooksApp'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3efe4] gap-3">
      <BrandLogo size="lg" />
      <p className="text-sm font-medium text-slate-600 tracking-wide">Trace Financials Easily</p>
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="book/:bookId" element={<BookView />} />
              <Route path="settings" element={<Settings />} />
          
              <Route path="books/*" element={<Suspense fallback={<div className="flex justify-center py-16"><BrandLogo size="md" /></div>}><BooksApp /></Suspense>} />

              
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
