import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandLogo from './BrandLogo';

type AuthSceneProps = {
  title: string;
  subtitle: string;
  switchPrompt: string;
  switchHref: string;
  switchLabel: string;
  children: React.ReactNode;
};

export default function AuthScene({
  title,
  subtitle,
  switchPrompt,
  switchHref,
  switchLabel,
  children,
}: AuthSceneProps) {
  return (
    <div className="auth-shell h-dvh max-h-dvh overflow-hidden grid lg:grid-cols-[1fr_minmax(380px,460px)] bg-white font-sans">
      <section className="auth-stage relative hidden lg:flex items-center justify-center overflow-hidden px-10">
        <div className="auth-stage-grid" />
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />
        <div className="relative z-10 w-full max-w-[420px]">
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-teal-200/90 mb-4">
            Byjan workspace
          </p>
          <motion.div
            className="auth-card-3d"
            initial={{ opacity: 0, rotateY: -22, y: 16 }}
            animate={{ opacity: 1, rotateY: -12, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-card-face">
              <BrandLogo size="lg" className="mx-auto" />
            </div>
          </motion.div>
          <motion.div
            className="mt-7 text-white"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
          >
            <h1 className="font-display text-[34px] leading-[1.08] font-semibold tracking-tight">
              Trace Financials Easily
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-300 max-w-sm">
              Ledgers, invoices, and expense books in one private workspace.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="relative flex flex-col justify-center px-5 py-6 sm:px-8 overflow-y-auto">
        <div className="lg:hidden mb-5 flex justify-center">
          <BrandLogo size="md" />
        </div>
        <div className="w-full max-w-[380px] mx-auto">
          <h2 className="font-display text-[26px] font-semibold tracking-tight text-[#0B1F3A]">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <p className="mt-1 text-sm text-slate-600">
            {switchPrompt}{' '}
            <Link to={switchHref} className="font-semibold text-teal-700 hover:text-teal-600">
              {switchLabel}
            </Link>
          </p>
          <div className="mt-5">{children}</div>
        </div>
      </section>
    </div>
  );
}
