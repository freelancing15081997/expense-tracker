import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLoader from './components/AppLoader';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookView from './pages/BookView';
import Settings from './pages/Settings';
import Layout from './components/Layout';

const BooksApp = lazy(() => import('./books/app/BooksApp'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <AppLoader message="Loading" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

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
              <Route path="expenses" element={<Dashboard />} />
              <Route path="book/:bookId" element={<BookView />} />
              <Route path="settings" element={<Settings />} />
          
              <Route path="books/*" element={<Suspense fallback={<AppLoader message="Loading" />}><BooksApp /></Suspense>} />

              
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
