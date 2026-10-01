import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, animate, type PanInfo } from 'motion/react';
import confetti from 'canvas-confetti';
import { tap, success } from './lib/haptics';

export { motion, AnimatePresence };
export const spring = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 };
export const softSpring = { type: 'spring' as const, stiffness: 260, damping: 28 };
const ease = [0.2, 0.8, 0.2, 1] as const;

/** Route-level transition: push slides in from the right, pop from the left. */
export function Page({ children, dir = 1 }: { children: React.ReactNode; dir?: 1 | -1 }) {
  return (
    <motion.div className="screen-wrap" style={{ minHeight: '100%' }}
      initial={{ opacity: 0, x: 28 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 * dir }}
      transition={{ duration: 0.28, ease }}>
      {children}
    </motion.div>
  );
}

export const Stagger = ({ children, className, style, delay = 0 }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number }) => (
  <motion.div className={className} style={style} initial="hide" animate="show"
    variants={{ hide: {}, show: { transition: { staggerChildren: 0.045, delayChildren: delay } } }}>{children}</motion.div>
);
export const Item = ({ children, className, style, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) => (
  <motion.div className={className} style={style} onClick={onClick}
    variants={{ hide: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } } }}>{children}</motion.div>
);

/** Anything tappable: springy press + light haptic. */
export function Press({ children, onClick, className, style, disabled, as = 'button', type, title }: {
  children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; className?: string; style?: React.CSSProperties; disabled?: boolean; as?: 'button' | 'div'; type?: 'button' | 'submit'; title?: string;
}) {
  const C = as === 'div' ? motion.div : motion.button;
  return (
    <C className={className} style={style} title={title} {...(as === 'button' ? { type: type || 'button', disabled } : {})}
      whileTap={disabled ? undefined : { scale: 0.97 }} transition={spring}
      onClick={(e: React.MouseEvent) => { if (disabled) return; tap(); onClick?.(e); }}>{children}</C>
  );
}

/** Bottom sheet with drag-to-dismiss and spring physics. */
export function Sheet({ open, onClose, title, children, footer, tall }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  const onDragEnd = (_: unknown, i: PanInfo) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose(); };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div className="sheet" role="dialog" aria-modal="true" style={tall ? { height: '92vh' } : undefined}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={softSpring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}>
            <div className="grab" />
            {title !== undefined && <div className="sheet-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button></div>}
            <div className="sheet-body" onPointerDownCapture={(e) => e.stopPropagation()}>{children}</div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Rolls numbers up to their value (totals, MRR, meters). */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-IN'), className, style }: { value: number; format?: (n: number) => string; className?: string; style?: React.CSSProperties }) {
  const mv = useMotionValue(0);
  const [txt, setTxt] = useState(format(0));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease });
    const u = mv.on('change', (v) => setTxt(format(v)));
    return () => { c.stop(); u(); };
  }, [value]);
  return <span className={className} style={style}>{txt}</span>;
}

/** Animated meter fill with colour by threshold. */
export function MeterBar({ pct, height = 6 }: { pct: number; height?: number }) {
  const p = Math.max(0, Math.min(1, pct));
  const bg = p >= 0.9 ? 'var(--red)' : p >= 0.75 ? 'var(--amber)' : 'var(--teal)';
  return (
    <div className="meter" style={{ height }}>
      <motion.div style={{ background: bg }} initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ duration: 0.8, ease }} />
    </div>
  );
}

/** Receipt scanning: a light beam sweeps the image while fields are read. */
export function ScanBeam({ src, active, isPdf }: { src?: string; active: boolean; isPdf?: boolean }) {
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0B1F3A', aspectRatio: '3 / 4', maxHeight: '46vh', margin: '0 auto', width: '100%' }}>
      {src && !isPdf ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: active ? 0.85 : 1, transition: 'opacity .4s' }} />
        : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', font: '600 15px var(--font)' }}>{isPdf ? 'PDF document' : 'Text message'}</div>}
      {active && (
        <>
          <motion.div style={{ position: 'absolute', left: 0, right: 0, height: 90, background: 'linear-gradient(180deg, rgba(18,184,168,0) 0%, rgba(18,184,168,.35) 70%, rgba(94,234,212,.95) 100%)', boxShadow: '0 6px 24px rgba(18,184,168,.7)' }}
            initial={{ top: '-20%' }} animate={{ top: ['-20%', '100%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }} />
          {[0, 1, 2, 3].map((i) => (
            <motion.span key={i} style={{ position: 'absolute', width: 22, height: 22, borderColor: '#5EEAD4', borderStyle: 'solid', borderWidth: 0, ...[
              { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3 }, { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3 },
              { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3 }, { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3 }][i] }}
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }} />
          ))}
        </>
      )}
    </div>
  );
}

/** Wraps an auto-filled field: soft teal flash + sparkle tag, then settles. */
export function AutoGlow({ active, delay = 0, children }: { active: boolean; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div style={{ position: 'relative', borderRadius: 10 }}
      initial={active ? { boxShadow: '0 0 0 0 rgba(18,184,168,0)' } : false}
      animate={active ? { boxShadow: ['0 0 0 0 rgba(18,184,168,0)', '0 0 0 6px rgba(18,184,168,.22)', '0 0 0 0 rgba(18,184,168,0)'] } : undefined}
      transition={{ duration: 1.1, delay, ease }}>
      {children}
    </motion.div>
  );
}

/** Types text in letter by letter (used for auto-filled amount + merchant reveal). */
export function TypeIn({ text, delay = 0, className, style }: { text: string; delay?: number; className?: string; style?: React.CSSProperties }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      let i = 0;
      t = setInterval(() => { i += 1; setN(i); if (i >= text.length && t) clearInterval(t); }, Math.max(14, 380 / Math.max(text.length, 1)));
    }, delay * 1000);
    return () => { clearTimeout(start); if (t) clearInterval(t); };
  }, [text, delay]);
  return <span className={className} style={style}>{text.slice(0, n)}<motion.span animate={{ opacity: n < text.length ? [1, 0] : 0 }} transition={{ repeat: Infinity, duration: 0.5 }}>|</motion.span></span>;
}

/** Big success moment: check draws itself, ring pops, optional confetti. */
export function SuccessMark({ size = 88, confettiOn = false }: { size?: number; confettiOn?: boolean }) {
  useEffect(() => {
    success();
    if (confettiOn) confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.42 }, colors: ['#12B8A8', '#5EEAD4', '#0B1F3A', '#FFFFFF'], disableForReducedMotion: true });
  }, [confettiOn]);
  return (
    <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      style={{ width: size, height: size, borderRadius: '50%', background: 'var(--teal-700)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 10px var(--teal-50)' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.15, ease }} />
      </svg>
    </motion.div>
  );
}

/** Sliding thumb for segmented controls / tabs (shared layout). */
export const Thumb = ({ id }: { id: string }) => <motion.span layoutId={id} className="thumb" transition={spring} />;
export const Underline = ({ id }: { id: string }) => (
  <motion.span layoutId={id} transition={spring} style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 2, background: 'var(--ink)' }} />
);

/** Pull-to-refresh for list screens. */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const y = useMotionValue(0);
  const s = useSpring(y, { stiffness: 400, damping: 40 });
  const rot = useTransform(s, [0, 80], [0, 270]);
  const op = useTransform(s, [0, 40, 80], [0, 0.6, 1]);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  return (
    <div
      onTouchStart={(e) => { if (window.scrollY <= 0) startY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => { if (startY.current == null || busy) return; const d = e.touches[0].clientY - startY.current; if (d > 0) y.set(Math.min(110, d * 0.5)); }}
      onTouchEnd={async () => {
        if (startY.current == null) return; startY.current = null;
        if (y.get() > 70 && !busy) { setBusy(true); y.set(64); tap(); try { await onRefresh(); } finally { setBusy(false); y.set(0); } } else y.set(0);
      }}>
      <motion.div style={{ height: s, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <motion.div style={{ rotate: busy ? undefined : rot, opacity: op }} animate={busy ? { rotate: 360 } : undefined} transition={busy ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : undefined}>
          <img src="/brand/byjan-mark.svg" alt="" width={26} height={26} />
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}

/** Brand loader used on boot and long waits. */
export function BrandLoader({ label }: { label?: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: 40 }}>
      <motion.img src="/brand/byjan-mark.svg" alt="Byjan" width={56} height={56}
        animate={{ scale: [0.92, 1.04, 0.92], opacity: [0.75, 1, 0.75] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} />
      {label && <p className="hint">{label}</p>}
    </div>
  );
}
