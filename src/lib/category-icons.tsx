import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  Camera,
  Car,
  CreditCard,
  Fuel,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  IndianRupee,
  Laptop,
  Lightbulb,
  NotebookPen,
  Package,
  Plane,
  Receipt,
  RotateCcw,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Ticket,
  Undo2,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';

export type CategoryVisual = {
  icon: LucideIcon;
  tone: string;
  label: string;
};

const RULES: Array<{ match: RegExp; icon: LucideIcon; tone: string }> = [
  { match: /meal|food|dining|restaurant|cafe|coffee|swiggy|zomato|catering/i, icon: Utensils, tone: 'coral' },
  { match: /grocer|supermarket|kirana/i, icon: ShoppingCart, tone: 'lime' },
  { match: /travel|flight|trip|uber|ola|taxi|cab/i, icon: Plane, tone: 'sky' },
  { match: /fuel|petrol|diesel|gas station/i, icon: Fuel, tone: 'amber' },
  { match: /transport|parking|toll|vehicle|car |bus|metro/i, icon: Bus, tone: 'slate' },
  { match: /software|saas|subscription|license|app store|cloud/i, icon: Laptop, tone: 'violet' },
  { match: /office|supplies|stationery|printer/i, icon: Briefcase, tone: 'navy' },
  { match: /utilit|electric|water|gas bill|internet|broadband|wifi/i, icon: Lightbulb, tone: 'gold' },
  { match: /health|medical|pharmacy|doctor|hospital|insurance/i, icon: HeartPulse, tone: 'rose' },
  { match: /shop|retail|amazon|flipkart|mall/i, icon: ShoppingBag, tone: 'teal' },
  { match: /rent|housing|home|mortgage/i, icon: Home, tone: 'indigo' },
  { match: /salary|income|payroll|refund/i, icon: Wallet, tone: 'emerald' },
  { match: /power|energy|electricity/i, icon: Zap, tone: 'gold' },
  { match: /phone|mobile|data|recharge/i, icon: Wifi, tone: 'sky' },
  { match: /package|shipping|courier|delivery|material/i, icon: Package, tone: 'slate' },
  { match: /hotel|stay|lodge/i, icon: Building2, tone: 'sky' },
  { match: /venue|hall|banquet/i, icon: Building2, tone: 'navy' },
  { match: /decor|decoration|flower/i, icon: Sparkles, tone: 'violet' },
  { match: /attire|dress|clothes|outfit/i, icon: Shirt, tone: 'rose' },
  { match: /gift|present/i, icon: Gift, tone: 'coral' },
  { match: /photo|camera|video/i, icon: Camera, tone: 'slate' },
  { match: /education|tuition|school|college|course/i, icon: GraduationCap, tone: 'indigo' },
  { match: /labour|labor|wages|worker/i, icon: Hammer, tone: 'amber' },
  { match: /maintain|repair|service/i, icon: Wrench, tone: 'gold' },
  { match: /activit|ticket|event|show/i, icon: Ticket, tone: 'teal' },
  { match: /uncategor/i, icon: Tag, tone: 'mute' },
];

export function categoryVisual(name?: string | null): CategoryVisual {
  const label = String(name || '').trim() || 'Uncategorized';
  for (const rule of RULES) {
    if (rule.match.test(label)) {
      return { icon: rule.icon, tone: rule.tone, label };
    }
  }
  return { icon: Receipt, tone: 'mute', label };
}

export function CategoryBadge({
  name,
  className = '',
  size = 'md',
}: {
  name?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { icon: Icon, tone, label } = categoryVisual(name);
  return (
    <span className={`cat-badge tone-${tone} ${size === 'sm' ? 'is-sm' : ''} ${className}`.trim()} title={label}>
      <span className="cat-badge-icon" aria-hidden>
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={2.25} />
      </span>
      <span className="cat-badge-label">{label}</span>
    </span>
  );
}

export function CategoryIconMark({
  name,
  className = '',
}: {
  name?: string | null;
  className?: string;
}) {
  const { icon: Icon, tone, label } = categoryVisual(name);
  return (
    <span className={`cat-mark tone-${tone} ${className}`.trim()} title={label} aria-hidden>
      <Icon className="w-5 h-5" strokeWidth={2.25} />
    </span>
  );
}

export const MONEY_KIND_VISUAL: Record<string, { icon: LucideIcon; tone: string }> = {
  EXPENSE: { icon: ArrowDownRight, tone: 'coral' },
  INCOME: { icon: ArrowUpRight, tone: 'emerald' },
  TRANSFER: { icon: ArrowLeftRight, tone: 'sky' },
  REFUND: { icon: RotateCcw, tone: 'teal' },
  REVERSAL: { icon: Undo2, tone: 'amber' },
  CREDIT_CARD_PAYMENT: { icon: CreditCard, tone: 'violet' },
  CASH_WITHDRAWAL: { icon: Banknote, tone: 'slate' },
  CASH_DEPOSIT: { icon: Wallet, tone: 'gold' },
};

export const ENTRY_FIELD_ICONS = {
  amount: IndianRupee,
  description: NotebookPen,
  category: Tag,
  date: CalendarDays,
  payment: CreditCard,
  account: Wallet,
  merchant: Store,
  notes: NotebookPen,
  tags: Tag,
  receipt: Receipt,
  entity: Building2,
};

export function EntryFieldLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <label className="entry-field-label">
      <span className="entry-field-ico" aria-hidden>
        <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
      </span>
      {children}
    </label>
  );
}
