import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BookOpen, BookText, CircleHelp, LogOut, Settings, Shield, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { emailIsSuperUser } from '../lib/super-users';
import { logout } from '../lib/firebase';

export default function AccountMenu() {
  const { currentUser, userProfile } = useAuth();
  const { on: hasFeature } = useFeatures();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = userProfile?.displayName || currentUser?.displayName || 'Account';
  const email = userProfile?.email || currentUser?.email || '';
  const showAccess = emailIsSuperUser(email);
  const photo = userProfile?.photoURL || currentUser?.photoURL || '';
  const initial = (name || email || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="account-avatar"
        title="Account and sign out"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {photo ? <img src={photo} alt="" /> : initial}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="account-sheet-backdrop" onClick={() => !signingOut && setOpen(false)} />
          <div className="account-sheet" role="dialog" aria-label="Account">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="account-avatar account-avatar-lg">
                  {photo ? <img src={photo} alt="" /> : initial}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[16px] font-semibold text-[#0B1F3A] truncate">{name}</p>
                  <p className="text-[12px] text-slate-500 truncate">{email}</p>
                </div>
              </div>
              <button
                type="button"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center"
                onClick={() => setOpen(false)}
                aria-label="Close account menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="account-guide">
              {showAccess && (
              <Link to="/access" onClick={() => setOpen(false)} className="account-guide-item">
                <span className="account-guide-icon"><Shield className="w-4 h-4" /></span>
                <span>
                  <strong>Access & roles</strong>
                  Search people and choose which features they can use.
                </span>
              </Link>
              )}
              {hasFeature('money') && (
              <Link to="/expenses" onClick={() => setOpen(false)} className="account-guide-item">
                <span className="account-guide-icon"><BookText className="w-4 h-4" /></span>
                <span>
                  <strong>Money books</strong>
                  Daily money in and out. Share with family or teammates.
                </span>
              </Link>
              )}
              {hasFeature('business') && (
              <Link to="/books" onClick={() => setOpen(false)} className="account-guide-item">
                <span className="account-guide-icon"><BookOpen className="w-4 h-4" /></span>
                <span>
                  <strong>Business</strong>
                  Invoices, bills, GST, and company accounts.
                </span>
              </Link>
              )}
            </div>

            <Link to="/help" onClick={() => setOpen(false)} className="account-action">
              <CircleHelp className="w-4 h-4" />
              Help & tickets
            </Link>
            <Link to="/settings" onClick={() => setOpen(false)} className="account-action">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button type="button" onClick={() => void handleSignOut()} disabled={signingOut} className="account-action account-action-danger">
              <LogOut className="w-4 h-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
