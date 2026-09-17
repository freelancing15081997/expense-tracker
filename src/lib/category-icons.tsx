import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Car,
  Coffee,
  Fuel,
  HeartPulse,
  Home,
  Laptop,
  Lightbulb,
  Package,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';

export type CategoryVisual = {
  icon: LucideIcon;
  tone: string;
  label: string;
};

const RULES: Array<{ match: RegExp; icon: LucideIcon; tone: string }> = [
  { match: /meal|food|dining|restaurant|cafe|coffee|swiggy|zomato/i, icon: Utensils, tone: 'coral' },
  { match: /grocer|supermarket|kirana/i, icon: ShoppingCart, tone: 'lime' },
  { match: /travel|flight|hotel|trip|uber|ola|taxi|cab/i, icon: Plane, tone: 'sky' },
  { match: /fuel|petrol|diesel|gas station/i, icon: Fuel, tone: 'amber' },
  { match: /transport|parking|toll|vehicle|car /i, icon: Car, tone: 'slate' },
  { match: /software|saas|subscription|license|app store|cloud/i, icon: Laptop, tone: 'violet' },
  { match: /office|supplies|stationery|printer/i, icon: Briefcase, tone: 'navy' },
  { match: /utilit|electric|water|gas bill|internet|broadband|wifi/i, icon: Lightbulb, tone: 'gold' },
  { match: /health|medical|pharmacy|doctor|hospital|insurance/i, icon: HeartPulse, tone: 'rose' },
  { match: /shop|retail|amazon|flipkart|mall/i, icon: ShoppingBag, tone: 'teal' },
  { match: /rent|housing|home|mortgage/i, icon: Home, tone: 'indigo' },
  { match: /salary|income|payroll|refund/i, icon: Wallet, tone: 'emerald' },
  { match: /power|energy|electricity/i, icon: Zap, tone: 'gold' },
  { match: /phone|mobile|data|recharge/i, icon: Wifi, tone: 'sky' },
  { match: /package|shipping|courier|delivery/i, icon: Package, tone: 'slate' },
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
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} strokeWidth={2.25} />
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
      <Icon className="w-4 h-4" strokeWidth={2.2} />
    </span>
  );
}
