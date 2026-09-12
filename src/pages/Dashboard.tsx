import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useLocation } from 'react-router-dom';
import { createLedger, listLedgers } from '../lib/ledgers';
import { listAllExpenses } from '../lib/expenses';
import { useBooksTenantMeta } from '../lib/tenant';
import { getCurrencySymbol } from '../lib/currency';
import { initials, readRecentLedgers, sparkDays } from '../lib/ledger-advanced';
import { formatIndianAmount, workspaceBridges } from '../lib/bridge-automations';
import { Plus, Check, X, Users, Building2, ChevronRight, BookOpen } from 'lucide-react';
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
  archived?: boolean;
  accentHue?: number;
  roles: Record<string, { role: string; email: string }>;
}

type BookStat = { net: number; monthOut: number; lastMonthOut: number; entries: number; spark: number[] };

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
  const [showArchived, setShowArchived] = useState(false);
  const [bridges, setBridges] = useState<ReturnType<typeof workspaceBridges> | null>(null);
  const recentIds = readRecentLedgers();

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
        archived: Boolean(book.archived),
        accentHue: Number(book.accentHue || 0) || undefined,
        roles: (book.roles || {}) as BookItem['roles'],
      })).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
      setBooks(fetchedBooks);
      setLoading(false);

      let tIn = 0; let tOut = 0; let monthIn = 0; let monthOut = 0; let reimbursable = 0; let uncategorized = 0;
      const monthKey = new Date().toISOString().slice(0, 7);
      let activity: Record<string, number> = {};
      const nextBookStats: Record<string, BookStat> = {};
      const lastKey = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
      const byBook: Record<string, Array<Record<string, unknown>>> = {};
      if (fetchedBooks.length) {
        const { expenses } = await listAllExpenses();
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
        setBookStats(nextBookStats);
        setBridges(workspaceBridges(expenses));
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
        setBridges(null);
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

  const renderLedgerCard = (book: BookItem) => {
    const role = book.roles[currentUser!.uid]?.role || 'viewer';
    const stat = bookStats[book.id];
    const symbol = getCurrencySymbol(book.currency);
    const maxSpark = Math.max(...(stat?.spark || [1]), 1);
    return (
      <Link to={`/book/${book.id}`} key={book.id} className="byjan-ledger-tile byjan-lift" title={`${book.name} · ${role} · net ${stat ? `${stat.net < 0 ? '−' : ''}${symbol}${Math.abs(stat.net).toLocaleString()}` : 'loading'}`}>
        <span className="byjan-ledger-mono">{initials(book.name)}</span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#0B1F3A] leading-tight tracking-tight">{book.name}</h3>
          <p className="text-[12px] text-slate-500 mt-0.5 truncate">
            {book.archived ? 'Archived · ' : ''}{book.pinned ? 'Pinned · ' : ''}{role} · {book.currency}
            {stat ? ` · ${stat.entries}` : ''}
          </p>
        </div>
        <span className="text-right shrink-0">
          <span className="byjan-money block text-[15px] font-semibold tabular-nums leading-none text-[#0B1F3A]">
            {stat ? `${stat.net < 0 ? '−' : ''}${symbol}${Math.abs(stat.net).toLocaleString()}` : '—'}
          </span>
          {stat && (
            <svg className="byjan-spark mt-1.5 ml-auto" viewBox="0 0 64 18" aria-hidden>
              <polyline
                fill="rgba(11,31,58,0.06)"
                stroke="#0B1F3A"
                strokeWidth="1.5"
                points={`0,18 ${stat.spark.map((v, i) => `${(i / Math.max(stat.spark.length - 1, 1)) * 64},${17 - (v / maxSpark) * 14}`).join(' ')} 64,18`}
              />
            </svg>
          )}
        </span>
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="ios-caption">{hello}</p>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-[#0B1F3A] truncate">{firstName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!expensesOnly && (
            <Link to="/books" className="byjan-btn-ghost !h-9 !rounded-full">
              <BookOpen className="w-4 h-4" />
              Books
            </Link>
          )}
          <button onClick={() => setShowNewBook(true)} className="byjan-btn !h-9 !rounded-full">
            <Plus className="w-4 h-4" />
            New ledger
          </button>
        </div>
      </div>

      {books.length > 0 && (
        <>
          <div className="byjan-stat-grid">
            {[
              { label: 'Net', value: formatIndianAmount(net, currency), tip: 'Money in minus money out across every ledger you can open.' },
              { label: 'In', value: formatIndianAmount(globalStats.totalIn, currency), tip: 'All recorded money in, all time.' },
              { label: 'Out / mo', value: formatIndianAmount(globalStats.monthOut, currency), tip: 'Money out recorded this calendar month.' },
              { label: 'In / mo', value: formatIndianAmount(globalStats.monthIn, currency), tip: 'Money in recorded this calendar month.' },
              { label: 'Entries', value: String(globalStats.entries), tip: 'Live entries, not including deleted rows.' },
              { label: 'Open', value: String(globalStats.uncategorized), tip: `${globalStats.uncategorized} uncategorized. ${formatIndianAmount(globalStats.reimbursable, currency)} still reimbursable.` },
            ].map((item) => (
              <div key={item.label} className="byjan-stat" title={item.tip}>
                <span className="byjan-stat-label">{item.label}</span>
                <span className="byjan-stat-value byjan-money">{item.value}</span>
              </div>
            ))}
          </div>
          {bridges && (bridges.tds || bridges.gstGaps || bridges.dues.length || bridges.fest || bridges.mix.cashShare >= 40 || globalStats.uncategorized > 0) && (
            <div className="ios-group">
              {globalStats.uncategorized > 0 && (
                <div className="ios-row" title="Entries with no category — email capture and UPI paste still land here if the merchant is new.">
                  <span className="text-[14px] text-[#0B1F3A]">{globalStats.uncategorized} uncategorized</span>
                </div>
              )}
              {bridges.tds > 0 && (
                <div className="ios-row" title="Outgoing payments that look like 194C / 194I / 194J. Open the ledger Studio → India to mark them.">
                  <span className="text-[14px] text-[#0B1F3A]">{bridges.tds} TDS watch</span>
                </div>
              )}
              {bridges.gstGaps > 0 && (
                <div className="ios-row" title="GST was applied but there is no receipt — ITC claims usually fail without it.">
                  <span className="text-[14px] text-[#0B1F3A]">{bridges.gstGaps} GST rows need a receipt</span>
                </div>
              )}
              {bridges.mix.cashShare >= 40 && (
                <div className="ios-row" title="Cash is still a large share this month. Useful for households that mix UPI and cash.">
                  <span className="text-[14px] text-[#0B1F3A]">{bridges.mix.cashShare}% cash this month</span>
                </div>
              )}
              {bridges.dues.length > 0 && (
                <div className="ios-row" title="Typical household bills not seen this month yet: rent, maid, society, power, school.">
                  <span className="text-[14px] text-[#0B1F3A]">Missing {bridges.dues.slice(0, 4).join(', ')}</span>
                </div>
              )}
              {bridges.fest && (
                <div className="ios-row" title="Festival or payday window — spend usually jumps here and generic apps never name it.">
                  <span className="text-[14px] text-[#0B1F3A]">{bridges.fest.name}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

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

      <div className={expensesOnly ? 'space-y-4' : 'grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-start'}>
        <section>
          <div className="flex items-center justify-between gap-2 ios-section-label">
            <span>{expensesOnly ? 'Ledgers' : 'Ledgers'}</span>
            <span className="flex items-center gap-2">
              {books.some((book) => book.archived) && (
                <button type="button" className="byjan-chip" data-on={showArchived} onClick={() => setShowArchived((v) => !v)}>Archived</button>
              )}
              {recentBooks[0] && <span className="font-normal">Last opened {recentBooks[0].name}</span>}
            </span>
          </div>
          {loading ? (
            <AppLoader title="Ledgers" message="Loading the books you can open." />
          ) : books.length === 0 ? (
            <div className="ios-widget text-center py-10">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-[15px] font-semibold text-[#0B1F3A]">No ledgers yet</h3>
              <p className="ios-caption mt-1">Create one or wait for an invitation.</p>
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
                {bookList.pageRows.map(renderLedgerCard)}
              </div>
            </div>
          )}
        </section>

        {!expensesOnly && (
        <section>
          <div className="flex items-center justify-between ios-section-label">
            <span>Books{tenant?.name ? ` · ${tenant.name}` : ''}</span>
            <Link to="/books" className="text-[#0B1F3A] font-semibold">Open</Link>
          </div>
          <div className="ios-group">
            {BOOKS_TREE.map((branch) => (
              <Link key={branch.id} to={branch.href} className="ios-row" title={branch.blurb}>
                <span className="ios-glyph">{branch.name.slice(0, 2)}</span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-medium text-[#0B1F3A] tracking-tight truncate">{branch.name}</span>
                  <span className="block text-[12px] text-[#8e8e93] truncate">{branch.blurb}</span>
                </span>
                <ChevronRight className="ios-chevron w-5 h-5" />
              </Link>
            ))}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

