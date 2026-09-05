import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookView from './pages/BookView';
import Settings from './pages/Settings';
import Layout from './components/Layout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="relative flex items-center justify-center w-20 h-20 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/20 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-12 h-12">
          <path d="M72 168 L108 116 L148 140 L192 72" fill="none" stroke="#ffffff" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="192" cy="72" r="16" fill="#ffffff" />
          <path d="M72 196 L192 196" fill="none" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">ExpenseShare</h2>
        <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
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
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
