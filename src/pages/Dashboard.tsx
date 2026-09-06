import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { getCurrencySymbol } from '../lib/currency';
import { Loader2, Plus, Check, X, Users, Building2, Receipt, ArrowRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';

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
      bookSnaps.forEach((doc) => fetchedBooks.push({ id: doc.id, ...doc.data() } as BookItem));
            setBooks(fetchedBooks);
      
      let tIn = 0; let tOut = 0;
      let activity: Record<string, number> = {};
      for (const b of fetchedBooks) {
        try {
          const expSnap = await getDocs(collection(db, 'books', b.id, 'expenses'));
          expSnap.forEach(e => {
            const data = e.data();
            if (data.type === 'in') tIn += (data.amount || 0);
            else tOut += (data.amount || 0);
            const user = data.createdBy || 'Unknown';
            activity[user] = (activity[user] || 0) + 1;
          });
        } catch(e){}
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
    if (userProfile && !newCurrency) {
      setNewCurrency(userProfile.defaultCurrency || 'INR');
    }
  }, [currentUser, userProfile]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile || !newBookName.trim()) return;
    setCreating(true);
    try {
      await addDoc(collection(db, 'books'), {
        name: newBookName,
        ownerId: currentUser.uid,
        currency: newCurrency,
        createdAt: serverTimestamp(),
        roles: { [currentUser.uid]: { role: 'owner', email: userProfile.email } }
      });
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
        const emails = Object.values(bookData.roles)
          .map((r: any) => r.email)
          .filter((email: string) => email !== userProfile.email);
          
        if (emails.length > 0) {
          const { getAccessToken } = await import('../lib/firebase');
          const token = getAccessToken();
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
              headers: { 'Content-Type': 'application/json' },
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
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from your ExpenseShare application.</p>
          </div>
        </div>
      `
              })
            });
            
            if (!res.ok) {
              addToast('Email sending failed on the server. Check Render server logs.', 'error');
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
    switch(role) {
      case 'owner': return 'bg-slate-900 text-white border-transparent';
      case 'admin': return 'bg-zinc-50 text-zinc-700 border-zinc-200';
      case 'contributor': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'auditor': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 bg-[#f8f9fa]/95 backdrop-blur border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Expense Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your expense trackers.</p>
        </div>
        <button 
          onClick={() => setShowNewBook(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-600 text-white rounded-md text-sm font-medium hover:bg-zinc-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Expense Tracker
        </button>
      </div>

      <Dialog.Root open={showNewBook} onOpenChange={setShowNewBook}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-5 shadow-lg sm:rounded-lg">
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none"
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
                  <button type="button" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={creating || !newBookName.trim()} className="px-4 py-2 bg-zinc-600 text-white text-sm font-medium rounded-md hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Expense Tracker
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-zinc-600" />
            Pending Invitations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {invites.map(invite => (
              <div key={invite.id} className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{invite.bookName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Invited as <span className="font-semibold text-slate-700 capitalize">{invite.role}</span></p>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button onClick={() => handleAcceptInvite(invite)} disabled={acceptingId === invite.id} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-zinc-600 text-white text-xs font-medium rounded-md hover:bg-zinc-700 transition disabled:opacity-50">
  {acceptingId === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
</button>
                  <button onClick={() => handleDeclineInvite(invite.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-200 transition border border-slate-200">
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

            {books.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Money In</h3>
            <span className="text-2xl font-bold text-emerald-600">+{globalStats.totalIn.toLocaleString()}</span>
          </div>
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Money Out</h3>
            <span className="text-2xl font-bold text-zinc-900">-{globalStats.totalOut.toLocaleString()}</span>
          </div>
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Contributor</h3>
            <span className="text-lg font-bold text-zinc-900 truncate">
              {Object.entries(globalStats.userActivity).sort((a,b)=> (b[1] as number) - (a[1] as number))[0]?.[0] || 'No entries yet'}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-zinc-600 rounded-full animate-spin" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200 border-dashed shadow-sm">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No Expense Trackers Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Create a new tracker to track expenses or wait for an invitation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => {
            const role = book.roles[currentUser!.uid]?.role || 'viewer';
            return (
              <Link to={`/book/${book.id}`} key={book.id} className="group flex flex-col bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-md flex items-center justify-center border border-slate-100 group-hover:bg-zinc-50 transition-colors">
                    <Receipt className="w-5 h-5 text-slate-600 group-hover:text-zinc-600" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${getRoleBadgeColor(role)}`}>
                    {role}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1 truncate">{book.name}</h3>
                <div className="mt-auto pt-4 flex items-center justify-between text-xs border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    {Object.keys(book.roles).length} members
                  </div>
                  <div className="flex items-center gap-1 text-slate-700 font-bold bg-slate-50 px-2 py-1 rounded">
                    {getCurrencySymbol(book.currency)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
