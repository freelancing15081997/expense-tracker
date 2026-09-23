import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { useToast } from '../context/ToastContext';
import { toUserMessage } from '../lib/user-message';
import {
  addLedgerMailEvent,
  ensureLedgerMailbox,
  getLedger,
  forgetLedger,
  listLedgerAudit,
  listLedgerMail,
  removeLedgerMember,
  softDeleteLedger,
  updateLedger,
} from '../lib/ledgers';
import { createExpense, listExpenses, softDeleteExpense, updateExpense } from '../lib/expenses';
import { notifyLedgerMembers } from '../lib/notify-team';
import { CapacitorService, isWeb } from '../lib/capacitor';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, ArrowLeft, Plus, Trash2, Users, UserPlus, X, PenSquare, FileText, FileUp, LogOut, UserMinus, Search, Download, Settings2, ChevronLeft, ChevronRight, ChevronDown, Send, Copy, CopyPlus, Paperclip, Mail, Megaphone, Shield, Pin, PinOff, SlidersHorizontal, ArrowUpDown, Star, Wallet, ArrowUpRight, ArrowDownRight, Receipt, History, PieChart, Split, MoreHorizontal, CalendarClock, Check, Calendar, CreditCard, Landmark, Tag, StickyNote, Store, User as UserIcon, QrCode, Eye } from 'lucide-react';
import UpiQrPaySheet from '../components/UpiQrPaySheet';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import ReportsDashboard from '../components/money/ReportsDashboard';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currency';
import { CategoryBadge, CategoryIconMark, EntryFieldLabel, ENTRY_FIELD_ICONS, MONEY_KIND_VISUAL, categoryVisual } from '../lib/category-icons';
import { categoryForQuickAction, getPurposeTemplate, purposeFieldMeta, quickActionLabel, type QuickActionId } from '../lib/purpose-templates';
import { suggestBookEvolution } from '../lib/book-evolution';
import { bookInboundAddress, ledgerAppLink, openInviteButtonHtml, openLedgerButtonHtml, wrapByjanEmailHtml } from '../lib/inbound-mail';
import { createLedgerInvite, memberEmails } from '../lib/invites';
import { EMAIL_NOTIFY_HINT, isValidNotifyEmail, normalizeEmail } from '../lib/email';
import { apiUrl, apiPost } from '../lib/api';
import { savePdfBase64, saveTextFile, safeFileName } from '../lib/save-file';
import { authHeaders } from '../lib/auth-client';
import { ReceiptModal, attachmentKind } from '../components/ReceiptModal';
import { EventMailTrack, emailStatusClass, emailStatusLabel, resolvedStatus } from '../components/EmailActivityFlow';
import { ListControls, ListPager, usePagedList } from '../components/ListControls';
import AppLoader from '../components/AppLoader';
import { MoneyBookScreenSkeleton } from '../components/money/MoneySkeletons';
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
import { roleLabel } from '../lib/plain-language';
import { MONEY_KIND_OPTIONS, newMoneyId, readAccounts, readSettlements, readUserRules, toPaise, type TxType } from '../lib/money-core';
import { buildEvidenceTrail, learnRuleFromCorrection } from '../lib/money-helpers';
import { uploadLedgerReceipt } from '../lib/money-receipts';
import { RECEIPT_FILE_ACCEPT } from '../lib/receipt-fields';
import { buildEqualPersonSplits, formatSettlementLine, peopleFromBook, suggestSettlements } from '../lib/money-splits';
import { enqueueOfflineExpense, flushOfflineQueue, isLikelyOfflineError, listOfflineQueue } from '../lib/money-offline';
import { buildCapturePreview } from '../lib/money-capture';
import CapturePreviewSheet from '../components/CapturePreviewSheet';
import ReceiptCaptureFlow, { type ManualFormDraft, type ReceiptLaunch } from '../components/ReceiptCaptureFlow';
import WebScanSheet, { type WebScanFile } from '../components/WebScanSheet';
import { confirmMismatchGold, reportParseMismatch } from '../lib/parse-feedback';
import SplitExpenseSheet from '../components/SplitExpenseSheet';
import SplitEntryPickSheet from '../components/SplitEntryPickSheet';
import { ENTRY_PAY_METHODS, UpiBrandMark } from '../components/UpiBrandMark';
import '../components/split-premium.css';
import SettlementsPanel from '../components/SettlementsPanel';
import PullToRefresh from '../components/money/PullToRefresh';
import VoiceEntrySheet from '../components/VoiceEntrySheet';
import { rememberMoneyBook } from '../components/ShareIntentListener';
import { guessCategoryFromText } from '../lib/bridge-automations';
import UpiSetupSheet from '../components/UpiSetupSheet';
import { ExpenseSuccessCard, MoneySheet } from '../components/money/MoneyUi';
import { readPendingCapture, clearPendingCapture } from '../components/ShareIntentListener';
import { CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
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

const BASE_CATEGORIES = [
  'Office Supplies', 'Software Subscriptions', 'Travel', 'Meals', 'Food', 'Fuel',
  'Groceries', 'Utilities', 'Health', 'Shopping', 'Housing', 'Education',
  'Insurance', 'Bills', 'Entertainment', 'Transfers', 'Income',
];

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

function expenseCreatedDay(exp: any): string {
  try {
    if (exp?.createdAt && typeof exp.createdAt.toDate === 'function') {
      return format(exp.createdAt.toDate(), 'yyyy-MM-dd');
    }
  } catch { /* pending */ }
  const raw = String(exp?.createdAt || '').trim();
  if (!raw) return '';
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return format(new Date(parsed), 'yyyy-MM-dd');
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return '';
}

function expensePaidDay(exp: any): string {
  const paid = String(exp?.paidAt || exp?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(paid)) return paid.slice(0, 10);
  return '';
}

function formatDayLabel(day: string) {
  if (!day) return '';
  try {
    return format(new Date(`${day}T12:00:00`), 'MMM dd, yyyy');
  } catch {
    return day;
  }
}

function dayHeading(day: string) {
  if (!day) return 'Other';
  const today = format(new Date(), 'yyyy-MM-dd');
  const yday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  if (day === today) return 'Today';
  if (day === yday) return 'Yesterday';
  return formatDayLabel(day);
}

function groupExpensesByDay<T extends { id?: string }>(rows: T[], keyFn: (row: T) => string) {
  const out: Array<{ day: string; label: string; rows: T[] }> = [];
  for (const row of rows) {
    const day = keyFn(row) || 'other';
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else out.push({ day, label: dayHeading(day === 'other' ? '' : day), rows: [row] });
  }
  return out;
}

/** Primary list date = when the record was created. Paid date shown separately. */
function expenseDateLabel(exp: any) {
  const created = expenseCreatedDay(exp);
  const paid = expensePaidDay(exp);
  if (created && paid && paid !== created) {
    return `${formatDayLabel(created)} · Paid ${formatDayLabel(paid)}`;
  }
  if (created) return formatDayLabel(created);
  if (paid) return `Paid ${formatDayLabel(paid)}`;
  return '';
}

function moneyKindMeta(entryType?: string, txType?: string) {
  const tx = String(txType || '').toUpperCase();
  if (tx === 'REFUND') return { label: 'Refund', cls: 'money-kind-in', sign: '+' };
  if (tx === 'REVERSAL') return { label: 'Reversal', cls: 'money-kind-out', sign: '−' };
  if (tx === 'CREDIT_CARD_PAYMENT') return { label: 'Card payment', cls: 'money-kind-xfer', sign: '' };
  if (tx === 'CASH_WITHDRAWAL') return { label: 'Cash out', cls: 'money-kind-xfer', sign: '' };
  if (tx === 'CASH_DEPOSIT') return { label: 'Cash in', cls: 'money-kind-in', sign: '+' };
  if (entryType === 'in') return { label: 'Money in', cls: 'money-kind-in', sign: '+' };
  if (entryType === 'transfer') return { label: 'Transfer', cls: 'money-kind-xfer', sign: '' };
  return { label: 'Money out', cls: 'money-kind-out', sign: '−' };
}

function entryEvidence(exp: any) {
  const trail = buildEvidenceTrail(exp || {});
  if (trail.length > 1) return trail.slice(0, 2).map((s) => s.detail).join(' · ');
  if (exp?.source === 'email') return 'Source: Email';
  if (exp?.receiptPath) return 'Receipt attached';
  if (exp?.status === 'draft') return 'Needs your confirm';
  return '';
}

export default function BookView() {
  const { bookId } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userProfile, refreshUserProfile } = useAuth();
  const { on: hasFeature } = useFeatures();
  const [book, setBook] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upiSetupOpen, setUpiSetupOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [qrPayOpen, setQrPayOpen] = useState(false);
  const [evolutionDismissed, setEvolutionDismissed] = useState(false);
  /** Latest Add/Scan/Voice handlers — FAB listener mounts before book loads, so use a ref. */
  const quickActionsRef = useRef<{
    scan: () => void | Promise<void>;
    add: () => void;
    voice: () => void;
    importDocs: () => void | Promise<void>;
  }>({
    scan: () => undefined,
    add: () => undefined,
    voice: () => setVoiceOpen(true),
    importDocs: () => undefined,
  });
  // Quick action tapped while the book skeleton is still up — replay once handlers are live.
  const pendingQuickRef = useRef<'scan' | 'add' | 'voice' | 'pay' | 'import' | null>(null);
  const loadingRef = useRef(true);
  const scanBusyRef = useRef(false);
  
  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(() => Boolean((location.state as { openEntry?: boolean } | null)?.openEntry));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(() => Boolean((location.state as { openPeople?: boolean } | null)?.openPeople));
  const [inboundAddress, setInboundAddress] = useState('');
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [viewExpense, setViewExpense] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const editConfirmedRef = useRef(false);
  const [moreFields, setMoreFields] = useState(false);
  
  // Form State
  const [entryType, setEntryType] = useState<'in' | 'out' | 'transfer'>('out');
  const [txType, setTxType] = useState<TxType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCatInput, setCustomCatInput] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [merchantFocus, setMerchantFocus] = useState(false);
  const [purposeEntityType, setPurposeEntityType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [accountId, setAccountId] = useState('cash');
  const [notes, setNotes] = useState('');
  const [reimbursable, setReimbursable] = useState(false);
  const [billable, setBillable] = useState(false);
  const [splitWithTeam, setSplitWithTeam] = useState(false);
  const [tags, setTags] = useState('');
  const [receiptMeta, setReceiptMeta] = useState<{ receiptPath?: string; receiptName?: string } | null>(null);
  const [receiptOcrText, setReceiptOcrText] = useState('');
  const [mismatchThanks, setMismatchThanks] = useState('');
  const mismatchIdRef = useRef('');
  const [capturePreview, setCapturePreview] = useState<ReturnType<typeof buildCapturePreview> | null>(null);
  const [receiptLaunch, setReceiptLaunch] = useState<ReceiptLaunch | null>(null);
  const [webScanOpen, setWebScanOpen] = useState(false);
  const [successExpense, setSuccessExpense] = useState<Record<string, unknown> | null>(null);
  const [successCount, setSuccessCount] = useState(1);
  const [splitTarget, setSplitTarget] = useState<{ id: string; amount: number; merchant?: string; description?: string } | null>(null);
  const [splitPickOpen, setSplitPickOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileRef = useRef<HTMLInputElement | null>(null);
  const attachBusyRef = useRef(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reimbursableOnly, setReimbursableOnly] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Array<Record<string, unknown>>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [period, setPeriod] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const openedEntryRef = useRef('');
  const [filterPos, setFilterPos] = useState({ top: 56, left: 24, width: 400 });
  const [exportOpen, setExportOpen] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [exportPos, setExportPos] = useState({ top: 56, left: 24, width: 240 });
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSentTo, setInviteSentTo] = useState('');
  const [inviteRole, setInviteRole] = useState('contributor');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditBookOpen, setIsEditBookOpen] = useState(false);
  const [editBookName, setEditBookName] = useState('');
  const [savingBook, setSavingBook] = useState(false);
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

  useEffect(() => {
    if (searchParams.get('pay') && hasFeature('money_split_tab')) setLedgerTab('splits');
    const tab = String(searchParams.get('tab') || '').trim().toLowerCase();
    if (!tab) return;
    if (tab === 'splits' && hasFeature('money_split_tab')) setLedgerTab('splits');
    else if (tab === 'email' && hasFeature('money_email_tab')) setLedgerTab('email');
    else if (tab === 'reports' || tab === 'analytics') setLedgerTab('analytics');
    else if (tab === 'history' || tab === 'audit') setLedgerTab('audit');
    else if (tab === 'expenses' || tab === 'ledger') setLedgerTab('ledger');
  }, [searchParams, hasFeature]);

  const onLedgerTabChange = (next: string) => {
    setLedgerTab(next);
    if (!searchParams.get('tab') && !searchParams.get('pay')) return;
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    if (next !== 'splits') params.delete('pay');
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const entryId = String(searchParams.get('entry') || '').trim();
    if (!entryId || !expenses.length || openedEntryRef.current === entryId) return;
    const exp = expenses.find((row) => String(row.id) === entryId);
    if (!exp) return;
    openedEntryRef.current = entryId;
    // Deep links (inbox, search, notifications) open the read-only view first; Edit is one tap away.
    setViewExpense(exp);
    const next = new URLSearchParams(searchParams);
    next.delete('entry');
    setSearchParams(next, { replace: true });
  }, [searchParams, expenses, setSearchParams]);
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
  const [unsentEmailChange, setUnsentEmailChange] = useState<{action: string, detail: string} | null>(null);
  const navigate = useNavigate();

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
        setMonthlyBudget((next as any).monthlyBudget != null ? String((next as any).monthlyBudget) : '');
        setInboundAddress(bookInboundAddress(next));
        const isMember = next.isMember !== false && Boolean(next.roles?.[currentUser.uid]?.role || next.ownerId === currentUser.uid);
        if (!isMember) {
          setExpenses([]);
          setLoading(false);
          return;
        }
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
      if (!bookId || document.visibilityState !== 'visible') return;
      listExpenses(bookId).then((rows) => {
        if (!alive) return;
        setExpenses(rows
          .filter((row) => row && !row.deleted && !row.deletedAt && row.status !== 'deleted' && !hiddenExpenseIds.current.has(String(row.id)))
          .sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt)));
      }).catch(() => undefined);
    }, 45000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [bookId, currentUser?.uid]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, typeFilter, personFilter, dateFrom, dateTo, methodFilter, categoryFilter, period, reimbursableOnly, uncategorizedOnly, hideTransfers, flaggedOnly, amountMin, amountMax, hideDrafts, staleOnly, anomalyOnly, missingOnly]);

  useEffect(() => {
    if (bookId) rememberMoneyBook(bookId);
  }, [bookId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if (params.get('setupUpi') === '1' || params.get('upi') === '1') {
      setUpiSetupOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    skipFilterSave.current = true;
    if (!bookId) return;
    try {
      const raw = sessionStorage.getItem(`byjan.ledger.filters.${bookId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.searchQuery === 'string') setSearchQuery(saved.searchQuery);
      if (typeof saved.typeFilter === 'string') setTypeFilter(saved.typeFilter);
      if (typeof saved.personFilter === 'string') setPersonFilter(saved.personFilter);
      if (typeof saved.methodFilter === 'string') setMethodFilter(saved.methodFilter);
      if (typeof saved.categoryFilter === 'string') setCategoryFilter(saved.categoryFilter);
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
      if (typeof saved.missingOnly === 'boolean') setMissingOnly(saved.missingOnly);
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
        searchQuery, typeFilter, personFilter, methodFilter, categoryFilter, dateFrom, dateTo, period, reimbursableOnly, uncategorizedOnly, sortKey, sortDir,
        hideTransfers, flaggedOnly, hideDrafts, staleOnly, anomalyOnly, missingOnly, amountMin, amountMax,
      }));
    } catch { /* ignore */ }
  }, [bookId, searchQuery, typeFilter, personFilter, methodFilter, categoryFilter, dateFrom, dateTo, period, reimbursableOnly, uncategorizedOnly, sortKey, sortDir, hideTransfers, flaggedOnly, hideDrafts, staleOnly, anomalyOnly, missingOnly, amountMin, amountMax]);

  useEffect(() => {
    if (bookId) touchRecentLedger(bookId);
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    setOfflineCount(listOfflineQueue(bookId).length);
    const pending = readPendingCapture();
    const wantsCapture = location.search.includes('capture=1');

    if (pending && (pending.imageDataUrl || pending.text)) {
      // Share with 2+ books must use Dashboard choose-book — never auto-save here
      // just because preferredBookId happens to match this book.
      if (pending.requireBookPick === true) {
        navigate(`/?capture=1&s=${Date.now().toString(36)}`, { replace: true });
        return;
      }

      const preferred = String(pending.preferredBookId || '');
      if (preferred && preferred !== bookId) {
        navigate(`/book/${preferred}?capture=1&s=${Date.now().toString(36)}`, { replace: true });
        return;
      }

      if (pending.batch && pending.batch.length > 1) {
        setReceiptLaunch({
          source: pending.source || 'share',
          batch: pending.batch,
          text: pending.text,
          preferredBookId: bookId,
          requireBookPick: false,
        });
        clearPendingCapture();
        if (wantsCapture) navigate(`/book/${bookId}`, { replace: true });
      } else if (pending.imageDataUrl || pending.mimeType) {
        setReceiptLaunch({
          text: pending.text,
          imageDataUrl: pending.imageDataUrl,
          fileName: pending.fileName,
          mimeType: pending.mimeType,
          source: pending.source || 'share',
          preferredBookId: bookId,
          requireBookPick: false,
        });
        clearPendingCapture();
        if (wantsCapture) navigate(`/book/${bookId}`, { replace: true });
      } else if (pending.text) {
        const preview = buildCapturePreview(pending.text, pending.source === 'share' ? 'share' : 'sms', expenses, [], readUserRules(book, currentUser?.uid || ''));
        setCapturePreview(preview);
        clearPendingCapture();
      }
    }

    const sync = async () => {
      const status = await Network.getStatus().catch(() => ({ connected: true }));
      if (!status.connected) return;
      const results = await flushOfflineQueue(bookId);
      const ok = results.filter((r) => r.ok);
      if (ok.length) {
        setOfflineCount(listOfflineQueue(bookId).length);
        addToast(`Synced ${ok.length} offline ${ok.length === 1 ? 'entry' : 'entries'}`, 'success');
        for (const row of ok) if (row.expense) applyExpenseLocal(row.expense);
      }
    };
    void sync();
    const handle = Network.addListener('networkStatusChange', (status) => {
      if (status.connected) void sync();
    });
    return () => { void handle.then((h) => h.remove()); };
  }, [bookId, location.search]);

  useEffect(() => {
    const st = location.state as {
      openPeople?: boolean;
      openEdit?: boolean;
      openEntry?: boolean;
      openVoice?: boolean;
      openScan?: boolean;
      openSplitPick?: boolean;
    } | null;
    if (st?.openPeople) setIsMembersModalOpen(true);
    if (st?.openEdit) {
      setEditBookName(String(book?.name || ''));
      setIsEditBookOpen(true);
    }
    if (st?.openEntry) setIsExpenseModalOpen(true);
    if (st?.openVoice) setVoiceOpen(true);
    if (st?.openScan) void scanReceiptEntry();
    if (st?.openPay) setQrPayOpen(true);
    if (st?.openSplitPick) {
      if (!String((userProfile as { upiId?: string } | null)?.upiId || '').trim()) {
        setUpiSetupOpen(true);
        addToast('Add your UPI ID before splitting — teammates need it to pay you.', 'error');
      } else {
        setSplitPickOpen(true);
      }
      // Clear one-shot navigation state so back/refresh does not reopen.
      try { navigate(location.pathname + location.search, { replace: true, state: {} }); } catch { /* ignore */ }
    }
  }, [location.state, bookId]);

  // Raised center + button on the tab bar fires these while a book is open.
  useEffect(() => {
    const onQuick = (event: Event) => {
      const kind = (event as CustomEvent<string>).detail;
      if (kind !== 'scan' && kind !== 'add' && kind !== 'voice' && kind !== 'pay' && kind !== 'import') return;
      // Book still loading → handlers below the early-return skeleton aren't bound yet. Queue it.
      if (loadingRef.current) {
        pendingQuickRef.current = kind;
        return;
      }
      if (kind === 'scan') void quickActionsRef.current.scan();
      else if (kind === 'add') quickActionsRef.current.add();
      else if (kind === 'pay') setQrPayOpen(true);
      else if (kind === 'import') void quickActionsRef.current.importDocs();
      else quickActionsRef.current.voice();
    };
    window.addEventListener('byjan-quick', onQuick);
    return () => window.removeEventListener('byjan-quick', onQuick);
  }, []);

  useEffect(() => {
    loadingRef.current = loading;
    if (loading || !pendingQuickRef.current) return;
    const kind = pendingQuickRef.current;
    pendingQuickRef.current = null;
    // Next tick so quickActionsRef has been re-assigned by the full render.
    const t = window.setTimeout(() => {
      if (kind === 'scan') void quickActionsRef.current.scan();
      else if (kind === 'add') quickActionsRef.current.add();
      else if (kind === 'pay') setQrPayOpen(true);
      else if (kind === 'import') void quickActionsRef.current.importDocs();
      else quickActionsRef.current.voice();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loading]);

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
        document.querySelector<HTMLInputElement>('[data-ledger-search]')?.focus();
        return;
      }
      if (typing) return;
      if (key === 'n') {
        if (!canWrite) return;
        event.preventDefault();
        openNewExpense();
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
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load();
    }, 30000);
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
    setExportOpen(false);
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

  const updateExportPos = useCallback(() => {
    const el = exportBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
    const panelH = 180;
    const below = r.bottom + 8;
    const top = below + panelH > window.innerHeight - 12
      ? Math.max(12, r.top - panelH - 8)
      : below;
    setExportPos({ top, left, width });
  }, []);

  const toggleExport = () => {
    setFiltersOpen(false);
    setExportOpen((open) => {
      if (!open) requestAnimationFrame(updateExportPos);
      return !open;
    });
  };

  useEffect(() => {
    if (!exportOpen) return;
    updateExportPos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('resize', updateExportPos);
    window.addEventListener('scroll', updateExportPos, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', updateExportPos);
      window.removeEventListener('scroll', updateExportPos, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportOpen, updateExportPos]);

  const merchantSuggestions = useMemo(() => {
    const needle = merchant.trim().toLowerCase();
    if (!needle) return [] as string[];
    const names: string[] = [];
    const seen = new Set<string>();
    for (const exp of expenses) {
      const name = String(exp.merchant || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower.includes(needle) && lower !== needle;
      })
      .slice(0, 8);
  }, [expenses, merchant]);

  if (loading) return <MoneyBookScreenSkeleton />;
  if (!book) return <div className="p-8 text-center text-sm text-slate-500">Book not found or access denied.</div>;

  const isActiveMember = Boolean(book.roles?.[currentUser!.uid]?.role) || book.ownerId === currentUser!.uid;
  if (!isActiveMember) {
    return (
      <div className="ios-page px-4 py-8 max-w-lg mx-auto">
        <Link to="/expenses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Books
        </Link>
        <div className="byjan-card p-5 space-y-3">
          <span className="inline-flex text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Not a member</span>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">{String(book.name || 'Money book')}</h1>
          <p className="text-sm text-slate-600 leading-relaxed">You are not a member of this book anymore. It can stay in your list until you remove it.</p>
          <button
            type="button"
            className="byjan-btn w-full"
            onClick={async () => {
              try {
                await forgetLedger(book.id);
                navigate('/expenses');
              } catch (err) {
                addToast(err instanceof Error ? err.message : 'Could not remove this book', 'error');
              }
            }}
          >
            Remove this book from my list
          </button>
        </div>
      </div>
    );
  }

  const myRole = book.roles?.[currentUser!.uid]?.role || (book.ownerId === currentUser!.uid ? 'owner' : 'viewer');
  const canWrite = ['owner', 'admin', 'contributor'].includes(myRole) && hasFeature('money_add');
  const canScan = ['owner', 'admin', 'contributor'].includes(myRole) && hasFeature('money_scan');
  const canVoice = ['owner', 'admin', 'contributor'].includes(myRole) && hasFeature('money_voice');
  const canDelete = ['owner', 'admin', 'contributor'].includes(myRole) && hasFeature('money_delete');
  const canManageUsers = ['owner', 'admin'].includes(myRole) && hasFeature('money_people');
  const canSplitTab = hasFeature('money_split') && hasFeature('money_split_tab');
  const canSplitEntry = hasFeature('money_split_entry');
  const canSplitEqual = hasFeature('money_split_equal');
  const canEmailTab = hasFeature('money_email') && hasFeature('money_email_tab');
  const canAnnounce = hasFeature('money_announce');
  const canBookReports = hasFeature('money_book_analytics') || hasFeature('money_reports');
  const canHistory = hasFeature('money_history');
  const canPin = hasFeature('money_pin');
  const canEmailReport = hasFeature('money_email_report');
  const canExport = hasFeature('money_export');
  const canLedgerSearch = hasFeature('money_search');
  const canFilters = hasFeature('money_filters');
  const canDuplicate = canWrite && hasFeature('money_duplicate');
  const canFlag = canWrite && hasFeature('money_flag');
  const canDeleteBook = myRole === 'owner' && hasFeature('money_delete_book');
  const canBudget = canManageUsers && hasFeature('money_budget');
  const isAuditor = myRole === 'auditor';
  const shownTab = (
    ledgerTab === 'splits' && !canSplitTab ? 'ledger'
      : ledgerTab === 'email' && !canEmailTab ? 'ledger'
        : ledgerTab === 'analytics' && !canBookReports ? 'ledger'
          : ledgerTab === 'audit' && !canHistory ? 'ledger'
            : ledgerTab
  );

  const expenseCategories = expenses.map((exp) => String(exp.category || '')).filter(Boolean);
  const ledgerCategories = Array.isArray(book.categories) ? book.categories.map(String) : [];
  const purposeId = String(book.purposeId || 'default');
  const purposeTpl = getPurposeTemplate(purposeId);
  const purposeFields = purposeFieldMeta(purposeTpl, book);
  const purposeQuickActions: QuickActionId[] = Array.isArray(book.quickActions) && book.quickActions.length
    ? (book.quickActions as QuickActionId[])
    : purposeTpl.quickActions;
  const evolution = !evolutionDismissed ? suggestBookEvolution(expenses, purposeId) : null;
  const configCats = book.purposeConfig && typeof book.purposeConfig === 'object' && Array.isArray((book.purposeConfig as { categories?: unknown }).categories)
    ? ((book.purposeConfig as { categories: unknown[] }).categories).map(String)
    : [];
  const categoryOptions = uniqueCategories(
    purposeTpl.categories,
    ledgerCategories,
    configCats,
    expenseCategories,
    userProfile?.customCategories,
    purposeId === 'default' ? BASE_CATEGORIES : [],
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

  const openNewExpense = (preset?: { category?: string; entryType?: 'in' | 'out' | 'transfer'; txType?: TxType; merchant?: string; description?: string; entityType?: string }) => {
    setEditingExpense(null);
    setEntryType(preset?.entryType || 'out');
    setTxType(preset?.txType || (preset?.entryType === 'in' ? 'INCOME' : 'EXPENSE'));
    setAmount('');
    setDescription(preset?.description || '');
    const presetCat = String(preset?.category || '').trim();
    setCategory(presetCat || categoryOptions[0] || 'Other');
    setCustomCatInput(presetCat && !categoryOptions.includes(presetCat) ? presetCat : '');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setMerchant(preset?.merchant || '');
    setPurposeEntityType(preset?.entityType || purposeFields.entities[0] || '');
    setPaymentMethod('cash');
    setAccountId(readAccounts(book)[0]?.id || 'cash');
    setNotes('');
    setReimbursable(false);
    setBillable(false);
    setSplitWithTeam(false);
    setTags('');
    setReceiptMeta(null);
    setReceiptOcrText('');
    setMismatchThanks('');
    mismatchIdRef.current = '';
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
      const res = await fetch(apiUrl(`/api/blob/file?path=${encodeURIComponent(exp.receiptPath)}`), { headers: await authHeaders() });
      if (!res.ok) throw new Error('Could not open attachment');
      const buf = await res.arrayBuffer();
      const fileName = String(exp.receiptName || exp.receiptPath.split('/').pop() || title);
      const blobType = res.headers.get('content-type') || '';
      const { sniffAttachmentKind, blobUrlForAttachment } = await import('../lib/receipt-preview');
      const kind = sniffAttachmentKind(buf, fileName, blobType);
      if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url);
      setReceiptPreview({
        url: blobUrlForAttachment(buf, kind, blobType),
        title,
        kind,
        fileName,
      });
    } catch (err: any) {
      setReceiptPreview(null);
      addToast(err?.message || 'Could not open attachment', 'error');
    } finally {
      setOpeningReceiptId(null);
    }
  };

  const pdfSafe = (value: unknown) => String(value ?? '')
    .replace(/₹/g, 'Rs ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, 140);

  const reportFileBase = () => safeFileName(String(book?.name || 'ledger'), 'ledger');

  const buildReportPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = pdfSafe(book?.name || 'Money book');
    const currency = pdfSafe(getCurrencySymbol(book?.currency) || book?.currency || 'INR') || 'INR';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Byjan report: ${title}`.slice(0, 80), 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Created ${new Date().toLocaleString()} · ${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'entry' : 'entries'}`, 14, 28);

    const tableData = filteredExpenses.map((exp) => [
      pdfSafe(expenseDateLabel(exp) || expensePaidDay(exp) || ''),
      pdfSafe(exp.description || exp.merchant || ''),
      pdfSafe(exp.category || ''),
      pdfSafe(exp.paidByName || exp.enteredBy || ''),
      `${currency} ${Number(exp.amount || 0).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 34,
      head: [['Date', 'Description', 'Category', 'Entered by', 'Amount']],
      body: tableData.length ? tableData : [['—', 'No entries in this filter', '—', '—', '—']],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 31, 58], textColor: 255 },
    });

    const dataUri = String(doc.output('datauristring') || '');
    const base64 = dataUri.split(',')[1] || '';
    if (!base64) throw new Error('Could not create the PDF');
    return { base64, fileName: `${reportFileBase()}_report.pdf` };
  };

  const downloadPdf = async () => {
    if (!canExport || exportingPdf) return;
    setExportOpen(false);
    setExportingPdf(true);
    try {
      const { base64, fileName } = buildReportPdf();
      const how = await savePdfBase64(fileName, base64, `${book?.name || 'Ledger'} report`);
      addToast('PDF downloaded.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not create the PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const emailReport = async () => {
    if (!currentUser?.email) {
      addToast('Sign in with an email address to send a report.', 'error');
      return;
    }
    if (sendingReport) return;
    setSendingReport(true);
    let built: { base64: string; fileName: string } | null = null;
    try {
      built = buildReportPdf();
      await apiPost('/api/email/send', {
        to: currentUser.email,
        subject: `${book?.name || 'Byjan'} money report`,
        message: `Here is the PDF report for ${book?.name || 'your money book'}.`,
        pdfBase64: built.base64,
        filename: built.fileName,
      });
      addToast(`Report emailed to ${currentUser.email}`, 'success');
    } catch (err) {
      try {
        if (!built) built = buildReportPdf();
        await savePdfBase64(built.fileName, built.base64, 'Share this report');
        addToast(err instanceof Error ? `${err.message}. Share the PDF from the sheet instead.` : 'Email failed. Share the PDF from the sheet instead.', 'error');
      } catch {
        addToast(err instanceof Error ? err.message : 'Could not send the report email', 'error');
      }
    } finally {
      setSendingReport(false);
    }
  };

  const openEditExpense = (exp: any) => {
    setEditingExpense(exp);
    setMoreFields(Boolean(exp.tags || exp.notes || exp.reimbursable || exp.billable || (Array.isArray(exp.personSplits) && exp.personSplits.length)));
    setEntryType(exp.entryType || exp.entryType || 'out');
    setTxType((exp.txType as TxType) || (exp.entryType === 'in' ? 'INCOME' : exp.entryType === 'transfer' ? 'TRANSFER' : 'EXPENSE'));
    setAmount(exp.amount == null ? '' : String(exp.amount));
    setDescription(exp.description);
    if (categoryOptions.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCatInput('');
    } else {
      setCategory('__custom__');
      setCustomCatInput(exp.category);
    }
    setEntryDate(String(exp.paidAt || exp.date || new Date().toISOString().split('T')[0]));
    setMerchant(String(exp.merchant || ''));
    setPurposeEntityType(String(exp.entityType || purposeFields.entities[0] || ''));
    setPaymentMethod(String(exp.paymentMethod || 'cash'));
    setAccountId(String(exp.accountId || 'cash'));
    setNotes(String(exp.notes || ''));
    setReimbursable(Boolean(exp.reimbursable));
    setBillable(Boolean(exp.billable));
    setSplitWithTeam(Array.isArray(exp.personSplits) && exp.personSplits.length > 0);
    setTags(String(exp.tags || ''));
    setReceiptMeta(exp.receiptPath ? { receiptPath: String(exp.receiptPath), receiptName: String(exp.receiptName || '') } : null);
    setIsExpenseModalOpen(true);
  };

  const downloadCsv = async () => {
    if (!canExport) return;
    setExportOpen(false);
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
    try {
      const how = await saveTextFile(`${reportFileBase()}-entries.csv`, csv, 'text/csv', `${book?.name || 'Ledger'} CSV`);
      addToast('CSV downloaded.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not save the CSV', 'error');
    }
  };

  const notifyTeamMembers = async (action: string, detail: string, customSubject?: string, htmlOverride?: string) => {
    await notifyLedgerMembers({
      roles: book.roles,
      actorUid: currentUser?.uid,
      bookId: bookId || book.id,
      bookName: book.name,
      action,
      detail,
      senderName: userProfile?.displayName || currentUser?.email,
      kind: htmlOverride ? 'announcement' : 'entry',
      ledgerMail: inboundAddress || bookInboundAddress(book),
      link: ledgerAppLink(bookId || book.id),
    });

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
        sendEmailNotification(email, subject, message, { action, silent: !htmlOverride }).catch(console.error);
      }
    }
  };

  const applyExpenseLocal = (row: Record<string, unknown> | null | undefined) => {
    if (!row?.id) return;
    hiddenExpenseIds.current.delete(String(row.id));
    const key = String(row.idempotencyKey || '');
    setExpenses((curr) => {
      const filtered = curr.filter((exp) => {
        if (String(exp.id) === String(row.id)) return false;
        if (key && (String(exp.id) === key || String(exp.idempotencyKey || '') === key)) return false;
        if (exp.offlineQueued && key && String(exp.idempotencyKey || exp.id) === key) return false;
        return true;
      });
      return [row, ...filtered].sort((a, b) => expenseMillis(b.createdAt) - expenseMillis(a.createdAt));
    });
  };

  const dropExpensesLocal = (ids: string[]) => {
    const gone = new Set(ids);
    ids.forEach((id) => hiddenExpenseIds.current.add(id));
    setExpenses((curr) => curr.filter((exp) => !gone.has(exp.id)));
    setSelectedIds((curr) => curr.filter((id) => !gone.has(id)));
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    // Editing an existing entry changes shared numbers — ask once before writing.
    if (editingExpense && !editConfirmedRef.current) {
      setEditConfirmOpen(true);
      return;
    }
    editConfirmedRef.current = false;
    await saveExpenseNow();
  };

  const saveExpenseNow = async () => {
    if (!canWrite || !bookId) return;
    setIsSaving(true);
    const finalCategory = (category === '__custom__' ? customCatInput.trim() : category) || 'Other';

    const lockBefore = String(book.lockBefore || '');
    if (lockBefore && entryDate && entryDate < lockBefore) {
      setIsSaving(false);
      addToast(`This ledger is locked before ${lockBefore}.`, 'error');
      return;
    }
    const cap = Number(book.dailyCap || 0);
    const extra = entryType === 'out' ? Number(amount || 0) : 0;
    const capBase = editingExpense
      ? expenses.filter((e) => String(e.id) !== String(editingExpense.id))
      : expenses;
    if (wouldBreakDailyCap(capBase, cap, extra, entryDate) && !window.confirm(`This would go past the daily cap of ${getCurrencySymbol(book.currency)}${cap.toLocaleString()}. Record anyway?`)) {
      setIsSaving(false);
      return;
    }
    const personSplits = splitWithTeam ? buildEqualPersonSplits(Number(amount || 0), book) : undefined;
    const amountPaise = toPaise(Number(amount || 0));
    const evidenceReasons = [
      `Type: ${txType}`,
      receiptMeta?.receiptPath ? 'Receipt evidence attached' : '',
      splitWithTeam ? 'Split equally with team' : '',
    ].filter(Boolean);
    try {
      if (editingExpense) {
        const nextStatus = Number(amount) > 0 ? 'recorded' : 'draft';
        const beforeCategory = String(editingExpense.category || '');
        const updated = await updateExpense(bookId, editingExpense.id, {
          amount: Number(amount),
          amountPaise,
          description,
          category: finalCategory,
          entryType: entryType,
          txType,
          date: entryDate,
          paidAt: entryDate,
          merchant,
          entityType: purposeEntityType || undefined,
          paymentMethod,
          accountId,
          notes,
          reimbursable,
          billable,
          tags,
          personSplits,
          receiptPath: receiptMeta?.receiptPath || editingExpense.receiptPath,
          receiptName: receiptMeta?.receiptName || editingExpense.receiptName,
          evidenceReasons,
          financialStatus: nextStatus === 'draft' ? 'DRAFT' : 'CONFIRMED',
          processingStatus: 'COMPLETED',
          status: nextStatus,
          lastEditedBy: userProfile?.displayName || currentUser?.email,
          lastEditedByUid: currentUser?.uid || '',
        });
        if (beforeCategory && beforeCategory !== finalCategory && currentUser?.uid) {
          const nextRules = learnRuleFromCorrection({
            beforeCategory,
            afterCategory: finalCategory,
            merchant,
            description,
            existing: readUserRules(book, currentUser.uid),
          });
          const map = { ...(book.userMoneyRules && typeof book.userMoneyRules === 'object' ? book.userMoneyRules as Record<string, unknown> : {}), [currentUser.uid]: nextRules };
          const nextBook = await updateLedger(bookId, { userMoneyRules: map });
          setBook(nextBook);
        }
        applyExpenseLocal(updated || {
          ...editingExpense,
          amount: Number(amount),
          description,
          category: finalCategory,
          entryType,
          txType,
          date: entryDate,
          merchant,
          paymentMethod,
          accountId,
          notes,
          reimbursable,
          billable,
          tags,
          personSplits,
          status: nextStatus,
          receiptPath: receiptMeta?.receiptPath || editingExpense.receiptPath,
          receiptName: receiptMeta?.receiptName || editingExpense.receiptName,
        });
        setIsExpenseModalOpen(false);
        addToast('Entry updated', 'success');
        persistLedgerCategory(finalCategory).catch(console.error);
        notifyTeamMembers('Edited an entry', `Updated ${entryType === 'in' ? 'money in' : 'money out'} for "${description}" to ${getCurrencySymbol(book.currency)} ${amount} in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} updated "${description}" to ${getCurrencySymbol(book.currency)}${amount} in ${book.name}`).catch(console.error);
      } else {
        const payload = {
          amount: Number(amount),
          amountPaise,
          description,
          category: finalCategory,
          entryType: entryType,
          txType,
          date: entryDate,
          paidAt: entryDate,
          merchant,
          entityType: purposeEntityType || undefined,
          paymentMethod,
          accountId,
          notes,
          reimbursable,
          billable,
          tags,
          personSplits,
          receiptPath: receiptMeta?.receiptPath,
          receiptName: receiptMeta?.receiptName,
          evidenceReasons,
          captureSource: receiptMeta?.receiptPath ? 'receipt' : 'manual',
          financialStatus: Number(amount) > 0 ? 'CONFIRMED' : 'DRAFT',
          processingStatus: 'COMPLETED',
          paidByName: userProfile?.displayName || currentUser?.email,
          enteredBy: userProfile?.displayName || currentUser?.email,
          enteredByUid: currentUser?.uid || '',
          enteredByEmail: currentUser?.email || '',
          status: Number(amount) > 0 ? 'recorded' : 'draft',
          idempotencyKey: newMoneyId('exp'),
        };
        let created: any = null;
        try {
          created = await createExpense(bookId, payload, { idempotencyKey: String(payload.idempotencyKey) });
        } catch (err: any) {
          if (isLikelyOfflineError(err)) {
            enqueueOfflineExpense(bookId, payload);
            setOfflineCount(listOfflineQueue(bookId).length);
            applyExpenseLocal({ ...payload, id: payload.idempotencyKey, offlineQueued: true });
            setIsExpenseModalOpen(false);
            addToast('Saved offline — will sync when you are back online', 'success');
            setIsSaving(false);
            return;
          }
          if (err?.status === 409 && window.confirm('A similar entry already exists on this ledger. Save it anyway?')) {
            created = await createExpense(bookId, payload, { force: true, idempotencyKey: String(payload.idempotencyKey) });
          } else {
            throw err;
          }
        }
        if (created) {
          applyExpenseLocal({
            ...created,
            receiptPath: created.receiptPath || receiptMeta?.receiptPath,
            receiptName: created.receiptName || receiptMeta?.receiptName,
          });
        }
        if (receiptOcrText && Number(amount) > 0) {
          void confirmMismatchGold({
            id: mismatchIdRef.current,
            bookId,
            ocrText: receiptOcrText,
            gold: { amount: Number(amount), merchant },
            saved: true,
          });
        }
        setIsExpenseModalOpen(false);
        setAmount('');
        setDescription('');
        setCustomCatInput('');
        setCategory(finalCategory);
        setReceiptMeta(null);
        setReceiptOcrText('');
        setMismatchThanks('');
        mismatchIdRef.current = '';
        setCurrentPage(1);
        setSuccessCount(1);
        setSuccessExpense(created || { ...payload, id: payload.idempotencyKey, bookId });
        persistLedgerCategory(finalCategory).catch(console.error);
        void CapacitorService.hapticImpact();
        notifyTeamMembers('Added a new entry', `Recorded ${entryType === 'in' ? 'money in' : 'money out'} of ${getCurrencySymbol(book.currency)} ${amount} for "${description}" in category "${finalCategory}"`, `${userProfile?.displayName || currentUser?.email} added "${description}" (${getCurrencySymbol(book.currency)}${amount}) to ${book.name}`).catch(console.error);
      }
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Error saving expense', 'error');
    } finally { setIsSaving(false); }
  };

  const launchScanBatch = (batch: WebScanFile[]) => {
    if (!batch.length) return;
    if (batch.length === 1) {
      setReceiptLaunch({
        source: 'camera',
        imageDataUrl: batch[0].imageDataUrl,
        fileName: batch[0].fileName,
        mimeType: batch[0].mimeType,
      });
      return;
    }
    setReceiptLaunch({ source: 'batch', batch });
  };

  const scanReceiptEntry = async () => {
    if (!bookId) return;
    if (!canScan) {
      addToast(canWrite ? 'Scan is not enabled for this book' : 'You need write access to scan receipts', 'error');
      return;
    }
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;
    window.setTimeout(() => { scanBusyRef.current = false; }, 1500);
    if (isWeb) {
      setWebScanOpen(true);
      scanBusyRef.current = false;
      return;
    }
    try {
      await CapacitorService.requestCameraPermission();
      let batch: Array<{ imageDataUrl: string; fileName: string; mimeType: string }> = [];
      try {
        batch = await CapacitorService.captureScanReceipts({ limit: 24, quality: 88 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (/cancel/i.test(msg)) return;
        throw err;
      }
      launchScanBatch(batch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open camera or photos';
      if (/cancel/i.test(msg)) return;
      addToast(msg, 'error');
    } finally {
      scanBusyRef.current = false;
    }
  };

  const importDocuments = async () => {
    if (!bookId) return;
    if (!canWrite) {
      addToast('You need write access to import documents', 'error');
      return;
    }
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;
    try {
      const batch = await CapacitorService.pickDocuments({ limit: 24 });
      launchScanBatch(batch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open documents';
      if (/cancel/i.test(msg)) return;
      addToast(msg, 'error');
    } finally {
      scanBusyRef.current = false;
    }
  };

  /** OCR found no amount inside the budget — open the Add form pre-filled, receipt already attached. */
  const openManualFromReceipt = (draft: ManualFormDraft) => {
    if (!canWrite) {
      addToast('You need write access to add entries', 'error');
      return;
    }
    const guessed = String(draft.category || '').trim();
    const category = guessed && guessed.toLowerCase() !== 'uncategorized'
      ? guessed
      : guessCategoryFromText(draft.merchant, draft.description, draft.ocrText) || undefined;
    openNewExpense({
      merchant: draft.merchant || '',
      description: draft.description || draft.merchant || '',
      category,
    });
    if (draft.amount && draft.amount > 0) setAmount(String(draft.amount));
    if (draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)) setEntryDate(draft.date);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.receiptPath) setReceiptMeta({ receiptPath: draft.receiptPath, receiptName: draft.receiptName });
    setReceiptOcrText(String(draft.ocrText || ''));
    addToast('Could not read the amount — type it in, receipt is attached', 'error');
  };

  // Keep FAB actions pointed at live handlers (hooks above run before book is ready).
  quickActionsRef.current = {
    scan: () => scanReceiptEntry(),
    add: () => {
      if (!canWrite) {
        addToast('You need write access to add entries', 'error');
        return;
      }
      openNewExpense();
    },
    importDocs: () => { void importDocuments(); },
    voice: () => {
      if (!canVoice) {
        addToast('Voice entry is not available for your role', 'error');
        return;
      }
      setVoiceOpen(true);
    },
  };

  const attachReceiptFiles = async (files: FileList | File[] | null) => {
    if (!bookId || !canWrite) return;
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    attachBusyRef.current = true;
    setUploadingReceipt(true);
    try {
      const file = list[0];
      const { dataUrl, fileName, mimeType } = await CapacitorService.fileToDataUrl(file);
      const uploaded = await uploadLedgerReceipt(bookId, { dataUrl, fileName, mimeType });
      setReceiptMeta(uploaded);
      addToast(list.length > 1 ? 'First file attached — one document per entry' : 'Document attached', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not attach document';
      if (!/cancel/i.test(msg)) addToast(msg, 'error');
    } finally {
      attachBusyRef.current = false;
      setUploadingReceipt(false);
      if (receiptFileRef.current) receiptFileRef.current.value = '';
    }
  };

  const attachReceiptFromCamera = async (source: CameraSource = CameraSource.Prompt) => {
    if (!bookId || !canWrite) return;
    attachBusyRef.current = true;
    setUploadingReceipt(true);
    try {
      await CapacitorService.requestCameraPermission();
      const photo = await CapacitorService.takePicture({ source, quality: 85 });
      const dataUrl = photo.dataUrl || (photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : '');
      if (!dataUrl) throw new Error('No photo data');
      const uploaded = await uploadLedgerReceipt(bookId, {
        dataUrl,
        fileName: `receipt-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      });
      setReceiptMeta(uploaded);
      addToast('Receipt attached', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not attach receipt';
      if (!/cancel/i.test(msg)) addToast(msg, 'error');
    } finally {
      attachBusyRef.current = false;
      setUploadingReceipt(false);
    }
  };

  const handleDeleteExpense = (id: string, description: string) => {
    if (!canDelete || !currentUser) return;
    setDeleteTarget({ id, description });
  };

  const performDeleteExpense = async (id: string, description: string) => {
    if (!canDelete || !currentUser) return;
    setDeleteTarget(null);
    setViewExpense((curr: any) => (curr && String(curr.id) === id ? null : curr));
    setIsDeleting(id);
    const gone = expenses.find((row) => row.id === id);
    dropExpensesLocal([id]);
    if (gone) setLastDeleted({ ...gone, status: gone.status === 'deleted' ? 'recorded' : (gone.status || 'recorded') });
    try {
      await softDeleteExpense(bookId, id);
      await notifyTeamMembers('Deleted an entry', `Removed entry for "${description}"`, `${userProfile?.displayName || currentUser?.email} deleted "${description}" from ${book.name}`);
      addToast('Entry deleted. Tap Undo to bring it back.', 'success');
    } catch (err: any) {
      if (gone) applyExpenseLocal(gone);
      setLastDeleted(null);
      console.error("Delete failed:", err);
      addToast("Delete failed: " + err.message, 'error');
    } finally { setIsDeleting(null); }
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
    if (!bookId || !selectedIds.length) return;
    if (kind === 'delete') {
      if (!canDelete) return;
      if (!confirm(`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'}?`)) return;
    } else if (!canWrite) return;
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

  const sendEmailNotification = async (toEmail: string, subject: string, message: string, meta?: { action?: string; kind?: string; silent?: boolean }) => {
    try {
      const { apiPost } = await import('../lib/api');
      const kind = meta?.kind
        || (meta?.action?.toLowerCase().includes('announcement') ? 'announcement'
          : meta?.action?.toLowerCase().includes('invite') ? 'invite'
            : 'notice');
      await apiPost('/api/email/send', {
        to: toEmail,
        subject,
        message,
        bookId: bookId || undefined,
        ledgerMail: inboundAddress || bookInboundAddress(book),
        kind,
      });
      if (bookId) {
        await addLedgerMailEvent(bookId, {
          direction: 'outbound',
          status: 'sent',
          toEmail,
          subject,
          action: meta?.action || 'Team notification',
          detail: 'Notification email sent',
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
      return true;
    } catch (err: any) {
      console.error('Failed to send email via backend:', err);
      if (bookId) {
        await addLedgerMailEvent(bookId, {
          direction: 'outbound',
          status: 'failed',
          toEmail,
          subject,
          action: meta?.action || 'Team notification',
          detail: err?.message || 'Send failed',
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
      if (!meta?.silent) {
        addToast(err?.message || 'Email sending failed on the server.', 'error');
      }
      return false;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers || !inviteEmail) return;
    const email = normalizeEmail(inviteEmail);
    if (!isValidNotifyEmail(email)) {
      addToast('Enter a valid email. Invitations only reach a real inbox.', 'error');
      return;
    }
    setInviting(true);
    try {
      const inviteId = await createLedgerInvite({
        bookId: book.id,
        bookName: book.name,
        email,
        role: inviteRole,
        invitedBy: currentUser!.uid,
      });
      setInviteEmail('');
      setInviteSentTo(email);
      addToast('Invitation sent. Keep this screen open or close it when you are done.', 'success');
      
      const sent = await sendEmailNotification(
        email,
        `Invitation to ledger: ${book.name}`,
        wrapByjanEmailHtml({
          kicker: 'Invitation',
          title: `Join ${book.name} on Byjan`,
          intro: `You have been invited as ${inviteRole} to this expense ledger.`,
          rows: [
            { label: 'Ledger', value: String(book.name || '') },
            { label: 'Role', value: inviteRole },
            { label: 'Sign in as', value: email },
          ],
          note: 'Open the invitation while signed in as the invited email. Sign out first if another account is already open on this device.',
          extraHtml: openInviteButtonHtml(inviteId),
        }),
        { action: 'Invite', kind: 'invite' },
      );
      if (sent) {
        addToast(`Email sent to ${email}. They will also see it on Home after signing in with that address.`, 'success');
      }
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Failed to send invite. Check permissions.', 'error');
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
    setConfirmDelete(true);
  };

  const confirmDeleteLedger = async () => {
    if (!currentUser || !bookId || !book) return;
    setDeletingLedger(true);
    try {
      await softDeleteLedger(bookId);
      addToast('Ledger deleted.', 'success');
      navigate('/expenses');
    } catch (err: any) {
      addToast(toUserMessage(err, 'Could not delete this ledger'), 'error');
    } finally {
      setDeletingLedger(false);
      setConfirmDelete(false);
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
  const anomalySet = anomalyIds(expenses);
  const dupeSet = nearDupeIds(expenses);
  const staleSet = staleReimburseIds(expenses);
  const missingSet = missingReceiptIds(expenses);
  const watchSet = new Set(readWatchMerchants(book).map((name) => name.toLowerCase()));
  const q = searchQuery.trim().toLowerCase();
  const peopleOptions = [...new Set(
    expenses
      .map((exp) => String(exp.enteredBy || exp.paidByName || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
  const filteredExpenses = expenses.filter((exp) => {
    const hay = [exp.description, exp.category, exp.paidByName, exp.enteredBy, exp.merchant, exp.notes, exp.tags, exp.paymentMethod]
      .some((value) => String(value || '').toLowerCase().includes(q));
    if (q && !hay) return false;
    if (typeFilter !== 'all' && String(exp.entryType || 'out') !== typeFilter) return false;
    if (personFilter !== 'all') {
      const who = String(exp.enteredBy || exp.paidByName || '').trim();
      if (who !== personFilter) return false;
    }
    if (methodFilter !== 'all' && String(exp.paymentMethod || 'cash') !== methodFilter) return false;
    if (categoryFilter !== 'all') {
      const cat = String(exp.category || '').trim() || 'Uncategorized';
      if (cat.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    }
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
    return (expenseMillis(a.createdAt) - expenseMillis(b.createdAt)) * dir;
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
  const safePage = Math.min(currentPage, totalPages);
  const paginatedExpenses = sortedExpenses.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
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
    personFilter !== 'all',
    methodFilter !== 'all',
    categoryFilter !== 'all',
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
    setPersonFilter('all');
    setMethodFilter('all');
    setCategoryFilter('all');
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
      <div className="book-stage h-full min-h-0 flex flex-col" data-purpose-id={purposeId}>
      <Tabs.Root value={shownTab} onValueChange={onLedgerTabChange} className="h-full min-h-0 flex flex-col">
        <div className="book-chrome shrink-0">
        <div className="px-4 md:px-6 lg:px-8 pt-2 pb-0">
        <div className="max-w-6xl mx-auto">
      <div className="book-head mb-1">
      <div className="flex flex-col gap-2 mb-1">
        <div className="book-open-head">
          <Link to="/expenses" className="p-1.5 -ml-1 text-slate-400 hover:text-slate-700 rounded-lg shrink-0" title="Back to money books">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Money book</p>
            <h1 className="book-open-name">{String(book.name || 'Money book')}</h1>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                {roleLabel(myRole)}
              </span>
              {offlineCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {offlineCount} offline
                </span>
              )}
            </div>
          </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="book-head-action book-head-more" aria-label="Book actions">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="book-overflow-menu" align="end" sideOffset={6}>
                  {canManageUsers && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => { setEditBookName(String(book.name || '')); setIsEditBookOpen(true); }}>
                      <PenSquare className="w-4 h-4" /> Edit book
                    </DropdownMenu.Item>
                  )}
                  {canManageUsers && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => setIsMembersModalOpen(true)}>
                      <UserPlus className="w-4 h-4" /> Invite people
                    </DropdownMenu.Item>
                  )}
                  {canWrite && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => { void importDocuments(); }}>
                      <FileUp className="w-4 h-4" /> Import Excel, PDF or photos
                    </DropdownMenu.Item>
                  )}
                  {hasFeature('money_recurring') && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => navigate('/regular-payments')}>
                      <CalendarClock className="w-4 h-4" /> Upcoming
                    </DropdownMenu.Item>
                  )}
                  {canPin && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => { void togglePinned(); }}>
                      {book.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      {book.pinned ? 'Unpin' : 'Pin'}
                    </DropdownMenu.Item>
                  )}
                  {canAnnounce && (
                    <DropdownMenu.Item className="book-overflow-item" onSelect={() => setIsAnnounceOpen(true)}>
                      <Megaphone className="w-4 h-4" /> Announce
                    </DropdownMenu.Item>
                  )}
                  {canDeleteBook && (
                    <DropdownMenu.Item className="book-overflow-item is-danger" onSelect={() => { void handleDeleteLedger(); }} disabled={deletingLedger}>
                      {deletingLedger ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete book
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </div>
        {evolution && canManageUsers ? (
          <div className="purpose-detect mt-2">
            <span className="flex-1 min-w-0">
              <strong>{evolution.title}</strong> {evolution.detail}
              <span className="block text-[11px] text-slate-500 mt-0.5">{evolution.features.join(' · ')}</span>
            </span>
            <button
              type="button"
              className="byjan-btn !h-8 text-xs"
              onClick={() => {
                void (async () => {
                  if (!bookId) return;
                  const tpl = getPurposeTemplate(evolution.suggestedPurposeId);
                  const cats = uniqueCategories(ledgerCategories, tpl.categories);
                  await updateLedger(bookId, {
                    purposeId: evolution.suggestedPurposeId,
                    purposeLabel: tpl.label,
                    categories: cats,
                    quickActions: tpl.quickActions,
                    purposeConfig: { purposeId: evolution.suggestedPurposeId, confirmedAt: new Date().toISOString(), evolved: true },
                  });
                  setBook((prev: any) => prev ? {
                    ...prev,
                    purposeId: evolution.suggestedPurposeId,
                    purposeLabel: tpl.label,
                    categories: cats,
                    quickActions: tpl.quickActions,
                  } : prev);
                  setEvolutionDismissed(true);
                  addToast(`${tpl.label} setup enabled`, 'success');
                })();
              }}
            >
              Enable
            </button>
            <button type="button" className="byjan-btn-ghost !h-8 text-xs" onClick={() => setEvolutionDismissed(true)}>
              Not now
            </button>
          </div>
        ) : null}
      </div>

        <div className="pt-1 pb-2 border-b border-slate-100">
        <Tabs.List className="book-tabs" aria-label="Book sections">
          <Tabs.Trigger value="ledger" className="book-tab">
            <Wallet className="w-3.5 h-3.5" />
            <span>Entries</span>
          </Tabs.Trigger>
          {canSplitTab && (
          <Tabs.Trigger value="splits" className="book-tab">
            <Split className="w-3.5 h-3.5" />
            <span>Splits</span>
          </Tabs.Trigger>
          )}
          {canEmailTab && (
          <Tabs.Trigger value="email" className="book-tab" data-testid="book-tab-email" onClick={() => setLedgerTab('email')}>
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </Tabs.Trigger>
          )}
          {canBookReports && (
          <Tabs.Trigger value="analytics" className="book-tab" data-testid="book-tab-summary">
            <PieChart className="w-3.5 h-3.5" />
            <span>Summary</span>
          </Tabs.Trigger>
          )}
          {canHistory && (
          <Tabs.Trigger value="audit" className="book-tab">
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </Tabs.Trigger>
          )}
        </Tabs.List>
        </div>
        </div>

        {ledgerTab === 'ledger' && (
            <div className="book-dash-tools book-tools-bar">
            <div className="flex items-center gap-1.5">
              {canLedgerSearch && (
              <label className="byjan-search flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="search"
                  placeholder="Merchant, category, notes"
                  data-ledger-search
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-700" title="Clear search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
              )}
              {canFilters && (
              <button
                type="button"
                ref={filterBtnRef}
                className="byjan-btn-ghost byjan-tool-btn relative"
                onClick={toggleFilters}
                aria-expanded={filtersOpen}
                title="Filters"
              >
                <SlidersHorizontal />
                {activeFilterCount > 0 && (
                  <span className="byjan-tool-badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              )}
              {canExport && (
              <button
                type="button"
                ref={exportBtnRef}
                className="byjan-btn-ghost byjan-tool-btn relative"
                onClick={toggleExport}
                aria-expanded={exportOpen}
                title="Download report"
                disabled={exportingPdf}
              >
                {exportingPdf ? <Loader2 className="animate-spin" /> : <Download />}
              </button>
              )}
              {canEmailReport && (
              <button type="button" onClick={() => void emailReport()} disabled={sendingReport} className="byjan-btn-ghost byjan-tool-btn" title="Email PDF report">
                {sendingReport ? <Loader2 className="animate-spin" /> : <Send />}
              </button>
              )}
              {canFilters && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="byjan-btn-ghost byjan-tool-btn" title="Columns">
                    <Settings2 />
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
                        <DropdownMenu.ItemIndicator className="w-4 inline-flex">
                          <Check className="w-3.5 h-3.5 text-teal-700" />
                        </DropdownMenu.ItemIndicator>
                        <span className="capitalize">{col}</span>
                      </DropdownMenu.CheckboxItem>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              )}
            </div>
            </div>
        )}

        </div>
        </div>
        </div>
        <PullToRefresh
          className="flex-1 min-h-0 overflow-y-auto book-scroll pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
          onRefresh={async () => { await refreshExpenses(); }}
        >
        <div className="px-4 md:px-6 lg:px-8 pt-2">
        <div className="max-w-6xl mx-auto">
        <div className="book-open-actions">
            {canWrite && (
              <button
                type="button"
                onClick={() => { void CapacitorService.hapticTick(); openNewExpense(); }}
                className="book-head-action book-head-add"
                title="Add entry"
              >
                <Plus className="w-4 h-4" />
                <span>Add entry</span>
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => { void CapacitorService.hapticTick(); setQrPayOpen(true); }}
                className="book-head-action book-head-pay"
                title="Scan a UPI QR and pay — the entry is recorded here"
                data-testid="book-pay-qr"
              >
                <QrCode className="w-4 h-4" />
                <span>Pay</span>
              </button>
            )}
            {hasFeature('money_people') && (
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(true)}
                className="book-head-action book-head-team"
                title="Team — people with access to this book"
              >
                <Users className="w-4 h-4" />
                <span>Team</span>
              </button>
            )}
        </div>
        {ledgerTab === 'ledger' && (
          <div className="book-dash-kpis mb-2">
            <div className="md3-stats">
              <div className="md3-stat tone-idle">
                <span className="md3-stat-icon" aria-hidden><Wallet className="w-3.5 h-3.5" /></span>
                <span className="md3-stat-label">Net</span>
                <strong className={cn('md3-stat-value byjan-money', balance >= 0 ? 'is-in' : '')}>
                  {balance < 0 ? '−' : ''}{getCurrencySymbol(book.currency)}{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="md3-stat tone-out">
                <span className="md3-stat-icon" aria-hidden><ArrowUpRight className="w-3.5 h-3.5" /></span>
                <span className="md3-stat-label">Money out</span>
                <strong className="md3-stat-value byjan-money">
                  {getCurrencySymbol(book.currency)}{totalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="md3-stat tone-in">
                <span className="md3-stat-icon" aria-hidden><ArrowDownRight className="w-3.5 h-3.5" /></span>
                <span className="md3-stat-label">Money in</span>
                <strong className="md3-stat-value byjan-money">
                  {getCurrencySymbol(book.currency)}{totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="md3-stat tone-warn">
                <span className="md3-stat-icon" aria-hidden><Receipt className="w-3.5 h-3.5" /></span>
                <span className="md3-stat-label">This month</span>
                <strong className="md3-stat-value byjan-money">
                  {getCurrencySymbol(book.currency)}{monthOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
            {(budget > 0 || reimbursableOpen > 0 || isAuditor) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
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
          </div>
        )}

        {filtersOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setFiltersOpen(false)} />
            <div
              className="fixed z-[110] byjan-panel p-3.5 space-y-3"
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
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="byjan-filter w-full col-span-2">
                  <option value="all">All categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="byjan-filter w-full col-span-2">
                  <option value="all">All people</option>
                  {peopleOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input type="date" value={dateFrom} onChange={(e) => { setPeriod(''); setDateFrom(e.target.value); }} className="byjan-filter w-full" title="From date" />
                <input type="date" value={dateTo} onChange={(e) => { setPeriod(''); setDateTo(e.target.value); }} className="byjan-filter w-full" title="To date" />
              </div>
              {categoryOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {categoryOptions.slice(0, 12).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="byjan-chip !inline-flex !items-center !gap-1.5"
                      data-on={categoryFilter === cat}
                      onClick={() => setCategoryFilter((prev) => (prev === cat ? 'all' : cat))}
                    >
                      <CategoryIconMark name={cat} className="!w-5 !h-5 !rounded-md" />
                      <span className="truncate max-w-[7rem]">{cat}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="byjan-chip" data-on={reimbursableOnly} onClick={() => setReimbursableOnly((v) => !v)}>Reimbursable</button>
                <button type="button" className="byjan-chip" data-on={uncategorizedOnly} onClick={() => setUncategorizedOnly((v) => !v)}>Uncategorized</button>
              </div>
            </div>
          </>,
          document.body
        )}

        {canExport && exportOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setExportOpen(false)} />
            <div
              className="fixed z-[110] byjan-panel p-2 space-y-1"
              style={{ top: exportPos.top, left: exportPos.left, width: exportPos.width }}
              role="dialog"
              aria-label="Download report"
            >
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">Download report</p>
              <button
                type="button"
                className="ios-row w-full text-left !rounded-lg"
                onClick={() => void downloadPdf()}
                disabled={exportingPdf}
              >
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-[#0B1F3A]">PDF report</span>
                  <span className="block text-[11px] text-slate-500">Filtered entries as a printable PDF</span>
                </span>
              </button>
              <button
                type="button"
                className="ios-row w-full text-left !rounded-lg"
                onClick={() => void downloadCsv()}
              >
                <Download className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-[#0B1F3A]">CSV spreadsheet</span>
                  <span className="block text-[11px] text-slate-500">Open in Excel or Sheets</span>
                </span>
              </button>
            </div>
          </>,
          document.body
        )}

        <div className="py-1.5">
        <Tabs.Content value="ledger" className="outline-none">
          <div className="tool-collapse-row tool-collapse-row-soft mb-1.5">
          {bookId && currentUser?.uid ? (
            <SettlementsPanel
              bookId={bookId}
              currentUid={currentUser.uid}
              symbol={getCurrencySymbol(book.currency)}
              myUpiId={String((userProfile as any)?.upiId || '')}
              myUpiName={String((userProfile as any)?.upiDisplayName || userProfile?.displayName || '')}
              onToast={addToast}
              onProfileRefresh={() => void refreshUserProfile()}
            />
          ) : null}
          {lastDeleted && canWrite && (
            <button
              type="button"
              data-undo-remove
              className="byjan-chip"
              disabled={Boolean(isDeleting)}
              onClick={async () => {
                const restored = lastDeleted;
                if (!restored?.id || !bookId) return;
                applyExpenseLocal(restored);
                setLastDeleted(null);
                try {
                  await updateExpense(bookId, String(restored.id), {
                    deleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    status: restored.status === 'deleted' ? 'recorded' : (restored.status || 'recorded'),
                  });
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
              {canDelete && <button type="button" className="byjan-chip" disabled={Boolean(bulkBusy)} onClick={() => void runBulk('delete')}>Delete</button>}
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
          {filteredExpenses.length > 0 && (
            <ListPager
              page={safePage}
              totalPages={totalPages}
              onPage={setCurrentPage}
              pageSize={itemsPerPage}
              onPageSize={setItemsPerPage}
              total={filteredExpenses.length}
            />
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
                          Created <ArrowUpDown className="w-3 h-3" />{sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
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
                        role="button"
                        tabIndex={0}
                        data-testid="entry-row"
                        className={cn(
                          'hover:bg-white/40 transition-colors group cursor-pointer',
                          exp.flagged && 'byjan-row-flag',
                          anomalySet.has(exp.id) && 'byjan-row-anomaly',
                          dupeSet.has(exp.id) && 'byjan-row-dupe',
                          watchSet.has(String(exp.merchant || '').toLowerCase()) && 'byjan-row-watch',
                        )}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest('button, input, a, [role="menuitem"]')) return;
                          setViewExpense(exp);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && event.target === event.currentTarget) setViewExpense(exp);
                        }}
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
                                className="text-[#0ea396] hover:text-indigo-900 disabled:opacity-70"
                                title="Open attachment"
                                aria-label="Open attachment"
                                data-receipt-open="true"
                              >
                                {openingReceiptId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {exp.description}
                            {exp.source === 'email' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200" title={String(exp.emailSubject || 'From inbound email')}>Email</span>
                            )}
                            {exp.status === 'draft' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Needs review</span>
                            )}
                          </span>
                        </td>
                        {visibleColumns.date && <td className="px-3.5 py-2 text-slate-500 text-sm">{expenseDateLabel(exp)}</td>}
                        {visibleColumns.category && (
                          <td className="px-3.5 py-2">
                            <CategoryBadge name={exp.category} size="sm" />
                          </td>
                        )}
                        {visibleColumns.merchant && <td className="px-3.5 py-2 text-slate-600 text-sm truncate max-w-[140px]" title={exp.merchant || ''}>{exp.merchant || '—'}</td>}
                        {visibleColumns.method && <td className="px-3.5 py-2 text-slate-500 text-sm capitalize">{exp.paymentMethod || 'cash'}</td>}
                        {visibleColumns.author && <td className="px-3.5 py-2 text-slate-600 text-sm truncate max-w-[160px]" title={`Added by ${exp.enteredBy || exp.paidByName}${exp.lastEditedBy ? '\nLast edited by: ' + exp.lastEditedBy : ''}`}>{exp.enteredBy || exp.paidByName ? `Added by ${exp.enteredBy || exp.paidByName}` : ''}</td>}
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
                              {canFlag && (
                              <button
                                type="button"
                                onClick={() => void updateExpense(bookId!, exp.id, { flagged: !exp.flagged }).then(() => refreshExpenses())}
                                className={cn('p-1 rounded transition-colors', exp.flagged ? 'text-amber-500' : 'hover:text-zinc-600 hover:bg-white/70')}
                                title={exp.flagged ? 'Unflag' : 'Flag'}
                              >
                                <Star className="w-4 h-4" fill={exp.flagged ? 'currentColor' : 'none'} />
                              </button>
                              )}
                              {canDuplicate && (
                              <button onClick={() => void duplicateExpense(exp)} disabled={bulkBusy === exp.id} className="p-1 hover:text-zinc-600 hover:bg-white/70 rounded transition-colors" title="Duplicate">
                                {bulkBusy === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
                              </button>
                              )}
                              <button type="button" onClick={() => setViewExpense(exp)} className="p-1 hover:text-zinc-600 hover:bg-white/70 rounded transition-colors" title="View" data-testid="entry-row-view">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditExpense(exp)} className="p-1 hover:text-zinc-600 hover:bg-white/70 rounded transition-colors" title="Edit">
                                <PenSquare className="w-4 h-4" />
                              </button>
                              {canSplitEntry && peopleFromBook(book).length > 1 && String(exp.entryType || 'out') === 'out' ? (
                                <button
                                  type="button"
                                  onClick={() => setSplitTarget({
                                    id: String(exp.id),
                                    amount: Number(exp.amount || 0),
                                    merchant: String(exp.merchant || ''),
                                    description: String(exp.description || ''),
                                  })}
                                  className={`entry-split-cta is-inline ${Array.isArray(exp.personSplits) && exp.personSplits.length ? 'is-done' : ''}`}
                                  title="Split with team"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  {Array.isArray(exp.personSplits) && exp.personSplits.length ? 'Edit split' : 'Split'}
                                </button>
                              ) : null}
                              {canDelete && (
                              <button onClick={() => handleDeleteExpense(exp.id, exp.description)} disabled={isDeleting === exp.id} className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50" title="Delete">
                                {isDeleting === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                              )}
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
            <div className="md:hidden flex flex-col gap-1.5 pt-1">
              {paginatedExpenses.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">No entries found.</div>
              ) : (
                groupExpensesByDay(paginatedExpenses, (exp) => expenseCreatedDay(exp) || expensePaidDay(exp)).map((group) => (
                  <div key={group.day} className="day-group">
                    <p className="day-group-label">{group.label}</p>
                    {group.rows.map((exp) => {
                  const kind = moneyKindMeta(exp.entryType, exp.txType);
                  const why = entryEvidence(exp);
                  const cat = categoryVisual(exp.category);
                  return (
                  <div
                    key={exp.id}
                    role="button"
                    tabIndex={0}
                    data-testid="entry-card"
                    className={cn(
                      'entry-card-mobile mb-entry is-tappable',
                      `tone-${cat.tone}`,
                      exp.flagged && 'byjan-row-flag',
                      anomalySet.has(exp.id) && 'byjan-row-anomaly',
                    )}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button, input, a, [role="menuitem"]')) return;
                      setViewExpense(exp);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && event.target === event.currentTarget) setViewExpense(exp);
                    }}
                  >
                    <div className="entry-card-row">
                      {canWrite && (
                        <input type="checkbox" aria-label={`Select ${exp.description}`} checked={selectedIds.includes(exp.id)} onChange={() => toggleSelected(exp.id)} />
                      )}
                      <span className={`mb-entry-icon tone-${exp.entryType === 'in' ? 'in' : exp.entryType === 'transfer' ? 'xfer' : 'out'}`} aria-hidden>
                        <CategoryIconMark name={exp.category || (exp.entryType === 'in' ? 'income' : 'Uncategorized')} className="!w-full !h-full" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="entry-card-line">
                          <p className="entry-card-title">{exp.description}</p>
                          <div className={cn('entry-card-amount byjan-money', kind.cls)}>{kind.sign}{getCurrencySymbol(book.currency)}{Number(exp.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                        <p className="entry-card-meta">
                          <span className={cn('money-kind', kind.cls)}>{kind.label}</span>
                          <span className={`entry-cat-pill tone-${cat.tone}`}>{cat.label}</span>
                          <span>{expenseDateLabel(exp)}</span>
                          {exp.merchant ? <span>{exp.merchant}</span> : null}
                          {exp.status === 'draft' ? <span className="entry-cat-pill tone-amber">Needs review</span> : null}
                          {Array.isArray(exp.personSplits) && exp.personSplits.length > 1 ? (
                            <span className="entry-cat-pill tone-teal">Split · {exp.personSplits.length}</span>
                          ) : null}
                          {exp.enteredBy || exp.paidByName ? <span className="entry-card-by">Added by {exp.enteredBy || exp.paidByName}</span> : null}
                        </p>
                      </div>
                      {canSplitEntry && peopleFromBook(book).length > 1 && String(exp.entryType || 'out') === 'out' ? (
                        <button
                          type="button"
                          className="entry-split-chip"
                          aria-label="Split this entry"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSplitTarget({
                              id: String(exp.id),
                              amount: Number(exp.amount || 0),
                              merchant: String(exp.merchant || ''),
                              description: String(exp.description || ''),
                            });
                          }}
                        >
                          <Users className="w-3.5 h-3.5" />
                          Split
                        </button>
                      ) : null}
                      {canWrite && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button type="button" className="entry-card-more" aria-label="Entry actions">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="book-overflow-menu" align="end" sideOffset={6}>
                              <DropdownMenu.Item className="book-overflow-item" data-testid="entry-card-view" onSelect={() => setViewExpense(exp)}>
                                <Eye className="w-4 h-4" /> View
                              </DropdownMenu.Item>
                              <DropdownMenu.Item className="book-overflow-item" onSelect={() => openEditExpense(exp)}>
                                <PenSquare className="w-4 h-4" /> Edit
                              </DropdownMenu.Item>
                              {exp.receiptPath ? (
                                <DropdownMenu.Item className="book-overflow-item" onSelect={() => { void openReceipt(exp); }}>
                                  <Paperclip className="w-4 h-4" /> Receipt
                                </DropdownMenu.Item>
                              ) : null}
                              {canFlag ? (
                                <DropdownMenu.Item className="book-overflow-item" onSelect={() => { void updateExpense(bookId!, exp.id, { flagged: !exp.flagged }).then(() => refreshExpenses()); }}>
                                  <Star className="w-4 h-4" /> {exp.flagged ? 'Unflag' : 'Flag'}
                                </DropdownMenu.Item>
                              ) : null}
                              {canDuplicate ? (
                                <DropdownMenu.Item className="book-overflow-item" onSelect={() => { void duplicateExpense(exp); }}>
                                  <CopyPlus className="w-4 h-4" /> Duplicate
                                </DropdownMenu.Item>
                              ) : null}
                              {canSplitEntry && peopleFromBook(book).length > 1 && String(exp.entryType || 'out') === 'out' ? (
                                <DropdownMenu.Item className="book-overflow-item" onSelect={() => setSplitTarget({
                                  id: String(exp.id),
                                  amount: Number(exp.amount || 0),
                                  merchant: String(exp.merchant || ''),
                                  description: String(exp.description || ''),
                                })}>
                                  <Users className="w-4 h-4" /> {Array.isArray(exp.personSplits) && exp.personSplits.length ? 'Edit split' : 'Split'}
                                </DropdownMenu.Item>
                              ) : null}
                              {canDelete ? (
                                <DropdownMenu.Item className="book-overflow-item is-danger" onSelect={() => handleDeleteExpense(exp.id, exp.description)}>
                                  <Trash2 className="w-4 h-4" /> Delete
                                </DropdownMenu.Item>
                              ) : null}
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      )}
                    </div>
                    {why ? <p className="entry-card-why">{why}</p> : null}
                  </div>
                  );
                })}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Pagination Controls */}
          {filteredExpenses.length > 0 && (
            <ListPager
              page={safePage}
              totalPages={totalPages}
              onPage={setCurrentPage}
              pageSize={itemsPerPage}
              onPageSize={setItemsPerPage}
              total={filteredExpenses.length}
            />
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
                {hasFeature('money_email_mailbox') && (
                <code className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 max-w-[220px] truncate">{inboundAddress || bookInboundAddress(book)}</code>
                )}
                {hasFeature('money_email_mailbox') && (
                <button type="button" className="byjan-btn-ghost !px-2.5 !py-1.5" onClick={() => void copyInboundAddress()}>
                  <Copy className="w-3.5 h-3.5" />
                  {copiedInbound ? 'Copied' : 'Copy'}
                </button>
                )}
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
          <ListPager
            page={emailList.page}
            totalPages={emailList.totalPages}
            onPage={emailList.setPage}
            pageSize={emailList.pageSize}
            onPageSize={emailList.setPageSize}
            total={emailList.filtered.length}
          />
        </Tabs.Content>

        <Tabs.Content value="analytics" className="outline-none">
          <ReportsDashboard
            expenses={expenses.map((exp) => ({ ...exp, bookId, bookName: book.name, currency: book.currency }))}
            books={[{ id: bookId, name: book.name, currency: book.currency, monthlyBudget: Number(book.monthlyBudget || 0) }]}
            fixedBookId={bookId}
            onOpenEntry={(id) => { const exp = expenses.find((row) => String(row.id) === id); if (exp) setViewExpense(exp); }}
          >
            <section className="rp-card">
              <header className="rp-card-head">
                <div><p className="rp-kicker">Take it with you</p><h2>Download this book</h2></div>
                <FileText className="w-4 h-4 text-slate-400" />
              </header>
              <p className="rp-muted mb-3">PDF for sharing, CSV for a spreadsheet or your accountant.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void downloadPdf()} disabled={exportingPdf} className="byjan-btn-ghost w-full">
                  {exportingPdf ? <Loader2 className="animate-spin" /> : <Download />} PDF
                </button>
                <button type="button" onClick={() => void downloadCsv()} className="byjan-btn w-full">
                  <FileText /> Full CSV
                </button>
              </div>
            </section>
            {canBudget && (
              <section className="rp-card">
                <header className="rp-card-head"><div><p className="rp-kicker">Monthly limit</p><h2>How much is okay to spend a month?</h2></div></header>
                <p className="rp-muted mb-3">We compare this month's money out against this number and warn you when you get close.</p>
                <div className="flex gap-2">
                  <input className="byjan-input" type="number" min={0} step="0.01" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="0.00" />
                  <button type="button" className="byjan-btn" onClick={() => void saveMonthlyBudget()}>Save</button>
                </div>
              </section>
            )}
          </ReportsDashboard>
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

        <Tabs.Content value="splits" className="outline-none">
          {bookId && currentUser?.uid ? (
            <SettlementsPanel
              variant="page"
              bookId={bookId}
              currentUid={currentUser.uid}
              symbol={getCurrencySymbol(book.currency)}
              myUpiId={String((userProfile as any)?.upiId || '')}
              myUpiName={String((userProfile as any)?.upiDisplayName || userProfile?.displayName || '')}
              onToast={addToast}
              onProfileRefresh={() => void refreshUserProfile()}
              initialPayId={searchParams.get('pay') || ''}
              onPayConsumed={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('pay');
                setSearchParams(next, { replace: true });
              }}
            />
          ) : (
            <div className="byjan-card p-8 text-center text-sm text-slate-500">Sign in to view shared entries.</div>
          )}
        </Tabs.Content>
        </div>
        </div>
        </div>
        </PullToRefresh>
      </Tabs.Root>

      {/* Entry detail (view) sheet */}
      <Dialog.Root open={Boolean(viewExpense)} onOpenChange={(next) => { if (!next) setViewExpense(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/45 z-[170] byjan-fade-in" />
          <Dialog.Content className="record-sheet entry-view fixed z-[180] p-0 max-h-[92vh] overflow-y-auto bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]" onCloseAutoFocus={(event) => event.preventDefault()} data-testid="entry-view">
            {viewExpense ? (() => {
              const exp = viewExpense;
              const kind = moneyKindMeta(exp.entryType, exp.txType);
              const acct = readAccounts(book).find((a) => a.id === String(exp.accountId || ''));
              const payLabel = ENTRY_PAY_METHODS.find((m) => m.id === String(exp.paymentMethod || ''))?.label || String(exp.paymentMethod || '');
              const trail = buildEvidenceTrail(exp);
              const facts: Array<{ icon: React.ReactNode; label: string; value: string }> = [
                { icon: <Calendar className="w-3.5 h-3.5" />, label: 'Paid on', value: formatDayLabel(expensePaidDay(exp)) || '—' },
                { icon: <Store className="w-3.5 h-3.5" />, label: purposeFields.merchantLabel, value: String(exp.merchant || '—') },
                { icon: <CreditCard className="w-3.5 h-3.5" />, label: 'Paid with', value: payLabel || '—' },
                { icon: <Landmark className="w-3.5 h-3.5" />, label: 'Account', value: acct?.name || String(exp.accountId || '—') },
                { icon: <UserIcon className="w-3.5 h-3.5" />, label: 'Added by', value: String(exp.enteredBy || exp.paidByName || 'Unknown') },
                { icon: <Calendar className="w-3.5 h-3.5" />, label: 'Added on', value: formatDayLabel(expenseCreatedDay(exp)) || '—' },
              ];
              if (exp.tags) facts.push({ icon: <Tag className="w-3.5 h-3.5" />, label: purposeFields.tagsLabel, value: String(exp.tags) });
              return (
                <>
                  <div className="record-sheet-handle md:hidden" aria-hidden />
                  <div className={cn('entry-view-hero', kind.cls)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('money-kind', kind.cls)}>{kind.label}</span>
                        {exp.status === 'draft' ? <span className="money-evidence money-evidence-warn">Needs review</span> : null}
                        {exp.flagged ? <span className="money-evidence"><Star className="w-3 h-3 inline -mt-0.5" fill="currentColor" /> Flagged</span> : null}
                      </div>
                      <Dialog.Close className="entry-view-close" aria-label="Close"><X className="w-4 h-4" /></Dialog.Close>
                    </div>
                    <p className="entry-view-amount byjan-money">{kind.sign}{getCurrencySymbol(book.currency)}{Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    <Dialog.Title className="entry-view-title">{String(exp.description || 'Entry')}</Dialog.Title>
                    <div className="mt-2"><CategoryBadge name={exp.category || 'Uncategorized'} size="md" /></div>
                  </div>
                  <div className="entry-view-body">
                    <dl className="entry-view-facts">
                      {facts.map((f) => (
                        <div key={f.label} className="entry-view-fact">
                          <dt>{f.icon} {f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {exp.notes ? (
                      <div className="entry-view-note"><StickyNote className="w-3.5 h-3.5" /><p>{String(exp.notes)}</p></div>
                    ) : null}
                    {Array.isArray(exp.personSplits) && exp.personSplits.length ? (
                      <div className="entry-view-split">
                        <p className="rp-kicker">Split between</p>
                        <ul>
                          {exp.personSplits.map((s: any, i: number) => (
                            <li key={`${s.uid || s.name || i}`}><span>{String(s.name || s.email || s.uid || 'Person')}</span><span className="byjan-money">{getCurrencySymbol(book.currency)}{Number(s.amount || 0).toLocaleString('en-IN')}</span></li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {trail.length ? (
                      <div className="entry-view-trail">
                        <p className="rp-kicker">Why Byjan recorded it this way</p>
                        {trail.map((step, i) => <p key={`${step.label}-${i}`}><strong>{step.label}:</strong> {step.detail}</p>)}
                      </div>
                    ) : null}
                    {exp.receiptPath ? (
                      <button type="button" className="byjan-btn-ghost w-full !h-10" onClick={() => void openReceipt(exp)} disabled={openingReceiptId === exp.id}>
                        {openingReceiptId === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Open attachment
                      </button>
                    ) : null}
                  </div>
                  <div className="entry-view-actions">
                    {canWrite ? (
                      <button type="button" className="byjan-btn flex-1" data-testid="entry-view-edit" onClick={() => { setViewExpense(null); openEditExpense(exp); }}>
                        <PenSquare className="w-4 h-4" /> Edit
                      </button>
                    ) : null}
                    {canSplitEntry && canWrite && peopleFromBook(book).length > 1 && String(exp.entryType || 'out') === 'out' ? (
                      <button type="button" className="byjan-btn-ghost" onClick={() => { setViewExpense(null); setSplitTarget({ id: String(exp.id), amount: Number(exp.amount || 0), merchant: String(exp.merchant || ''), description: String(exp.description || '') }); }}>
                        <Users className="w-4 h-4" /> {Array.isArray(exp.personSplits) && exp.personSplits.length ? 'Edit split' : 'Split'}
                      </button>
                    ) : null}
                    {canDuplicate ? (
                      <button type="button" className="byjan-btn-ghost" title="Duplicate" aria-label="Duplicate" onClick={() => { setViewExpense(null); void duplicateExpense(exp); }}><CopyPlus className="w-4 h-4" /></button>
                    ) : null}
                    {canFlag ? (
                      <button type="button" className={cn('byjan-btn-ghost', exp.flagged && 'text-amber-600')} title={exp.flagged ? 'Unflag' : 'Flag'} aria-label={exp.flagged ? 'Unflag' : 'Flag'} onClick={() => { void updateExpense(bookId!, exp.id, { flagged: !exp.flagged }).then(() => { setViewExpense({ ...exp, flagged: !exp.flagged }); return refreshExpenses(); }); }}><Star className="w-4 h-4" fill={exp.flagged ? 'currentColor' : 'none'} /></button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="byjan-btn-ghost text-rose-600" title="Delete" aria-label="Delete" data-testid="entry-view-delete" onClick={() => handleDeleteExpense(exp.id, exp.description)}><Trash2 className="w-4 h-4" /></button>
                    ) : null}
                  </div>
                </>
              );
            })() : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete entry — always confirm */}
      <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[190]" />
          <Dialog.Content className="byjan-dialog fixed z-[200] w-[min(100%-1.5rem,24rem)] rounded-[22px] bg-white border border-slate-200 p-5 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)] byjan-pop-in" data-testid="entry-delete-confirm">
            <Dialog.Title className="text-base font-semibold text-slate-900">Delete this entry?</Dialog.Title>
            <p className="text-sm text-slate-600 mt-2">“{deleteTarget?.description || 'This entry'}” will be removed from {book?.name || 'this book'} for everyone on it. You can undo for a short while after.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="byjan-btn-ghost" onClick={() => setDeleteTarget(null)}>Keep it</button>
              <button type="button" className="byjan-btn !bg-rose-600" data-testid="entry-delete-yes" onClick={() => { if (deleteTarget) void performDeleteExpense(deleteTarget.id, deleteTarget.description); }}>
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Save changes — confirm edits to shared entries */}
      <Dialog.Root open={editConfirmOpen} onOpenChange={(next) => { if (!isSaving) setEditConfirmOpen(next); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[190]" />
          <Dialog.Content className="byjan-dialog fixed z-[200] w-[min(100%-1.5rem,24rem)] rounded-[22px] bg-white border border-slate-200 p-5 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)] byjan-pop-in" data-testid="entry-edit-confirm">
            <Dialog.Title className="text-base font-semibold text-slate-900">Save these changes?</Dialog.Title>
            {editingExpense ? (
              <ul className="mt-2 text-sm text-slate-600 space-y-1">
                {Number(editingExpense.amount || 0) !== Number(amount || 0) ? (
                  <li>Amount: <s className="text-slate-400">{getCurrencySymbol(book.currency)}{Number(editingExpense.amount || 0).toLocaleString('en-IN')}</s> → <strong className="text-slate-900">{getCurrencySymbol(book.currency)}{Number(amount || 0).toLocaleString('en-IN')}</strong></li>
                ) : null}
                {String(editingExpense.description || '') !== description ? <li>Description → <strong className="text-slate-900">{description || '—'}</strong></li> : null}
                {String(editingExpense.category || '') !== (category === '__custom__' ? customCatInput : category) ? <li>Category → <strong className="text-slate-900">{category === '__custom__' ? customCatInput : category}</strong></li> : null}
                {String(editingExpense.paidAt || editingExpense.date || '').slice(0, 10) !== entryDate ? <li>Paid date → <strong className="text-slate-900">{formatDayLabel(entryDate)}</strong></li> : null}
                <li className="text-slate-500">Everyone on {book?.name || 'this book'} will see the updated entry.</li>
              </ul>
            ) : null}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="byjan-btn-ghost" onClick={() => setEditConfirmOpen(false)}>Keep editing</button>
              <button type="button" className="byjan-btn" data-testid="entry-edit-yes" disabled={isSaving} onClick={() => { editConfirmedRef.current = true; setEditConfirmOpen(false); void saveExpenseNow(); }}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save changes
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Expense Edit/Add Modal */}
      <Dialog.Root open={isExpenseModalOpen} onOpenChange={(next) => {
        if (!next && (isSaving || uploadingReceipt || attachBusyRef.current)) return;
        setIsExpenseModalOpen(next);
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[170]" />
          <Dialog.Content
            className="record-sheet fixed z-[180] flex flex-col gap-3 p-4 max-h-[90vh] overflow-y-auto bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)] pointer-events-auto"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => {
              if (isSaving || uploadingReceipt || attachBusyRef.current) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (isSaving || uploadingReceipt || attachBusyRef.current) event.preventDefault();
            }}
            onFocusOutside={(event) => {
              if (isSaving || uploadingReceipt || attachBusyRef.current) event.preventDefault();
            }}
          >
            <div className="record-sheet-handle md:hidden" aria-hidden />
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <Dialog.Title className="text-[17px] font-semibold text-slate-900">
                {editingExpense
                  ? 'Edit expense'
                  : entryType === 'in'
                    ? 'Add income'
                    : entryType === 'transfer'
                      ? 'Add transfer'
                      : 'Add expense'}
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            
                        <form onSubmit={handleSaveExpense} className="entry-form" data-testid="entry-form">
              <div className="entry-kind-seg" role="tablist" aria-label="What kind of money move">
                {MONEY_KIND_OPTIONS.map((opt) => {
                  const visual = MONEY_KIND_VISUAL[opt.txType];
                  const KindIcon = visual?.icon;
                  const on = txType === opt.txType;
                  return (
                  <button
                    key={opt.txType}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-on={on}
                    title={opt.hint}
                    onClick={() => { setTxType(opt.txType); setEntryType(opt.entryType); }}
                    className="entry-kind-btn"
                  >
                    {KindIcon ? <KindIcon className="w-4 h-4 shrink-0" strokeWidth={2.2} /> : null}
                    <span>{opt.label}</span>
                  </button>
                  );
                })}
              </div>
              <label className={cn('entry-amount-hero', entryType === 'in' ? 'is-in' : entryType === 'transfer' ? 'is-xfer' : 'is-out')}>
                <span className="entry-amount-ccy" aria-hidden>{getCurrencySymbol(book.currency)}</span>
                <input
                  type="number" step="0.01" required autoFocus
                  value={amount} onChange={e=>setAmount(e.target.value)}
                  className="money-amount-input"
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Amount in ${getCurrencySymbol(book.currency)}`}
                />
                <span className="entry-amount-hint">{MONEY_KIND_OPTIONS.find((o) => o.txType === txType)?.hint || ''}</span>
              </label>
              <div className="entry-field">
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.description}>What was it for?</EntryFieldLabel>
                <input 
                  type="text" required 
                  value={description} onChange={e=>setDescription(e.target.value)} 
                  className="byjan-input" 
                  placeholder={purposeFields.descriptionPlaceholder}
                />
                {editingExpense?.source === 'email' ? (
                  <p className="mt-1 text-[11px] text-slate-500">From inbound email — you can update this description anytime.</p>
                ) : null}
              </div>
              {editingExpense?.source === 'email' && (editingExpense.emailBody || editingExpense.emailSubject) ? (
                <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">Original email</p>
                  {editingExpense.emailSubject ? (
                    <p className="text-xs font-medium text-slate-800">{String(editingExpense.emailSubject)}</p>
                  ) : null}
                  {editingExpense.emailBody ? (
                    <p className="text-xs text-slate-600 whitespace-pre-wrap max-h-28 overflow-y-auto">{String(editingExpense.emailBody)}</p>
                  ) : null}
                  {editingExpense.fundSource ? (
                    <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-700">Paid from:</span> {String(editingExpense.fundSource)}</p>
                  ) : null}
                  {editingExpense.adjustments ? (
                    <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-700">Adjustment:</span> {String(editingExpense.adjustments)}</p>
                  ) : null}
                </div>
              ) : null}
              {editingExpense && buildEvidenceTrail(editingExpense).length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why Byjan?</p>
                  {buildEvidenceTrail(editingExpense).map((step, i) => (
                    <p key={`${step.label}-${i}`} className="text-[12px] text-slate-600"><span className="font-semibold text-slate-700">{step.label}:</span> {step.detail}</p>
                  ))}
                </div>
              )}
              <div>
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.category}>{purposeFields.categoryLabel}</EntryFieldLabel>
                {categoryOptions.length > 0 ? (
                  <div className="purpose-cat-row" role="listbox" aria-label={purposeFields.categoryLabel}>
                    {categoryOptions.slice(0, 8).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className="purpose-cat-chip"
                        data-on={category === cat}
                        onClick={() => setCategory(cat)}
                      >
                        <CategoryIconMark name={cat} />
                        {cat}
                      </button>
                    ))}
                    {category && category !== '__custom__' && !categoryOptions.slice(0, 8).includes(category) ? (
                      <button type="button" className="purpose-cat-chip" data-on="true">{category}</button>
                    ) : null}
                    <button type="button" className="purpose-cat-chip" data-on={category === '__custom__'} onClick={() => setCategory('__custom__')}>
                      + New
                    </button>
                    {categoryOptions.length > 8 ? (
                      <select
                        className="purpose-cat-chip !h-8 !w-auto max-w-[42vw] px-2 border-slate-200 bg-white"
                        value={categoryOptions.slice(8).includes(category) ? category : ''}
                        onChange={(e) => { if (e.target.value) setCategory(e.target.value); }}
                        aria-label="More categories"
                      >
                        <option value="">More</option>
                        {categoryOptions.slice(8).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : (
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full mb-2 h-9 border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__" className="font-semibold text-blue-600">+ New category…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {category === '__custom__' && (
                  <input 
                    type="text" required
                    value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)}
                    className="byjan-input mt-2"
                    placeholder="Name the new category"
                  />
                )}
              </div>
              <div className="entry-row-2">
                <div className="entry-field">
                  <EntryFieldLabel icon={ENTRY_FIELD_ICONS.date}>Paid on</EntryFieldLabel>
                  <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="byjan-input" title={editingExpense ? `Created ${formatDayLabel(expenseCreatedDay(editingExpense)) || 'when first saved'}` : 'Date on the receipt or when money moved'} />
                </div>
                <div className="entry-field">
                  <EntryFieldLabel icon={ENTRY_FIELD_ICONS.account}>Account</EntryFieldLabel>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="byjan-input">
                    {readAccounts(book).map((acct) => (
                      <option key={acct.id} value={acct.id}>{acct.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="entry-field">
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.payment}>Paid with</EntryFieldLabel>
                <div className="entry-pay-grid" role="listbox" aria-label="Payment method">
                  {ENTRY_PAY_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`entry-pay-chip${paymentMethod === m.id ? ' is-on' : ''}`}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      {m.apps.length ? (
                        <span className="entry-pay-mini">
                          {m.apps.slice(0, 3).map((app) => (
                            <span key={app}>
                              <UpiBrandMark app={app} size={20} />
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="entry-pay-cash" aria-hidden>₹</span>
                      )}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="entry-field relative">
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.merchant}>{purposeFields.merchantLabel}</EntryFieldLabel>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  onFocus={() => setMerchantFocus(true)}
                  onBlur={() => window.setTimeout(() => setMerchantFocus(false), 120)}
                  className="byjan-input"
                  placeholder={purposeFields.merchantPlaceholder}
                  autoComplete="off"
                />
                {merchantFocus && merchantSuggestions.length > 0 && (
                  <div className="merchant-suggest" role="listbox">
                    {merchantSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="merchant-suggest-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setMerchant(name); setMerchantFocus(false); }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="entry-more-bar">
                <input
                  ref={receiptFileRef}
                  type="file"
                  accept={RECEIPT_FILE_ACCEPT}
                  className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none"
                  data-testid="entry-receipt-file"
                  tabIndex={-1}
                  onChange={(event) => { void attachReceiptFiles(event.target.files); }}
                />
                <button
                  type="button"
                  className="byjan-btn-ghost !h-9 text-xs"
                  data-testid="entry-attach-receipt"
                  disabled={uploadingReceipt}
                  onClick={() => {
                    attachBusyRef.current = true;
                    window.setTimeout(() => { if (!uploadingReceipt) attachBusyRef.current = false; }, 12_000);
                    receiptFileRef.current?.click();
                  }}
                >
                  {uploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {receiptMeta?.receiptPath ? (receiptMeta.receiptName || 'Document attached') : 'Attach document'}
                </button>
                <button
                  type="button"
                  className="byjan-btn-ghost !h-9 text-xs"
                  disabled={uploadingReceipt}
                  onClick={() => void attachReceiptFromCamera()}
                >
                  Camera
                </button>
                <button
                  type="button"
                  className="entry-more-toggle"
                  data-testid="entry-more"
                  aria-expanded={moreFields}
                  onClick={() => {
                    setMoreFields((v) => {
                      const next = !v;
                      if (next) {
                        window.setTimeout(() => {
                          document.querySelector('[data-testid="entry-more-panel"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }, 40);
                      }
                      return next;
                    });
                  }}
                >
                  {moreFields ? 'Fewer details' : 'More details'}
                  <ChevronDown className={cn('w-4 h-4 transition-transform', moreFields && 'rotate-180')} />
                </button>
              </div>
              <div className={cn('entry-more-panel', moreFields && 'is-open')} hidden={!moreFields} data-testid="entry-more-panel">
              {purposeFields.entities.length > 0 ? (
                <div className="entry-field">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{purposeFields.entityLabel}</label>
                  <div className="purpose-cat-row">
                    {purposeFields.entities.map((ent) => (
                      <button
                        key={ent}
                        type="button"
                        className="purpose-cat-chip"
                        data-on={purposeEntityType === ent}
                        onClick={() => setPurposeEntityType(ent)}
                      >
                        <CategoryIconMark name={ent} />
                        {ent}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="entry-field">
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.tags}>{purposeFields.tagsLabel}</EntryFieldLabel>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="byjan-input" placeholder="Comma-separated, e.g. trip, gst" />
              </div>
              <div className="entry-field">
                <EntryFieldLabel icon={ENTRY_FIELD_ICONS.notes}>Notes</EntryFieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="byjan-input min-h-[64px]" placeholder={purposeFields.notesPlaceholder} />
              </div>
              <div className="entry-toggles">
                <label className="entry-toggle" data-on={reimbursable}>
                  <input type="checkbox" checked={reimbursable} onChange={(e) => setReimbursable(e.target.checked)} />
                  Get this money back
                </label>
                <label className="entry-toggle" data-on={billable}>
                  <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
                  Bill to a client
                </label>
                {canSplitEqual && (
                <label className="entry-toggle" data-on={splitWithTeam}>
                  <input type="checkbox" checked={splitWithTeam} onChange={(e) => setSplitWithTeam(e.target.checked)} />
                  Split equally with everyone
                </label>
                )}
              </div>
              </div>
              {mismatchThanks && (receiptOcrText || receiptMeta) && !editingExpense ? (
                <p className="text-[13px] leading-snug text-slate-600 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">{mismatchThanks}</p>
              ) : null}
              <div className="entry-form-actions">
                {(receiptOcrText || receiptMeta) && !editingExpense && !mismatchThanks ? (
                    <button
                      type="button"
                      className="byjan-btn-ghost !mr-auto"
                      onClick={async () => {
                        if (!receiptOcrText.trim()) {
                          setMismatchThanks('Sorry for the inconvenience — we are aiming for 100% accuracy so your finances stay smart. Thanks for your patience.');
                          return;
                        }
                        const goldAmt = Number(amount || 0);
                        const result = await reportParseMismatch({
                          bookId,
                          ocrText: receiptOcrText,
                          predicted: [{ amount: 0, merchant: merchant || description }],
                          gold: goldAmt > 0 ? { amount: goldAmt, merchant: merchant || description } : undefined,
                        });
                        if (result.id) mismatchIdRef.current = result.id;
                        setMismatchThanks(result.thanks);
                      }}
                    >
                      Is this a mismatch?
                    </button>
                ) : null}
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={isSaving || uploadingReceipt} className="byjan-btn" data-testid="entry-save">
                  {isSaving && <span className="app-loader-ring app-loader-ring-sm" />}
                  {isSaving ? (editingExpense ? 'Saving…' : 'Adding…') : (editingExpense ? 'Save changes' : 'Add expense')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={isAnnounceOpen} onOpenChange={setIsAnnounceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content className="byjan-dialog fixed z-[100] grid w-full max-w-md gap-4 p-5 rounded-[22px] bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]">
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

      <Dialog.Root open={confirmDelete} onOpenChange={(open) => { if (!deletingLedger) setConfirmDelete(open); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content className="byjan-dialog fixed z-[100] w-[min(100%-1.5rem,24rem)] rounded-[22px] bg-white border border-slate-200 p-5 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]">
            <Dialog.Title className="text-base font-bold text-slate-900">Delete this book?</Dialog.Title>
            <p className="text-sm text-slate-600 mt-2">“{book?.name}” and its entries will be removed for the team. This cannot be undone from the app.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="byjan-btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="byjan-btn !bg-rose-600" disabled={deletingLedger} onClick={() => void confirmDeleteLedger()}>
                {deletingLedger ? 'Deleting…' : 'Delete book'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit book */}
      <Dialog.Root open={isEditBookOpen} onOpenChange={setIsEditBookOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content className="byjan-dialog fixed z-[100] w-[min(100%-1.5rem,24rem)] rounded-[22px] bg-white border border-slate-200 p-5 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]">
            <div className="flex items-center justify-between mb-3">
              <Dialog.Title className="text-base font-bold text-slate-900">Edit book</Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></Dialog.Close>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const name = editBookName.trim();
                if (!name || !bookId || !canManageUsers) return;
                void (async () => {
                  try {
                    setSavingBook(true);
                    const next = await updateLedger(bookId, { name });
                    setBook(next || { ...book, name });
                    addToast('Book updated', 'success');
                    setIsEditBookOpen(false);
                  } catch (err: any) {
                    addToast(err?.message || 'Could not update book', 'error');
                  } finally {
                    setSavingBook(false);
                  }
                })();
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Book name</label>
                <input
                  className="byjan-input"
                  value={editBookName}
                  onChange={(e) => setEditBookName(e.target.value)}
                  required
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Dialog.Close asChild>
                  <button type="button" className="byjan-btn-ghost">Cancel</button>
                </Dialog.Close>
                <button type="submit" disabled={savingBook || !editBookName.trim()} className="byjan-btn">
                  {savingBook ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Members Modal */}
      <Dialog.Root open={isMembersModalOpen} onOpenChange={(open) => {
        setIsMembersModalOpen(open);
        if (!open) setInviteSentTo('');
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content className="byjan-dialog fixed z-[100] flex flex-col w-full max-w-lg max-h-[85vh] overflow-hidden rounded-[22px] bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <Dialog.Title className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> People & access
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
                <p className="text-sm text-slate-600 leading-relaxed">Anyone in this book can send a receipt to this email. Byjan saves it and tells the group.</p>
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
                        {roleLabel(data.role)}
                      </span>
                      
                      {(canManageUsers || uid === currentUser?.uid) && (
                        <button
                          onClick={() => handleRemoveMember(uid, uid === currentUser?.uid)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={uid === currentUser?.uid ? "Leave this book" : "Remove person"}
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
                  <UserPlus className="w-3.5 h-3.5 text-slate-500"/> Invite someone
                </h3>
                <form onSubmit={handleInvite} className="flex flex-col gap-2">
                  <input 
                    type="email" required placeholder="email@company.com" 
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    className="byjan-input"
                    autoComplete="email"
                    inputMode="email"
                  />
                  <p className="text-[11px] leading-relaxed text-slate-500">{EMAIL_NOTIFY_HINT}</p>
                  {inviteSentTo ? (
                    <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                      Invitation sent to <strong>{inviteSentTo}</strong>. They must sign in with that email to accept. This screen stays open until you close it.
                    </div>
                  ) : null}
                  <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-full sm:w-32 h-[34px] py-1.5 border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Manager</SelectItem>
                      <SelectItem value="contributor">Can add</SelectItem>
                      <SelectItem value="auditor">Can check</SelectItem>
                      <SelectItem value="viewer">Can view</SelectItem>
                    </SelectContent>
                  </Select>
                  <button type="submit" disabled={inviting} className="byjan-btn">
                    {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Invite
                  </button>
                  </div>
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

      {bookId && (
        <CapturePreviewSheet
          open={Boolean(capturePreview)}
          preview={capturePreview}
          bookId={bookId}
          currency={String(book?.currency || 'INR')}
          onClose={() => setCapturePreview(null)}
          onConfirmed={(expense) => {
            applyExpenseLocal(expense);
            setCapturePreview(null);
            setSuccessCount(1);
            setSuccessExpense({ ...expense, bookId });
          }}
          onToast={addToast}
        />
      )}

      <WebScanSheet
        open={webScanOpen}
        onClose={() => setWebScanOpen(false)}
        onCaptured={(files) => {
          setWebScanOpen(false);
          launchScanBatch(files);
        }}
      />

      <ReceiptCaptureFlow
        open={Boolean(receiptLaunch)}
        launch={receiptLaunch}
        bookId={bookId}
        bookName={String(book?.name || '')}
        onClose={() => {
          setReceiptLaunch(null);
          clearPendingCapture();
        }}
        onManualForm={openManualFromReceipt}
        onConfirmed={(expense, extras) => {
          applyExpenseLocal(expense);
          setReceiptLaunch(null);
          clearPendingCapture();
          void refreshExpenses();
          if (extras?.duplicate) {
            addToast('Same receipt — nothing new added', 'success');
            setSuccessExpense(null);
            return;
          }
          if (extras?.needsEdit) {
            addToast('Could not read amount — saved as draft for you to edit', 'error');
            setSuccessExpense(null);
            return;
          }
          setSuccessCount(Number(extras?.count || 1));
          setSuccessExpense({ ...expense, bookId });
        }}
      />

      {successExpense ? (
        <MoneySheet open onClose={() => setSuccessExpense(null)} title="Saved">
          <ExpenseSuccessCard
            amountPaise={toPaise(Number(successExpense.amount || 0))}
            merchant={String(successExpense.merchant || successExpense.description || '')}
            category={String(successExpense.category || '')}
            bookName={String(book?.name || '')}
            receiptAttached={Boolean(successExpense.receiptPath)}
            symbol={getCurrencySymbol(book?.currency || 'INR')}
            count={successCount}
            onView={() => setSuccessExpense(null)}
            onSplit={
              canSplitEntry && peopleFromBook(book).length > 1 && String(successExpense.entryType || 'out') === 'out'
                ? () => {
                    setSplitTarget({
                      id: String(successExpense.id),
                      amount: Number(successExpense.amount || 0),
                      merchant: String(successExpense.merchant || ''),
                      description: String(successExpense.description || ''),
                    });
                    setSuccessExpense(null);
                  }
                : undefined
            }
            onDone={() => setSuccessExpense(null)}
          />
        </MoneySheet>
      ) : null}

      {splitPickOpen && bookId ? (
        <SplitEntryPickSheet
          open
          bookName={book?.name}
          currencySymbol={getCurrencySymbol(book?.currency || 'INR')}
          entries={(expenses || [])
            .filter((e) => !e.deleted && !e.deletedAt && String(e.entryType || 'out') === 'out' && Number(e.amount || 0) > 0)
            .slice(0, 80)
            .map((e) => ({
              id: String(e.id),
              amount: Number(e.amount || 0),
              merchant: String(e.merchant || ''),
              description: String(e.description || ''),
              date: String(e.date || e.createdAt || ''),
              alreadySplit: Array.isArray(e.personSplits) && e.personSplits.length > 0,
            }))}
          onClose={() => setSplitPickOpen(false)}
          onViewSettlements={() => {
            setSplitPickOpen(false);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', 'splits');
              return next;
            });
          }}
          onPick={(entry) => {
            setSplitPickOpen(false);
            if (!String((userProfile as { upiId?: string } | null)?.upiId || '').trim()) {
              setUpiSetupOpen(true);
              addToast('Add a valid UPI ID before splitting — it must be your ID so others can pay you.', 'error');
              return;
            }
            if (!canSplitEntry) {
              addToast('Split is not available for your role', 'error');
              return;
            }
            setSplitTarget({
              id: entry.id,
              amount: entry.amount,
              merchant: entry.merchant,
              description: entry.description,
            });
          }}
        />
      ) : null}

      {splitTarget && bookId ? (
        <SplitExpenseSheet
          open
          bookId={bookId}
          book={book}
          expenseId={splitTarget.id}
          amount={splitTarget.amount}
          merchant={splitTarget.merchant}
          description={splitTarget.description}
          currencySymbol={getCurrencySymbol(book?.currency || 'INR')}
          onClose={() => setSplitTarget(null)}
          onSaved={(personSplits) => {
            setExpenses((curr) => curr.map((e) => String(e.id) === String(splitTarget.id) ? { ...e, personSplits } : e));
            setSplitTarget(null);
            addToast('Split saved — settlements ready to pay', 'success');
          }}
          onToast={addToast}
        />
      ) : null}

      <UpiQrPaySheet
        open={qrPayOpen}
        bookId={bookId}
        onClose={() => setQrPayOpen(false)}
        onToast={(msg, kind) => addToast(msg, kind || 'success')}
        onRecorded={() => { setQrPayOpen(false); void refreshExpenses(); }}
      />

      <VoiceEntrySheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onToast={addToast}
        onReady={(parsed) => {
          openNewExpense({
            category: parsed.category && parsed.category !== 'Uncategorized' ? parsed.category : undefined,
            entryType: parsed.entryType,
            merchant: parsed.merchant,
            description: parsed.merchant || parsed.transcript,
          });
          setAmount(parsed.amount ? String(parsed.amount) : '');
          if (parsed.entryType === 'in') setTxType('INCOME');
        }}
      />

      <UpiSetupSheet
        open={upiSetupOpen}
        initialUpiId={String((userProfile as any)?.upiId || '')}
        initialName={String((userProfile as any)?.upiDisplayName || userProfile?.displayName || '')}
        onClose={() => setUpiSetupOpen(false)}
        onSaved={() => void refreshUserProfile()}
        onToast={addToast}
      />

      {/* Toast Notification */}

      </div>
    </>
  );
}
