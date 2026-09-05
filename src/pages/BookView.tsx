import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { Loader2, ArrowLeft, Plus, Trash2, Users, UserPlus, X, PenSquare, FileText, FileBarChart, LogOut, UserMinus } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function BookView() {
  const { bookId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const [book, setBook] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCatInput, setCustomCatInput] = useState('');
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('contributor');
  const [inviting, setInviting] = useState(false);
  const { addToast } = useToast();
  const [unsentEmailChange, setUnsentEmailChange] = useState<{action: string, detail: string} | null>(null);  const navigate = useNavigate();

  const handleRemoveMember = async (uidToRemove: string, isSelf: boolean) => {
    if (!currentUser || !book) return;
    
    // Prevent removing the last owner
    if (book.roles[uidToRemove]?.role === 'owner') {
      const ownerCount = Object.values(book.roles).filter((r: any) => r.role === 'owner').length;
      if (ownerCount <= 1) {
        addToast('You cannot remove the last owner of the ledger.', 'error');
        return;
      }
    }

    if (confirm(isSelf ? 'Are you sure you want to leave this ledger?' : 'Are you sure you want to remove this member?')) {
      try {
        const bookRef = doc(db, 'books', book.id);
        await updateDoc(bookRef, {
          [`roles.${uidToRemove}`]: deleteField()
        });
        
        addToast(isSelf ? 'You have left the ledger.' : 'Member removed.', 'success');
        
        if (isSelf) {
          navigate('/');
        } else {
          // If we removed someone else, notify remaining team members
          await notifyTeamMembers('Member Removed', `${book.roles[uidToRemove]?.email} was removed from the ledger.`);
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to remove member.', 'error');
      }
    }
  };

  useEffect(() => {
    if (!bookId || !currentUser) return;
    const fetchBook = async () => {
      const docSnap = await getDoc(doc(db, 'books', bookId));
      if (docSnap.exists()) setBook({ id: docSnap.id, ...docSnap.data() });
    };
    fetchBook();

    const q = query(collection(db, `books/${bookId}/expenses`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps: any[] = [];
      snapshot.forEach(doc => exps.push({ id: doc.id, ...doc.data() }));
      exps.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setExpenses(exps);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [bookId, currentUser]);

  if (loading) return <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" /></div>;
  if (!book) return <div className="p-8 text-center text-sm text-slate-500">Book not found or access denied.</div>;

  const myRole = book.roles[currentUser!.uid]?.role || 'viewer';
  const canWrite = ['owner', 'admin', 'contributor'].includes(myRole);
  const canManageUsers = ['owner', 'admin'].includes(myRole);
  const isAuditor = myRole === 'auditor';

  const defaultCategories = userProfile?.customCategories?.length ? userProfile.customCategories : ['Office Supplies', 'Software Subscriptions', 'Travel', 'Meals'];

  const openNewExpense = () => {
    setEditingExpense(null);
    setAmount('');
    setDescription('');
    setCategory(defaultCategories[0] || '');
    setCustomCatInput('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setAmount(exp.amount.toString());
    setDescription(exp.description);
    if (defaultCategories.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCatInput('');
    } else {
      setCategory('__custom__');
      setCustomCatInput(exp.category);
    }
    setIsExpenseModalOpen(true);
  };

  const notifyTeamMembers = async (action: string, detail: string) => {
    // 1. In-app notifications
    const uidsToNotify = Object.keys(book.roles).filter(uid => uid !== currentUser?.uid);
    for (const uid of uidsToNotify) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: uid,
          bookId,
          bookName: book.name,
          action,
          detail,
          senderName: userProfile?.displayName || currentUser?.email,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
    }

    // 2. Email notifications (Now sent reliably via our Node backend)
    const emails = Object.values(book.roles)
      .map((r: any) => r.email)
      ; // Removed self-filter for testing so the user gets their own emails
    
    if (emails.length > 0) {
      const subject = `Ledger Update: ${book.name}`;
      const message = `<p>Hello,</p><p>A ledger you are a member of has been updated by <b>${userProfile?.displayName || currentUser?.email}</b>.</p><p><b>Action:</b> ${action}</p><p><b>Details:</b> ${detail}</p>`;
      
      for (const email of emails) {
        // This hits our reliable Express backend which doesn't lose credentials
        sendEmailNotification(email, subject, message).catch(console.error);
      }
    }
  };

  
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setIsSaving(true);
    const finalCategory = category === '__custom__' ? customCatInput.trim() : category;
    if (!finalCategory) return addToast("Please specify a category", 'error');

    try {
      if (editingExpense) {
        await updateDoc(doc(db, `books/${bookId}/expenses`, editingExpense.id), {
          amount: Number(amount),
          description,
          category: finalCategory,
        });
        await notifyTeamMembers('Edited an Entry', `Updated expense for ${description} to ${book.currency} ${amount}`);
        addToast('Entry updated successfully!', 'success');
      } else {
        await addDoc(collection(db, `books/${bookId}/expenses`), {
          amount: Number(amount),
          description,
          category: finalCategory,
          date: new Date().toISOString().split('T')[0],
          createdBy: userProfile?.displayName || currentUser?.email,
          createdAt: serverTimestamp()
        });
        await notifyTeamMembers('Added a New Entry', `Recorded ${book.currency} ${amount} for ${description}`);
        addToast('Entry recorded successfully!', 'success');
      }
      setIsExpenseModalOpen(false);
    } catch (err) {
      console.error(err);
      addToast('Error saving expense', 'error');
    } finally { setIsSaving(false); }
  };

  const handleDeleteExpense = async (id: string, description: string) => {
    if (!canWrite) return;
    if (confirm('Delete this entry permanently?')) {
      setIsDeleting(id);
      try {
        await deleteDoc(doc(db, `books/${bookId}/expenses`, id));
        await notifyTeamMembers('Deleted an Entry', `Removed expense for ${description}`);
        addToast('Entry deleted successfully!', 'success');
      } catch (err: any) {
        console.error("Delete failed:", err);
        addToast("Delete failed: " + err.message, 'error');
      } finally { setIsDeleting(null); }
    }
  };

  const sendEmailNotification = async (toEmail: string, subject: string, message: string) => {
    try {
      // In production (Render), the frontend might be running under a different URL base if not configured properly, 
      // but absolute path /api/email/send works if the React app and Node app are on the exact same domain.
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to: toEmail, subject, message })
      });
      if (!res.ok) {
         console.error('Email API Error:', res.statusText);
         addToast('Email sending failed on the server. Check Render server logs.', 'error');
      }
      return res.ok;
    } catch (err: any) {
      console.error('Failed to send email via backend:', err);
      addToast('Network error sending email: ' + err.message, 'error');
      return false;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !inviteEmail) return;
    setInviting(true);
    try {
      const inviteId = `${book.id}_${inviteEmail.toLowerCase()}`;
      await setDoc(doc(db, 'invites', inviteId), {
        email: inviteEmail.toLowerCase(),
        bookId: book.id,
        bookName: book.name,
        role: inviteRole,
        invitedBy: currentUser!.uid,
        status: 'pending'
      });
      setInviteEmail('');
      addToast('Invitation added to their dashboard successfully!', 'success');
      
      const sent = await sendEmailNotification(
        inviteEmail.toLowerCase(),
        `Invitation to ledger: ${book.name}`,
        `<p>Hello,</p><p>You have been invited to join the ledger <b>${book.name}</b> on ExpenseShare.</p><p>Please log in to your dashboard to accept the invitation.</p>`
      );
      if (sent) {
        addToast('Invitation added and email notification sent!', 'success');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to send invite. Check permissions.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const totalSpend = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  const chartData = expenses.reduce((acc: any[], exp) => {
    const existing = acc.find(a => a.name === exp.category);
    if (existing) existing.total += exp.amount;
    else acc.push({ name: exp.category, total: exp.amount });
    return acc;
  }, []).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link to="/" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-orange-500 transition-colors mb-2 uppercase tracking-wide">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{book.name}</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 uppercase tracking-wider">
              {myRole}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Users className="w-4 h-4" />
            Team
          </button>
          {canWrite && (
            <button 
              onClick={openNewExpense}
              className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          )}
        </div>
      </div>

      <Tabs.Root defaultValue="ledger" className="space-y-5">
        <Tabs.List className="flex gap-4 border-b border-slate-200">
          <Tabs.Trigger value="ledger" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-orange-500 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 transition-colors">
            Ledger Entries
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-orange-500 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 transition-colors">
            Analytics & Reports
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="ledger" className="space-y-4 outline-none">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Total Balance</p>
              <h2 className="text-2xl font-bold text-slate-900">{book.currency} {totalSpend.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Entries Count</p>
              <h2 className="text-2xl font-bold text-slate-900">{expenses.length}</h2>
            </div>
            {isAuditor && (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wider">Auditor Access</p>
                <p className="text-xs text-amber-900/80 font-medium z-10">Read-only access for compliance reporting.</p>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Author</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                    {canWrite && <th className="px-4 py-2.5 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No expenses recorded yet.</td></tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-2 text-xs font-medium text-slate-500">
                          {exp.createdAt ? format(exp.createdAt.toDate(), 'MMM dd, yyyy') : exp.date}
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-slate-900">{exp.description}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">{exp.createdBy}</td>
                        <td className="px-4 py-2 text-sm font-bold text-slate-900 text-right">
                          {book.currency} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {canWrite && (
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditExpense(exp)} className="p-1 text-slate-400 hover:text-orange-500 rounded transition-colors" title="Edit">
                                <PenSquare className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteExpense(exp.id, exp.description)} disabled={isDeleting === exp.id} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors disabled:opacity-50" title="Delete">
  {isDeleting === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Tabs.Content>
        
        <Tabs.Content value="analytics" className="outline-none space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-slate-400" /> Top Categories
              </h3>
              {chartData.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} width={90} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px'}} 
                        formatter={(value: number) => [`${book.currency} ${value.toLocaleString()}`, 'Amount']}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-slate-400">Not enough data to display.</div>
              )}
            </div>
            
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
              <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Export & Reports
              </h3>
              <p className="text-xs text-slate-500 mb-6 flex-1">Generate comprehensive CSV exports of the ledger for tax filing, audits, or external accounting software integration.</p>
              <button 
                onClick={() => addToast("CSV Export coming soon.", "info")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Download CSV Ledger
              </button>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Expense Edit/Add Modal */}
      <Dialog.Root open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-5 shadow-xl rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <Dialog.Title className="text-base font-bold text-slate-900">
                {editingExpense ? 'Edit Entry' : 'Record Expense'}
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({book.currency})</label>
                <input 
                  type="number" step="0.01" required autoFocus
                  value={amount} onChange={e=>setAmount(e.target.value)} 
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input 
                  type="text" required 
                  value={description} onChange={e=>setDescription(e.target.value)} 
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" 
                  placeholder="e.g. Server Hosting"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select 
                  required 
                  value={category} onChange={e=>setCategory(e.target.value)} 
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-orange-500 outline-none mb-2"
                >
                  {defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__custom__">-- Add Custom Category --</option>
                </select>
                {category === '__custom__' && (
                  <input 
                    type="text" required
                    value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                    placeholder="Enter custom category name"
                  />
                )}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingExpense ? 'Save Changes' : 'Record Entry'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Members Modal */}
      <Dialog.Root open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg max-h-[85vh] translate-x-[-50%] translate-y-[-50%] bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <Dialog.Title className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> Team Members
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {Object.entries(book.roles).map(([uid, data]: [string, any]) => (
                  <div key={uid} className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
                        {data.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{data.email}</p>
                        {uid === currentUser?.uid && <p className="text-[10px] text-slate-500 font-medium">You</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                        data.role === 'owner' ? "bg-slate-900 text-white border-transparent" :
                        data.role === 'admin' ? "bg-orange-50 text-orange-600 border-orange-200" :
                        data.role === 'contributor' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        data.role === 'auditor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      )}>
                        {data.role}
                      </span>
                      
                      {(canManageUsers || uid === currentUser?.uid) && (
                        <button
                          onClick={() => handleRemoveMember(uid, uid === currentUser?.uid)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={uid === currentUser?.uid ? "Leave Ledger" : "Remove Member"}
                        >
                          {uid === currentUser?.uid ? (
                            <LogOut className="w-4 h-4" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {canManageUsers && (
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-slate-500"/> Invite Colleague
                </h3>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="email" required placeholder="email@company.com" 
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                  <select 
                    value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="w-full sm:w-32 border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="contributor">Contributor</option>
                    <option value="auditor">Auditor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="submit" disabled={inviting} className="px-4 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
  {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
  Invite
</button>
                </form>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast Notification */}

    </div>
  );
}
