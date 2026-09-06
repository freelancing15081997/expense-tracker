import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, setDoc, deleteField, getDocs } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, ArrowLeft, Plus, Trash2, Users, UserPlus, X, PenSquare, FileText, FileBarChart, LogOut, UserMinus, Search, Download, Settings2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currency';
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
  const [entryType, setEntryType] = useState<'in' | 'out' | 'transfer'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCatInput, setCustomCatInput] = useState('');
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('contributor');
  const [inviting, setInviting] = useState(false);

  // List enhancements
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    category: true,
    author: true,
    amount: true
  });
  const [sendingReport, setSendingReport] = useState(false);
  const [isDeletingBook, setIsDeletingBook] = useState(false);
  const [showDeleteBookConfirm, setShowDeleteBookConfirm] = useState(false);

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
          await notifyTeamMembers('Member Removed', `${book.roles[uidToRemove]?.email} was removed from the ledger.`, `${book.roles[uidToRemove]?.email} was removed from ${book.name}`);
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to remove member.', 'error');
      }
    }
  };

  const handleDeleteBook = async () => {
    if (!currentUser || !book) return;
    
    // Check if user has permission to delete (only owner or admin)
    const myRole = book.roles[currentUser.uid]?.role;
    if (myRole !== 'owner' && myRole !== 'admin') {
      addToast('Only owners and admins can delete this ledger.', 'error');
      return;
    }
    
    setIsDeletingBook(true);
    try {
      // 1. Notify all members before deletion
      const memberEmails = Object.values(book.roles).map((r: any) => r.email);
      const subject = `🗑️ Ledger Deleted: ${book.name}`;
      const message = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background-color: #dc2626; color: white; display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">Byjan</div>
            <h2 style="color: #991b1b; margin-top: 16px; margin-bottom: 4px; font-size: 20px;">⚠️ Ledger Deleted</h2>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #fee2e2; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 0;">Hello,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">The ledger "<strong style="color: #dc2626;">${book.name}</strong>" has been permanently deleted by <strong style="color: #111827;">${userProfile?.displayName || currentUser?.email}</strong>.</p>
            
            <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border-radius: 6px; border-left: 4px solid #dc2626;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b; font-weight: 600;">Ledger Details</p>
              <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Name:</strong> ${book.name}</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;"><strong>Currency:</strong> ${book.currency}</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;"><strong>Deleted by:</strong> ${userProfile?.displayName || currentUser?.email}</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #374151;"><strong>Deletion time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 14px; background-color: #fffbeb; border-radius: 6px; border: 1px solid #fef3c7;">
              <p style="margin: 0; font-size: 13px; color: #92400e;">
                ℹ️ <strong>Important:</strong> All expense entries, analytics, and data associated with this ledger have been permanently removed and cannot be recovered.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #fecaca;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">This is an automated notification from Byjan Expense Tracker</p>
          </div>
        </div>
      `;

      // Send email notification to all members
      try {
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: memberEmails, subject, html: message })
        });
        
        if (!response.ok) {
          console.error('Failed to send deletion notification emails');
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }

      // 2. Send in-app notifications to all members
      const uidsToNotify = Object.keys(book.roles);
      for (const uid of uidsToNotify) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: uid,
            bookId: book.id,
            bookName: book.name,
            action: 'Deleted Ledger',
            detail: `The ledger "${book.name}" has been permanently deleted by ${userProfile?.displayName || currentUser?.email}.`,
            senderName: userProfile?.displayName || currentUser?.email,
            createdAt: serverTimestamp(),
            read: false
          });
        } catch (err) {
          console.error("Failed to add notification:", err);
        }
      }

      // 3. Delete all expenses in the book
      const expensesQuery = query(collection(db, `books/${book.id}/expenses`));
      const expensesSnapshot = await getDocs(expensesQuery);
      const deletionPromises = expensesSnapshot.docs.map(expenseDoc => 
        deleteDoc(doc(db, `books/${book.id}/expenses`, expenseDoc.id))
      );
      await Promise.all(deletionPromises);

      // 4. Delete the book itself
      await deleteDoc(doc(db, 'books', book.id));

      addToast('Ledger deleted successfully. All members have been notified.', 'success');
      navigate('/');
    } catch (err) {
      console.error('Failed to delete book:', err);
      addToast('Failed to delete ledger. Please try again.', 'error');
    } finally {
      setIsDeletingBook(false);
      setShowDeleteBookConfirm(false);
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
    }, (err) => { console.error("Snapshot error on", q, err); });

    
    return () => unsubscribe();
  }, [bookId, currentUser]);

  if (loading) return <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-zinc-600 rounded-full animate-spin" /></div>;
  if (!book) return <div className="p-8 text-center text-sm text-slate-500">Book not found or access denied.</div>;

  const myRole = book.roles[currentUser!.uid]?.role || 'viewer';
  const canWrite = ['owner', 'admin', 'contributor'].includes(myRole);
  const canManageUsers = ['owner', 'admin'].includes(myRole);
  const isAuditor = myRole === 'auditor';

  const defaultCategories = userProfile?.customCategories?.length ? userProfile.customCategories : ['Office Supplies', 'Software Subscriptions', 'Travel', 'Meals'];

  const openNewExpense = () => {
    setEditingExpense(null);
    setEntryType('out');
    setAmount('');
    setDescription('');
    setCategory(defaultCategories[0] || '');
    setCustomCatInput('');
    setIsExpenseModalOpen(true);
  };

  
  const generatePDF = (returnBase64 = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Expense Report: ${book?.name}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const tableData = filteredExpenses.map(exp => [
      exp.createdAt ? new Date(exp.createdAt.toDate()).toLocaleDateString() : exp.date,
      exp.description,
      exp.category,
      exp.paidByName,
      `${book?.currency} ${exp.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['Date', 'Description', 'Category', 'Author', 'Amount']],
      body: tableData,
    });

    if (returnBase64) {
      return doc.output('datauristring');
    } else {
      doc.save(`${book?.name}_Report.pdf`);
    }
  };

  const emailReport = async () => {
    if (!currentUser?.email) return;
    setSendingReport(true);
    try {
      const pdfBase64 = generatePDF(true).split(',')[1];
      const res = await fetch('/api/email/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: currentUser.email,
          subject: `${book?.name} - Expense Report`,
          message: 'Please find the attached PDF report for your ledger.',
          pdfBase64,
          filename: 'Expense_Report.pdf'
        })
      });
      if (!res.ok) throw new Error('Failed to send email');
      addToast({ title: 'Report Sent', description: `PDF report sent to ${currentUser.email}`, type: 'success' });
    } catch (err) {
      addToast({ title: 'Error', description: 'Failed to send report email', type: 'error' });
    } finally {
      setSendingReport(false);
    }
  };

  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setEntryType(exp.entryType || exp.entryType || 'out');
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

  const notifyTeamMembers = async (action: string, detail: string, customSubject?: string) => {
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
      const subject = customSubject || `${userProfile?.displayName || currentUser?.email} ${action.toLowerCase()} in ${book.name} expense book`;
      const message = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background-color: #0B1F3A; color: white; display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">Byjan</div>
            <h2 style="color: #111827; margin-top: 16px; margin-bottom: 4px; font-size: 20px;">Expense Tracker Update</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Ledger: <strong>${book.name}</strong></p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #f3f4f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 0;">Hello,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">An entry in a ledger you follow has been updated by <strong style="color: #111827;">${userProfile?.displayName || currentUser?.email}</strong>.</p>
            
            <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Action</p>
              <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 500;">${action}</p>
            </div>
            
            <div style="margin-top: 16px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #10b981;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Details</p>
              <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 500;">${detail}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from your ExpenseShare application.</p>
          </div>
        </div>
      `;
      
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
          entryType: entryType,
          lastEditedBy: userProfile?.displayName || currentUser?.email,
          lastEditedByUid: currentUser?.uid || '',
          lastEditedAt: serverTimestamp()
        });
        await notifyTeamMembers('Edited an entry', `Updated ${entryType === 'in' ? 'money in' : 'money out'} for "${description}" to ${getCurrencySymbol(book.currency)} ${amount} in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} updated "${description}" to ${getCurrencySymbol(book.currency)}${amount} in ${book.name}`);
        addToast('Entry updated successfully!', 'success');
      } else {
        await addDoc(collection(db, `books/${bookId}/expenses`), {
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType: entryType,
          date: new Date().toISOString().split('T')[0],
          paidByName: userProfile?.displayName || currentUser?.email,
          enteredBy: userProfile?.displayName || currentUser?.email,
          enteredByUid: currentUser?.uid || '',
          enteredByEmail: currentUser?.email || '',
          createdAt: serverTimestamp()
        });
        await notifyTeamMembers('Added a new entry', `Recorded ${entryType === 'in' ? 'money in' : 'money out'} of ${getCurrencySymbol(book.currency)} ${amount} for "${description}" in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} added "${description}" (${getCurrencySymbol(book.currency)}${amount}) to ${book.name}`);
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
        await notifyTeamMembers('Deleted an entry', `Removed entry for "${description}"`, `${userProfile?.displayName || currentUser?.email} deleted "${description}" from ${book.name}`);
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

  const totalIn = expenses.filter(e => e.entryType === 'in' || e.entryType === 'in').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalOut = expenses.filter(e => e.entryType !== 'in' && e.entryType !== 'in').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const balance = totalIn - totalOut;
  
  const chartData = expenses.filter(e => e.entryType !== 'in' && e.entryType !== 'in').reduce((acc: any[], exp) => {
    const existing = acc.find(a => a.name === exp.category);
    if (existing) existing.total += exp.amount;
    else acc.push({ name: exp.category, total: exp.amount });
    return acc;
  }, []).sort((a, b) => b.total - a.total).slice(0, 5);

  
  // Filter and Pagination Logic
  const filteredExpenses = expenses.filter(exp => 
    exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.paidByName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / itemsPerPage));
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      {isSaving && <TransactionLoader message="Saving transaction..." />}
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Compact Modern Header */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 bg-[#f8f9fa]/95 backdrop-blur border-b border-slate-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link to="/" className="inline-flex items-center text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-none">{book.name}</h1>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-zinc-50 text-zinc-700 uppercase tracking-widest border border-zinc-100/50">
              {myRole}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Users className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Team</span>
          </button>
          
          {(myRole === 'owner' || myRole === 'admin') && (
            <button 
              onClick={() => setShowDeleteBookConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:border-red-300 hover:bg-red-50 transition-all shadow-sm"
              title="Delete Ledger (Only Owner/Admin)"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          
          {canWrite && (
            <button 
              onClick={openNewExpense}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-zinc-600 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-all shadow-sm hover:shadow shadow-zinc-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Entry</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      <Tabs.Root defaultValue="ledger" className="space-y-5">
        <Tabs.List className="flex gap-4 border-b border-slate-200/60">
          <Tabs.Trigger value="ledger" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-zinc-600 data-[state=active]:border-b-2 data-[state=active]:border-zinc-600 transition-colors">
            Ledger Entries
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-zinc-600 data-[state=active]:border-b-2 data-[state=active]:border-zinc-600 transition-colors">
            Analytics & Reports
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="ledger" className="space-y-4 outline-none">
          {/* Summary Cards */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between bg-white p-3 px-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</p>
              <h2 className={cn("text-lg font-bold", balance >= 0 ? "text-emerald-600" : "text-rose-600")}>{balance < 0 ? '-' : ''}{getCurrencySymbol(book.currency)} {Math.abs(balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between bg-white p-3 px-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money Out</p>
              <h2 className="text-lg font-bold text-rose-600">{getCurrencySymbol(book.currency)} {totalOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between bg-white p-3 px-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money In</p>
              <h2 className="text-lg font-bold text-emerald-600">{getCurrencySymbol(book.currency)} {totalIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            {isAuditor && (
              <div className="w-full sm:w-auto flex-1 bg-amber-50 p-3 px-5 rounded-lg border border-amber-200 shadow-sm flex flex-row items-center justify-between relative overflow-hidden">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Auditor</p>
                <p className="text-[10px] text-amber-900/80 font-medium z-10">Read-only</p>
              </div>
            )}
          </div>

          
          {/* Enhanced Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search entries..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-600/20 focus:border-zinc-600 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => generatePDF(false)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={emailReport} disabled={sendingReport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} <span className="hidden sm:inline">Email</span>
              </button>
              
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Cols</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" className="w-48 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Visible Columns</div>
                    {Object.keys(visibleColumns).map((col) => (
                      <DropdownMenu.CheckboxItem
                        key={col}
                        checked={visibleColumns[col as keyof typeof visibleColumns]}
                        onCheckedChange={(checked) => setVisibleColumns(prev => ({...prev, [col]: checked}))}
                        className="px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-slate-50 rounded flex items-center gap-2"
                      >
                        <span className="capitalize">{col}</span>
                      </DropdownMenu.CheckboxItem>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Desktop / Tablet View */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    {visibleColumns.date && <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>}
                    {visibleColumns.category && <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>}
                    {visibleColumns.author && <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Author</th>}
                    {visibleColumns.amount && <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>}
                    {canWrite && <th className="px-5 py-3 w-16 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">No entries found matching your criteria.</td></tr>
                  ) : (
                    paginatedExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-3 font-medium text-slate-900 text-sm max-w-xs truncate" title={exp.description}>{exp.description}</td>
                        {visibleColumns.date && <td className="px-5 py-3 text-slate-500 text-sm">{exp.createdAt ? format(exp.createdAt.toDate(), 'MMM dd, yyyy') : exp.date}</td>}
                        {visibleColumns.category && (
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {exp.category}
                            </span>
                          </td>
                        )}
                        {visibleColumns.author && <td className="px-5 py-3 text-slate-600 text-sm truncate max-w-[120px]" title={`Entered by: ${exp.enteredBy || exp.paidByName}${exp.lastEditedBy ? '\nLast edited by: ' + exp.lastEditedBy : ''}`}>{exp.enteredBy || exp.paidByName}</td>}
                        {visibleColumns.amount && (
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-bold">
                              {exp.entryType === 'in' ? (
                                <span className="text-emerald-600">+{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : exp.entryType === 'transfer' ? (
                                <span className="text-blue-600">{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : (
                                <span className="text-slate-900">-{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              )}
                            </div>
                          </td>
                        )}
                        {canWrite && (
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2 text-slate-400">
                              <button onClick={() => openEditExpense(exp)} className="p-1 hover:text-zinc-600 hover:bg-zinc-50 rounded transition-colors" title="Edit">
                                <PenSquare className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteExpense(exp.id, exp.description)} disabled={isDeleting === exp.id} className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50" title="Delete">
                                {isDeleting === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

            {/* Compact Mobile View */}
            <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50">
              {paginatedExpenses.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">No entries found.</div>
              ) : (
                paginatedExpenses.map((exp) => (
                  <div key={exp.id} className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-semibold text-slate-900 text-[14px] leading-tight flex-1">{exp.description}</div>
                      <div className={cn("font-bold text-[14px] whitespace-nowrap", exp.entryType === 'in' ? "text-emerald-600" : exp.entryType === 'transfer' ? "text-blue-600" : "text-slate-900")}>{exp.entryType === 'in' ? '+' : exp.entryType === 'transfer' ? '' : '-'}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">{exp.createdAt ? format(exp.createdAt.toDate(), 'MMM dd, yyyy') : exp.date}</span>
                        <span className="flex items-center gap-1.5">{exp.enteredBy || exp.paidByName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {canWrite && (
                          <>
                            <button onClick={() => openEditExpense(exp)} className="p-1.5 bg-slate-50 text-slate-500 hover:text-zinc-600 rounded-md border border-slate-200">
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteExpense(exp.id, exp.description)} disabled={isDeleting === exp.id} className="p-1.5 bg-slate-50 text-slate-500 hover:text-rose-600 rounded-md border border-slate-200">
                              {isDeleting === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Pagination Controls */}
          {filteredExpenses.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg mt-3">
              <span className="text-xs font-medium text-slate-500">
                <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredExpenses.length)}</span> of <span className="text-slate-900">{filteredExpenses.length}</span>
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
                        formatter={(value: number) => [`${getCurrencySymbol(book.currency)} ${value.toLocaleString()}`, 'Amount']}
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
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setEntryType('out')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'out' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money Out
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('in')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'in' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money In
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('transfer')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'transfer' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Transfer
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({getCurrencySymbol(book.currency)})</label>
                <input 
                  type="number" step="0.01" required autoFocus
                  value={amount} onChange={e=>setAmount(e.target.value)} 
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input 
                  type="text" required 
                  value={description} onChange={e=>setDescription(e.target.value)} 
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none" 
                  placeholder="e.g. Server Hosting"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full mb-2 h-9 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    <div className="h-px bg-slate-200 my-1"></div>
                    <SelectItem value="__custom__" className="font-semibold text-blue-600">-- Add Custom Category --</SelectItem>
                  </SelectContent>
                </Select>
                {category === '__custom__' && (
                  <input 
                    type="text" required
                    value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-zinc-600 outline-none"
                    placeholder="Enter custom category name"
                  />
                )}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-zinc-600 text-white text-sm font-medium rounded-md hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
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
                        data.role === 'admin' ? "bg-zinc-50 text-zinc-700 border-zinc-200" :
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
                    className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-zinc-600 outline-none"
                  />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-full sm:w-32 h-[34px] py-1.5 border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <button type="submit" disabled={inviting} className="px-4 py-1.5 bg-zinc-600 text-white text-sm font-medium rounded-md hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
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

      {/* Delete Book Confirmation Dialog */}
      <Dialog.Root open={showDeleteBookConfirm} onOpenChange={setShowDeleteBookConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-[calc(100%-2rem)] z-50 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-lg font-bold text-slate-900 mb-1">
                  Delete Ledger Permanently?
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-600">
                  This action cannot be undone. This will permanently delete "<strong>{book?.name}</strong>" and all its expense entries.
                </Dialog.Description>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 font-medium mb-2">⚠️ All members will be notified:</p>
              <ul className="text-xs text-amber-700 space-y-1 ml-4">
                <li>• In-app notifications will be sent to all members</li>
                <li>• Email notifications will be sent to all members</li>
                <li>• All expense data will be permanently deleted</li>
                <li>• This ledger will no longer be accessible</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button 
                  disabled={isDeletingBook}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button 
                onClick={handleDeleteBook}
                disabled={isDeletingBook}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingBook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Ledger
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      </div>
    </>
  );
}
