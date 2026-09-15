import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createLedger } from '../lib/ledgers';
import { listAllExpenses } from '../lib/expenses';
import { useBooksTenantMeta } from '../lib/tenant';
import { getCurrencySymbol } from '../lib/currency';
import { initials, readRecentLedgers, sparkDays } from '../lib/ledger-advanced';
import { formatIndianAmount, workspaceBridges } from '../lib/bridge-automations';
import { Plus, Check, X, Users, ArrowUpRight, RefreshCw, Wallet, TrendingUp, Receipt, BookOpen, Shield, ChevronRight, IndianRupee } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { ListControls, usePagedList } from '../components/ListControls';
import { FeatureIcon } from '../books/ui/icons';
import { acceptLedgerInvite, declineLedgerInvite, listLedgerInvites, type LedgerInvite } from '../lib/invites';
import { clearStoreCache } from '../lib/store';
import { roleLabel } from '../lib/plain-language';
import { useFeatures } from '../lib/use-features';
import ReceiptCaptureFlow, { type ReceiptLaunch } from '../components/ReceiptCaptureFlow';
import { cacheMoneyBooks, readPendingCapture, clearPendingCapture } from '../components/ShareIntentListener';
import { readUserJson, writeUserJson } from '../lib/user-cache';

interface BookItem {
  id: string;
  name: string;
  ownerId: string;
  currency: string;
  pinned?: boolean;
  archived?: boolean;
  accentHue?: number;
  roles: Record<string, { role: string; email: string }>;
}

type BookStat = { net: number; monthOut: number; lastMonthOut: number; entries: number; spark: number[] };

type InviteItem = LedgerInvite;

export default function Dashboard() {
  const { currentUser, userProfile, isSuperUser } = useAuth();
  const { on: hasFeature, anyOn: hasAnyFeature, canSeeMoney, tree: businessTree } = useFeatures();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const tenant = useBooksTenantMeta();
  const expensesOnly = location.pathname.startsWith('/expenses');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalIn: 0,
    totalOut: 0,
    monthIn: 0,
    monthOut: 0,
    reimbursable: 0,
    entries: 0,
    uncategorized: 0,
    userActivity: {} as Record<string, number>,
  });
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsReady, setStatsReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [creating, setCreating] = useState(false);
  const [bookStats, setBookStats] = useState<Record<string, BookStat>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [bridges, setBridges] = useState<ReturnType<typeof workspaceBridges> | null>(null);
  const recentIds = readRecentLedgers();

  const emptyStats = {
    totalIn: 0,
    totalOut: 0,
    monthIn: 0,
    monthOut: 0,
    reimbursable: 0,
    entries: 0,
    uncategorized: 0,
    userActivity: {} as Record<string, number>,
  };

  const fetchData = async (opts?: { silent?: boolean }) => {
    if (!currentUser || !userProfile) return;
    const uid = currentUser.uid;
    try {
      if (!opts?.silent) {
        setLoading(true);
        setStatsReady(false);
        // Paint last-known totals for THIS user only.
        const parsed = readUserJson<{
          globalStats?: typeof globalStats;
          bookStats?: Record<string, BookStat>;
          books?: BookItem[];
          at?: number;
        }>(uid, 'dash_stats');
        if (parsed?.globalStats && Date.now() - Number(parsed.at || 0) < 15 * 60_000) {
          setGlobalStats(parsed.globalStats);
          if (parsed.bookStats) setBookStats(parsed.bookStats);
          if (parsed.books?.length) setBooks(parsed.books);
          setStatsReady(true);
          setLoading(false);
        }
      }
      setLoadError('');
      if (!canSeeMoney) {
        setBooks([]);
        setBookStats({});
        setBridges(null);
        setGlobalStats(emptyStats);
        setInvites([]);
        setStatsReady(true);
        setLoading(false);
        return;
      }

      // One expenses API (includes books) + invites — no duplicate listLedgers.
      const [allExp, inviteRows] = await Promise.all([
        listAllExpenses().catch(() => ({ expenses: [] as Array<Record<string, unknown>>, books: [] as Array<Record<string, unknown>> })),
        listLedgerInvites().catch(() => [] as InviteItem[]),
      ]);

      const fetchedBooks = (allExp.books || []).map((book: any) => ({
        id: String(book.id),
        name: String(book.name || 'Money book'),
        ownerId: String(book.ownerId || ''),
        currency: String(book.currency || 'INR'),
        pinned: Boolean(book.pinned),
        archived: Boolean(book.archived),
        accentHue: Number(book.accentHue || 0) || undefined,
        roles: (book.roles || {}) as BookItem['roles'],
      })).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
      setBooks(fetchedBooks);
      setInvites(inviteRows);
      setLoading(false);
      cacheMoneyBooks(fetchedBooks.map((b) => ({ id: b.id, name: b.name, currency: b.currency })));

      try {
      let tIn = 0; let tOut = 0; let monthIn = 0; let monthOut = 0; let reimbursable = 0; let uncategorized = 0;
      const monthKey = new Date().toISOString().slice(0, 7);
      let activity: Record<string, number> = {};
      const nextBookStats: Record<string, BookStat> = {};
      const lastKey = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
      const byBook: Record<string, Array<Record<string, unknown>>> = {};
      const expenses = Array.isArray(allExp.expenses) ? allExp.expenses : [];
      if (fetchedBooks.length) {
        expenses.forEach((data) => {
          const amount = Number(data.amount || 0);
          const isIn = data.entryType === 'in' || data.type === 'in';
          const isTransfer = data.entryType === 'transfer';
          const ledgerId = String(data.bookId || '');
          if (!nextBookStats[ledgerId]) nextBookStats[ledgerId] = { net: 0, monthOut: 0, lastMonthOut: 0, entries: 0, spark: [0, 0, 0, 0, 0, 0, 0] };
          if (!byBook[ledgerId]) byBook[ledgerId] = [];
          byBook[ledgerId].push(data);
          nextBookStats[ledgerId].entries += 1;
          if (isIn) nextBookStats[ledgerId].net += amount;
          else if (!isTransfer) nextBookStats[ledgerId].net -= amount;
          if (isIn) tIn += amount;
          else if (!isTransfer) tOut += amount;
          if (String(data.date || '').startsWith(monthKey)) {
            if (isIn) monthIn += amount;
            else if (!isTransfer) {
              monthOut += amount;
              nextBookStats[ledgerId].monthOut += amount;
            }
          }
          if (!isIn && !isTransfer && String(data.date || '').startsWith(lastKey)) {
            nextBookStats[ledgerId].lastMonthOut += amount;
          }
          if (data.reimbursable) reimbursable += amount;
          const cat = String(data.category || '').trim().toLowerCase();
          if (!cat || cat === 'uncategorized') uncategorized += 1;
          const user = String(data.enteredBy || data.paidByName || data.createdBy || 'Unknown');
          activity[user] = (activity[user] || 0) + 1;
        });
        Object.keys(byBook).forEach((id) => {
          if (nextBookStats[id]) nextBookStats[id].spark = sparkDays(byBook[id]);
        });
        const nextGlobal = {
          totalIn: tIn,
          totalOut: tOut,
          monthIn,
          monthOut,
          reimbursable,
          entries: expenses.length,
          uncategorized,
          userActivity: activity,
        };
        setBookStats(nextBookStats);
        setBridges(workspaceBridges(expenses));
        setGlobalStats(nextGlobal);
        writeUserJson(uid, 'dash_stats', {
          at: Date.now(),
          globalStats: nextGlobal,
          bookStats: nextBookStats,
          books: fetchedBooks,
        });
      } else {
        setBookStats({});
        setBridges(null);
        setGlobalStats({ totalIn: 0, totalOut: 0, monthIn: 0, monthOut: 0, reimbursable: 0, entries: 0, uncategorized: 0, userActivity: {} });
      }
      } catch (err) {
        console.error('Ledger extras error:', err);
      } finally {
        setStatsReady(true);
      }
    } catch (err) {
      console.error('Fetch API error:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load your workspace.');
    } finally {
      setLoading(false);
      setStatsReady(true);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [currentUser?.uid, canSeeMoney, userProfile?.features]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (userProfile?.defaultCurrency && !newCurrency) {
      setNewCurrency(userProfile.defaultCurrency);
    }
  }, [userProfile?.defaultCurrency, newCurrency]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile || !newBookName.trim()) return;
    setCreating(true);
    try {
      await createLedger({ name: newBookName, currency: newCurrency });
      setNewBookName('');
      setShowNewBook(false);
      addToast('Money book created', 'success');
      void fetchData({ silent: true });
    } catch (err) {
      console.error('Fetch API error:', err);
      addToast(err instanceof Error ? err.message : 'Could not create money book', 'error');
    } finally {
      setCreating(false);
    }
  };

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [receiptLaunch, setReceiptLaunch] = useState<ReceiptLaunch | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => {
    const openFromPending = () => {
      const pending = readPendingCapture();
      if (!pending?.imageDataUrl && !pending?.text) return;
      setReceiptLaunch({
        text: pending.text,
        imageDataUrl: pending.imageDataUrl,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        source: pending.source || 'share',
        preferredBookId: pending.preferredBookId,
        requireBookPick: pending.requireBookPick !== false,
      });
    };

    const params = new URLSearchParams(location.search);
    if (params.get('capture') === '1') {
      const pending = readPendingCapture();
      if (!pending?.imageDataUrl && !pending?.text) {
        navigate(location.pathname, { replace: true });
      } else {
        openFromPending();
        navigate(location.pathname, { replace: true });
      }
    }

    window.addEventListener('byjan-pending-capture', openFromPending);
    return () => window.removeEventListener('byjan-pending-capture', openFromPending);
  }, [location.search, location.pathname, navigate]);

  const handleAcceptInvite = async (invite: InviteItem) => {
    if (!currentUser || !userProfile) return;
    setAcceptingId(invite.id);
    try {
      const result = await acceptLedgerInvite({
        invite,
        uid: currentUser.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
      });
      if (result.notifyError) addToast(result.notifyError, 'error');
      clearStoreCache();
      fetchData();
    } catch (err: any) {
      console.error('Dashboard error:', err);
      addToast('Error: ' + err.message, 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setDecliningId(inviteId);
    try {
      await declineLedgerInvite(inviteId);
      fetchData();
    } catch (err) {
      console.error('Fetch API error:', err);
      addToast('Could not decline that invitation', 'error');
    } finally {
      setDecliningId(null);
    }
  };

  const filterBook = useCallback((book: BookItem, q: string) => (
    [book.name, book.currency, ...Object.values(book.roles || {}).map((r) => r.email)]
      .some((value) => String(value || '').toLowerCase().includes(q))
  ), []);
  const visibleBooks = books.filter((book) => showArchived || !book.archived);
  const bookList = usePagedList(visibleBooks, filterBook, 12);
  const recentBooks = recentIds.map((id) => books.find((book) => book.id === id)).filter(Boolean) as BookItem[];

  const currency = getCurrencySymbol(books[0]?.currency || userProfile?.defaultCurrency || 'INR');
  const net = globalStats.totalIn - globalStats.totalOut;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = String(userProfile?.displayName || currentUser?.email || 'there').split(' ')[0];
  const uid = currentUser?.uid || '';
  const myRoleOn = (book: BookItem) => book.roles[uid]?.role || (book.ownerId === uid ? 'owner' : 'viewer');
  const managedBooks = visibleBooks.filter((book) => ['owner'].includes(myRoleOn(book)) || book.ownerId === uid);
  const isBusinessOwner = Boolean(tenant && uid && tenant.ownerId === uid);
  const openPeople = (bookId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    navigate(`/book/${bookId}`, { state: { openPeople: true } });
  };
  const peopleCount = (book: BookItem) => Math.max(Object.keys(book.roles || {}).length, book.ownerId ? 1 : 0);

  const renderLedgerCard = (book: BookItem) => {
    const role = myRoleOn(book);
    const stat = bookStats[book.id];
    const symbol = getCurrencySymbol(book.currency);
    const maxSpark = Math.max(...(stat?.spark || [1]), 1);
    const people = peopleCount(book);
    const canManage = role === 'owner' || role === 'admin';
    const netVal = stat ? Math.abs(stat.net) : 0;
    const netNeg = Boolean(stat && stat.net < 0);
    return (
      <article key={book.id} className="md3-book">
        <Link to={`/book/${book.id}`} className="md3-book-main">
          <span className="md3-book-icon" aria-hidden>
            <span className="md3-book-icon-face">{initials(book.name)}</span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[#0B1F3A] leading-tight tracking-tight truncate">{book.name}</h3>
              <span className="md3-badge">{roleLabel(role)}</span>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5 truncate">
              {book.archived ? 'Archived · ' : ''}{people} {people === 1 ? 'person' : 'people'}
              {stat ? ` · ${stat.entries} records` : ''}
            </p>
          </div>
        </Link>
        <div className="md3-book-side">
          {canSeeMoney ? (
            <>
              <p className={`byjan-money md3-book-amt ${netNeg ? 'is-out' : 'is-in'}`}>
                {stat ? `${netNeg ? '−' : ''}${symbol}${netVal.toLocaleString()}` : '—'}
              </p>
              {canManage ? (
                <button type="button" className="dash-people-btn" onClick={(event) => openPeople(book.id, event)}>
                  <Users className="w-3.5 h-3.5" /> People
                </button>
              ) : stat ? (
                <svg className="byjan-spark" viewBox="0 0 64 18" aria-hidden>
                  <polyline
                    fill="rgba(11,31,58,0.06)"
                    stroke="#12B8A8"
                    strokeWidth="1.5"
                    points={`0,18 ${stat.spark.map((v, i) => `${(i / Math.max(stat.spark.length - 1, 1)) * 64},${17 - (v / maxSpark) * 14}`).join(' ')} 64,18`}
                  />
                </svg>
              ) : null}
            </>
          ) : canManage ? (
            <button type="button" className="dash-people-btn" onClick={(event) => openPeople(book.id, event)}>
              <Users className="w-3.5 h-3.5" /> People
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  const createDialog = (
      <Dialog.Root open={showNewBook} onOpenChange={(next) => { if (!creating) setShowNewBook(next); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content
            className="fixed left-[50%] top-[50%] z-[100] grid w-[calc(100%-1.5rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-5 rounded-[22px] bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(11,31,58,0.42)]"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold text-slate-900">New money book</Dialog.Title>
              <Dialog.Close className="text-slate-400 hover:text-slate-700 rounded-md p-1"><X className="w-4 h-4"/></Dialog.Close>
            </div>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text" required autoFocus
                  value={newBookName} onChange={e => setNewBookName(e.target.value)}
                  className="byjan-input"
                  placeholder="e.g. Home, Shop, Travel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <Select value={newCurrency} onValueChange={setNewCurrency}>
                  <SelectTrigger className="w-full border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={creating || !newBookName.trim()} className="byjan-btn">
                  {creating && <span className="app-loader-ring app-loader-ring-sm" />}
                  Create book
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );

  const inviteBlock = canSeeMoney && invites.length > 0 && (
        <div className="space-y-2">
          <h2 className="dash-section-label"><Users className="w-3.5 h-3.5" /> Invitations</h2>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="dash-invite">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0B1F3A] truncate">{invite.bookName}</p>
                  <p className="text-xs text-slate-500">Invited as {roleLabel(invite.role)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleAcceptInvite(invite)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn !h-8 text-xs">
                    {acceptingId === invite.id ? <span className="app-loader-ring app-loader-ring-sm" /> : <Check className="w-3.5 h-3.5" />}
                    Accept
                  </button>
                  <button onClick={() => handleDeclineInvite(invite.id)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn-ghost !h-8 text-xs">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
  );

  if (!expensesOnly) {
    return (
      <div className="home-shell ios-page">
        {createDialog}
        <section className="home-stage">
          <div className="home-stage-glow" aria-hidden />
          <div className="home-stage-grid" aria-hidden />
          <div className="home-brand-row">
            <p className="home-brand">Byjan</p>
            {isSuperUser && (
              <Link to="/access" className="home-super">
                <Shield className="w-3.5 h-3.5" /> Access
              </Link>
            )}
          </div>
          <p className="home-hello">{hello}, {firstName}</p>
          {!hasAnyFeature ? (
            <p className="home-lead">Your admin has not turned on Money or Business yet.</p>
          ) : canSeeMoney ? (
            <>
              <p className="home-balance-label">Across your books</p>
              <p className="home-balance byjan-money">
                {loading || !statsReady ? '…' : formatIndianAmount(net, currency)}
              </p>
            </>
          ) : (
            <p className="home-lead">Open Business when you need invoices and GST.</p>
          )}
          <div className="home-cta-row">
            {hasFeature('money') && (
              <Link to="/expenses" className="home-cta home-cta-primary">
                <span className="home-cta-orb" aria-hidden><IndianRupee className="w-4 h-4" /></span>
                Money
              </Link>
            )}
            {hasFeature('money') && (
              <button type="button" className="home-cta" onClick={() => setShowNewBook(true)}>
                <span className="home-cta-orb tone-2" aria-hidden><Plus className="w-4 h-4" /></span>
                New book
              </button>
            )}
            {hasFeature('business') && (
              <Link to="/books" className="home-cta">
                <span className="home-cta-orb tone-3" aria-hidden><BookOpen className="w-4 h-4" /></span>
                Business
              </Link>
            )}
          </div>
        </section>

        {hasFeature('money') && visibleBooks.length > 0 && (
          <section className="home-continue">
            <div className="home-continue-head">
              <h2>Continue</h2>
              <Link to="/expenses">All books</Link>
            </div>
            <div className="home-continue-list">
              {(recentBooks.length ? recentBooks : visibleBooks).slice(0, 4).map((book, i) => {
                const stat = bookStats[book.id];
                const symbol = getCurrencySymbol(book.currency);
                const netNeg = Boolean(stat && stat.net < 0);
                return (
                  <Link
                    key={book.id}
                    to={`/book/${book.id}`}
                    className="home-continue-card"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="home-continue-icon" aria-hidden>
                      <span>{initials(book.name)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="home-continue-name">{book.name}</span>
                      <span className="home-continue-meta">{roleLabel(myRoleOn(book))}</span>
                    </span>
                    {canSeeMoney && stat ? (
                      <span className={`byjan-money home-continue-amt ${netNeg ? 'is-out' : 'is-in'}`}>
                        {netNeg ? '−' : ''}{symbol}{Math.abs(stat.net).toLocaleString()}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {inviteBlock}

        {hasFeature('business') && businessTree.length > 0 && (
          <section className="home-continue">
            <div className="home-continue-head">
              <h2>Business{tenant?.name ? ` · ${tenant.name}` : ''}</h2>
              <Link to="/books">Open</Link>
            </div>
            <div className="home-biz-row">
              {businessTree.filter((branch) => branch.id !== 'dashboard').slice(0, 4).map((branch) => (
                <Link key={branch.id} to={branch.href} className="home-biz-chip" title={branch.blurb}>
                  <FeatureIcon href={branch.href} className="w-4 h-4" />
                  <span>{branch.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="dash-shell ios-page">
      {createDialog}
      <section className="dash-hero dash-hero-money">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Money</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] sm:text-[30px] font-semibold tracking-[-0.04em] text-white">Money books</h1>
            <p className="text-[13px] text-white/70 mt-1">Add money out, money in, or a transfer. Paste a UPI SMS when you can.</p>
          </div>
          <button type="button" onClick={() => setShowNewBook(true)} className="dash-hero-cta">
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
        {canSeeMoney && (
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Balance</p>
            <p className="font-display text-[32px] sm:text-[36px] font-semibold tracking-[-0.04em] text-white tabular-nums leading-none mt-1">
              {loading || !statsReady ? <span className="dash-skel dash-skel-money" /> : formatIndianAmount(net, currency)}
            </p>
          </div>
          <div className="text-right text-[12px] text-white/70 space-y-0.5">
            <p>{loading || !statsReady ? 'Updating totals' : `${globalStats.entries} expenses`}</p>
            <p>{visibleBooks.length} books</p>
          </div>
        </div>
        )}
      </section>

      {canSeeMoney && books.length > 0 && (
        <section className="md3-panel">
          <div className="md3-panel-head">
            <div>
              <p className="md3-kicker">Overview</p>
              <h2>Money at a glance</h2>
            </div>
          </div>
          <div className="md3-stats">
            {[
              { label: 'Money in', value: formatIndianAmount(globalStats.totalIn, currency), tone: 'in', Icon: TrendingUp },
              { label: 'Money out', value: formatIndianAmount(globalStats.totalOut, currency), tone: 'out', Icon: ArrowUpRight },
              { label: 'This month', value: formatIndianAmount(globalStats.monthOut, currency), tone: 'idle', Icon: Wallet },
              { label: 'Uncategorized', value: String(globalStats.uncategorized), tone: 'warn', Icon: Receipt },
            ].map((item) => (
              <div key={item.label} className={`md3-stat tone-${item.tone}`}>
                <span className="md3-stat-icon" aria-hidden>
                  <item.Icon className="w-4 h-4" />
                </span>
                <span className="md3-stat-label">{item.label}</span>
                <strong className="md3-stat-value byjan-money">{!statsReady ? <span className="dash-skel dash-skel-line" /> : item.value}</strong>
              </div>
            ))}
          </div>
          {bridges && (bridges.tds || bridges.gstGaps || bridges.dues.length || bridges.fest || bridges.mix.cashShare >= 40 || globalStats.uncategorized > 0) ? (
            <div className="dash-chips dash-chips-inpanel">
              {globalStats.uncategorized > 0 && <span className="dash-chip">{globalStats.uncategorized} need a category</span>}
              {bridges.tds > 0 && <span className="dash-chip">{bridges.tds} TDS watch</span>}
              {bridges.gstGaps > 0 && <span className="dash-chip">{bridges.gstGaps} GST need receipt</span>}
              {bridges.mix.cashShare >= 40 && <span className="dash-chip">{bridges.mix.cashShare}% cash</span>}
              {bridges.dues.length > 0 && <span className="dash-chip">Missing {bridges.dues.slice(0, 2).join(', ')}</span>}
              {bridges.fest && <span className="dash-chip">{bridges.fest.name}</span>}
            </div>
          ) : null}
        </section>
      )}

      {inviteBlock}

      {!canSeeMoney ? (
        <div className="dash-empty">
          <p className="font-semibold text-[#0B1F3A]">Money is turned off for your account</p>
          <p className="text-sm text-slate-500 mt-1">Ask your super user to enable Money if you need access to money books.</p>
        </div>
      ) : (
      <section className="md3-panel md3-panel-books">
          <div className="md3-panel-head">
            <div>
              <p className="md3-kicker">Library</p>
              <h2>Your books</h2>
              <p className="md3-sub">{visibleBooks.length} open · tap to open expenses</p>
            </div>
            <div className="flex items-center gap-2">
              {books.some((book) => book.archived) && (
                <button type="button" className="byjan-chip" data-on={showArchived} onClick={() => setShowArchived((v) => !v)}>Archived</button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="md3-book-list" aria-busy="true" aria-label="Loading money books">
              {[0, 1, 2].map((row) => <div key={row} className="md3-book dash-skel-card" />)}
            </div>
          ) : loadError && books.length === 0 ? (
            <div className="dash-empty">
              <p className="font-semibold text-[#0B1F3A]">Could not load your money books</p>
              <p className="text-sm text-slate-500 mt-1">{loadError}</p>
              <button type="button" onClick={() => void fetchData()} className="byjan-btn mt-4">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="dash-empty">
              <span className="md3-empty-icon"><IndianRupee className="w-6 h-6" /></span>
              <h3 className="text-[15px] font-semibold text-[#0B1F3A]">No money books yet</h3>
              <p className="ios-caption mt-1">A money book is a shared list of money in and money out. Create one, then add your first record.</p>
              <button type="button" onClick={() => setShowNewBook(true)} className="byjan-btn mt-4">
                <Plus className="w-4 h-4" /> New money book
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <ListControls
                query={bookList.query}
                onQuery={bookList.setQuery}
                page={bookList.page}
                totalPages={bookList.totalPages}
                onPage={bookList.setPage}
                pageSize={bookList.pageSize}
                onPageSize={bookList.setPageSize}
                total={bookList.filtered.length}
                placeholder="Search money books"
              />
              <div className="md3-book-list">
                {bookList.pageRows.map(renderLedgerCard)}
              </div>
            </div>
          )}
      </section>
      )}

      <ReceiptCaptureFlow
        open={Boolean(receiptLaunch)}
        launch={receiptLaunch}
        onClose={() => setReceiptLaunch(null)}
        onConfirmed={(expense, extras) => {
          const bookId = String(expense.bookId || '');
          setReceiptLaunch(null);
          clearPendingCapture();
          addToast(
            extras?.needsEdit
              ? 'Could not read amount — saved as draft for you to edit'
              : 'Shared entry saved',
            extras?.needsEdit ? 'error' : 'success',
          );
          if (bookId) navigate(`/book/${bookId}`);
          else void fetchData({ silent: true });
        }}
      />
    </div>
  );
}
