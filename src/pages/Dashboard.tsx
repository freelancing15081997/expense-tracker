import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useLocation } from 'react-router-dom';
import { createLedger, listLedgers } from '../lib/ledgers';
import { listAllExpenses } from '../lib/expenses';
import { useBooksTenantMeta } from '../lib/tenant';
import { getCurrencySymbol } from '../lib/currency';
import { Plus, Check, X, Users, Building2, Receipt, ArrowRight, BookOpen, Pin, Sparkles } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import AppLoader from '../components/AppLoader';
import { ListControls, usePagedList } from '../components/ListControls';
import { BOOKS_TREE } from '../books/catalog/modules';
import { acceptLedgerInvite, declineLedgerInvite, listLedgerInvites, type LedgerInvite } from '../lib/invites';
import { clearStoreCache } from '../lib/store';

interface BookItem {
  id: string;
  name: string;
  ownerId: string;
  currency: string;
  pinned?: boolean;
  roles: Record<string, { role: string; email: string }>;
}

type BookStat = { net: number; monthOut: number; entries: number };

type InviteItem = LedgerInvite;

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
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
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [creating, setCreating] = useState(false);
  const [bookStats, setBookStats] = useState<Record<string, BookStat>>({});

  const fetchData = async () => {
    if (!currentUser || !userProfile) return;
    try {
      setLoading(true);
      const fetchedBooks = (await listLedgers()).map((book) => ({
        id: book.id,
        name: String(book.name || 'Ledger'),
        ownerId: String(book.ownerId || ''),
        currency: String(book.currency || 'INR'),
        pinned: Boolean(book.pinned),
        roles: (book.roles || {}) as BookItem['roles'],
      })).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
      setBooks(fetchedBooks);
      setLoading(false);

      let tIn = 0; let tOut = 0; let monthIn = 0; let monthOut = 0; let reimbursable = 0; let uncategorized = 0;
      const monthKey = new Date().toISOString().slice(0, 7);
      let activity: Record<string, number> = {};
      const nextBookStats: Record<string, BookStat> = {};
      if (fetchedBooks.length) {
        const { expenses } = await listAllExpenses();
        expenses.forEach((data) => {
          const amount = Number(data.amount || 0);
          const isIn = data.entryType === 'in' || data.type === 'in';
          const isTransfer = data.entryType === 'transfer';
          const ledgerId = String(data.bookId || '');
          if (!nextBookStats[ledgerId]) nextBookStats[ledgerId] = { net: 0, monthOut: 0, entries: 0 };
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
          if (data.reimbursable) reimbursable += amount;
          const cat = String(data.category || '').trim().toLowerCase();
          if (!cat || cat === 'uncategorized') uncategorized += 1;
          const user = String(data.enteredBy || data.paidByName || data.createdBy || 'Unknown');
          activity[user] = (activity[user] || 0) + 1;
        });
        setBookStats(nextBookStats);
        setGlobalStats({
          totalIn: tIn,
          totalOut: tOut,
          monthIn,
          monthOut,
          reimbursable,
          entries: expenses.length,
          uncategorized,
          userActivity: activity,
        });
      } else {
        setBookStats({});
        setGlobalStats({ totalIn: 0, totalOut: 0, monthIn: 0, monthOut: 0, reimbursable: 0, entries: 0, uncategorized: 0, userActivity: {} });
      }

      setInvites(await listLedgerInvites());
    } catch (err) { console.error("Fetch API error:", err); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.uid, userProfile?.email]);

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
      fetchData();
    } catch (err) { console.error("Fetch API error:", err); } finally {
      setCreating(false);
    }
  };

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
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
      console.error("Fetch API error:", err);
      addToast('Could not decline that invitation', 'error');
    } finally {
      setDecliningId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'owner') return 'bg-slate-900 text-white border-transparent';
    if (role === 'admin') return 'bg-zinc-50 text-zinc-700 border-zinc-200';
    if (role === 'contributor') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (role === 'auditor') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const filterBook = useCallback((book: BookItem, q: string) => (
    [book.name, book.currency, ...Object.values(book.roles || {}).map((r) => r.email)]
      .some((value) => String(value || '').toLowerCase().includes(q))
  ), []);
  const bookList = usePagedList(books, filterBook, 10);

  const currency = getCurrencySymbol(books[0]?.currency || userProfile?.defaultCurrency || 'INR');
  const net = globalStats.totalIn - globalStats.totalOut;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = String(userProfile?.displayName || currentUser?.email || 'there').split(' ')[0];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <section className="byjan-card byjan-hero">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/80">{hello}</p>
            <h1 className="text-[28px] leading-tight font-semibold text-slate-900 font-display mt-1">{firstName}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {expensesOnly ? 'Every shared ledger you can post to, in one glass desk.' : 'Ledgers and Books in one private workspace — tap a card and keep moving.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!expensesOnly && (
              <Link to="/books" className="byjan-btn-ghost min-h-10">
                <BookOpen className="w-4 h-4" />
                Open Books
              </Link>
            )}
            <button onClick={() => setShowNewBook(true)} className="byjan-btn min-h-10">
              <Plus className="w-4 h-4" />
              New ledger
            </button>
          </div>
        </div>
        {books.length > 0 && (
          <div className="byjan-stat-grid mt-4 relative z-10">
            <div className="byjan-stat">
              <p className="byjan-stat-label">Net</p>
              <p className={`byjan-stat-value ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{net < 0 ? '−' : ''}{currency}{Math.abs(net).toLocaleString()}</p>
            </div>
            <div className="byjan-stat">
              <p className="byjan-stat-label">In</p>
              <p className="byjan-stat-value text-emerald-600">{currency}{globalStats.totalIn.toLocaleString()}</p>
            </div>
            <div className="byjan-stat">
              <p className="byjan-stat-label">Out</p>
              <p className="byjan-stat-value text-[#0B1F3A]">{currency}{globalStats.totalOut.toLocaleString()}</p>
            </div>
            <div className="byjan-stat">
              <p className="byjan-stat-label">Month</p>
              <p className="byjan-stat-value text-[#0B1F3A]">{currency}{globalStats.monthOut.toLocaleString()}</p>
            </div>
          </div>
        )}
        {(globalStats.reimbursable > 0 || globalStats.uncategorized > 0) && (
          <div className="relative z-10 flex flex-wrap gap-2 mt-3">
            {globalStats.reimbursable > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50/80 text-amber-800 border border-amber-200/70">
                Reimbursable {currency}{globalStats.reimbursable.toLocaleString()}
              </span>
            )}
            {globalStats.uncategorized > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-50/80 text-slate-600 border border-slate-200/70">
                {globalStats.uncategorized} need a category
              </span>
            )}
          </div>
        )}
      </section>

      <Dialog.Root open={showNewBook} onOpenChange={setShowNewBook}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="byjan-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-5">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold text-slate-900">Create New Expense Tracker</Dialog.Title>
              <Dialog.Close className="text-slate-400 hover:text-slate-700 rounded-md p-1"><X className="w-4 h-4"/></Dialog.Close>
            </div>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expense Tracker Name</label>
                <input 
                  type="text" required autoFocus
                  value={newBookName} onChange={e => setNewBookName(e.target.value)}
                  className="byjan-input"
                  placeholder="e.g. Acme Corp Q3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Currency</label>
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
                <p className="text-xs text-slate-500 mt-1">Default pulled from your Settings.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={creating || !newBookName.trim()} className="byjan-btn">
                  {creating && <span className="app-loader-ring app-loader-ring-sm" />}
                  Create Expense Tracker
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-zinc-600" />
            Pending Invitations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {invites.map(invite => (
              <div key={invite.id} className="byjan-card byjan-lift p-4 flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{invite.bookName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Invited as <span className="font-semibold text-slate-700 capitalize">{invite.role}</span></p>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button onClick={() => handleAcceptInvite(invite)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn flex-1 text-xs">
                    {acceptingId === invite.id ? <span className="app-loader-ring app-loader-ring-sm" /> : <Check className="w-3.5 h-3.5" />}
                    {acceptingId === invite.id ? 'Joining' : 'Accept'}
                  </button>
                  <button onClick={() => handleDeclineInvite(invite.id)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn-ghost flex-1 text-xs">
                    {decliningId === invite.id ? <span className="app-loader-ring app-loader-ring-sm" /> : <X className="w-3.5 h-3.5" />}
                    {decliningId === invite.id ? 'Declining' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={expensesOnly ? 'space-y-4' : 'grid lg:grid-cols-2 gap-5 items-start'}>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{expensesOnly ? 'Your ledgers' : 'Ledgers'}</h2>
            <span className="text-xs text-slate-500">{books.length}</span>
          </div>
          {loading ? (
            <AppLoader title="Ledgers" message="Loading the books you can open." />
          ) : books.length === 0 ? (
            <div className="text-center py-12 byjan-card border-dashed">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No ledgers yet</h3>
              <p className="text-sm text-slate-500 mt-1">Create a tracker or wait for an invitation.</p>
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
                placeholder="Search ledgers"
              />
            <div className={expensesOnly ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
              {bookList.pageRows.map(book => {
                const role = book.roles[currentUser!.uid]?.role || 'viewer';
                const stat = bookStats[book.id];
                const symbol = getCurrencySymbol(book.currency);
                return (
                  <Link to={`/book/${book.id}`} key={book.id} className="byjan-card byjan-lift byjan-ledger-card">
                    <div className="w-9 h-9 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug">{book.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{Object.keys(book.roles).length}</span>
                        <span className="tabular-nums">{book.currency}</span>
                        {stat ? (
                          <span className={`tabular-nums font-semibold ${stat.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {stat.net < 0 ? '−' : ''}{symbol}{Math.abs(stat.net).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="inline-flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1">
                        {book.pinned ? <Pin className="w-3.5 h-3.5 text-[#12B8A8]" /> : null}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${getRoleBadgeColor(role)}`}>
                          {role}
                        </span>
                      </span>
                      {stat && stat.monthOut > 0 && (
                        <span className="text-[10px] text-slate-500 tabular-nums">Month {symbol}{stat.monthOut.toLocaleString()}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
            </div>
          )}
        </section>

        {!expensesOnly && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-teal-700" /> Books</h2>
            <Link to="/books" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline min-h-10">
              Open <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {tenant?.name && <p className="text-xs text-slate-500 -mt-1">{tenant.name}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {BOOKS_TREE.map((branch) => (
              <Link key={branch.id} to={branch.href} className="byjan-card byjan-lift p-3.5">
                <p className="font-semibold text-sm text-slate-900">{branch.name}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{branch.blurb}</p>
                <p className="text-[11px] text-slate-400 mt-2">{branch.items.length} live tools</p>
              </Link>
            ))}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

