import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createLedger, listLedgers } from '../lib/ledgers';
import { listAllExpenses } from '../lib/expenses';
import { useBooksTenantMeta } from '../lib/tenant';
import { getCurrencySymbol } from '../lib/currency';
import { initials, readRecentLedgers, sparkDays } from '../lib/ledger-advanced';
import { formatIndianAmount, workspaceBridges } from '../lib/bridge-automations';
import { Plus, Check, X, Users, ArrowUpRight, RefreshCw, Wallet, TrendingUp, Receipt, Shield, ChevronRight, IndianRupee, ScanLine, PenLine } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { ListControls, usePagedList } from '../components/ListControls';
import { FeatureIcon } from '../books/ui/icons';
import { acceptLedgerInvite, declineLedgerInvite, listLedgerInvites, type LedgerInvite } from '../lib/invites';
import { clearStoreCache } from '../lib/store';
import { roleLabel } from '../lib/plain-language';
import { useFeatures } from '../lib/use-features';
import ReceiptCaptureFlow, { type ReceiptLaunch } from '../components/ReceiptCaptureFlow';
import { cacheMoneyBooks, readPendingCapture, clearPendingCapture, rememberMoneyBook, readCachedMoneyBooks, type PendingCapture } from '../components/ShareIntentListener';
import { readUserJson, writeUserJson } from '../lib/user-cache';
import PendingPayStrip from '../components/PendingPayStrip';
import { CapacitorService } from '../lib/capacitor';
import { CameraSource } from '@capacitor/camera';
import BrandLogo from '../components/BrandLogo';
import BookPickSheet from '../components/BookPickSheet';
import FinancialInbox from '../components/FinancialInbox';
import {
  RECOMMENDED_PURPOSES,
  detectPurposeFromName,
  getPurposeTemplate,
  suggestCustomPurposeConfig,
  type PurposeId,
} from '../lib/purpose-templates';
import { buildAttentionInbox } from '../lib/financial-memory';
import { detectAnomalies, detectCommitments } from '../lib/money-intelligence';
import { detectRegularPayments } from '../lib/recurrence-engine';

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
  const { currentUser, userProfile, isSuperUser } = useAuth();
  const { on: hasFeature, anyOn: hasAnyFeature, canSeeMoney, tree: businessTree } = useFeatures();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [statsReady, setStatsReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPurposeId, setNewPurposeId] = useState<PurposeId | null>(null);
  const [customPurposeLabel, setCustomPurposeLabel] = useState('');
  const [nameDetectDismissed, setNameDetectDismissed] = useState(false);
  const [attentionItems, setAttentionItems] = useState<ReturnType<typeof buildAttentionInbox>>([]);
  const [bookStats, setBookStats] = useState<Record<string, BookStat>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [bridges, setBridges] = useState<ReturnType<typeof workspaceBridges> | null>(null);
  const recentIds = readRecentLedgers();

  const emptyStats = {
    totalIn: 0,
    totalOut: 0,
    monthIn: 0,
    monthOut: 0,
    reimbursable: 0,
    entries: 0,
    uncategorized: 0,
    userActivity: {} as Record<string, number>,
  };

  const fetchData = async (opts?: { silent?: boolean }) => {
    if (!currentUser || !userProfile) return;
    const uid = currentUser.uid;
    try {
      if (!opts?.silent) {
        setLoading(true);
        setStatsReady(false);
        // Paint last-known totals for THIS user only.
        const parsed = readUserJson<{
          globalStats?: typeof globalStats;
          bookStats?: Record<string, BookStat>;
          books?: BookItem[];
          at?: number;
        }>(uid, 'dash_stats');
        if (parsed?.globalStats && Date.now() - Number(parsed.at || 0) < 15 * 60_000) {
          setGlobalStats(parsed.globalStats);
          if (parsed.bookStats) setBookStats(parsed.bookStats);
          if (parsed.books?.length) setBooks(parsed.books);
          setStatsReady(true);
          setLoading(false);
        }
      }
      setLoadError('');
      if (!canSeeMoney) {
        setBooks([]);
        setBookStats({});
        setBridges(null);
        setGlobalStats(emptyStats);
        setInvites([]);
        setStatsReady(true);
        setLoading(false);
        return;
      }

      // One expenses API (includes books) + invites — no duplicate listLedgers.
      const [allExp, inviteRows] = await Promise.all([
        listAllExpenses().catch(() => ({ expenses: [] as Array<Record<string, unknown>>, books: [] as Array<Record<string, unknown>> })),
        listLedgerInvites().catch(() => [] as InviteItem[]),
      ]);

      const fetchedBooks = (allExp.books || []).map((book: any) => ({
        id: String(book.id),
        name: String(book.name || 'Money book'),
        ownerId: String(book.ownerId || ''),
        currency: String(book.currency || 'INR'),
        pinned: Boolean(book.pinned),
        archived: Boolean(book.archived),
        accentHue: Number(book.accentHue || 0) || undefined,
        roles: (book.roles || {}) as BookItem['roles'],
      })).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
      setBooks(fetchedBooks);
      setInvites(inviteRows);
      setLoading(false);
      cacheMoneyBooks(fetchedBooks.map((b) => ({ id: b.id, name: b.name, currency: b.currency })));

      try {
      let tIn = 0; let tOut = 0; let monthIn = 0; let monthOut = 0; let reimbursable = 0; let uncategorized = 0;
      const monthKey = new Date().toISOString().slice(0, 7);
      let activity: Record<string, number> = {};
      const nextBookStats: Record<string, BookStat> = {};
      const lastKey = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
      const byBook: Record<string, Array<Record<string, unknown>>> = {};
      const expenses = Array.isArray(allExp.expenses) ? allExp.expenses : [];
      if (fetchedBooks.length) {
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
        const nextGlobal = {
          totalIn: tIn,
          totalOut: tOut,
          monthIn,
          monthOut,
          reimbursable,
          entries: expenses.length,
          uncategorized,
          userActivity: activity,
        };
        setBookStats(nextBookStats);
        setBridges(workspaceBridges(expenses));
        setGlobalStats(nextGlobal);
        writeUserJson(uid, 'dash_stats', {
          at: Date.now(),
          globalStats: nextGlobal,
          bookStats: nextBookStats,
          books: fetchedBooks,
        });

        const drafts = expenses.filter((e) => String(e.status || '').toLowerCase() === 'draft' || String(e.financialStatus || '') === 'DRAFT');
        const uncategorizedRows = expenses.filter((e) => {
          const cat = String(e.category || '').trim().toLowerCase();
          return !cat || cat === 'uncategorized';
        }).slice(0, 8);
        const dupHits = detectAnomalies(expenses as any).filter((h) => h.kind === 'duplicate').slice(0, 5);
        const commitments = detectCommitments(expenses as any).slice(0, 4);
        const recurring = detectRegularPayments(expenses.map((e) => ({
          id: String(e.id),
          amount: Number(e.amount || 0),
          date: String(e.date || ''),
          merchant: String(e.merchant || ''),
          description: String(e.description || ''),
          category: String(e.category || ''),
          entryType: String(e.entryType || 'out'),
          paymentMethod: String(e.paymentMethod || ''),
        }))).filter((p) => p.band !== 'NOT_RECURRING').slice(0, 4);
        setAttentionItems(buildAttentionInbox({
          drafts: drafts as any,
          uncategorized: uncategorizedRows as any,
          duplicates: dupHits.map((h) => ({
            id: h.id,
            message: h.message,
            bookId: String((expenses.find((e) => String(e.id) === h.id) || {}).bookId || ''),
          })),
          recurring: recurring.map((r) => ({ id: r.id, label: r.merchant, amount: r.avgAmount })),
          commitments: commitments.map((c) => ({
            id: c.id,
            label: c.label,
            nextEstimate: c.nextEstimate,
            amount: c.amount,
          })),
        }));
      } else {
        setBookStats({});
        setBridges(null);
        setGlobalStats({ totalIn: 0, totalOut: 0, monthIn: 0, monthOut: 0, reimbursable: 0, entries: 0, uncategorized: 0, userActivity: {} });
        setAttentionItems([]);
      }
      } catch (err) {
        console.error('Ledger extras error:', err);
      } finally {
        setStatsReady(true);
      }
    } catch (err) {
      console.error('Fetch API error:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load your workspace.');
    } finally {
      setLoading(false);
      setStatsReady(true);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [currentUser?.uid, canSeeMoney, userProfile?.features]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0 });
  }, [location.pathname]);

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
      const purposeId = (newPurposeId || 'default') as PurposeId;
      const tpl = getPurposeTemplate(purposeId);
      let categories = [...tpl.categories];
      let quickActions = [...tpl.quickActions];
      let purposeLabel = tpl.label;
      let purposeConfig: Record<string, unknown> | undefined;

      if (purposeId === 'other' && customPurposeLabel.trim()) {
        const custom = suggestCustomPurposeConfig(customPurposeLabel.trim());
        categories = custom.categories;
        purposeLabel = custom.label;
        purposeConfig = {
          customLabel: custom.label,
          entities: custom.entities,
          suggested: true,
          confirmedAt: new Date().toISOString(),
        };
      } else if (purposeId !== 'default') {
        purposeConfig = {
          purposeId,
          confirmedAt: new Date().toISOString(),
        };
      }

      await createLedger({
        name: newBookName.trim(),
        currency: newCurrency || userProfile.defaultCurrency || 'INR',
        purposeId,
        purposeLabel,
        categories,
        quickActions,
        purposeConfig,
      });
      setNewBookName('');
      setNewPurposeId(null);
      setCustomPurposeLabel('');
      setNameDetectDismissed(false);
      setShowNewBook(false);
      addToast(purposeId === 'default' ? 'Money book created' : `${purposeLabel} book ready`, 'success');
      void fetchData({ silent: true });
    } catch (err) {
      console.error('Fetch API error:', err);
      addToast(err instanceof Error ? err.message : 'Could not create money book', 'error');
    } finally {
      setCreating(false);
    }
  };

  const createBasicBook = async () => {
    if (!currentUser || !userProfile || !newBookName.trim()) {
      if (!newBookName.trim()) addToast('Enter a book name first', 'error');
      return;
    }
    setNewPurposeId('default');
    setCreating(true);
    try {
      const tpl = getPurposeTemplate('default');
      await createLedger({
        name: newBookName.trim(),
        currency: newCurrency || userProfile.defaultCurrency || 'INR',
        purposeId: 'default',
        purposeLabel: tpl.label,
        categories: tpl.categories,
        quickActions: tpl.quickActions,
      });
      setNewBookName('');
      setNewPurposeId(null);
      setCustomPurposeLabel('');
      setNameDetectDismissed(false);
      setShowNewBook(false);
      addToast('Basic book created', 'success');
      void fetchData({ silent: true });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not create money book', 'error');
    } finally {
      setCreating(false);
    }
  };

  const nameDetection = !nameDetectDismissed ? detectPurposeFromName(newBookName) : null;

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [receiptLaunch, setReceiptLaunch] = useState<ReceiptLaunch | null>(null);
  const [bookPickKind, setBookPickKind] = useState<'add' | 'scan' | 'voice' | 'share' | null>(null);
  const [sharePending, setSharePending] = useState<PendingCapture | null>(null);
  const [sharePickBooks, setSharePickBooks] = useState<Array<{ id: string; name: string }>>([]);
  const [sharePickLoading, setSharePickLoading] = useState(false);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => {
    const openFromPending = () => {
      const pending = readPendingCapture();
      if (!pending?.imageDataUrl && !pending?.text) return;

      const cached = readCachedMoneyBooks();
      const needPick = pending.requireBookPick !== false;

      // Prefer the reliable BookPickSheet (same as Add entry) when a book must be chosen.
      if (needPick) {
        if (cached.length === 1) {
          setSharePending(null);
          setSharePickBooks([]);
          setSharePickLoading(false);
          setReceiptLaunch({
            text: pending.text,
            imageDataUrl: pending.imageDataUrl,
            fileName: pending.fileName,
            mimeType: pending.mimeType,
            source: pending.source || 'share',
            preferredBookId: cached[0].id,
            requireBookPick: false,
          });
          return;
        }
        setSharePending(pending);
        setSharePickBooks(cached.map((b) => ({ id: b.id, name: b.name })));
        setBookPickKind('share');
        setSharePickLoading(cached.length === 0);
        void fetchData({ silent: true });
        // Always refresh ledger list so the sheet is not stuck empty/loading.
        void listLedgers()
          .then((rows) => {
            const visible = (rows || [])
              .filter((b) => b && !b.deleted && !b.deletedAt && !b.archived)
              .map((b) => ({ id: String(b.id), name: String(b.name || 'Money book'), currency: String(b.currency || 'INR') }));
            cacheMoneyBooks(visible);
            setSharePickBooks(visible.map((b) => ({ id: b.id, name: b.name })));
            if (visible.length === 1) {
              const only = visible[0];
              setBookPickKind(null);
              setSharePending(null);
              setSharePickLoading(false);
              rememberMoneyBook(only.id);
              setReceiptLaunch({
                text: pending.text,
                imageDataUrl: pending.imageDataUrl,
                fileName: pending.fileName,
                mimeType: pending.mimeType,
                source: pending.source || 'share',
                preferredBookId: only.id,
                requireBookPick: false,
              });
            }
          })
          .catch(() => undefined)
          .finally(() => setSharePickLoading(false));
        return;
      }

      setSharePending(null);
      setSharePickBooks([]);
      setSharePickLoading(false);
      setReceiptLaunch({
        text: pending.text,
        imageDataUrl: pending.imageDataUrl,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        source: pending.source || 'share',
        preferredBookId: pending.preferredBookId,
        requireBookPick: false,
      });
    };

    const params = new URLSearchParams(location.search);
    if (params.get('capture') === '1') {
      const pending = readPendingCapture();
      if (pending?.imageDataUrl || pending?.text) {
        openFromPending();
        navigate(location.pathname, { replace: true });
      } else {
        const t = window.setTimeout(() => {
          const again = readPendingCapture();
          if (again?.imageDataUrl || again?.text) {
            openFromPending();
            navigate(location.pathname, { replace: true });
          } else {
            navigate(location.pathname, { replace: true });
          }
        }, 180);
        return () => window.clearTimeout(t);
      }
    }

    window.addEventListener('byjan-pending-capture', openFromPending);
    return () => window.removeEventListener('byjan-pending-capture', openFromPending);
  }, [location.search, location.pathname, navigate]);

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
      console.error('Fetch API error:', err);
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
  const uid = currentUser?.uid || '';
  const myRoleOn = (book: BookItem) => book.roles[uid]?.role || (book.ownerId === uid ? 'owner' : 'viewer');
  const managedBooks = visibleBooks.filter((book) => ['owner'].includes(myRoleOn(book)) || book.ownerId === uid);
  const isBusinessOwner = Boolean(tenant && uid && tenant.ownerId === uid);
  const openPeople = (bookId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    navigate(`/book/${bookId}`, { state: { openPeople: true } });
  };
  const scanHomeReceipt = async (bookId?: string) => {
    try {
      await CapacitorService.requestCameraPermission();
      const photo = await CapacitorService.takePicture({ source: CameraSource.Prompt, quality: 85 });
      const dataUrl = photo.dataUrl || (photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : '');
      if (!dataUrl) throw new Error('No photo data');
      const preferred = bookId || (visibleBooks.length === 1 ? visibleBooks[0].id : '');
      setReceiptLaunch({
        source: 'camera',
        imageDataUrl: dataUrl,
        fileName: `receipt-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        preferredBookId: preferred || undefined,
        requireBookPick: !preferred,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open camera';
      if (/cancel/i.test(msg)) return;
      addToast(msg, 'error');
    }
  };

  const addHomeEntry = (bookId?: string) => {
    const id = bookId || (visibleBooks.length === 1 ? visibleBooks[0]?.id : '');
    if (id) navigate(`/book/${id}`, { state: { openEntry: true } });
    else if (!visibleBooks.length) setShowNewBook(true);
    else setBookPickKind('add');
  };

  const voiceHomeEntry = (bookId?: string) => {
    const id = bookId || (visibleBooks.length === 1 ? visibleBooks[0]?.id : '');
    if (id) navigate(`/book/${id}`, { state: { openVoice: true } });
    else if (!visibleBooks.length) setShowNewBook(true);
    else setBookPickKind('voice');
  };

  const requestQuick = (kind: 'add' | 'scan' | 'voice') => {
    if (loading) {
      setBookPickKind(kind);
      return;
    }
    if (!visibleBooks.length) {
      setShowNewBook(true);
      return;
    }
    // Always let the user pick when more than one book; single book still confirms via sheet.
    setBookPickKind(kind);
  };

  // Raised center + button on the tab bar fires these.
  useEffect(() => {
    const onQuick = (event: Event) => {
      const kind = (event as CustomEvent<string>).detail;
      if (kind === 'scan' || kind === 'add' || kind === 'voice') requestQuick(kind);
    };
    window.addEventListener('byjan-quick', onQuick);
    return () => window.removeEventListener('byjan-quick', onQuick);
  });

  const onBookPicked = (bookId: string) => {
    const kind = bookPickKind;
    setBookPickKind(null);
    if (!kind) return;
    if (kind === 'share') {
      const pending = sharePending || readPendingCapture();
      setSharePending(null);
      if (!pending?.imageDataUrl && !pending?.text) return;
      rememberMoneyBook(bookId);
      setReceiptLaunch({
        text: pending.text,
        imageDataUrl: pending.imageDataUrl,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        source: pending.source || 'share',
        preferredBookId: bookId,
        requireBookPick: false,
      });
      return;
    }
    if (kind === 'scan') void scanHomeReceipt(bookId);
    else if (kind === 'add') addHomeEntry(bookId);
    else voiceHomeEntry(bookId);
  };

  const pickSheetBooks = (() => {
    if (visibleBooks.length) {
      return visibleBooks.map((b) => ({ id: b.id, name: b.name, role: myRoleOn(b) }));
    }
    if (bookPickKind === 'share' && sharePickBooks.length) {
      return sharePickBooks;
    }
    return readCachedMoneyBooks().map((b) => ({ id: b.id, name: b.name }));
  })();

  const pickSheetTitle = bookPickKind === 'scan'
    ? 'Scan into which book?'
    : bookPickKind === 'voice'
      ? 'Voice entry for which book?'
      : bookPickKind === 'share'
        ? 'Save shared receipt to which book?'
        : 'Add entry to which book?';
  const pickSheetSubtitle = bookPickKind === 'share'
    ? 'Pick a money book for this shared receipt'
    : 'Pick a money book to continue';

  const peopleCount = (book: BookItem) => Math.max(Object.keys(book.roles || {}).length, book.ownerId ? 1 : 0);

  const renderLedgerCard = (book: BookItem) => {
    const role = myRoleOn(book);
    const stat = bookStats[book.id];
    const symbol = getCurrencySymbol(book.currency);
    const maxSpark = Math.max(...(stat?.spark || [1]), 1);
    const people = peopleCount(book);
    const canManage = role === 'owner' || role === 'admin';
    const netVal = stat ? Math.abs(stat.net) : 0;
    const netNeg = Boolean(stat && stat.net < 0);
    return (
      <article key={book.id} className="md3-book">
        <Link to={`/book/${book.id}`} className="md3-book-main">
          <span className="md3-book-icon" aria-hidden>
            <span className="md3-book-icon-face">{initials(book.name)}</span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[#0B0F1F] leading-tight tracking-tight truncate">{book.name}</h3>
              <span className="md3-badge">{roleLabel(role)}</span>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5 truncate">
              {book.archived ? 'Archived · ' : ''}{people} {people === 1 ? 'person' : 'people'}
              {stat ? ` · ${stat.entries} records` : ''}
            </p>
          </div>
        </Link>
        <div className="md3-book-side">
          {canSeeMoney ? (
            <>
              <p className={`byjan-money md3-book-amt ${netNeg ? 'is-out' : 'is-in'}`}>
                {stat ? `${netNeg ? '−' : ''}${symbol}${netVal.toLocaleString()}` : '·'}
              </p>
              {canManage ? (
                <button type="button" className="dash-people-btn" onClick={(event) => openPeople(book.id, event)}>
                  <Users className="w-3.5 h-3.5" /> People
                </button>
              ) : stat ? (
                <svg className="byjan-spark" viewBox="0 0 64 18" aria-hidden>
                  <polyline
                    fill="rgba(30,45,120,0.06)"
                    stroke="#12B8A8"
                    strokeWidth="1.5"
                    points={`0,18 ${stat.spark.map((v, i) => `${(i / Math.max(stat.spark.length - 1, 1)) * 64},${17 - (v / maxSpark) * 14}`).join(' ')} 64,18`}
                  />
                </svg>
              ) : null}
            </>
          ) : canManage ? (
            <button type="button" className="dash-people-btn" onClick={(event) => openPeople(book.id, event)}>
              <Users className="w-3.5 h-3.5" /> People
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  const createDialog = (
      <Dialog.Root open={showNewBook} onOpenChange={(next) => {
        if (creating) return;
        setShowNewBook(next);
        if (!next) {
          setNewPurposeId(null);
          setCustomPurposeLabel('');
          setNameDetectDismissed(false);
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 z-[90]" />
          <Dialog.Content
            className="fixed left-[50%] top-[50%] z-[100] grid w-[calc(100%-1.5rem)] max-w-md max-h-[min(92vh,720px)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 p-5 rounded-[22px] bg-white border border-slate-200 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-bold text-slate-900">New money book</Dialog.Title>
              <Dialog.Close className="text-slate-400 hover:text-slate-700 rounded-md p-1"><X className="w-4 h-4"/></Dialog.Close>
            </div>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text" required autoFocus
                  value={newBookName}
                  onChange={(e) => {
                    setNewBookName(e.target.value);
                    setNameDetectDismissed(false);
                  }}
                  className="byjan-input"
                  placeholder="e.g. Goa Trip 2026, Home, Wedding"
                />
              </div>

              {nameDetection && nameDetection.confidence !== 'low' && !newPurposeId ? (
                <div className="purpose-detect">
                  <span className="flex-1 min-w-0">
                    Looks like a <strong>{getPurposeTemplate(nameDetection.purposeId).label}</strong> book. {nameDetection.reason}.
                  </span>
                  <button
                    type="button"
                    className="byjan-btn !h-8 text-xs"
                    onClick={() => setNewPurposeId(nameDetection.purposeId)}
                  >
                    Use {getPurposeTemplate(nameDetection.purposeId).label}
                  </button>
                  <button
                    type="button"
                    className="byjan-btn-ghost !h-8 text-xs"
                    onClick={() => { setNewPurposeId('default'); setNameDetectDismissed(true); }}
                  >
                    Keep basic
                  </button>
                </div>
              ) : null}

              <div>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-slate-700">What are you managing?</label>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </div>
                <div className="purpose-grid">
                  {RECOMMENDED_PURPOSES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="purpose-chip"
                      data-on={newPurposeId === p.id}
                      onClick={() => setNewPurposeId(p.id)}
                    >
                      <span className="purpose-chip-label">{p.label}</span>
                      <span className="purpose-chip-blurb">{p.blurb}</span>
                    </button>
                  ))}
                </div>
                {newPurposeId === 'other' ? (
                  <input
                    type="text"
                    className="byjan-input mt-2"
                    placeholder="e.g. Cricket tournament"
                    value={customPurposeLabel}
                    onChange={(e) => setCustomPurposeLabel(e.target.value)}
                  />
                ) : null}
                {newPurposeId && newPurposeId !== 'default' ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Starts with {getPurposeTemplate(newPurposeId).categories.slice(0, 4).join(', ')}
                    {getPurposeTemplate(newPurposeId).categories.length > 4 ? '…' : ''}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
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
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button type="button" className="byjan-btn-ghost">Cancel</button>
                  </Dialog.Close>
                  <button type="submit" disabled={creating || !newBookName.trim()} className="byjan-btn">
                    {creating && <span className="app-loader-ring app-loader-ring-sm" />}
                    {newPurposeId && newPurposeId !== 'default' ? 'Create book' : 'Create book'}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={creating || !newBookName.trim()}
                  className="text-center text-[12px] font-semibold text-slate-500 hover:text-[#12B8A8] py-1"
                  onClick={() => void createBasicBook()}
                >
                  Skip → Create basic book
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );

  const inviteBlock = canSeeMoney && invites.length > 0 && (
        <div className="space-y-2">
          <h2 className="dash-section-label"><Users className="w-3.5 h-3.5" /> Invitations</h2>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="dash-invite">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0B0F1F] truncate">{invite.bookName}</p>
                  <p className="text-xs text-slate-500">Invited as {roleLabel(invite.role)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleAcceptInvite(invite)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn !h-8 text-xs">
                    {acceptingId === invite.id ? <span className="app-loader-ring app-loader-ring-sm" /> : <Check className="w-3.5 h-3.5" />}
                    Accept
                  </button>
                  <button onClick={() => handleDeclineInvite(invite.id)} disabled={Boolean(acceptingId || decliningId)} className="byjan-btn-ghost !h-8 text-xs">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
  );

  if (!expensesOnly) {
    return (
      <div className="home-shell ios-page">
        {createDialog}
        <section className="home-stage">
          <div className="home-stage-glow" aria-hidden />
          <div className="home-stage-grid" aria-hidden />
          <div className="home-brand-row">
            <div className="home-brand-mark">
              <BrandLogo size="sm" />
              <p className="home-brand">Byjan</p>
            </div>
            {isSuperUser && (
              <Link to="/access" className="home-super">
                <Shield className="w-3.5 h-3.5" /> Access
              </Link>
            )}
          </div>
          <p className="home-hello">{hello}, {firstName}</p>
          {!hasAnyFeature ? (
            <p className="home-lead">Your admin has not turned on Money or Business yet.</p>
          ) : canSeeMoney ? (
            <>
              <div className="home-balance-block">
                <p className="home-balance-label">Across your books</p>
                <p className="home-balance byjan-money">
                  {loading || !statsReady
                    ? <span className="dash-skel home-skel-balance" aria-hidden />
                    : formatIndianAmount(net, currency)}
                </p>
                <div className="home-balance-meta">
                  <span>{loading || !statsReady ? 'Updating' : `${visibleBooks.length} books`}</span>
                  <span>{loading || !statsReady ? '…' : `${globalStats.entries} entries`}</span>
                </div>
              </div>
              <div className="home-flow" aria-label="Money in and out">
                <span className="home-flow-chip is-in">
                  Money in <b>{!statsReady ? '…' : formatIndianAmount(globalStats.totalIn, currency)}</b>
                </span>
                <span className="home-flow-chip is-out">
                  Money out <b>{!statsReady ? '…' : formatIndianAmount(globalStats.totalOut, currency)}</b>
                </span>
              </div>
            </>
          ) : (
            <p className="home-lead">Open Business when you need invoices and GST.</p>
          )}
        </section>

        {hasFeature('money') && statsReady ? (
          <section className="home-zone home-zone-enter" style={{ animationDelay: '20ms' }} aria-label="Attention">
            <FinancialInbox items={attentionItems} />
          </section>
        ) : null}

        {hasFeature('money') && (
          <section className="home-zone home-zone-enter" style={{ animationDelay: '40ms' }} aria-label="Quick actions">
            <div className="home-zone-head">
              <h2>Quick actions</h2>
              <Link to="/expenses">All books</Link>
            </div>
            <div className="home-action-grid">
              <Link to="/expenses" className="home-action-tile tone-money">
                <span className="home-action-orb" aria-hidden><IndianRupee className="w-5 h-5" /></span>
                <span className="home-action-copy">
                  <strong>Money books</strong>
                  <em>Open library</em>
                </span>
              </Link>
              {hasFeature('money_scan') && (
              <button type="button" className="home-action-tile tone-scan" onClick={() => { void CapacitorService.hapticTick(); requestQuick('scan'); }}>
                <span className="home-action-orb" aria-hidden><ScanLine className="w-5 h-5" /></span>
                <span className="home-action-copy">
                  <strong>Scan</strong>
                  <em>Receipt capture</em>
                </span>
              </button>
              )}
              {hasFeature('money_add') && (
              <button type="button" className="home-action-tile tone-add" onClick={() => { void CapacitorService.hapticTick(); requestQuick('add'); }}>
                <span className="home-action-orb" aria-hidden><PenLine className="w-5 h-5" /></span>
                <span className="home-action-copy">
                  <strong>Add entry</strong>
                  <em>Choose a book</em>
                </span>
              </button>
              )}
              <button type="button" className="home-action-tile tone-new" onClick={() => setShowNewBook(true)}>
                <span className="home-action-orb" aria-hidden><Plus className="w-5 h-5" /></span>
                <span className="home-action-copy">
                  <strong>New book</strong>
                  <em>Start a ledger</em>
                </span>
              </button>
            </div>
          </section>
        )}

        {hasFeature('money') && hasFeature('money_settle') && uid ? <PendingPayStrip uid={uid} /> : null}

        {hasFeature('money') && (loading || visibleBooks.length > 0) && (
          <section className="home-zone home-continue home-zone-enter" style={{ animationDelay: '90ms' }} aria-label="Your books">
            <div className="home-zone-head home-continue-head">
              <h2>Your books</h2>
              <Link to="/expenses">See all</Link>
            </div>
            {loading && visibleBooks.length === 0 ? (
              <div className="home-continue-list" aria-busy="true" aria-label="Loading books">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="home-skel-card">
                    <span className="dash-skel home-skel-icon" />
                    <span className="home-skel-lines">
                      <span className="dash-skel" style={{ width: '42%', height: 12 }} />
                      <span className="dash-skel" style={{ width: '28%', height: 10 }} />
                    </span>
                    <span className="dash-skel" style={{ width: 52, height: 14, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            ) : (
            <div className="home-continue-list">
              {(recentBooks.length ? recentBooks : visibleBooks).slice(0, 4).map((book, i) => {
                const stat = bookStats[book.id];
                const symbol = getCurrencySymbol(book.currency);
                const netNeg = Boolean(stat && stat.net < 0);
                return (
                  <Link
                    key={book.id}
                    to={`/book/${book.id}`}
                    className="home-continue-card"
                    style={{ animationDelay: `${120 + i * 55}ms` }}
                  >
                    <span className="home-continue-icon" aria-hidden>
                      <span>{initials(book.name)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="home-continue-name">{book.name}</span>
                      <span className="home-continue-meta">
                        {roleLabel(myRoleOn(book))}
                        {stat ? ` · ${stat.entries} entries` : ''}
                      </span>
                    </span>
                    {canSeeMoney && (loading || !statsReady) && !stat ? (
                      <span className="dash-skel" style={{ width: 52, height: 14, borderRadius: 6 }} aria-hidden />
                    ) : canSeeMoney && stat ? (
                      <span className={`byjan-money home-continue-amt ${netNeg ? 'is-out' : 'is-in'}`}>
                        {netNeg ? '−' : ''}{symbol}{Math.abs(stat.net).toLocaleString()}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    )}
                  </Link>
                );
              })}
            </div>
            )}
          </section>
        )}

        {inviteBlock}

        {hasFeature('business') && businessTree.length > 0 && (
          <section className="home-zone home-continue home-zone-enter" style={{ animationDelay: '140ms' }} aria-label="Business">
            <div className="home-zone-head home-continue-head">
              <h2 title={tenant?.name ? `Business · ${tenant.name}` : 'Business'}>Business</h2>
              <Link to="/books">Open</Link>
            </div>
            <div className="home-biz-row">
              {businessTree.filter((branch) => branch.id !== 'dashboard').slice(0, 4).map((branch) => (
                <Link key={branch.id} to={branch.href} className="home-biz-chip" title={branch.blurb}>
                  <FeatureIcon href={branch.href} className="w-4 h-4" />
                  <span>{branch.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <ReceiptCaptureFlow
          open={Boolean(receiptLaunch)}
          launch={receiptLaunch}
          booksSeed={pickSheetBooks.map((b) => ({ id: b.id, name: b.name }))}
          onClose={() => {
            setReceiptLaunch(null);
            clearPendingCapture();
          }}
          onConfirmed={(expense, extras) => {
            const bookId = String(expense.bookId || '');
            setReceiptLaunch(null);
            clearPendingCapture();
            if (bookId) rememberMoneyBook(bookId);
            if (extras?.duplicate) {
              addToast('Same receipt — nothing new added', 'success');
              if (bookId) navigate(`/book/${bookId}`);
              else void fetchData({ silent: true });
              return;
            }
            addToast(
              extras?.needsEdit
                ? 'Could not read amount — saved as draft for you to edit'
                : 'Entry saved',
              extras?.needsEdit ? 'error' : 'success',
            );
            if (bookId) navigate(`/book/${bookId}`);
            else void fetchData({ silent: true });
          }}
        />
        <BookPickSheet
          open={Boolean(bookPickKind)}
          title={pickSheetTitle}
          subtitle={pickSheetSubtitle}
          books={pickSheetBooks}
          loading={Boolean(bookPickKind) && pickSheetBooks.length === 0 && (loading || (bookPickKind === 'share' && sharePickLoading))}
          onPick={onBookPicked}
          onClose={() => {
            const wasShare = bookPickKind === 'share';
            setBookPickKind(null);
            if (wasShare) {
              setSharePending(null);
              setSharePickBooks([]);
              setSharePickLoading(false);
              clearPendingCapture();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="dash-shell ios-page">
      {createDialog}
      <section className="dash-hero dash-hero-money dash-hero-compact">
        <div className="dash-hero-compact-row">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Money books</p>
            <p className="dash-hero-balance byjan-money !mt-1">
              {loading || !statsReady ? <span className="dash-skel dash-skel-money" /> : formatIndianAmount(net, currency)}
            </p>
          </div>
          <button type="button" onClick={() => setShowNewBook(true)} className="dash-hero-cta">
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
        {canSeeMoney && (
          <div className="dash-hero-compact-meta">
            <span>{loading || !statsReady ? '…' : `${visibleBooks.length} books`}</span>
            <span>{loading || !statsReady ? '…' : `${globalStats.entries} entries`}</span>
            <span className="is-in">In {!statsReady ? '…' : formatIndianAmount(globalStats.totalIn, currency)}</span>
            <span className="is-out">Out {!statsReady ? '…' : formatIndianAmount(globalStats.totalOut, currency)}</span>
          </div>
        )}
      </section>

      {hasFeature('money_settle') && uid ? <PendingPayStrip uid={uid} /> : null}

      {canSeeMoney && books.length > 0 && (
        <section className="md3-panel">
          <div className="md3-panel-head">
            <div>
              <p className="md3-kicker">Overview</p>
              <h2>Needs attention</h2>
            </div>
          </div>
          <div className="md3-stats md3-stats-2">
            {[
              { label: 'Uncategorized', value: String(globalStats.uncategorized), tone: 'warn', Icon: Receipt },
              { label: 'This month out', value: formatIndianAmount(globalStats.monthOut, currency), tone: 'out', Icon: ArrowUpRight },
              { label: 'Money in', value: formatIndianAmount(globalStats.totalIn, currency), tone: 'in', Icon: TrendingUp },
              { label: 'Money out', value: formatIndianAmount(globalStats.totalOut, currency), tone: 'out', Icon: Wallet },
            ].map((item) => (
              <div key={item.label} className={`md3-stat tone-${item.tone}`}>
                <span className="md3-stat-icon" aria-hidden>
                  <item.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="md3-stat-label">{item.label}</span>
                <strong className="md3-stat-value byjan-money">{!statsReady ? <span className="dash-skel dash-skel-line" /> : item.value}</strong>
              </div>
            ))}
          </div>
          {bridges && (bridges.tds || bridges.gstGaps || bridges.dues.length || bridges.fest || bridges.mix.cashShare >= 40 || globalStats.uncategorized > 0) ? (
            <div className="dash-chips dash-chips-inpanel">
              {globalStats.uncategorized > 0 && <span className="dash-chip">{globalStats.uncategorized} need a category</span>}
              {bridges.tds > 0 && <span className="dash-chip">{bridges.tds} TDS watch</span>}
              {bridges.gstGaps > 0 && <span className="dash-chip">{bridges.gstGaps} GST need receipt</span>}
              {bridges.mix.cashShare >= 40 && <span className="dash-chip">{bridges.mix.cashShare}% cash</span>}
              {bridges.dues.length > 0 && <span className="dash-chip">Missing {bridges.dues.slice(0, 2).join(', ')}</span>}
              {bridges.fest && <span className="dash-chip">{bridges.fest.name}</span>}
            </div>
          ) : (
            <p className="text-[12px] text-slate-500 mt-2 px-0.5">Use + below to scan, add, or dictate into a book you choose.</p>
          )}
        </section>
      )}

      {inviteBlock}

      {!canSeeMoney ? (
        <div className="dash-empty">
          <p className="font-semibold text-[#0B0F1F]">Money is turned off for your account</p>
          <p className="text-sm text-slate-500 mt-1">Ask your super user to enable Money if you need access to money books.</p>
        </div>
      ) : (
      <section className="md3-panel md3-panel-books">
          <div className="md3-panel-head">
            <div>
              <p className="md3-kicker">Library</p>
              <h2>Your books</h2>
              <p className="md3-sub">{visibleBooks.length} open · tap to open expenses</p>
            </div>
            <div className="flex items-center gap-2">
              {books.some((book) => book.archived) && (
                <button type="button" className="byjan-chip" data-on={showArchived} onClick={() => setShowArchived((v) => !v)}>Archived</button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="md3-book-list" aria-busy="true" aria-label="Loading money books">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="md3-skel-book">
                  <span className="dash-skel md3-skel-icon" />
                  <span className="md3-skel-lines">
                    <span className="dash-skel" style={{ width: '46%', height: 12 }} />
                    <span className="dash-skel" style={{ width: '30%', height: 10 }} />
                  </span>
                  <span className="dash-skel" style={{ width: 56, height: 14, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : loadError && books.length === 0 ? (
            <div className="dash-empty">
              <p className="font-semibold text-[#0B0F1F]">Could not load your money books</p>
              <p className="text-sm text-slate-500 mt-1">{loadError}</p>
              <button type="button" onClick={() => void fetchData()} className="byjan-btn mt-4">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="dash-empty">
              <span className="md3-empty-icon"><IndianRupee className="w-6 h-6" /></span>
              <h3 className="text-[15px] font-semibold text-[#0B0F1F]">No money books yet</h3>
              <p className="ios-caption mt-1">A money book is a shared list of money in and money out. Create one, then add your first record.</p>
              <button type="button" onClick={() => setShowNewBook(true)} className="byjan-btn mt-4">
                <Plus className="w-4 h-4" /> New money book
              </button>
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
                placeholder="Search money books"
              />
              <div className="md3-book-list">
                {bookList.pageRows.map(renderLedgerCard)}
              </div>
            </div>
          )}
      </section>
      )}

      <ReceiptCaptureFlow
        open={Boolean(receiptLaunch)}
        launch={receiptLaunch}
        booksSeed={pickSheetBooks.map((b) => ({ id: b.id, name: b.name }))}
        onClose={() => {
          setReceiptLaunch(null);
          clearPendingCapture();
        }}
        onConfirmed={(expense, extras) => {
          const bookId = String(expense.bookId || '');
          setReceiptLaunch(null);
          clearPendingCapture();
          if (bookId) rememberMoneyBook(bookId);
          if (extras?.duplicate) {
            addToast('Same receipt — nothing new added', 'success');
            if (bookId) navigate(`/book/${bookId}`);
            else void fetchData({ silent: true });
            return;
          }
          addToast(
            extras?.needsEdit
              ? 'Could not read amount — saved as draft for you to edit'
              : 'Shared entry saved',
            extras?.needsEdit ? 'error' : 'success',
          );
          // Land in the book so the next manual entry uses book actions, not the picker.
          if (bookId) navigate(`/book/${bookId}`);
          else void fetchData({ silent: true });
        }}
      />
      <BookPickSheet
        open={Boolean(bookPickKind)}
        title={pickSheetTitle}
        subtitle={pickSheetSubtitle}
        books={pickSheetBooks}
        loading={Boolean(bookPickKind) && pickSheetBooks.length === 0 && (loading || (bookPickKind === 'share' && sharePickLoading))}
        onPick={onBookPicked}
        onClose={() => {
          const wasShare = bookPickKind === 'share';
          setBookPickKind(null);
          if (wasShare) {
            setSharePending(null);
            setSharePickBooks([]);
            setSharePickLoading(false);
            clearPendingCapture();
          }
        }}
      />
    </div>
  );
}
