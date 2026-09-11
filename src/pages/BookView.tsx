import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteField } from '../lib/store';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, ArrowLeft, Plus, Trash2, Users, UserPlus, X, PenSquare, FileText, FileBarChart, LogOut, UserMinus, Search, Download, Settings2, ChevronLeft, ChevronRight, Send, Copy, Paperclip, Mail, Megaphone } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currency';
import { isSoftDeleted, softDeletePatch } from '../lib/records';
import { bookInboundAddress, ledgerAppLink, openLedgerButtonHtml, syncInboundMailbox } from '../lib/inbound-mail';
import { createLedgerInvite, memberEmails } from '../lib/invites';
import { authHeaders } from '../lib/auth-client';
import { ReceiptModal } from '../components/ReceiptModal';
import { EventMailTrack, emailStatusClass, emailStatusLabel, resolvedStatus } from '../components/EmailActivityFlow';
import { ListControls, usePagedList } from '../components/ListControls';
import AppLoader from '../components/AppLoader';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function expenseMillis(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  try {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
  } catch { /* pending server timestamp */ }
  return 0;
}

const BASE_CATEGORIES = ['Office Supplies', 'Software Subscriptions', 'Travel', 'Meals', 'Fuel', 'Groceries', 'Utilities', 'Health', 'Shopping'];

function uniqueCategories(...lists: Array<string[] | undefined | null>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const raw of list || []) {
      const value = String(raw || '').trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function expenseDateLabel(exp: any) {
  try {
    if (exp?.createdAt && typeof exp.createdAt.toDate === 'function') {
      return format(exp.createdAt.toDate(), 'MMM dd, yyyy');
    }
  } catch { /* pending server timestamp */ }
  return exp?.date || '';
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
  const [inboundAddress, setInboundAddress] = useState('');
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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    category: true,
    author: true,
    amount: true
  });
  const [sendingReport, setSendingReport] = useState(false);

  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announcing, setAnnouncing] = useState(false);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);
  const [deletingLedger, setDeletingLedger] = useState(false);
  const { addToast } = useToast();
  const [copiedInbound, setCopiedInbound] = useState(false);
  const [inboundEvents, setInboundEvents] = useState<any[]>([]);
  const [outboundEvents, setOutboundEvents] = useState<any[]>([]);
  const [inboundEventsLoading, setInboundEventsLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState('ledger');
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string } | null>(null);
  const [unsentEmailChange, setUnsentEmailChange] = useState<{action: string, detail: string} | null>(null);  const navigate = useNavigate();

  const handleRemoveMember = async (uidToRemove: string, isSelf: boolean) => {
    if (!currentUser || !book) return;
    
    // Prevent removing the last owner
    if (book.roles?.[uidToRemove]?.role === 'owner') {
      const ownerCount = Object.values(book.roles || {}).filter((r: any) => r.role === 'owner').length;
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
        const nextRoles = { ...book.roles };
        delete nextRoles[uidToRemove];
        const nextBook = { ...book, roles: nextRoles };
        setBook(nextBook);
        setInboundAddress(bookInboundAddress(nextBook));
        
        addToast(isSelf ? 'You have left the ledger.' : 'Member removed.', 'success');
        
        if (isSelf) {
          navigate('/expenses');
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

  useEffect(() => {
    if (!bookId || !currentUser) return;
    const fetchBook = async () => {
      const docSnap = await getDoc(doc(db, 'books', bookId));
      if (docSnap.exists()) {
        const next = { id: docSnap.id, ...docSnap.data() };
        setBook(next);
        setInboundAddress(bookInboundAddress(next));
        if (!String(next.inboundAddress || next.inboundSlug || '').trim()) {
          void syncInboundMailbox(next).then((record) => setInboundAddress(record.address)).catch(() => undefined);
        }
      }
    };
    fetchBook();

    const q = query(collection(db, `books/${bookId}/expenses`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        if (isSoftDeleted(data)) return;
        exps.push({ id: d.id, ...data });
      });
      setExpenses((prev) => {
        const byId = new Map(exps.map((row) => [row.id, row]));
        const recent = Date.now() - 30_000;
        for (const row of prev) {
          if (byId.has(row.id) || isSoftDeleted(row)) continue;
          if (expenseMillis(row.createdAt) >= recent) byId.set(row.id, row);
        }
        return [...byId.values()].sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt));
      });
      setLoading(false);
    }, (err) => {
      console.error('Snapshot error on', q, err);
      if ((err as { code?: string }).code === 'resource-exhausted') unsubscribe();
    });

    
    return () => unsubscribe();
  }, [bookId, currentUser?.uid]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const loadEmailActivity = async () => {
    if (!bookId) return;
    setInboundEventsLoading(true);
    try {
      const [inboundSnap, outboundSnap] = await Promise.all([
        getDocs(query(collection(db, `books/${bookId}/inbound_events`)), { force: true }),
        getDocs(query(collection(db, `books/${bookId}/email_events`)), { force: true }),
      ]);
      const inbound: any[] = [];
      inboundSnap.forEach((d) => inbound.push({ id: d.id, direction: 'inbound', ...d.data() }));
      inbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
      const outbound: any[] = [];
      outboundSnap.forEach((d) => outbound.push({ id: d.id, direction: 'outbound', ...d.data() }));
      outbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
      setInboundEvents(inbound.slice(0, 250));
      setOutboundEvents(outbound.slice(0, 250));
    } catch {
      setInboundEvents([]);
      setOutboundEvents([]);
    } finally {
      setInboundEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!bookId || ledgerTab !== 'email') return;
    setInboundEventsLoading(true);
    const unsubIn = onSnapshot(query(collection(db, `books/${bookId}/inbound_events`)), (snap) => {
      const inbound: any[] = [];
      snap.forEach((d) => inbound.push({ id: d.id, direction: 'inbound', ...d.data() }));
      inbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
      setInboundEvents(inbound.slice(0, 250));
      setInboundEventsLoading(false);
    }, () => setInboundEventsLoading(false));
    const unsubOut = onSnapshot(query(collection(db, `books/${bookId}/email_events`)), (snap) => {
      const outbound: any[] = [];
      snap.forEach((d) => outbound.push({ id: d.id, direction: 'outbound', ...d.data() }));
      outbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
      setOutboundEvents(outbound.slice(0, 250));
    });
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [ledgerTab, bookId]);

  const emailActivityAll = useMemo(() => (
    [...inboundEvents, ...outboundEvents]
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')))
  ), [inboundEvents, outboundEvents]);
  const emailFilter = useCallback((row: any, q: string) => (
    [row.subject, row.action, row.detail, row.reason, row.fromEmail, row.toEmail, row.status, row.description, row.category]
      .some((value) => String(value || '').toLowerCase().includes(q))
  ), []);
  const emailList = usePagedList(emailActivityAll, emailFilter, 10);

  if (loading) return <AppLoader title="Ledger" message="Opening entries and balances." />;
  if (!book) return <div className="p-8 text-center text-sm text-slate-500">Book not found or access denied.</div>;

  const myRole = book.roles[currentUser!.uid]?.role || 'viewer';
  const canWrite = ['owner', 'admin', 'contributor'].includes(myRole);
  const canManageUsers = ['owner', 'admin'].includes(myRole);
  const isAuditor = myRole === 'auditor';

  const expenseCategories = expenses.map((exp) => String(exp.category || '')).filter(Boolean);
  const ledgerCategories = Array.isArray(book.categories) ? book.categories.map(String) : [];
  const categoryOptions = uniqueCategories(
    BASE_CATEGORIES,
    userProfile?.customCategories,
    ledgerCategories,
    expenseCategories,
  );

  const persistLedgerCategory = async (name: string) => {
    if (!bookId || !name) return;
    const next = uniqueCategories(ledgerCategories, [name]);
    if (next.length === ledgerCategories.length && ledgerCategories.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    await updateDoc(doc(db, 'books', bookId), { categories: next });
    setBook((prev: any) => prev ? { ...prev, categories: next } : prev);
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setEntryType('out');
    setAmount('');
    setDescription('');
    setCategory(categoryOptions[0] || '');
    setCustomCatInput('');
    setIsExpenseModalOpen(true);
  };

  const copyInboundAddress = async () => {
    const address = inboundAddress || bookInboundAddress(book);
    try {
      await navigator.clipboard.writeText(address);
      setCopiedInbound(true);
      window.setTimeout(() => setCopiedInbound(false), 1600);
    } catch {
      addToast('Could not copy the address', 'error');
    }
  };

  const openReceipt = async (exp: any) => {
    if (!exp?.receiptPath) return;
    try {
      const res = await fetch(`/api/blob/file?path=${encodeURIComponent(exp.receiptPath)}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error('Could not open receipt');
      const blob = await res.blob();
      if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url);
      setReceiptPreview({ url: URL.createObjectURL(blob), title: exp.receiptName || exp.description });
    } catch (err: any) {
      addToast(err?.message || 'Could not open receipt', 'error');
    }
  };

  const generatePDF = (returnBase64 = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Expense Report: ${book?.name}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const tableData = filteredExpenses.map(exp => [
      exp.createdAt && typeof exp.createdAt.toDate === 'function'
        ? new Date(exp.createdAt.toDate()).toLocaleDateString()
        : (exp.date || ''),
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
      const { authHeaders } = await import('../lib/auth-client');
      const res = await fetch('/api/email/send-report', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: currentUser.email,
          subject: `${book?.name} - Expense Report`,
          message: 'Please find the attached PDF report for your ledger.',
          pdfBase64,
          filename: 'Expense_Report.pdf'
        })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to send email');
      }
      addToast(`PDF report sent to ${currentUser.email}`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to send report email', 'error');
    } finally {
      setSendingReport(false);
    }
  };

  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setEntryType(exp.entryType || exp.entryType || 'out');
    setAmount(exp.amount.toString());
    setDescription(exp.description);
    if (categoryOptions.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCatInput('');
    } else {
      setCategory('__custom__');
      setCustomCatInput(exp.category);
    }
    setIsExpenseModalOpen(true);
  };

  const notifyTeamMembers = async (action: string, detail: string, customSubject?: string, htmlOverride?: string) => {
    // 1. In-app notifications
    const uidsToNotify = Object.keys(book.roles).filter(uid => uid !== currentUser?.uid);
    for (const uid of uidsToNotify) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: uid,
          bookId,
          bookName: book.name,
          kind: htmlOverride ? 'announcement' : 'entry',
          action,
          detail,
          senderName: userProfile?.displayName || currentUser?.email,
          ledgerMail: inboundAddress || bookInboundAddress(book),
          link: ledgerAppLink(bookId || book.id),
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
    }

    // 2. Email notifications (Now sent reliably via our Node backend)
    const emails = memberEmails(book.roles); 
    if (emails.length > 0) {
      const mailbox = inboundAddress || bookInboundAddress(book);
      const subject = customSubject || `${userProfile?.displayName || currentUser?.email} ${action.toLowerCase()} in ${book.name} expense book`;
      const message = htmlOverride || `
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
            <p style="color: #374151; font-size: 15px; line-height: 1.5; margin-top: 20px;">Everyone on this ledger is notified. Open Byjan to review the entry.</p>
            <p style="color:#64748b;font-size:13px;line-height:1.55">Send receipts or entries to <strong>${mailbox}</strong> and Byjan will record them automatically. The ledger team is notified when an entry is added.</p>
            ${openLedgerButtonHtml(bookId || book.id)}
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from Byjan.</p>
          </div>
        </div>
      `;
      
      for (const email of emails) {
        // This hits our reliable Express backend which doesn't lose credentials
        sendEmailNotification(email, subject, message, { action }).catch(console.error);
      }
    }
  };

  
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setIsSaving(true);
    const finalCategory = category === '__custom__' ? customCatInput.trim() : category;
    if (!finalCategory) {
      setIsSaving(false);
      addToast('Please specify a category', 'error');
      return;
    }

    try {
      if (editingExpense) {
        const nextStatus = Number(amount) > 0 ? 'recorded' : 'draft';
        await updateDoc(doc(db, `books/${bookId}/expenses`, editingExpense.id), {
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType: entryType,
          status: nextStatus,
          lastEditedBy: userProfile?.displayName || currentUser?.email,
          lastEditedByUid: currentUser?.uid || '',
          lastEditedAt: serverTimestamp()
        });
        await persistLedgerCategory(finalCategory);
        setExpenses((prev) => prev.map((row) => row.id === editingExpense.id ? {
          ...row,
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType,
          status: nextStatus,
          lastEditedBy: userProfile?.displayName || currentUser?.email,
          lastEditedByUid: currentUser?.uid || '',
          lastEditedAt: new Date().toISOString(),
        } : row));
        addToast('Entry updated successfully!', 'success');
        setIsExpenseModalOpen(false);
        notifyTeamMembers('Edited an entry', `Updated ${entryType === 'in' ? 'money in' : 'money out'} for "${description}" to ${getCurrencySymbol(book.currency)} ${amount} in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} updated "${description}" to ${getCurrencySymbol(book.currency)}${amount} in ${book.name}`).catch(console.error);
      } else {
        const created = await addDoc(collection(db, `books/${bookId}/expenses`), {
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType: entryType,
          date: new Date().toISOString().split('T')[0],
          paidByName: userProfile?.displayName || currentUser?.email,
          enteredBy: userProfile?.displayName || currentUser?.email,
          enteredByUid: currentUser?.uid || '',
          enteredByEmail: currentUser?.email || '',
          status: Number(amount) > 0 ? 'recorded' : 'draft',
          createdAt: serverTimestamp()
        });
        await persistLedgerCategory(finalCategory);
        setExpenses((prev) => [{
          id: created.id,
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType,
          date: new Date().toISOString().split('T')[0],
          paidByName: userProfile?.displayName || currentUser?.email,
          enteredBy: userProfile?.displayName || currentUser?.email,
          enteredByUid: currentUser?.uid || '',
          enteredByEmail: currentUser?.email || '',
          status: Number(amount) > 0 ? 'recorded' : 'draft',
          createdAt: new Date().toISOString(),
        }, ...prev]);
        addToast('Entry recorded successfully!', 'success');
        setCurrentPage(1);
        setIsExpenseModalOpen(false);
        setAmount('');
        setDescription('');
        setCustomCatInput('');
        setCategory(finalCategory);
        notifyTeamMembers('Added a new entry', `Recorded ${entryType === 'in' ? 'money in' : 'money out'} of ${getCurrencySymbol(book.currency)} ${amount} for "${description}" in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} added "${description}" (${getCurrencySymbol(book.currency)}${amount}) to ${book.name}`).catch(console.error);
      }
    } catch (err) {
      console.error(err);
      addToast('Error saving expense', 'error');
    } finally { setIsSaving(false); }
  };

  const handleDeleteExpense = async (id: string, description: string) => {
    if (!canWrite || !currentUser) return;
    if (confirm('Remove this entry? It stays in the ledger for audit and is hidden from lists and totals.')) {
      setIsDeleting(id);
      try {
        await updateDoc(doc(db, `books/${bookId}/expenses`, id), softDeletePatch(currentUser.uid));
        setExpenses((prev) => prev.filter((row) => row.id !== id));
        await notifyTeamMembers('Deleted an entry', `Removed entry for "${description}"`, `${userProfile?.displayName || currentUser?.email} deleted "${description}" from ${book.name}`);
        addToast('Entry removed. The record is kept for audit.', 'success');
      } catch (err: any) {
        console.error("Delete failed:", err);
        addToast("Delete failed: " + err.message, 'error');
      } finally { setIsDeleting(null); }
    }
  };

  const sendEmailNotification = async (toEmail: string, subject: string, message: string, meta?: { action?: string }) => {
    try {
      const { authHeaders } = await import('../lib/auth-client');
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          to: toEmail,
          subject,
          message,
          ledgerMail: inboundAddress || bookInboundAddress(book),
          kind: meta?.action?.toLowerCase().includes('announcement') ? 'announcement' : 'notice',
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (bookId) {
        await addDoc(collection(db, `books/${bookId}/email_events`), {
          direction: 'outbound',
          status: res.ok ? 'sent' : 'failed',
          toEmail,
          subject,
          action: meta?.action || 'Team notification',
          detail: res.ok ? 'Notification email sent' : String(payload.error || res.statusText || 'Send failed'),
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
      if (!res.ok) {
         console.error('Email API Error:', payload.error || res.statusText);
         addToast(payload.error || 'Email sending failed on the server.', 'error');
      }
      return res.ok;
    } catch (err: any) {
      console.error('Failed to send email via backend:', err);
      if (bookId) {
        await addDoc(collection(db, `books/${bookId}/email_events`), {
          direction: 'outbound',
          status: 'failed',
          toEmail,
          subject,
          action: meta?.action || 'Team notification',
          detail: err?.message || 'Network error',
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
      addToast('Network error sending email: ' + err.message, 'error');
      return false;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !inviteEmail) return;
    setInviting(true);
    try {
      await createLedgerInvite({
        bookId: book.id,
        bookName: book.name,
        email: inviteEmail,
        role: inviteRole,
        invitedBy: currentUser!.uid,
      });
      setInviteEmail('');
      addToast('Invitation added to their dashboard successfully!', 'success');
      
      const sent = await sendEmailNotification(
        inviteEmail.toLowerCase(),
        `Invitation to ledger: ${book.name}`,
        `<p>Hello,</p><p>You have been invited to join the ledger <b>${book.name}</b> on Byjan.</p><p>Open the app, sign in, and accept the invitation from your dashboard.</p>${openLedgerButtonHtml(book.id, 'Open Byjan')}`
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

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = announceTitle.trim();
    const body = announceBody.trim();
    if (!title || !body || !book) return;
    setAnnouncing(true);
    try {
      const mailbox = inboundAddress || bookInboundAddress(book);
      const sender = userProfile?.displayName || currentUser?.email || 'A teammate';
      const html = `
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8070">Team announcement</p>
        <h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0B1F3A;font-weight:normal">${title.replace(/</g, '&lt;')}</h2>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px">From ${sender} · ${book.name}</p>
        <div style="white-space:pre-wrap;font-size:15px;line-height:1.65;color:#334155">${body.replace(/</g, '&lt;')}</div>
        <p style="margin:24px 0 0;font-size:13px;color:#64748b">Send receipts or any entry to <strong>${mailbox}</strong> and Byjan will record it automatically. This ledger team is notified when a line is added.</p>
        ${openLedgerButtonHtml(book.id, 'Open ledger')}
      `;
      await notifyTeamMembers(title, body, `Announcement · ${book.name}: ${title}`, html);
      setAnnounceTitle('');
      setAnnounceBody('');
      addToast('Announcement sent to the ledger team.', 'success');
      setIsAnnounceOpen(false);
    } catch (err: any) {
      addToast(err?.message || 'Could not send announcement', 'error');
    } finally {
      setAnnouncing(false);
    }
  };

  const handleDeleteLedger = async () => {
    if (!currentUser || !bookId || !book) return;
    if (!confirm(`Delete ledger “${book.name}”? It leaves everyone’s list. Entries are kept for audit.`)) return;
    setDeletingLedger(true);
    try {
      await updateDoc(doc(db, 'books', bookId), softDeletePatch(currentUser.uid));
      addToast('Ledger deleted.', 'success');
      navigate('/expenses');
    } catch (err: any) {
      addToast(err?.message || 'Could not delete this ledger', 'error');
    } finally {
      setDeletingLedger(false);
    }
  };

  const totalIn = expenses.filter(e => e.entryType === 'in').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalTransfer = expenses.filter(e => e.entryType === 'transfer').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalOut = expenses.filter(e => e.entryType !== 'in' && e.entryType !== 'transfer').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const balance = totalIn - totalOut;
  
  const chartData = expenses.filter(e => e.entryType !== 'in' && e.entryType !== 'transfer').reduce((acc: any[], exp) => {
    const existing = acc.find(a => a.name === exp.category);
    if (existing) existing.total += exp.amount;
    else acc.push({ name: exp.category, total: exp.amount });
    return acc;
  }, []).sort((a, b) => b.total - a.total).slice(0, 5);

  
  // Filter and Pagination Logic
  const filteredExpenses = expenses.filter(exp => 
    exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.paidByName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.enteredBy?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / itemsPerPage));
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div className="h-full min-h-0 flex flex-col">
      <Tabs.Root value={ledgerTab} onValueChange={setLedgerTab} className="h-full min-h-0 flex flex-col">
        <div className="shrink-0 px-4 md:px-6 lg:px-8 pt-4 pb-3 bg-[#F5F7FA] border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/expenses" className="p-1 text-slate-400 hover:text-slate-700" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900 truncate">{book.name}</h1>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-700 uppercase border border-zinc-100">
            {myRole}
          </span>
        </div>
          <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAnnounceOpen(true)}
            className="byjan-btn-ghost !px-3 !py-1.5"
            title="Send an announcement to this ledger team"
          >
            <Megaphone className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Announce</span>
          </button>
          <button 
            onClick={() => setIsMembersModalOpen(true)}
            className="byjan-btn-ghost !px-3 !py-1.5"
          >
            <Users className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Team</span>
          </button>
          {myRole === 'owner' && (
            <button
              type="button"
              onClick={() => void handleDeleteLedger()}
              disabled={deletingLedger}
              className="byjan-btn-ghost !px-3 !py-1.5 text-rose-700"
              title="Delete this ledger"
            >
              {deletingLedger ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          {canWrite && (
            <button 
              onClick={openNewExpense}
              className="byjan-btn !px-3 sm:!px-4 !py-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Entry</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
          </div>
        </div>

        <Tabs.List className="flex gap-4 border-b border-slate-200/60 overflow-x-auto">
          <Tabs.Trigger value="ledger" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Ledger Entries
          </Tabs.Trigger>
          <Tabs.Trigger value="email" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Email Activity
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="pb-2 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Analytics & Reports
          </Tabs.Trigger>
        </Tabs.List>

        {ledgerTab === 'ledger' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between byjan-card p-3 px-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</p>
              <h2 className={cn("text-lg font-bold", balance >= 0 ? "text-emerald-600" : "text-rose-600")}>{balance < 0 ? '-' : ''}{getCurrencySymbol(book.currency)} {Math.abs(balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between byjan-card p-3 px-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money Out</p>
              <h2 className="text-lg font-bold text-rose-600">{getCurrencySymbol(book.currency)} {totalOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between byjan-card p-3 px-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money In</p>
              <h2 className="text-lg font-bold text-emerald-600">{getCurrencySymbol(book.currency)} {totalIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between byjan-card p-3 px-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transfer</p>
              <h2 className="text-lg font-bold text-blue-600">{getCurrencySymbol(book.currency)} {totalTransfer.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            {isAuditor && (
              <div className="w-full sm:w-auto flex-1 bg-amber-50 p-3 px-5 rounded-lg border border-amber-200 shadow-sm flex flex-row items-center justify-between">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Auditor</p>
                <p className="text-[10px] text-amber-900/80 font-medium">Read-only</p>
              </div>
            )}
          </div>
        )}
        </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-6xl mx-auto">
        <Tabs.Content value="ledger" className="space-y-4 outline-none">
          {/* Enhanced Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search entries..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="byjan-input pl-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => generatePDF(false)} className="byjan-btn-ghost flex-1 sm:flex-none !px-3 !py-2">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={emailReport} disabled={sendingReport} className="byjan-btn-ghost flex-1 sm:flex-none !px-3 !py-2">
                {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} <span className="hidden sm:inline">Email</span>
              </button>
              
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="byjan-btn-ghost !px-3 !py-2">
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
          <div className="byjan-table flex flex-col">
            
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
                        <td className="px-5 py-3 font-medium text-slate-900 text-sm max-w-xs truncate" title={exp.description}>
                          <span className="inline-flex items-center gap-1.5">
                            {exp.receiptPath && (
                              <button type="button" onClick={() => openReceipt(exp)} className="text-teal-700 hover:text-teal-900" title="Open receipt">
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {exp.description}
                            {exp.status === 'draft' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Needs review</span>
                            )}
                          </span>
                        </td>
                        {visibleColumns.date && <td className="px-5 py-3 text-slate-500 text-sm">{expenseDateLabel(exp)}</td>}
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
                  <div key={exp.id} className="p-3.5 byjan-card flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-semibold text-slate-900 text-[14px] leading-tight flex-1">
                        {exp.description}
                        {exp.status === 'draft' && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Needs review</span>
                        )}
                      </div>
                      <div className={cn("font-bold text-[14px] whitespace-nowrap", exp.entryType === 'in' ? "text-emerald-600" : exp.entryType === 'transfer' ? "text-blue-600" : "text-slate-900")}>{exp.entryType === 'in' ? '+' : exp.entryType === 'transfer' ? '' : '-'}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">{expenseDateLabel(exp)}</span>
                        <span className="flex items-center gap-1.5">{exp.enteredBy || exp.paidByName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {canWrite && (
                          <>
                            {exp.receiptPath && (
                              <button type="button" onClick={() => openReceipt(exp)} className="p-1.5 bg-slate-50 text-slate-500 hover:text-teal-700 rounded-md border border-slate-200" title="Open receipt">
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            )}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 byjan-card mt-3">
              <span className="text-xs font-medium text-slate-500">
                <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredExpenses.length)}</span> of <span className="text-slate-900">{filteredExpenses.length}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="byjan-input !w-auto !py-1 !h-auto text-xs"
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
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

        <Tabs.Content value="email" className="outline-none space-y-4">
          <div className="byjan-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" /> Email activity
                </h3>
                <p className="text-xs text-slate-500 mt-1">Each inbound receipt shows its own path. It updates while Byjan works, then settles when the entry is saved.</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 max-w-[220px] truncate">{inboundAddress || bookInboundAddress(book)}</code>
                <button type="button" className="byjan-btn-ghost !px-2.5 !py-1.5" onClick={() => void copyInboundAddress()}>
                  <Copy className="w-3.5 h-3.5" />
                  {copiedInbound ? 'Copied' : 'Copy'}
                </button>
                <button type="button" className="byjan-btn-ghost !px-2.5 !py-1.5" onClick={() => void loadEmailActivity()} disabled={inboundEventsLoading}>
                  {inboundEventsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">Send receipts to this address. The team is notified when an entry is saved.</p>
          </div>

          <ListControls
            query={emailList.query}
            onQuery={emailList.setQuery}
            page={emailList.page}
            totalPages={emailList.totalPages}
            onPage={emailList.setPage}
            pageSize={emailList.pageSize}
            onPageSize={emailList.setPageSize}
            total={emailList.filtered.length}
            placeholder="Search status, sender, subject…"
          />

          <div className="space-y-3">
            {inboundEventsLoading && emailList.filtered.length === 0 ? (
              <AppLoader title="Email activity" message="Updating mail status." />
            ) : emailList.filtered.length === 0 ? (
              <div className="byjan-card p-8 text-center text-sm text-slate-500">No email activity for this ledger yet. Forward a receipt to the inbound address or add an entry to notify the team.</div>
            ) : (
              emailList.pageRows.map((event) => {
                const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : '—';
                const isInbound = event.direction !== 'outbound';
                const status = isInbound ? resolvedStatus(event) : String(event.status || '');
                return (
                  <article key={`${event.direction}-${event.id}`} className="byjan-card p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{event.subject || event.action || (isInbound ? 'Inbound receipt' : 'Team email')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isInbound ? (event.fromEmail || 'unknown') : (event.toEmail || '—')}
                          <span className="text-slate-300 px-1.5">·</span>
                          {when}
                        </p>
                      </div>
                      <span className={cn('inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', emailStatusClass(status))}>
                        {emailStatusLabel(status)}
                      </span>
                    </div>
                    {isInbound ? <EventMailTrack event={event} /> : null}
                    {(event.reason || event.detail || event.description || event.category || event.amount != null) ? (
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {event.reason ? <p>{event.reason}</p> : null}
                        {event.detail ? <p>{event.detail}</p> : null}
                        {event.amount != null && event.amount !== '' ? <p>{event.category || 'Uncategorized'} · {event.amount}</p> : null}
                        {event.description ? <p className="text-slate-500">{event.description}</p> : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="analytics" className="outline-none space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="byjan-card p-5">
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
            
            <div className="byjan-card p-5 flex flex-col">
              <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Export & Reports
              </h3>
              <p className="text-xs text-slate-500 mb-6 flex-1">Generate comprehensive CSV exports of the ledger for tax filing, audits, or external accounting software integration.</p>
              <button 
                onClick={() => addToast("CSV Export coming soon.", "info")}
                className="byjan-btn w-full"
              >
                Download CSV Ledger
              </button>
            </div>
          </div>
        </Tabs.Content>
        </div>
        </div>
      </Tabs.Root>

      {/* Expense Edit/Add Modal */}
      <Dialog.Root open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="byjan-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-5">
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
                  className="byjan-input" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input 
                  type="text" required 
                  value={description} onChange={e=>setDescription(e.target.value)} 
                  className="byjan-input" 
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
                    {categoryOptions.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    <div className="h-px bg-slate-200 my-1"></div>
                    <SelectItem value="__custom__" className="font-semibold text-blue-600">-- Add Custom Category --</SelectItem>
                  </SelectContent>
                </Select>
                {category === '__custom__' && (
                  <input 
                    type="text" required
                    value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                    className="byjan-input"
                    placeholder="Enter custom category name"
                  />
                )}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={isSaving} className="byjan-btn">
                  {isSaving && <span className="app-loader-ring app-loader-ring-sm" />}
                  {isSaving ? (editingExpense ? 'Saving changes' : 'Recording entry') : (editingExpense ? 'Save Changes' : 'Record Entry')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={isAnnounceOpen} onOpenChange={setIsAnnounceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="byjan-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <Dialog.Title className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-slate-500" /> Announce to the team
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <form onSubmit={sendAnnouncement} className="space-y-3">
              <p className="text-sm text-slate-500">Every member of this ledger receives the same letter, including the unique mailbox.</p>
              <input
                type="text"
                required
                maxLength={120}
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Subject"
                className="byjan-input"
              />
              <textarea
                required
                rows={5}
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                placeholder="Write the announcement"
                className="byjan-input min-h-[120px]"
              />
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={announcing} className="byjan-btn">
                  {announcing && <span className="app-loader-ring app-loader-ring-sm" />}
                  Send announcement
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
          <Dialog.Content className="byjan-panel fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg max-h-[85vh] translate-x-[-50%] translate-y-[-50%] overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <Dialog.Title className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> Team Members
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Receipt by email
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">Any member can send a receipt or entry to this unique ledger address. Byjan records it automatically and notifies this team. Full receive/send status is on the Email Activity tab.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 truncate">{inboundAddress || bookInboundAddress(book)}</code>
                  <button type="button" className="byjan-btn-ghost !px-2.5" onClick={() => void copyInboundAddress()}>
                    <Copy className="w-3.5 h-3.5" />
                    {copiedInbound ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button
                  type="button"
                  className="byjan-btn-ghost !w-full !justify-center text-xs"
                  onClick={() => {
                    setIsMembersModalOpen(false);
                    setLedgerTab('email');
                  }}
                >
                  Open Email Activity
                </button>
              </div>

              <button
                type="button"
                className="mb-4 byjan-btn-ghost !w-full !justify-center text-xs"
                onClick={() => {
                  setIsMembersModalOpen(false);
                  setIsAnnounceOpen(true);
                }}
              >
                <Megaphone className="w-3.5 h-3.5" /> Write a team announcement
              </button>
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
                    className="byjan-input"
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
                  <button type="submit" disabled={inviting} className="byjan-btn">
                    {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Invite
                  </button>
                </form>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {receiptPreview && (
        <ReceiptModal
          imageUrl={receiptPreview.url}
          expenseTitle={receiptPreview.title}
          verified={false}
          onClose={() => {
            URL.revokeObjectURL(receiptPreview.url);
            setReceiptPreview(null);
          }}
        />
      )}

      {/* Toast Notification */}

      </div>
    </>
  );
}
