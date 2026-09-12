import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  addLedgerMailEvent,
  ensureLedgerMailbox,
  getLedger,
  listLedgerAudit,
  listLedgerMail,
  removeLedgerMember,
  softDeleteLedger,
  updateLedger,
} from '../lib/ledgers';
import { createExpense, listExpenses, softDeleteExpense, updateExpense } from '../lib/expenses';
import { createNotification } from '../lib/notifications';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, ArrowLeft, Plus, Trash2, Users, UserPlus, X, PenSquare, FileText, FileBarChart, LogOut, UserMinus, Search, Download, Settings2, ChevronLeft, ChevronRight, Send, Copy, CopyPlus, Paperclip, Mail, Megaphone, Shield, Pin, PinOff, SlidersHorizontal, ArrowUpDown, Star } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currency';
import { bookInboundAddress, ledgerAppLink, openInviteButtonHtml, openLedgerButtonHtml, wrapByjanEmailHtml } from '../lib/inbound-mail';
import { createLedgerInvite, memberEmails } from '../lib/invites';
import { authHeaders } from '../lib/auth-client';
import { ReceiptModal, attachmentKind } from '../components/ReceiptModal';
import { EventMailTrack, emailStatusClass, emailStatusLabel, resolvedStatus } from '../components/EmailActivityFlow';
import { ListControls, usePagedList } from '../components/ListControls';
import AppLoader from '../components/AppLoader';
import LedgerTools from '../components/LedgerTools';
import LedgerStudio from '../components/LedgerStudio';
import {
  anomalyIds,
  dueRecurringPosts,
  isoDay,
  missingReceiptIds,
  nearDupeIds,
  readRecurring,
  readWatchMerchants,
  staleReimburseIds,
  touchRecentLedger,
  wouldBreakDailyCap,
} from '../lib/ledger-advanced';
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

function periodRange(kind: string) {
  const today = new Date();
  if (kind === 'week') {
    const start = new Date(today);
    const weekday = start.getDay();
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
    return { from: isoDay(start), to: isoDay(today) };
  }
  if (kind === 'month') {
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: isoDay(today) };
  }
  if (kind === '30') {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { from: isoDay(start), to: isoDay(today) };
  }
  return { from: '', to: '' };
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
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [reimbursable, setReimbursable] = useState(false);
  const [billable, setBillable] = useState(false);
  const [tags, setTags] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [reimbursableOnly, setReimbursableOnly] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Array<Record<string, unknown>>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [period, setPeriod] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [filterPos, setFilterPos] = useState({ top: 56, left: 24, width: 400 });
  
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
    merchant: false,
    method: false,
    author: true,
    amount: true,
    balance: false,
  });
  const [sortKey, setSortKey] = useState<'date' | 'amount' | 'description' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string; kind: 'image' | 'pdf' | 'file'; fileName?: string } | null>(null);
  const [openingReceiptId, setOpeningReceiptId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [hideTransfers, setHideTransfers] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [hideDrafts, setHideDrafts] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem('byjan.privacy') === '1'; } catch { return false; }
  });
  const [lastDeleted, setLastDeleted] = useState<Record<string, unknown> | null>(null);
  const skipFilterSave = useRef(true);
  const hiddenExpenseIds = useRef(new Set<string>());
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
        const nextBook = await removeLedgerMember(book.id, uidToRemove);
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
    let alive = true;
    const start = async () => {
      try {
        const next = await getLedger(bookId);
        if (!alive) return;
        setBook(next);
        setMonthlyBudget(next.monthlyBudget != null ? String(next.monthlyBudget) : '');
        setInboundAddress(bookInboundAddress(next));
        if (!String(next.inboundAddress || next.inboundSlug || '').trim()) {
          void ensureLedgerMailbox(bookId).then((payload) => {
            if (payload.mailbox?.address) setInboundAddress(payload.mailbox.address);
            if (payload.book) setBook(payload.book);
          }).catch(() => undefined);
        }
        let rows = await listExpenses(bookId);
        if (!alive) return;
        const myRoleNow = next.roles?.[currentUser.uid]?.role || (next.ownerId === currentUser.uid ? 'owner' : 'viewer');
        if (['owner', 'admin', 'contributor'].includes(String(myRoleNow))) {
          const { posts, nextRules } = dueRecurringPosts(readRecurring(next), rows);
          if (posts.length) {
            for (const row of posts) {
              await createExpense(bookId, {
                ...row,
                paidByName: userProfile?.displayName || currentUser.email,
                enteredBy: userProfile?.displayName || currentUser.email,
                enteredByUid: currentUser.uid,
                enteredByEmail: currentUser.email || '',
              }, { force: true });
            }
            const updated = await updateLedger(bookId, { recurringRules: nextRules });
            if (!alive) return;
            setBook(updated);
            rows = await listExpenses(bookId);
            addToast(`Posted ${posts.length} recurring ${posts.length === 1 ? 'entry' : 'entries'}.`, 'success');
          }
        }
        if (!alive) return;
        setExpenses(rows
          .filter((row) => row && !row.deleted && !row.deletedAt && row.status !== 'deleted')
          .sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt)));
        setLoading(false);
      } catch (err: any) {
        if (!alive) return;
        addToast(err?.message || 'You do not have access to this ledger.', 'error');
        navigate('/');
        setLoading(false);
      }
    };
    void start();
    const timer = window.setInterval(() => {
      if (!bookId) return;
      listExpenses(bookId).then((rows) => {
        if (!alive) return;
        setExpenses(rows
          .filter((row) => row && !row.deleted && !row.deletedAt && row.status !== 'deleted' && !hiddenExpenseIds.current.has(String(row.id)))
          .sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt)));
      }).catch(() => undefined);
    }, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [bookId, currentUser?.uid]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, typeFilter, dateFrom, dateTo, methodFilter, reimbursableOnly, uncategorizedOnly, hideTransfers, flaggedOnly, amountMin, amountMax, hideDrafts, staleOnly, anomalyOnly, missingOnly]);

  useEffect(() => {
    skipFilterSave.current = true;
    if (!bookId) return;
    try {
      const raw = sessionStorage.getItem(`byjan.ledger.filters.${bookId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.searchQuery === 'string') setSearchQuery(saved.searchQuery);
      if (typeof saved.typeFilter === 'string') setTypeFilter(saved.typeFilter);
      if (typeof saved.methodFilter === 'string') setMethodFilter(saved.methodFilter);
      if (typeof saved.dateFrom === 'string') setDateFrom(saved.dateFrom);
      if (typeof saved.dateTo === 'string') setDateTo(saved.dateTo);
      if (typeof saved.period === 'string') setPeriod(saved.period);
      if (typeof saved.reimbursableOnly === 'boolean') setReimbursableOnly(saved.reimbursableOnly);
      if (typeof saved.uncategorizedOnly === 'boolean') setUncategorizedOnly(saved.uncategorizedOnly);
      if (typeof saved.hideTransfers === 'boolean') setHideTransfers(saved.hideTransfers);
      if (typeof saved.flaggedOnly === 'boolean') setFlaggedOnly(saved.flaggedOnly);
      if (typeof saved.hideDrafts === 'boolean') setHideDrafts(saved.hideDrafts);
      if (typeof saved.staleOnly === 'boolean') setStaleOnly(saved.staleOnly);
      if (typeof saved.anomalyOnly === 'boolean') setAnomalyOnly(saved.anomalyOnly);
      if (typeof saved.amountMin === 'string') setAmountMin(saved.amountMin);
      if (typeof saved.amountMax === 'string') setAmountMax(saved.amountMax);
      if (saved.sortKey === 'date' || saved.sortKey === 'amount' || saved.sortKey === 'description' || saved.sortKey === 'category') setSortKey(saved.sortKey);
      if (saved.sortDir === 'asc' || saved.sortDir === 'desc') setSortDir(saved.sortDir);
    } catch { /* ignore */ }
    const rawQuery = window.location.hash.split('?')[1];
    if (!rawQuery) return;
    const params = new URLSearchParams(rawQuery);
    if (params.get('q')) setSearchQuery(params.get('q') || '');
    if (params.get('from')) setDateFrom(params.get('from') || '');
    if (params.get('to')) setDateTo(params.get('to') || '');
    if (params.get('min')) setAmountMin(params.get('min') || '');
    if (params.get('max')) setAmountMax(params.get('max') || '');
    if (params.get('type')) setTypeFilter(params.get('type') || 'all');
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    if (skipFilterSave.current) {
      skipFilterSave.current = false;
      return;
    }
    try {
      sessionStorage.setItem(`byjan.ledger.filters.${bookId}`, JSON.stringify({
        searchQuery, typeFilter, methodFilter, dateFrom, dateTo, period, reimbursableOnly, uncategorizedOnly, sortKey, sortDir,
        hideTransfers, flaggedOnly, hideDrafts, staleOnly, anomalyOnly, amountMin, amountMax,
      }));
    } catch { /* ignore */ }
  }, [bookId, searchQuery, typeFilter, methodFilter, dateFrom, dateTo, period, reimbursableOnly, uncategorizedOnly, sortKey, sortDir, hideTransfers, flaggedOnly, hideDrafts, staleOnly, anomalyOnly, amountMin, amountMax]);

  useEffect(() => {
    if (bookId) touchRecentLedger(bookId);
  }, [bookId]);

  useEffect(() => {
    const density = localStorage.getItem('byjan.density') || '';
    if (density) document.documentElement.dataset.density = density;
    if (localStorage.getItem('byjan.privacy') === '1') document.documentElement.dataset.privacy = 'on';
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (key === '/' && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Search entries"]')?.focus();
        return;
      }
      if (typing) return;
      if (key === 'n') {
        const add = document.querySelector('[data-add-entry]') as HTMLButtonElement | null;
        if (!add || add.disabled) return;
        event.preventDefault();
        add.click();
      }
      if (key === 'f') {
        event.preventDefault();
        setFiltersOpen((open) => !open);
      }
      if (key === 'u') {
        const undo = document.querySelector('[data-undo-remove]') as HTMLButtonElement | null;
        undo?.click();
      }
      if (key === 'd') {
        const next = document.documentElement.dataset.density === 'compact' ? '' : 'compact';
        document.documentElement.dataset.density = next;
        try { localStorage.setItem('byjan.density', next); } catch { /* ignore */ }
      }
      if (key === 'h') {
        event.preventDefault();
        setPrivacy((curr) => {
          const next = !curr;
          document.documentElement.dataset.privacy = next ? 'on' : '';
          try { localStorage.setItem('byjan.privacy', next ? '1' : '0'); } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.privacy = privacy ? 'on' : '';
    try { localStorage.setItem('byjan.privacy', privacy ? '1' : '0'); } catch { /* ignore */ }
  }, [privacy]);

  useEffect(() => {
    if (!bookId || ledgerTab !== 'audit') return;
    setAuditLoading(true);
    listLedgerAudit(bookId, 150)
      .then(setAuditEvents)
      .catch(() => setAuditEvents([]))
      .finally(() => setAuditLoading(false));
  }, [ledgerTab, bookId]);

  const loadEmailActivity = async () => {
    if (!bookId) return;
    setInboundEventsLoading(true);
    try {
      const { inbound, outbound } = await listLedgerMail(bookId);
      inbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
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
    let alive = true;
    const load = () => {
      listLedgerMail(bookId).then(({ inbound, outbound }) => {
        if (!alive) return;
        inbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
        outbound.sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
        setInboundEvents(inbound.slice(0, 250));
        setOutboundEvents(outbound.slice(0, 250));
        setInboundEventsLoading(false);
      }).catch(() => {
        if (!alive) return;
        setInboundEventsLoading(false);
      });
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
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

  const updateFilterPos = useCallback(() => {
    const el = filterBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
    const panelH = 300;
    const below = r.bottom + 8;
    const top = below + panelH > window.innerHeight - 12
      ? Math.max(12, r.top - panelH - 8)
      : below;
    setFilterPos({ top, left, width });
  }, []);

  const toggleFilters = () => {
    setFiltersOpen((open) => {
      if (!open) requestAnimationFrame(updateFilterPos);
      return !open;
    });
  };

  useEffect(() => {
    if (!filtersOpen) return;
    updateFilterPos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('resize', updateFilterPos);
    window.addEventListener('scroll', updateFilterPos, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', updateFilterPos);
      window.removeEventListener('scroll', updateFilterPos, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen, updateFilterPos]);

  if (loading) return <AppLoader title="Ledger" message="Opening entries and balances." />;
  if (!book) return <div className="p-8 text-center text-sm text-slate-500">Book not found or access denied.</div>;

  const myRole = book.roles?.[currentUser!.uid]?.role || (book.ownerId === currentUser!.uid ? 'owner' : 'viewer');
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
    await updateLedger(bookId, { categories: next });
    setBook((prev: any) => prev ? { ...prev, categories: next } : prev);
  };

  const togglePinned = async () => {
    if (!bookId) return;
    const pinned = !book.pinned;
    await updateLedger(bookId, { pinned });
    setBook((prev: any) => prev ? { ...prev, pinned } : prev);
    addToast(pinned ? 'Ledger pinned to the top of your list.' : 'Ledger unpinned.', 'success');
  };

  const saveMonthlyBudget = async () => {
    if (!bookId || !canManageUsers) return;
    const value = Number(monthlyBudget);
    if (!Number.isFinite(value) || value < 0) {
      addToast('Enter a valid monthly budget.', 'error');
      return;
    }
    await updateLedger(bookId, { monthlyBudget: value });
    setBook((prev: any) => prev ? { ...prev, monthlyBudget: value } : prev);
    addToast('Monthly spend budget saved.', 'success');
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setEntryType('out');
    setAmount('');
    setDescription('');
    setCategory(categoryOptions[0] || '');
    setCustomCatInput('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setMerchant('');
    setPaymentMethod('cash');
    setNotes('');
    setReimbursable(false);
    setBillable(false);
    setTags('');
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
    if (!exp?.receiptPath || openingReceiptId) return;
    const title = exp.receiptName || exp.description || 'Attachment';
    setOpeningReceiptId(exp.id);
    setReceiptPreview({ url: '', title, kind: 'image' });
    try {
      const res = await fetch(`/api/blob/file?path=${encodeURIComponent(exp.receiptPath)}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error('Could not open attachment');
      const blob = await res.blob();
      const fileName = String(exp.receiptName || exp.receiptPath.split('/').pop() || title);
      if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url);
      setReceiptPreview({
        url: URL.createObjectURL(blob),
        title,
        kind: attachmentKind(fileName, blob.type),
        fileName,
      });
    } catch (err: any) {
      setReceiptPreview(null);
      addToast(err?.message || 'Could not open attachment', 'error');
    } finally {
      setOpeningReceiptId(null);
    }
  };

  const downloadPdf = () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    requestAnimationFrame(() => {
      try {
        generatePDF(false);
      } catch {
        addToast('Could not create the PDF', 'error');
      } finally {
        setExportingPdf(false);
      }
    });
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
    setEntryDate(String(exp.date || new Date().toISOString().split('T')[0]));
    setMerchant(String(exp.merchant || ''));
    setPaymentMethod(String(exp.paymentMethod || 'cash'));
    setNotes(String(exp.notes || ''));
    setReimbursable(Boolean(exp.reimbursable));
    setBillable(Boolean(exp.billable));
    setTags(String(exp.tags || ''));
    setIsExpenseModalOpen(true);
  };

  const downloadCsv = () => {
    const rows = filteredExpenses.map((exp) => [
      exp.date || '',
      exp.entryType || 'out',
      exp.category || '',
      exp.description || '',
      exp.merchant || '',
      exp.paymentMethod || '',
      exp.enteredBy || exp.paidByName || '',
      Number(exp.amount || 0).toFixed(2),
      exp.reimbursable ? 'yes' : '',
      exp.billable ? 'yes' : '',
      exp.tags || '',
      exp.notes || '',
    ]);
    const csv = [['Date', 'Type', 'Category', 'Description', 'Merchant', 'Method', 'Entered by', 'Amount', 'Reimbursable', 'Billable', 'Tags', 'Notes'], ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(book?.name || 'ledger').replace(/\s+/g, '-')}-entries.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('CSV downloaded.', 'success');
  };

  const notifyTeamMembers = async (action: string, detail: string, customSubject?: string, htmlOverride?: string) => {
    // 1. In-app notifications
    const uidsToNotify = Object.keys(book.roles).filter(uid => uid !== currentUser?.uid);
    for (const uid of uidsToNotify) {
      try {
        await createNotification({
          userId: uid,
          bookId: bookId || book.id,
          bookName: book.name,
          kind: htmlOverride ? 'announcement' : 'entry',
          action,
          detail,
          senderName: userProfile?.displayName || currentUser?.email,
          ledgerMail: inboundAddress || bookInboundAddress(book),
          link: ledgerAppLink(bookId || book.id),
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
      const message = htmlOverride || wrapByjanEmailHtml({
        kicker: 'Ledger notice',
        title: 'Expense Tracker update',
        intro: `${userProfile?.displayName || currentUser?.email} updated a ledger you belong to.`,
        rows: [
          { label: 'Ledger', value: String(book.name || '') },
          { label: 'Action', value: action },
          { label: 'Details', value: detail },
        ],
        note: `Send receipts to ${mailbox} and Byjan will record them for the team.`,
        extraHtml: openLedgerButtonHtml(bookId || book.id),
      });
      
      for (const email of emails) {
        // This hits our reliable Express backend which doesn't lose credentials
        sendEmailNotification(email, subject, message, { action }).catch(console.error);
      }
    }
  };

  const applyExpenseLocal = (row: Record<string, unknown> | null | undefined) => {
    if (!row?.id) return;
    hiddenExpenseIds.current.delete(String(row.id));
    setExpenses((curr) => [row, ...curr.filter((exp) => exp.id !== row.id)].sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt)));
  };

  const dropExpensesLocal = (ids: string[]) => {
    const gone = new Set(ids);
    ids.forEach((id) => hiddenExpenseIds.current.add(id));
    setExpenses((curr) => curr.filter((exp) => !gone.has(exp.id)));
    setSelectedIds((curr) => curr.filter((id) => !gone.has(id)));
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !bookId) return;
    setIsSaving(true);
    const finalCategory = category === '__custom__' ? customCatInput.trim() : category;
    if (!finalCategory) {
      setIsSaving(false);
      addToast('Please specify a category', 'error');
      return;
    }

    const lockBefore = String(book.lockBefore || '');
    if (lockBefore && entryDate && entryDate < lockBefore) {
      setIsSaving(false);
      addToast(`This ledger is locked before ${lockBefore}.`, 'error');
      return;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = entryType === 'out' ? Number(amount || 0) : 0;
    if (wouldBreakDailyCap(expenses, cap, extra, entryDate) && !window.confirm(`This would go past the daily cap of ${getCurrencySymbol(book.currency)}${cap.toLocaleString()}. Record anyway?`)) {
      setIsSaving(false);
      return;
    }
    try {
      if (editingExpense) {
        const nextStatus = Number(amount) > 0 ? 'recorded' : 'draft';
        const updated = await updateExpense(bookId, editingExpense.id, {
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType: entryType,
          date: entryDate,
          merchant,
          paymentMethod,
          notes,
          reimbursable,
          billable,
          tags,
          status: nextStatus,
          lastEditedBy: userProfile?.displayName || currentUser?.email,
          lastEditedByUid: currentUser?.uid || '',
        });
        await persistLedgerCategory(finalCategory);
        applyExpenseLocal(updated || { ...editingExpense, amount: Number(amount), description, category: finalCategory, entryType, date: entryDate, merchant, paymentMethod, notes, reimbursable, billable, tags, status: nextStatus });
        addToast('Entry updated successfully!', 'success');
        setIsExpenseModalOpen(false);
        notifyTeamMembers('Edited an entry', `Updated ${entryType === 'in' ? 'money in' : 'money out'} for "${description}" to ${getCurrencySymbol(book.currency)} ${amount} in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} updated "${description}" to ${getCurrencySymbol(book.currency)}${amount} in ${book.name}`).catch(console.error);
      } else {
        const payload = {
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType: entryType,
          date: entryDate,
          merchant,
          paymentMethod,
          notes,
          reimbursable,
          billable,
          tags,
          paidByName: userProfile?.displayName || currentUser?.email,
          enteredBy: userProfile?.displayName || currentUser?.email,
          enteredByUid: currentUser?.uid || '',
          enteredByEmail: currentUser?.email || '',
          status: Number(amount) > 0 ? 'recorded' : 'draft',
        };
        let created: any = null;
        try {
          created = await createExpense(bookId, payload);
        } catch (err: any) {
          if (err?.status === 409 && window.confirm('A similar entry already exists on this ledger. Save it anyway?')) {
            created = await createExpense(bookId, payload, { force: true });
          } else {
            throw err;
          }
        }
        await persistLedgerCategory(finalCategory);
        if (created) applyExpenseLocal(created);
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
      addToast(err instanceof Error ? err.message : 'Error saving expense', 'error');
    } finally { setIsSaving(false); }
  };

  const handleDeleteExpense = async (id: string, description: string) => {
    if (!canWrite || !currentUser) return;
    if (confirm('Delete this entry?')) {
      setIsDeleting(id);
      const gone = expenses.find((row) => row.id === id);
      dropExpensesLocal([id]);
      if (gone) setLastDeleted(gone);
      try {
        await softDeleteExpense(bookId, id);
        await notifyTeamMembers('Deleted an entry', `Removed entry for "${description}"`, `${userProfile?.displayName || currentUser?.email} deleted "${description}" from ${book.name}`);
        addToast('Entry deleted.', 'success');
      } catch (err: any) {
        if (gone) applyExpenseLocal(gone);
        console.error("Delete failed:", err);
        addToast("Delete failed: " + err.message, 'error');
      } finally { setIsDeleting(null); }
    }
  };

  const refreshExpenses = async () => {
    if (!bookId) return;
    const rows = await listExpenses(bookId);
    setExpenses(rows
      .filter((row) => row && !row.deleted && !row.deletedAt && row.status !== 'deleted' && !hiddenExpenseIds.current.has(String(row.id)))
      .sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt)));
  };

  const duplicateExpense = async (exp: any) => {
    if (!canWrite || !bookId) return;
    setBulkBusy(exp.id);
    try {
      const created = await createExpense(bookId, {
        amount: Number(exp.amount || 0),
        description: `${exp.description || 'Entry'} (copy)`,
        category: exp.category || 'Uncategorized',
        entryType: exp.entryType || 'out',
        date: isoDay(),
        merchant: exp.merchant || '',
        paymentMethod: exp.paymentMethod || 'cash',
        notes: exp.notes || '',
        reimbursable: Boolean(exp.reimbursable),
        billable: Boolean(exp.billable),
        tags: exp.tags || '',
        paidByName: userProfile?.displayName || currentUser?.email,
        enteredBy: userProfile?.displayName || currentUser?.email,
        enteredByUid: currentUser?.uid || '',
        enteredByEmail: currentUser?.email || '',
        duplicatedFrom: exp.id,
      });
      applyExpenseLocal(created);
      addToast('Entry duplicated.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Could not duplicate that entry', 'error');
    } finally {
      setBulkBusy('');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((row) => row !== id) : [...curr, id]));
  };

  const runBulk = async (kind: 'delete' | 'reimburse' | 'category', categoryName?: string) => {
    if (!canWrite || !bookId || !selectedIds.length) return;
    if (kind === 'delete' && !confirm(`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'}?`)) return;
    setBulkBusy(kind);
    const ids = [...selectedIds];
    try {
      if (kind === 'delete') dropExpensesLocal(ids);
      for (const id of ids) {
        if (kind === 'delete') await softDeleteExpense(bookId, id);
        if (kind === 'reimburse') {
          const next = await updateExpense(bookId, id, { reimbursable: true });
          applyExpenseLocal(next || { ...(expenses.find((row) => row.id === id) || {}), id, reimbursable: true });
        }
        if (kind === 'category' && categoryName) {
          const next = await updateExpense(bookId, id, { category: categoryName });
          applyExpenseLocal(next || { ...(expenses.find((row) => row.id === id) || {}), id, category: categoryName });
        }
      }
      setSelectedIds([]);
      addToast(kind === 'delete' ? 'Selected entries deleted.' : 'Selected entries updated.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Bulk action failed', 'error');
    } finally {
      setBulkBusy('');
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
        await addLedgerMailEvent(bookId, {
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
        await addLedgerMailEvent(bookId, {
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
      const inviteId = await createLedgerInvite({
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
        wrapByjanEmailHtml({
          kicker: 'Invitation',
          title: `Join ${book.name} on Byjan`,
          intro: `You have been invited as ${inviteRole} to this expense ledger.`,
          rows: [
            { label: 'Ledger', value: String(book.name || '') },
            { label: 'Role', value: inviteRole },
            { label: 'Sign in as', value: inviteEmail.toLowerCase() },
          ],
          note: 'Open the invitation while signed in as the invited email. Sign out first if another account is already open on this device.',
          extraHtml: openInviteButtonHtml(inviteId),
        })
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
      const html = wrapByjanEmailHtml({
        kicker: 'Team announcement',
        title,
        intro: `From ${sender} on ${book.name}.`,
        note: `Send receipts to ${mailbox} and Byjan will record them for the team.`,
        extraHtml: `<div style="white-space:pre-wrap;font-size:15px;line-height:1.65;color:#334155;margin:8px 0 16px">${body.replace(/</g, '&lt;')}</div>${openLedgerButtonHtml(book.id, 'Open ledger')}`,
      });
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
    if (!confirm(`Delete ledger “${book.name}”?`)) return;
    setDeletingLedger(true);
    try {
      await softDeleteLedger(bookId);
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
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthOut = expenses.filter((e) => e.entryType !== 'in' && e.entryType !== 'transfer' && String(e.date || '').startsWith(monthKey)).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const reimbursableOpen = expenses.filter((e) => e.reimbursable).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const budget = Number(book.monthlyBudget || 0);
  
  const chartData = expenses.filter(e => e.entryType !== 'in' && e.entryType !== 'transfer').reduce((acc: any[], exp) => {
    const existing = acc.find(a => a.name === exp.category);
    if (existing) existing.total += exp.amount;
    else acc.push({ name: exp.category, total: exp.amount });
    return acc;
  }, []).sort((a, b) => b.total - a.total).slice(0, 5);

  
  // Filter and Pagination Logic
  const anomalySet = anomalyIds(expenses);
  const dupeSet = nearDupeIds(expenses);
  const staleSet = staleReimburseIds(expenses);
  const missingSet = missingReceiptIds(expenses);
  const watchSet = new Set(readWatchMerchants(book).map((name) => name.toLowerCase()));
  const q = searchQuery.trim().toLowerCase();
  const filteredExpenses = expenses.filter((exp) => {
    const hay = [exp.description, exp.category, exp.paidByName, exp.enteredBy, exp.merchant, exp.notes, exp.tags, exp.paymentMethod]
      .some((value) => String(value || '').toLowerCase().includes(q));
    if (q && !hay) return false;
    if (typeFilter !== 'all' && String(exp.entryType || 'out') !== typeFilter) return false;
    if (methodFilter !== 'all' && String(exp.paymentMethod || 'cash') !== methodFilter) return false;
    if (reimbursableOnly && !exp.reimbursable) return false;
    if (uncategorizedOnly) {
      const cat = String(exp.category || '').trim().toLowerCase();
      if (cat && cat !== 'uncategorized') return false;
    }
    const day = String(exp.date || '').slice(0, 10);
    if (dateFrom && day && day < dateFrom) return false;
    if (dateTo && day && day > dateTo) return false;
    if (hideTransfers && String(exp.entryType || '') === 'transfer') return false;
    if (flaggedOnly && !exp.flagged) return false;
    const amt = Number(exp.amount || 0);
    if (amountMin && amt < Number(amountMin)) return false;
    if (amountMax && amt > Number(amountMax)) return false;
    if (hideDrafts && exp.status === 'draft') return false;
    if (staleOnly && !staleSet.has(exp.id)) return false;
    if (anomalyOnly && !anomalySet.has(exp.id)) return false;
    if (missingOnly && !missingSet.has(exp.id)) return false;
    return true;
  });
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'amount') return (Number(a.amount || 0) - Number(b.amount || 0)) * dir;
    if (sortKey === 'description') return String(a.description || '').localeCompare(String(b.description || '')) * dir;
    if (sortKey === 'category') return String(a.category || '').localeCompare(String(b.category || '')) * dir;
    return String(a.date || a.createdAt || '').localeCompare(String(b.date || b.createdAt || '')) * dir;
  });
  const runningById = new Map<string, number>();
  let run = 0;
  [...filteredExpenses]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .forEach((exp) => {
      const amount = Number(exp.amount || 0);
      if (exp.entryType === 'in') run += amount;
      else if (exp.entryType !== 'transfer') run -= amount;
      runningById.set(exp.id, run);
    });
  const filterIn = filteredExpenses.filter((e) => e.entryType === 'in').reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const filterOut = filteredExpenses.filter((e) => e.entryType !== 'in' && e.entryType !== 'transfer').reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / itemsPerPage));
  const paginatedExpenses = sortedExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };
  const activeFilterCount = [
    searchQuery.trim(),
    typeFilter !== 'all',
    methodFilter !== 'all',
    dateFrom,
    dateTo,
    reimbursableOnly,
    uncategorizedOnly,
    hideTransfers,
    flaggedOnly,
    hideDrafts,
    staleOnly,
    anomalyOnly,
    missingOnly,
    amountMin,
    amountMax,
  ].filter(Boolean).length;

  const applyPeriod = (kind: string) => {
    if (period === kind) {
      setPeriod('');
      setDateFrom('');
      setDateTo('');
      return;
    }
    const next = periodRange(kind);
    setPeriod(kind);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setPeriod('');
    setReimbursableOnly(false);
    setUncategorizedOnly(false);
    setHideTransfers(false);
    setFlaggedOnly(false);
    setHideDrafts(false);
    setStaleOnly(false);
    setAnomalyOnly(false);
    setMissingOnly(false);
    setAmountMin('');
    setAmountMax('');
  };

  return (
    <>
      <div className="h-full min-h-0 flex flex-col">
      <Tabs.Root value={ledgerTab} onValueChange={setLedgerTab} className="h-full min-h-0 flex flex-col">
        <div className="shrink-0 px-4 md:px-6 lg:px-8 pt-2 pb-2 byjan-glass border-b border-white/50">
        <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/expenses" className="p-1 text-slate-400 hover:text-slate-700" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-base font-bold text-slate-900 truncate">{book.name}</h1>
          <button type="button" onClick={() => void togglePinned()} className="p-1 text-slate-400 hover:text-[#0B1F3A]" title={book.pinned ? 'Unpin ledger' : 'Pin ledger'}>
            {book.pinned ? <Pin className="w-4 h-4 text-[#12B8A8]" /> : <PinOff className="w-4 h-4" />}
          </button>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-700 uppercase border border-zinc-100">
            {myRole}
          </span>
        </div>
          <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAnnounceOpen(true)}
            className="byjan-btn-ghost !px-2 !py-1.5 hidden lg:inline-flex"
            title="Send an announcement to this ledger team"
          >
            <Megaphone className="w-4 h-4 text-slate-400" />
            <span>Announce</span>
          </button>
          <button 
            onClick={() => setIsMembersModalOpen(true)}
            className="byjan-btn-ghost !px-2 !py-1.5"
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
              type="button"
              data-add-entry
              onClick={openNewExpense}
              className="byjan-btn !px-3 sm:!px-4 !py-1.5"
              title="Add entry (N)"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Entry</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
          </div>
        </div>

        <Tabs.List className="flex gap-5 border-b border-slate-200/60 overflow-x-auto">
          <Tabs.Trigger value="ledger" className="pb-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Ledger
          </Tabs.Trigger>
          <Tabs.Trigger value="email" className="pb-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Email
          </Tabs.Trigger>
          <Tabs.Trigger value="analytics" className="pb-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Analytics
          </Tabs.Trigger>
          <Tabs.Trigger value="audit" className="pb-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 data-[state=active]:text-[#0B1F3A] data-[state=active]:border-b-2 data-[state=active]:border-[#12B8A8] transition-colors whitespace-nowrap">
            Audit
          </Tabs.Trigger>
        </Tabs.List>

        {ledgerTab === 'ledger' && (
          <div className="mt-2 space-y-2">
            <div className="byjan-stat-grid">
              <div className="byjan-stat">
                <p className="byjan-stat-label">Net</p>
                <p className={cn('byjan-stat-value byjan-money', balance >= 0 ? 'text-emerald-700' : 'text-slate-800')}>{balance < 0 ? '−' : ''}{getCurrencySymbol(book.currency)}{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="byjan-stat">
                <p className="byjan-stat-label">Out</p>
                <p className="byjan-stat-value byjan-money text-slate-800">{getCurrencySymbol(book.currency)}{totalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="byjan-stat">
                <p className="byjan-stat-label">In</p>
                <p className="byjan-stat-value byjan-money text-slate-800">{getCurrencySymbol(book.currency)}{totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="byjan-stat">
                <p className="byjan-stat-label">Month</p>
                <p className="byjan-stat-value byjan-money text-[#0B1F3A]">{getCurrencySymbol(book.currency)}{monthOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {(budget > 0 || reimbursableOpen > 0 || isAuditor) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {budget > 0 && (
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', monthOut > budget ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-50 border-slate-200')}>
                    Budget left {getCurrencySymbol(book.currency)}{(budget - monthOut).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
                {reimbursableOpen > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-800 bg-amber-50 border-amber-200">
                    Reimbursable {getCurrencySymbol(book.currency)}{reimbursableOpen.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
                {isAuditor && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-800 bg-amber-50 border-amber-200">Read-only</span>}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <label className="byjan-search flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="search"
                  placeholder="Search entries"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-700" title="Clear search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
              <button
                type="button"
                ref={filterBtnRef}
                className="byjan-btn-ghost !h-9 !px-2.5 relative"
                onClick={toggleFilters}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0B1F3A] text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button type="button" onClick={downloadPdf} disabled={exportingPdf} className="byjan-btn-ghost !h-9 !px-2.5" title="Download PDF">
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              <button type="button" onClick={emailReport} disabled={sendingReport} className="byjan-btn-ghost !h-9 !px-2.5" title="Email report">
                {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="byjan-btn-ghost !h-9 !px-2.5" title="Columns">
                    <Settings2 className="w-4 h-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" className="w-48 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Columns</div>
                    {Object.keys(visibleColumns).map((col) => (
                      <DropdownMenu.CheckboxItem
                        key={col}
                        checked={visibleColumns[col as keyof typeof visibleColumns]}
                        onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, [col]: checked }))}
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
        )}
        </div>
        </div>

        {filtersOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setFiltersOpen(false)} />
            <div
              className="fixed z-[70] byjan-panel p-3.5 space-y-3"
              style={{ top: filterPos.top, left: filterPos.left, width: filterPos.width }}
              role="dialog"
              aria-label="Filters"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Filters</p>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters} className="text-xs font-semibold text-slate-500 hover:text-[#0B1F3A]">Clear all</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="byjan-chip" data-on={period === 'week'} onClick={() => applyPeriod('week')}>This week</button>
                <button type="button" className="byjan-chip" data-on={period === 'month'} onClick={() => applyPeriod('month')}>This month</button>
                <button type="button" className="byjan-chip" data-on={period === '30'} onClick={() => applyPeriod('30')}>Last 30 days</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="byjan-filter w-full">
                  <option value="all">All types</option>
                  <option value="out">Money out</option>
                  <option value="in">Money in</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="byjan-filter w-full">
                  <option value="all">All methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                  <option value="wallet">Wallet</option>
                </select>
                <input type="date" value={dateFrom} onChange={(e) => { setPeriod(''); setDateFrom(e.target.value); }} className="byjan-filter w-full" title="From date" />
                <input type="date" value={dateTo} onChange={(e) => { setPeriod(''); setDateTo(e.target.value); }} className="byjan-filter w-full" title="To date" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="byjan-chip" data-on={reimbursableOnly} onClick={() => setReimbursableOnly((v) => !v)}>Reimbursable</button>
                <button type="button" className="byjan-chip" data-on={uncategorizedOnly} onClick={() => setUncategorizedOnly((v) => !v)}>Uncategorized</button>
              </div>
            </div>
          </>,
          document.body
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 lg:px-8 py-2">
        <div className="max-w-6xl mx-auto">
        <Tabs.Content value="ledger" className="outline-none">
          <LedgerTools
            bookId={bookId!}
            book={book}
            canWrite={canWrite}
            categories={categoryOptions}
            merchants={Array.from<string>(new Set(expenses.map((exp) => String(exp.merchant || '').trim()).filter((name) => name.length > 0))).slice(0, 40)}
            currencySymbol={getCurrencySymbol(book.currency)}
            enteredBy={String(userProfile?.displayName || currentUser?.email || '')}
            enteredByUid={currentUser?.uid || ''}
            enteredByEmail={currentUser?.email || ''}
            expenses={expenses}
            onBook={(next) => setBook(next)}
            onRefresh={refreshExpenses}
            onAdded={applyExpenseLocal}
            onRemoved={dropExpensesLocal}
            onToast={(message, kind) => addToast(message, kind || 'success')}
          />
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <LedgerStudio
              bookId={bookId!}
              book={book}
              bookName={book.name}
              canWrite={canWrite}
              canManage={canManageUsers}
              categories={categoryOptions}
              currencySymbol={getCurrencySymbol(book.currency)}
              expenses={expenses}
              filtered={filteredExpenses}
              selected={expenses.filter((exp) => selectedIds.includes(exp.id))}
              enteredBy={String(userProfile?.displayName || currentUser?.email || '')}
              enteredByUid={currentUser?.uid || ''}
              enteredByEmail={currentUser?.email || ''}
              onBook={(next) => setBook(next)}
              onRefresh={refreshExpenses}
              onAdded={applyExpenseLocal}
              onRemoved={dropExpensesLocal}
              onPatched={applyExpenseLocal}
              onToast={(message, kind) => addToast(message, kind || 'success')}
              amountMin={amountMin}
              amountMax={amountMax}
              onAmountMin={setAmountMin}
              onAmountMax={setAmountMax}
              hideTransfers={hideTransfers}
              onHideTransfers={setHideTransfers}
              flaggedOnly={flaggedOnly}
              onFlaggedOnly={setFlaggedOnly}
              hideDrafts={hideDrafts}
              onHideDrafts={setHideDrafts}
              staleOnly={staleOnly}
              onStaleOnly={setStaleOnly}
              anomalyOnly={anomalyOnly}
              onAnomalyOnly={setAnomalyOnly}
              missingOnly={missingOnly}
              onMissingOnly={setMissingOnly}
              privacy={privacy}
              onPrivacy={setPrivacy}
              onCopyFilterLink={() => {
                const params = new URLSearchParams();
                if (searchQuery) params.set('q', searchQuery);
                if (dateFrom) params.set('from', dateFrom);
                if (dateTo) params.set('to', dateTo);
                if (amountMin) params.set('min', amountMin);
                if (amountMax) params.set('max', amountMax);
                if (typeFilter !== 'all') params.set('type', typeFilter);
                const next = `${window.location.origin}${window.location.pathname}#/book/${bookId}${params.toString() ? `?${params}` : ''}`;
                void navigator.clipboard.writeText(next);
                addToast('Filter link copied.', 'success');
              }}
              onRepeatLast={() => {
                const last = expenses[0];
                if (last) void duplicateExpense(last);
              }}
            />
            {lastDeleted && canWrite && (
              <button
                type="button"
                data-undo-remove
                className="byjan-chip"
                onClick={async () => {
                  const restored = lastDeleted;
                  applyExpenseLocal(restored);
                  setLastDeleted(null);
                  try {
                    await updateExpense(bookId!, String(restored.id), { deleted: false, deletedAt: null, status: restored.status || 'recorded' });
                    addToast('Entry restored.', 'success');
                  } catch (err: any) {
                    dropExpensesLocal([String(restored.id)]);
                    setLastDeleted(restored);
                    addToast(err?.message || 'Could not restore that entry', 'error');
                  }
                }}
              >
                Undo
              </button>
            )}
          </div>
          {selectedIds.length > 0 && canWrite && createPortal(
            <div className="byjan-select-dock">
              <span className="text-xs font-semibold text-slate-600">{selectedIds.length} selected</span>
              <button type="button" className="byjan-chip" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('reimburse')}>Mark reimbursable</button>
              <select
                className="byjan-filter !h-8 !w-auto"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) void runBulk('category', e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Move category</option>
                {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button type="button" className="byjan-chip" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('delete')}>Delete</button>
              <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => setSelectedIds([])}>Clear</button>
            </div>,
            document.body,
          )}
          {filteredExpenses.length > 0 && (
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}
              <span className="text-emerald-600"> · In {getCurrencySymbol(book.currency)}{filterIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span> · Out {getCurrencySymbol(book.currency)}{filterOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
          )}

          {/* Data Table */}
          <div className="byjan-table flex flex-col">
            
            {/* Desktop / Tablet View */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                <thead>
                  <tr className="bg-white/40 border-b border-white/50">
                    {canWrite && (
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          aria-label="Select page"
                          checked={paginatedExpenses.length > 0 && paginatedExpenses.every((exp) => selectedIds.includes(exp.id))}
                          onChange={(e) => {
                            const ids = paginatedExpenses.map((exp) => exp.id);
                            setSelectedIds((curr) => e.target.checked ? Array.from(new Set([...curr, ...ids])) : curr.filter((id) => !ids.includes(id)));
                          }}
                        />
                      </th>
                    )}
                    <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('description')} className="inline-flex items-center gap-1 hover:text-[#0B1F3A]">
                        Description <ArrowUpDown className="w-3 h-3" />{sortKey === 'description' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    {visibleColumns.date && (
                      <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 hover:text-[#0B1F3A]">
                          Date <ArrowUpDown className="w-3 h-3" />{sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                    )}
                    {visibleColumns.category && (
                      <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <button type="button" onClick={() => toggleSort('category')} className="inline-flex items-center gap-1 hover:text-[#0B1F3A]">
                          Category <ArrowUpDown className="w-3 h-3" />{sortKey === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                    )}
                    {visibleColumns.merchant && <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Merchant</th>}
                    {visibleColumns.method && <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Method</th>}
                    {visibleColumns.author && <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Author</th>}
                    {visibleColumns.amount && (
                      <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">
                        <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 ml-auto hover:text-[#0B1F3A]">
                          Amount <ArrowUpDown className="w-3 h-3" />{sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                    )}
                    {visibleColumns.balance && <th className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Running</th>}
                    {canWrite && <th className="px-3.5 py-2 w-16 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.length === 0 ? (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-slate-500">No entries found matching your criteria.</td></tr>
                  ) : (
                    paginatedExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className={cn(
                          'hover:bg-white/40 transition-colors group',
                          exp.flagged && 'byjan-row-flag',
                          anomalySet.has(exp.id) && 'byjan-row-anomaly',
                          dupeSet.has(exp.id) && 'byjan-row-dupe',
                          watchSet.has(String(exp.merchant || '').toLowerCase()) && 'byjan-row-watch',
                        )}
                      >
                        {canWrite && (
                          <td className="px-3 py-2">
                            <input type="checkbox" aria-label={`Select ${exp.description}`} checked={selectedIds.includes(exp.id)} onChange={() => toggleSelected(exp.id)} />
                          </td>
                        )}
                        <td className="px-3.5 py-2 font-medium text-slate-900 text-sm max-w-xs truncate" title={exp.description}>
                          <span className="inline-flex items-center gap-1.5">
                            {exp.receiptPath && (
                              <button
                                type="button"
                                onClick={() => void openReceipt(exp)}
                                disabled={openingReceiptId === exp.id}
                                className="text-teal-700 hover:text-teal-900 disabled:opacity-70"
                                title="Open attachment"
                              >
                                {openingReceiptId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {exp.description}
                            {exp.status === 'draft' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Needs review</span>
                            )}
                          </span>
                        </td>
                        {visibleColumns.date && <td className="px-3.5 py-2 text-slate-500 text-sm">{expenseDateLabel(exp)}</td>}
                        {visibleColumns.category && (
                          <td className="px-3.5 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {exp.category}
                            </span>
                          </td>
                        )}
                        {visibleColumns.merchant && <td className="px-3.5 py-2 text-slate-600 text-sm truncate max-w-[140px]" title={exp.merchant || ''}>{exp.merchant || '—'}</td>}
                        {visibleColumns.method && <td className="px-3.5 py-2 text-slate-500 text-sm capitalize">{exp.paymentMethod || 'cash'}</td>}
                        {visibleColumns.author && <td className="px-3.5 py-2 text-slate-600 text-sm truncate max-w-[120px]" title={`Entered by: ${exp.enteredBy || exp.paidByName}${exp.lastEditedBy ? '\nLast edited by: ' + exp.lastEditedBy : ''}`}>{exp.enteredBy || exp.paidByName}</td>}
                        {visibleColumns.amount && (
                          <td className="px-3.5 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-bold">
                              {exp.entryType === 'in' ? (
                                <span className="byjan-money text-emerald-700">+{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : exp.entryType === 'transfer' ? (
                                <span className="text-blue-600">{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              ) : (
                                <span className="text-slate-900">-{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.balance && (
                          <td className="px-3.5 py-2 text-right text-sm font-semibold text-slate-600">
                            {getCurrencySymbol(book.currency)} {Number(runningById.get(exp.id) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        )}
                        {canWrite && (
                          <td className="px-3.5 py-2 text-right">
                            <div className="flex items-center justify-end gap-2 text-slate-400">
                              <button
                                type="button"
                                onClick={() => void updateExpense(bookId!, exp.id, { flagged: !exp.flagged }).then(() => refreshExpenses())}
                                className={cn('p-1 rounded transition-colors', exp.flagged ? 'text-amber-500' : 'hover:text-zinc-600 hover:bg-white/70')}
                                title={exp.flagged ? 'Unflag' : 'Flag'}
                              >
                                <Star className="w-4 h-4" fill={exp.flagged ? 'currentColor' : 'none'} />
                              </button>
                              <button onClick={() => void duplicateExpense(exp)} disabled={bulkBusy === exp.id} className="p-1 hover:text-zinc-600 hover:bg-white/70 rounded transition-colors" title="Duplicate">
                                {bulkBusy === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
                              </button>
                              <button onClick={() => openEditExpense(exp)} className="p-1 hover:text-zinc-600 hover:bg-white/70 rounded transition-colors" title="Edit">
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
            <div className="md:hidden flex flex-col gap-3 p-3 bg-white/30">
              {paginatedExpenses.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">No entries found.</div>
              ) : (
                paginatedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className={cn(
                      'p-2.5 byjan-card flex flex-col gap-1.5',
                      exp.flagged && 'byjan-row-flag',
                      anomalySet.has(exp.id) && 'byjan-row-anomaly',
                    )}
                  >
                    <div className="flex justify-between items-start gap-2">
                      {canWrite && (
                        <input type="checkbox" className="mt-1" aria-label={`Select ${exp.description}`} checked={selectedIds.includes(exp.id)} onChange={() => toggleSelected(exp.id)} />
                      )}
                      <div className="font-semibold text-slate-900 text-[14px] leading-tight flex-1">
                        {exp.description}
                        {exp.status === 'draft' && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Needs review</span>
                        )}
                      </div>
                      <div className={cn("byjan-money font-semibold text-[14px] whitespace-nowrap", exp.entryType === 'in' ? "text-emerald-700" : "text-slate-900")}>{exp.entryType === 'in' ? '+' : exp.entryType === 'transfer' ? '' : '−'}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">{expenseDateLabel(exp)}{exp.merchant ? ` · ${exp.merchant}` : ''}</span>
                        <span className="flex items-center gap-1.5">{exp.category || 'Uncategorized'}{exp.paymentMethod ? ` · ${exp.paymentMethod}` : ''}</span>
                        <span className="flex items-center gap-1.5">{exp.enteredBy || exp.paidByName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {canWrite && (
                          <>
                            {exp.receiptPath && (
                              <button
                                type="button"
                                onClick={() => void openReceipt(exp)}
                                disabled={openingReceiptId === exp.id}
                                className="p-1.5 bg-slate-50 text-slate-500 hover:text-teal-700 rounded-md border border-slate-200 disabled:opacity-70"
                                title="Open attachment"
                              >
                                {openingReceiptId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void updateExpense(bookId!, exp.id, { flagged: !exp.flagged }).then(() => refreshExpenses())}
                              className={cn('p-1.5 rounded-md border min-w-9 min-h-9', exp.flagged ? 'text-amber-500 border-amber-200 bg-amber-50' : 'bg-white/70 text-slate-500 border-white/70')}
                              title={exp.flagged ? 'Unflag' : 'Flag'}
                            >
                              <Star className="w-3.5 h-3.5" fill={exp.flagged ? 'currentColor' : 'none'} />
                            </button>
                            <button onClick={() => void duplicateExpense(exp)} disabled={bulkBusy === exp.id} className="p-1.5 bg-white/70 text-slate-500 hover:text-zinc-600 rounded-md border border-white/70 min-w-9 min-h-9">
                              {bulkBusy === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => openEditExpense(exp)} className="p-1.5 bg-white/70 text-slate-500 hover:text-zinc-600 rounded-md border border-white/70 min-w-9 min-h-9">
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
                onClick={downloadCsv}
                className="byjan-btn w-full"
              >
                Download CSV Ledger
              </button>
            </div>
          </div>
          {canManageUsers && (
            <div className="byjan-card p-5">
              <h3 className="font-semibold text-sm text-slate-900 mb-2">Monthly spend budget</h3>
              <p className="text-xs text-slate-500 mb-3">Compares money-out this calendar month against a target you set for this ledger.</p>
              <div className="flex gap-2">
                <input className="byjan-input" type="number" min={0} step="0.01" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="0.00" />
                <button type="button" className="byjan-btn" onClick={() => void saveMonthlyBudget()}>Save</button>
              </div>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="audit" className="outline-none space-y-3">
          <div className="byjan-card p-4">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" /> Ledger audit
            </h3>
            <p className="text-xs text-slate-500 mt-1">Who added, edited, or invited people on this ledger.</p>
          </div>
          {auditLoading ? (
            <AppLoader title="Audit" message="Loading ledger activity." />
          ) : auditEvents.length === 0 ? (
            <div className="byjan-card p-8 text-center text-sm text-slate-500">No audit events yet for this ledger.</div>
          ) : (
            <div className="space-y-2">
              {auditEvents.map((event, idx) => (
                <article key={String(event.id || idx)} className="byjan-card p-4">
                  <p className="text-sm font-semibold text-slate-900">{String(event.action || 'Event')}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {String(event.actorEmail || event.actorUid || 'Someone')}
                    <span className="text-slate-300 px-1.5">·</span>
                    {event.createdAt ? new Date(String(event.createdAt)).toLocaleString() : '—'}
                  </p>
                  {event.entityType ? <p className="text-xs text-slate-500 mt-1">{String(event.entityType)} {event.entityId ? `· ${String(event.entityId)}` : ''}</p> : null}
                </article>
              ))}
            </div>
          )}
        </Tabs.Content>
        </div>
        </div>
      </Tabs.Root>

      {/* Expense Edit/Add Modal */}
      <Dialog.Root open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" />
          <Dialog.Content className="byjan-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-5 max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="byjan-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="byjan-input">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank transfer</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant / payee</label>
                <input list="entry-merchants" type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} className="byjan-input" placeholder="e.g. Amazon, landlord" />
                <datalist id="entry-merchants">
                  {Array.from(new Set(expenses.map((exp) => String(exp.merchant || '').trim()).filter(Boolean))).slice(0, 40).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tags</label>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="byjan-input" placeholder="Comma-separated, e.g. trip, gst" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="byjan-input min-h-[72px]" placeholder="Internal notes" />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={reimbursable} onChange={(e) => setReimbursable(e.target.checked)} />
                  Reimbursable
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
                  Billable to client
                </label>
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
          imageUrl={receiptPreview.url || null}
          expenseTitle={receiptPreview.title}
          kind={receiptPreview.kind}
          fileName={receiptPreview.fileName}
          loading={!receiptPreview.url && Boolean(openingReceiptId)}
          verified={false}
          onClose={() => {
            if (receiptPreview.url) URL.revokeObjectURL(receiptPreview.url);
            setReceiptPreview(null);
            setOpeningReceiptId(null);
          }}
        />
      )}

      {/* Toast Notification */}

      </div>
    </>
  );
}
