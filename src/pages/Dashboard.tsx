import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, limit, getDocsMany } from '../lib/store';
import { Link, useLocation } from 'react-router-dom';
import { isSoftDeleted } from '../lib/records';
import { useBooksTenantMeta } from '../lib/tenant';
import { getCurrencySymbol } from '../lib/currency';
import { Plus, Check, X, Users, Building2, Receipt, ArrowRight, BookOpen } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import AppLoader from '../components/AppLoader';
import { ListControls, usePagedList } from '../components/ListControls';
import { BOOKS_TREE } from '../books/catalog/modules';
import { openLedgerButtonHtml, syncInboundMailbox } from '../lib/inbound-mail';

interface BookItem {
  id: string;
  name: string;
  ownerId: string;
  currency: string;
  roles: Record<string, { role: string; email: string }>;
}

interface InviteItem {
  id: string;
  bookId: string;
  bookName: string;
  role: string;
  invitedBy: string;
}

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const tenant = useBooksTenantMeta();
  const expensesOnly = location.pathname.startsWith('/expenses');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalIn: 0, totalOut: 0, userActivity: {} as Record<string, number> });
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    if (!currentUser || !userProfile) return;
    try {
      setLoading(true);
      const qBooks = query(collection(db, 'books'), where(`roles.${currentUser.uid}.role`, 'in', ['owner', 'admin', 'contributor', 'viewer', 'auditor']));
      const bookSnaps = await getDocs(qBooks);
      const fetchedBooks: BookItem[] = [];
      bookSnaps.forEach((doc) => {
        const data = doc.data() as BookItem & { deleted?: boolean; deletedAt?: unknown };
        if (isSoftDeleted(data)) return;
        fetchedBooks.push({ id: doc.id, ...data } as BookItem);
      });
      setBooks(fetchedBooks);
      setLoading(false);

      let tIn = 0; let tOut = 0;
      let activity: Record<string, number> = {};
      if (fetchedBooks.length) {
        const expenseSnaps = await getDocsMany(
          fetchedBooks.slice(0, 12).map((b) => query(collection(db, 'books', b.id, 'expenses'), limit(40))),
        );
        expenseSnaps.forEach((expSnap) => {
          expSnap.forEach((e) => {
            const data = e.data();
            if (isSoftDeleted(data)) return;
            if (data.entryType === 'in' || data.type === 'in') tIn += (data.amount || 0);
            else tOut += (data.amount || 0);
            const user = data.enteredBy || data.paidByName || data.createdBy || 'Unknown';
            activity[user] = (activity[user] || 0) + 1;
          });
        });
      }
      setGlobalStats({ totalIn: tIn, totalOut: tOut, userActivity: activity });

      const qInvites = query(collection(db, 'invites'), where('email', '==', userProfile.email));
      const inviteSnaps = await getDocs(qInvites);
      const fetchedInvites: InviteItem[] = [];
      inviteSnaps.forEach((doc) => fetchedInvites.push({ id: doc.id, ...doc.data() } as InviteItem));
      setInvites(fetchedInvites);
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
      const created = await addDoc(collection(db, 'books'), {
        name: newBookName,
        ownerId: currentUser.uid,
        currency: newCurrency,
        createdAt: serverTimestamp(),
        roles: { [currentUser.uid]: { role: 'owner', email: userProfile.email } }
      });
      void syncInboundMailbox({
        id: created.id,
        name: newBookName,
        currency: newCurrency,
        ownerId: currentUser.uid,
        roles: { [currentUser.uid]: { role: 'owner', email: userProfile.email } },
      }).catch(() => undefined);
      setNewBookName('');
      setShowNewBook(false);
      fetchData();
    } catch (err) { console.error("Fetch API error:", err); } finally {
      setCreating(false);
    }
  };

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const handleAcceptInvite = async (invite: InviteItem) => {
    if (!currentUser || !userProfile) return;
    setAcceptingId(invite.id);
    try {
      await updateDoc(doc(db, 'books', invite.bookId), {
        [`roles.${currentUser.uid}`]: { role: invite.role, email: userProfile.email }
      });
      await deleteDoc(doc(db, 'invites', invite.id));
      
      // Notify team members about the new user joining
      const bookSnap = await getDoc(doc(db, 'books', invite.bookId));
      if (bookSnap.exists()) {
        const bookData = bookSnap.data();
        void syncInboundMailbox({
          id: invite.bookId,
          name: String(bookData.name || invite.bookName),
          currency: String(bookData.currency || 'INR'),
          ownerId: String(bookData.ownerId || ''),
          roles: (bookData.roles || {}) as Record<string, { role?: string; email?: string }>,
        }).catch(() => undefined);
        const emails = Object.values(bookData.roles)
          .map((r: any) => r.email)
          .filter((email: string) => email !== userProfile.email);
          
        if (emails.length > 0) {
          const { getAccessToken } = await import('../lib/firebase');
          const token = await getAccessToken();
          if (token) {
            const emailContent = [
              `To: ${emails.join(', ')}`,
              'Content-Type: text/html; charset=utf-8',
              `Subject: New Member Joined Expense Tracker: ${invite.bookName}`,
              '',
              `<p>Hello,</p><p><b>${userProfile.displayName || userProfile.email}</b> has accepted the invitation and joined the ledger <b>${invite.bookName}</b>.</p>`
            ].join('\n');
            const encodedEmail = btoa(unescape(encodeURIComponent(emailContent))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const res = await fetch('/api/email/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                to: emails.join(", "),
                subject: `${userProfile.displayName || userProfile.email} joined ${invite.bookName} expense book`,
                message: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background-color: #0B1F3A; color: white; display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">Byjan</div>
            <h2 style="color: #111827; margin-top: 16px; margin-bottom: 4px; font-size: 20px;">New Member Joined</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Ledger: <strong>${invite.bookName}</strong></p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #f3f4f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 0;">Hello,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">Great news! <strong style="color: #10b981;">${userProfile.displayName || userProfile.email}</strong> has accepted your invitation and successfully joined your ledger.</p>
            ${openLedgerButtonHtml(invite.bookId)}
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from Byjan.</p>
          </div>
        </div>
      `
              })
            });
            
            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              addToast(payload.error || 'Email sending failed on the server.', 'error');
            }
          }
        }
      }
      
      fetchData();
    } catch (err: any) { 
      console.error("Dashboard error:", err);
      addToast("Error: " + err.message, 'error');
    } finally { setAcceptingId(null); }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      fetchData();
    } catch (err) { console.error("Fetch API error:", err); }
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{expensesOnly ? 'Shared ledgers' : 'Workspace'}</p>
          <h1 className="text-2xl font-bold text-slate-900 font-display mt-1">{expensesOnly ? 'Expense Tracker' : 'Main dashboard'}</h1>
          <p className="text-sm text-slate-500 mt-1">{expensesOnly ? 'Roommate and team ledgers you belong to.' : 'Ledgers, Books, and the work waiting on you.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!expensesOnly && (
            <Link to="/books" className="byjan-btn-ghost">
              <BookOpen className="w-4 h-4" />
              Open Books
            </Link>
          )}
          <button
            onClick={() => setShowNewBook(true)}
            className="byjan-btn"
          >
            <Plus className="w-4 h-4" />
            New Expense Tracker
          </button>
        </div>
      </div>

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
                  <button onClick={() => handleAcceptInvite(invite)} disabled={acceptingId === invite.id} className="byjan-btn flex-1 text-xs">
                    {acceptingId === invite.id ? <span className="app-loader-ring app-loader-ring-sm" /> : <Check className="w-3.5 h-3.5" />} Accept
                  </button>
                  <button onClick={() => handleDeclineInvite(invite.id)} className="byjan-btn-ghost flex-1 text-xs">
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!expensesOnly && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="byjan-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expense Tracker tenancy</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">Per-ledger membership</p>
            <p className="text-xs text-slate-500 mt-1">Each ledger lives under <code className="text-[11px]">books/{'{ledgerId}'}</code>. You only see ledgers where <code className="text-[11px]">roles.{'{your uid}'}</code> is set. Other users cannot see yours.</p>
          </div>
          <div className="byjan-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Books tenant</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{tenant?.name || 'Your Books workspace'}</p>
            <p className="text-xs text-slate-500 mt-1">Your account owns <code className="text-[11px]">erp_workspaces/{'{your uid}'}</code>. Nested companies get their own isolated books under that account. Create and switch them from Books → Companies or the Workspace menu.</p>
          </div>
        </div>
      )}

      <div className={expensesOnly ? 'space-y-4' : 'grid lg:grid-cols-2 gap-6 items-start'}>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">{expensesOnly ? 'Your ledgers' : 'Expense Tracker'}</h2>
            <span className="text-xs text-slate-500">{books.length} ledger{books.length === 1 ? '' : 's'}</span>
          </div>
          {books.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="byjan-card p-5">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Money in</h3>
                <span className="text-2xl font-display font-semibold text-emerald-600">+{getCurrencySymbol(books[0]?.currency || userProfile?.defaultCurrency || 'INR')}{globalStats.totalIn.toLocaleString()}</span>
              </div>
              <div className="byjan-card p-5">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Money out</h3>
                <span className="text-2xl font-display font-semibold text-[#0B1F3A]">-{getCurrencySymbol(books[0]?.currency || userProfile?.defaultCurrency || 'INR')}{globalStats.totalOut.toLocaleString()}</span>
              </div>
              <div className="byjan-card p-5">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Most active</h3>
                <span className="text-sm font-bold text-[#0B1F3A] truncate block mt-1">
                  {Object.entries(globalStats.userActivity).sort((a,b)=> (b[1] as number) - (a[1] as number))[0]?.[0] || '—'}
                </span>
              </div>
            </div>
          )}
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
                return (
                  <Link to={`/book/${book.id}`} key={book.id} className="group flex flex-col byjan-card byjan-lift p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 bg-slate-50 rounded-md flex items-center justify-center border border-slate-100">
                        <Receipt className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRoleBadgeColor(role)}`}>
                        {role}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{book.name}</h3>
                    <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1 text-slate-500"><Users className="w-3.5 h-3.5" />{Object.keys(book.roles).length}</span>
                      <span className="font-bold text-slate-700">{getCurrencySymbol(book.currency)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            </div>
          )}
        </section>

        {!expensesOnly && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Books</h2>
            <Link to="/books" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
              Open dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {BOOKS_TREE.map((branch) => (
              <Link key={branch.id} to={branch.href} className="byjan-card byjan-lift p-3">
                <p className="font-semibold text-sm text-slate-900">{branch.name}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{branch.blurb}</p>
                <p className="text-[11px] text-slate-400 mt-2">{branch.items.length} features</p>
              </Link>
            ))}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

