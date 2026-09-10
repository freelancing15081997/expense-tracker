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
    <div className="auth-shell min-h-screen grid lg:grid-cols-[1.08fr_0.92fr] bg-[#F4F7FB] font-sans">
      <section className="auth-stage relative hidden lg:flex items-center justify-center overflow-hidden px-12">
        <div className="auth-stage-grid" />
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />
        <div className="auth-orb auth-orb-c" />
        <div className="relative z-10 w-full max-w-[520px]">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-teal-200/90 mb-6">
            Byjan workspace
          </p>
          <motion.div
            className="auth-card-3d"
            initial={{ opacity: 0, rotateY: -28, rotateX: 12, y: 28 }}
            animate={{ opacity: 1, rotateY: -14, rotateX: 7, y: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-card-face">
              <BrandLogo size="lg" className="mx-auto" />
            </div>
          </motion.div>
          <motion.div
            className="mt-10 text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.55 }}
          >
            <h1 className="font-display text-[42px] leading-[1.05] font-semibold tracking-tight">
              Trace Financials Easily
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-300 max-w-md">
              Ledgers, invoices, and expense books in one private workspace — built for speed, clarity, and control.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16 bg-white">
        <div className="lg:hidden mb-8 flex justify-center">
          <div className="auth-card-3d auth-card-3d-mobile">
            <div className="auth-card-face py-4 px-5">
              <BrandLogo size="md" className="mx-auto" />
            </div>
          </div>
        </div>
        <div className="w-full max-w-[420px] mx-auto">
          <p className="hidden lg:block text-[11px] font-semibold tracking-[0.22em] uppercase text-slate-400 mb-3">
            Secure access
          </p>
          <h2 className="font-display text-[30px] font-semibold tracking-tight text-[#0B1F3A]">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <p className="mt-2 text-sm text-slate-600">
            {switchPrompt}{' '}
            <Link to={switchHref} className="font-semibold text-teal-700 hover:text-teal-600">
              {switchLabel}
            </Link>
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
