import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  BookText,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  File,
  FileMinus,
  FilePen,
  FileText,
  FileType,
  FolderKanban,
  Gauge,
  Image,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Monitor,
  Percent,
  Play,
  Plus,
  Receipt,
  Repeat,
  Save,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Table2,
  TrendingUp,
  Undo2,
  Users,
  Wallet,
  Wrench,
  CalendarRange,
  Lock,
  FilePlus,
  FileQuestionMark,
  PackageCheck,
  Building,
  LineChart,
  Briefcase,
  ClipboardCheck,
  FileSearch,
  Network,
} from 'lucide-react';

export type BooksGlyphName =
  | 'book'
  | 'dashboard'
  | 'tower'
  | 'accounts'
  | 'journal'
  | 'recurring'
  | 'ledger'
  | 'customer'
  | 'quote'
  | 'invoice'
  | 'credit'
  | 'statement'
  | 'collection'
  | 'vendor'
  | 'po'
  | 'bill'
  | 'vendor-credit'
  | 'payment'
  | 'bank'
  | 'expense'
  | 'inventory'
  | 'asset'
  | 'project'
  | 'budget'
  | 'revenue'
  | 'lease'
  | 'tax'
  | 'report'
  | 'entity'
  | 'workbench'
  | 'inbox'
  | 'approval'
  | 'period'
  | 'close'
  | 'estimate'
  | 'sales-order'
  | 'debit'
  | 'purchase-request'
  | 'purchase-receipt'
  | 'company'
  | 'forecast'
  | 'cfo'
  | 'insight'
  | 'audit'
  | 'settings'
  | 'create'
  | 'save'
  | 'post'
  | 'pay'
  | 'run'
  | 'file'
  | 'image'
  | 'pdf';

const ICONS: Record<BooksGlyphName, LucideIcon> = {
  book: BookOpen,
  dashboard: LayoutDashboard,
  tower: Building2,
  accounts: Table2,
  journal: BookMarked,
  recurring: Repeat,
  ledger: BookText,
  customer: Users,
  quote: FilePen,
  invoice: FileText,
  credit: FileMinus,
  statement: ScrollText,
  collection: Wallet,
  vendor: Store,
  po: ClipboardList,
  bill: Receipt,
  'vendor-credit': Undo2,
  payment: Banknote,
  bank: Landmark,
  expense: ArrowRightLeft,
  inventory: Boxes,
  asset: Monitor,
  project: FolderKanban,
  budget: Gauge,
  revenue: TrendingUp,
  lease: KeyRound,
  tax: Percent,
  report: BarChart3,
  entity: Network,
  workbench: Wrench,
  inbox: Inbox,
  approval: BadgeCheck,
  insight: Sparkles,
  audit: ShieldCheck,
  settings: Settings,
  create: Plus,
  save: Save,
  post: CheckCircle2,
  pay: CreditCard,
  run: Play,
  file: File,
  image: Image,
  pdf: FileType,
  period: CalendarRange,
  close: Lock,
  estimate: FileSearch,
  'sales-order': ClipboardCheck,
  debit: FilePlus,
  'purchase-request': FileQuestionMark,
  'purchase-receipt': PackageCheck,
  company: Building,
  forecast: LineChart,
  cfo: Briefcase,
};

const HREF_GLYPH: Record<string, BooksGlyphName> = {
  '/books': 'dashboard',
  '/books/cfo': 'cfo',
  '/books/control-tower': 'tower',
  '/books/chart-of-accounts': 'accounts',
  '/books/journals': 'journal',
  '/books/recurring': 'recurring',
  '/books/ledger': 'ledger',
  '/books/periods': 'period',
  '/books/close': 'close',
  '/books/customers': 'customer',
  '/books/estimates': 'estimate',
  '/books/quotes': 'quote',
  '/books/sales-orders': 'sales-order',
  '/books/invoices': 'invoice',
  '/books/credit-notes': 'credit',
  '/books/debit-notes': 'debit',
  '/books/statements': 'statement',
  '/books/collections': 'collection',
  '/books/vendors': 'vendor',
  '/books/purchase-requests': 'purchase-request',
  '/books/purchase-orders': 'po',
  '/books/purchase-receipts': 'purchase-receipt',
  '/books/bills': 'bill',
  '/books/vendor-credits': 'vendor-credit',
  '/books/payment-run': 'payment',
  '/books/banking': 'bank',
  '/books/expenses': 'expense',
  '/books/inventory': 'inventory',
  '/books/assets': 'asset',
  '/books/projects': 'project',
  '/books/budgets': 'budget',
  '/books/forecast': 'forecast',
  '/books/revenue': 'revenue',
  '/books/leases': 'lease',
  '/books/tax': 'tax',
  '/books/reports': 'report',
  '/books/entities': 'entity',
  '/books/companies': 'company',
  '/books/workbench': 'workbench',
  '/books/inbox': 'inbox',
  '/books/approvals': 'approval',
  '/books/insights': 'insight',
  '/books/audit': 'audit',
  '/books/settings': 'settings',
};

const GROUP_GLYPH: Record<string, BooksGlyphName> = {
  Dashboard: 'dashboard',
  Accounting: 'journal',
  Sales: 'invoice',
  Purchases: 'bill',
  'Banking & Expenses': 'bank',
  Operations: 'inventory',
  Control: 'approval',
};

export function BooksGlyph({ name, className }: { name: BooksGlyphName; className?: string }) {
  const Icon = ICONS[name] || BookOpen;
  return <Icon className={className || 'w-6 h-6'} strokeWidth={2.25} />;
}

export function glyphForHref(href: string): BooksGlyphName {
  const path = href.replace(/\/ledger\/.+$/, '/ledger').replace(/#.*$/, '');
  if (HREF_GLYPH[path]) return HREF_GLYPH[path];
  const hit = Object.keys(HREF_GLYPH).find((key) => key !== '/books' && path.startsWith(key));
  return hit ? HREF_GLYPH[hit] : 'book';
}

export function FeatureIcon({ href, className }: { href: string; className?: string }) {
  return <BooksGlyph name={glyphForHref(href)} className={className} />;
}

export function GroupIcon({ title, className }: { title: string; className?: string }) {
  return <BooksGlyph name={GROUP_GLYPH[title] || 'book'} className={className} />;
}

export function ActionIcon({ name, className }: { name: BooksGlyphName; className?: string }) {
  return <BooksGlyph name={name} className={className} />;
}

export function fileGlyph(file: { type?: string; name?: string }): BooksGlyphName {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}
