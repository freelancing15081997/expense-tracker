import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, WifiOff } from 'lucide-react';
import { Network } from '@capacitor/network';
import { motion, AnimatePresence, Press, Thumb, spring } from './motion';
import { initials } from './lib/format';
import { fail, warn } from './lib/haptics';

// ---------------- Toasts ----------------
type Toast = { id: number; text: string; tone?: 'error' | 'ok'; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

// ---------------- Confirm (optional reason) ----------------
type ConfirmOpts = { title: string; body?: string; confirm?: string; danger?: boolean; reason?: boolean; reasonLabel?: string };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<{ ok: boolean; reason: string }>>(async () => ({ ok: false, reason: '' }));
export const useConfirm = () => useContext(ConfirmCtx);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: { ok: boolean; reason: string }) => void }) | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    if (t.tone === 'error') fail();
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.action ? 5000 : 3000);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<{ ok: boolean; reason: string }>((resolve) => { if (o.danger) warn(); setReason(''); setReasonErr(''); setDlg({ ...o, resolve }); }), []);
  const close = (ok: boolean) => {
    if (!dlg) return;
    if (ok && dlg.reason && reason.trim().length < 4) { setReasonErr('Add a short reason (at least 4 characters).'); return; }
    dlg.resolve({ ok, reason: reason.trim() }); setDlg(null);
  };

  return (
    <ToastCtx.Provider value={push}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="toast-wrap" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`} layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={spring}>
                <span className="grow">{t.text}</span>
                {t.action && <button onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {dlg && (
            <>
              <motion.div className="backdrop" style={{ zIndex: 70 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)} />
              <motion.div className="dialog" role="alertdialog" aria-modal="true" initial={{ opacity: 0, y: '-46%', scale: 0.96 }} animate={{ opacity: 1, y: '-50%', scale: 1 }} exit={{ opacity: 0, y: '-48%', scale: 0.98 }} transition={spring}>
                <h3 style={{ font: '600 18px var(--font)' }}>{dlg.title}</h3>
                {dlg.body && <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>{dlg.body}</p>}
                {dlg.reason && (
                  <div className="field" style={{ marginTop: 14 }}>
                    <label>{dlg.reasonLabel || 'Reason'} <span className="hint">· saved to the audit log</span></label>
                    <textarea className={`input ${reasonErr ? 'bad' : ''}`} rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setReasonErr(''); }} autoFocus />
                    {reasonErr && <span className="err">{reasonErr}</span>}
                  </div>
                )}
                <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => close(false)}>Cancel</button>
                  <button className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{dlg.confirm || 'Confirm'}</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

// ---------------- Building blocks ----------------
export function AppBar({ title, back, right, rule, kicker }: { title?: React.ReactNode; back?: boolean | string; right?: React.ReactNode; rule?: boolean; kicker?: string }) {
  const nav = useNavigate();
  return (
    <header className={`appbar ${rule ? 'rule' : ''}`}>
      {back && <Press className="icon-btn" title="Back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}><ArrowLeft size={22} /></Press>}
      <div className="grow" style={{ paddingLeft: back ? 0 : 8 }}>
        {kicker && <p className="kicker" style={{ marginBottom: 4 }}>{kicker}</p>}
        {typeof title === 'string' ? <h1 style={{ paddingLeft: 0 }} className="ellipsis">{title}</h1> : title}
      </div>
      {right}
    </header>
  );
}

export const Logo = ({ height = 26, white }: { height?: number; white?: boolean }) =>
  <img src={white ? '/brand/byjan-logo-white.svg' : '/brand/byjan-logo.svg'} alt="Byjan" style={{ height, width: 'auto', display: 'block' }} />;
export const Mark = ({ size = 40, white }: { size?: number; white?: boolean }) =>
  <img src={white ? '/brand/byjan-mark-white.svg' : '/brand/byjan-mark.svg'} alt="" width={size} height={size} style={{ display: 'block' }} />;

const UPI_LOGOS: Record<string, string> = { phonepe: 'phonepe', gpay: 'gpay', 'google pay': 'gpay', paytm: 'paytm', bhim: 'bhim', 'amazon pay': 'amazonpay', amazonpay: 'amazonpay', cred: 'cred', mobikwik: 'mobikwik', upi: 'upi', whatsapp: 'whatsapp' };
export function SourceLogo({ name, size = 22 }: { name?: string; size?: number }) {
  const k = String(name || '').toLowerCase();
  const hit = Object.keys(UPI_LOGOS).find((x) => k.includes(x));
  if (!hit) return null;
  return <img src={`/brands/${UPI_LOGOS[hit]}.svg`} alt={hit} width={size} height={size} style={{ objectFit: 'contain', borderRadius: 4, flex: 'none' }} />;
}

export function Avatar({ name, src, size = 40 }: { name?: string; src?: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.33 }}>{src ? <img src={src} alt="" /> : initials(name)}</span>;
}

export function Field({ label, hint, error, warning, children, optional }: { label: React.ReactNode; hint?: string; error?: string; warning?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}{optional && <span className="hint" style={{ marginLeft: 'auto' }}>Optional</span>}</label>
      {children}
      <AnimatePresence initial={false}>
        {error ? <motion.span key="e" className="err" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }}>{error}</motion.span>
          : warning ? <motion.span key="w" className="warn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{warning}</motion.span>
            : hint ? <span className="hint">{hint}</span> : null}
      </AnimatePresence>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, id }: { value: T; options: Array<{ value: T; label: React.ReactNode }>; onChange: (v: T) => void; id: string }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <Thumb id={id} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="row" style={{ minHeight: 52, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
      <span className="grow"><span style={{ display: 'block', font: '500 15px var(--font)' }}>{label}</span>{hint && <span className="hint" style={{ display: 'block', marginTop: 2 }}>{hint}</span>}</span>
      <motion.button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
        style={{ flex: 'none', width: 48, height: 28, borderRadius: 14, border: 0, padding: 3, background: on ? 'var(--teal-700)' : 'var(--line-2)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer' }}>
        <motion.span layout transition={spring} style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </motion.button>
    </label>
  );
}

export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      {icon && <div style={{ color: 'var(--faint)' }}>{icon}</div>}
      <p style={{ font: '600 17px var(--font)' }}>{title}</p>
      {body && <p className="hint" style={{ fontSize: 14, maxWidth: 320 }}>{body}</p>}
      {action}
    </motion.div>
  );
}

export const Skeleton = ({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
export const ListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="list">{Array.from({ length: rows }).map((_, i) => (
    <div key={i} className="list-row" style={{ cursor: 'default' }}><Skeleton h={40} w={40} r={8} /><div className="grow stack" style={{ gap: 6 }}><Skeleton h={14} w="60%" /><Skeleton h={12} w="35%" /></div><Skeleton h={16} w={64} /></div>
  ))}</div>
);

export function OfflineBanner() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    void Network.getStatus().then((s) => setOff(!s.connected)).catch(() => undefined);
    const h = Network.addListener('networkStatusChange', (s) => setOff(!s.connected));
    return () => { void h.then((x) => x.remove()); };
  }, []);
  return (
    <AnimatePresence>
      {off && <motion.div className="banner warning" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><WifiOff size={16} />You’re offline. New entries are saved and will sync.</motion.div>}
    </AnimatePresence>
  );
}
