import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../lib/firebase';
import { acceptLedgerInvite, declineLedgerInvite, peekLedgerInvite, type InvitePeek } from '../lib/invites';
import { setReturnTo } from '../lib/return-to';
import { clearStoreCache } from '../lib/store';
import BrandLogo from '../components/BrandLogo';
import AppLoader from '../components/AppLoader';

export default function InviteAccept() {
  const { inviteId = '' } = useParams();
  const { currentUser, userProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [peek, setPeek] = useState<InvitePeek | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!inviteId) return;
    try {
      setError('');
      setPeek(await peekLedgerInvite(inviteId));
    } catch (err: any) {
      setError(err?.message || 'Could not open this invitation.');
    }
  };

  useEffect(() => {
    if (loading) return;
    void load();
  }, [inviteId, loading, currentUser?.uid, userProfile?.email]);

  if (loading && !peek) return <AppLoader title="Byjan" message="Opening invitation." />;

  const goLogin = () => {
    setReturnTo(`/invite/${inviteId}`);
    navigate('/login');
  };

  const switchAccount = async () => {
    setReturnTo(`/invite/${inviteId}`);
    clearStoreCache();
    await logout();
    navigate('/login');
  };

  const accept = async () => {
    if (!peek?.invite || !currentUser || !userProfile) return;
    setBusy('accept');
    try {
      await acceptLedgerInvite({
        invite: peek.invite,
        uid: currentUser.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
      });
      clearStoreCache();
      navigate(`/book/${peek.invite.bookId}`);
    } catch (err: any) {
      setError(err?.message || 'Could not accept this invitation.');
    } finally {
      setBusy('');
    }
  };

  const decline = async () => {
    if (!inviteId) return;
    setBusy('decline');
    try {
      await declineLedgerInvite(inviteId);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Could not decline this invitation.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-dvh bg-[#F5F7FA] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <BrandLogo size="sm" className="mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ledger invitation</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Join a shared ledger</h1>
        {error && <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

        {peek?.status === 'auth_required' && (
          <>
            <p className="mt-3 text-sm text-slate-600">Sign in with the email this invitation was sent to. A different signed-in account cannot open it.</p>
            <button type="button" className="byjan-btn w-full mt-4" onClick={goLogin}>Sign in to continue</button>
          </>
        )}

        {peek?.status === 'wrong_account' && (
          <>
            <p className="mt-3 text-sm text-slate-600">
              This invitation is for <b>{peek.invitedEmail}</b>. You are signed in as <b>{peek.currentEmail}</b>.
            </p>
            <button type="button" className="byjan-btn w-full mt-4" onClick={() => void switchAccount()}>Sign out and use the invited email</button>
          </>
        )}

        {peek?.status === 'already_member' && (
          <>
            <p className="mt-3 text-sm text-slate-600">You already have access to this ledger.</p>
            <button type="button" className="byjan-btn w-full mt-4" onClick={() => navigate(`/book/${peek.bookId}`)}>Open ledger</button>
          </>
        )}

        {peek?.status === 'closed' && (
          <p className="mt-3 text-sm text-slate-600">This invitation is no longer pending.</p>
        )}

        {peek?.status === 'missing' && (
          <p className="mt-3 text-sm text-slate-600">This invitation was not found.</p>
        )}

        {peek?.status === 'ok' && peek.invite && (
          <>
            <p className="mt-3 text-sm text-slate-600">
              You were invited to <b>{peek.invite.bookName}</b> as <span className="capitalize">{peek.invite.role}</span>.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="byjan-btn flex-1" disabled={Boolean(busy)} onClick={() => void accept()}>
                {busy === 'accept' ? 'Joining…' : 'Accept'}
              </button>
              <button type="button" className="byjan-btn-ghost flex-1" disabled={Boolean(busy)} onClick={() => void decline()}>
                {busy === 'decline' ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </>
        )}

        <Link to="/" className="block text-center text-sm text-slate-500 mt-5">Back to Byjan</Link>
      </div>
    </div>
  );
}
