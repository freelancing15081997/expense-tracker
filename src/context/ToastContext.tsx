import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { getRuntimePrefs } from '../lib/app-prefs';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string | { title?: string; description?: string }, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string | { title?: string; description?: string }, type: ToastType = 'info') => {
    if (type !== 'error' && !getRuntimePrefs().showToasts) return;
    const text = typeof message === 'string'
      ? message
      : [message?.title, message?.description].filter(Boolean).join(' — ') || 'Done';
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, message: text, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const stack = (
    <div className="fixed top-3 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto w-full max-w-md flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-[0_12px_30px_-16px_rgba(11,31,58,0.45)] ${
            toast.type === 'success' ? 'bg-white text-[#0B1F3A] border-teal-200' :
            toast.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-200' :
            'bg-[#0B1F3A] text-white border-[#0B1F3A]'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#12B8A8] shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-teal-200 shrink-0 mt-0.5" />}
          <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-slate-400 hover:text-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(stack, document.body) : stack}
    </ToastContext.Provider>
  );
};
