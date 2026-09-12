import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { getRuntimePrefs } from '../lib/app-prefs';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  title: string;
  description?: string;
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
    const title = typeof message === 'string' ? message : (message?.title || message?.description || 'Done');
    const description = typeof message === 'string' ? undefined : (message?.title ? message.description : undefined);
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, title, description, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const stack = (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none w-[min(100%-2rem,24rem)]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-[0_12px_32px_-18px_rgba(11,31,58,0.45)] ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-200' :
            toast.type === 'error' ? 'bg-rose-50 text-rose-950 border-rose-300' :
            'bg-[#0B1F3A] text-white border-[#0B1F3A]'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#12B8A8] shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-teal-200 shrink-0 mt-0.5" />}
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold leading-snug">{toast.title}</span>
            {toast.description && <span className="block text-xs mt-0.5 opacity-80 leading-relaxed">{toast.description}</span>}
          </span>
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
