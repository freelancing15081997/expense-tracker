import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Plus, Check, X, Users, Building2, Receipt, ArrowRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

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
  const [books, setBooks] = useState<BookItem[]>([]);
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

      const qInvites = query(collection(db, 'invites'), where('email', '==', userProfile.email));
      const inviteSnaps = await getDocs(qInvites);
      const fetchedInvites: InviteItem[] = [];
      inviteSnaps.forEach((doc) => fetchedInvites.push({ id: doc.id, ...doc.data() } as InviteItem));
      setInvites(fetchedInvites);
    } catch (err) {
      console.error(err);
    } finally {
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
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvite = async (invite: InviteItem) => {
    if (!currentUser || !userProfile) return;
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
              `Subject: New Member Joined Ledger: ${invite.bookName}`,
              '',
              `<p>Hello,</p><p><b>${userProfile.displayName || userProfile.email}</b> has accepted the invitation and joined the ledger <b>${invite.bookName}</b>.</p>`
            ].join('\n');
            const encodedEmail = btoa(unescape(encodeURIComponent(emailContent))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ raw: encodedEmail })
            });
          }
        }
      }
      
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-slate-900 text-white border-transparent';
      case 'admin': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'contributor': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'auditor': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ledgers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your financial workspaces.</p>
        </div>
        <button 
          onClick={() => setShowNewBook(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Ledger
        </button>
      </div>

      <Dialog.Root open={showNewBook} onOpenChange={setShowNewBook}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-5 shadow-lg sm:rounded-lg">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold text-slate-900">Create New Ledger</Dialog.Title>
              <Dialog.Close className="text-slate-400 hover:text-slate-700 rounded-md p-1"><X className="w-4 h-4"/></Dialog.Close>
            </div>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ledger Name</label>
                <input 
                  type="text" required autoFocus
                  value={newBookName} onChange={e => setNewBookName(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Acme Corp Q3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Currency</label>
                <select 
                  value={newCurrency} onChange={e => setNewCurrency(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Default pulled from your Settings.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={creating || !newBookName.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
                  Create Ledger
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            Pending Invitations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {invites.map(invite => (
              <div key={invite.id} className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{invite.bookName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Invited as <span className="font-semibold text-slate-700 capitalize">{invite.role}</span></p>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button onClick={() => handleAcceptInvite(invite)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition">
                    <Check className="w-3.5 h-3.5" /> Accept
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

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200 border-dashed shadow-sm">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No Ledgers Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Create a new ledger to track expenses or wait for an invitation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => {
            const role = book.roles[currentUser!.uid]?.role || 'viewer';
            return (
              <Link to={`/book/${book.id}`} key={book.id} className="group flex flex-col bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-md flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                    <Receipt className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
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
                    {book.currency}
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
