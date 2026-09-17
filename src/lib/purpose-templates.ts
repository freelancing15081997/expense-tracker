/**
 * Purpose Template Engine — configurable book setups (not separate apps).
 * Purpose is optional; Default always works as a full money book.
 */

export type PurposeId =
  | 'default'
  | 'home'
  | 'trip'
  | 'wedding'
  | 'construction'
  | 'vehicle'
  | 'family'
  | 'education'
  | 'event'
  | 'shopping'
  | 'festival'
  | 'project'
  | 'other';

export type QuickActionId =
  | 'expense'
  | 'income'
  | 'receipt'
  | 'split'
  | 'upcoming'
  | 'material'
  | 'labour'
  | 'payment'
  | 'vendor'
  | 'booking'
  | 'fuel'
  | 'service'
  | 'reminder'
  | 'bills';

export type PurposeTemplate = {
  id: PurposeId;
  label: string;
  blurb: string;
  /** One-tap chip on create */
  recommended: boolean;
  categories: string[];
  quickActions: QuickActionId[];
  /** Optional suggested entities for dashboards / memory tags */
  entities?: string[];
  /** Deterministic name-match keywords (lowercase) */
  nameHints: string[];
};

export const PURPOSE_TEMPLATES: PurposeTemplate[] = [
  {
    id: 'home',
    label: 'Home',
    blurb: 'Bills, groceries, and household spend',
    recommended: true,
    categories: ['Rent & Housing', 'Utilities', 'Groceries', 'Food & Dining', 'Maintenance', 'Internet', 'Miscellaneous'],
    quickActions: ['expense', 'bills', 'receipt', 'upcoming'],
    entities: ['Landlord', 'Utility', 'Vendor'],
    nameHints: ['home', 'house', 'flat', 'apartment', 'household', 'rent', 'family home'],
  },
  {
    id: 'trip',
    label: 'Trip',
    blurb: 'Travel, hotels, fuel, and splits',
    recommended: true,
    categories: ['Travel', 'Fuel', 'Hotel', 'Food & Dining', 'Transport', 'Activities', 'Shopping', 'Miscellaneous'],
    quickActions: ['expense', 'split', 'receipt', 'upcoming'],
    entities: ['Hotel', 'Flight', 'Companion'],
    nameHints: ['trip', 'travel', 'vacation', 'holiday', 'tour', 'goa', 'manali', 'flight', 'road trip'],
  },
  {
    id: 'wedding',
    label: 'Wedding',
    blurb: 'Vendors, bookings, and gifts',
    recommended: true,
    categories: ['Venue', 'Catering', 'Decor', 'Attire', 'Gifts', 'Photography', 'Travel', 'Miscellaneous'],
    quickActions: ['expense', 'vendor', 'payment', 'booking'],
    entities: ['Vendor', 'Venue', 'Guest'],
    nameHints: ['wedding', 'marriage', 'shaadi', 'reception', 'engagement'],
  },
  {
    id: 'construction',
    label: 'Construction',
    blurb: 'Materials, labour, and site payments',
    recommended: true,
    categories: ['Material', 'Labour', 'Cement', 'Steel', 'Electrical', 'Plumbing', 'Transport', 'Payment', 'Miscellaneous'],
    quickActions: ['material', 'labour', 'payment', 'receipt'],
    entities: ['Contractor', 'Supplier', 'Site'],
    nameHints: ['construction', 'building', 'renovation', 'site', 'civil', 'builder'],
  },
  {
    id: 'vehicle',
    label: 'Vehicle',
    blurb: 'Fuel, service, and reminders',
    recommended: true,
    categories: ['Fuel', 'Service', 'Insurance', 'Parking', 'Toll', 'Accessories', 'Miscellaneous'],
    quickActions: ['fuel', 'service', 'expense', 'reminder'],
    entities: ['Garage', 'Insurer'],
    nameHints: ['vehicle', 'car', 'bike', 'scooter', 'auto', 'petrol', 'diesel'],
  },
  {
    id: 'family',
    label: 'Family',
    blurb: 'Shared household and family spend',
    recommended: true,
    categories: ['Groceries', 'Food & Dining', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Miscellaneous'],
    quickActions: ['expense', 'split', 'receipt', 'upcoming'],
    nameHints: ['family', 'kids', 'parents', 'household'],
  },
  {
    id: 'education',
    label: 'Education',
    blurb: 'Fees, books, and courses',
    recommended: true,
    categories: ['Tuition', 'Books', 'Fees', 'Transport', 'Supplies', 'Courses', 'Miscellaneous'],
    quickActions: ['expense', 'payment', 'receipt', 'upcoming'],
    nameHints: ['school', 'college', 'education', 'tuition', 'course', 'university'],
  },
  {
    id: 'event',
    label: 'Event',
    blurb: 'One-off gatherings and parties',
    recommended: true,
    categories: ['Venue', 'Food & Dining', 'Decor', 'Entertainment', 'Transport', 'Gifts', 'Miscellaneous'],
    quickActions: ['expense', 'vendor', 'receipt', 'upcoming'],
    nameHints: ['event', 'party', 'birthday', 'anniversary', 'gathering'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    blurb: 'Purchases, returns, and warranties',
    recommended: true,
    categories: ['Shopping', 'Electronics', 'Fashion', 'Home', 'Returns', 'Miscellaneous'],
    quickActions: ['expense', 'receipt', 'upcoming'],
    nameHints: ['shopping', 'purchase', 'amazon', 'flipkart', 'buy'],
  },
  {
    id: 'festival',
    label: 'Festival',
    blurb: 'Seasonal and celebration spend',
    recommended: true,
    categories: ['Food & Dining', 'Gifts', 'Decor', 'Travel', 'Clothes', 'Miscellaneous'],
    quickActions: ['expense', 'receipt', 'split', 'upcoming'],
    nameHints: ['diwali', 'festival', 'christmas', 'eid', 'holi', 'navratri', 'puja'],
  },
  {
    id: 'project',
    label: 'Project',
    blurb: 'Budgets, vendors, and milestones',
    recommended: true,
    categories: ['Materials', 'Labour', 'Software', 'Travel', 'Fees', 'Miscellaneous'],
    quickActions: ['expense', 'payment', 'receipt', 'upcoming'],
    nameHints: ['project', 'build', 'launch', 'mvp'],
  },
  {
    id: 'other',
    label: 'Other',
    blurb: 'Custom setup — you confirm categories',
    recommended: true,
    categories: ['Money In', 'Money Out', 'Miscellaneous'],
    quickActions: ['expense', 'income', 'receipt', 'split'],
    nameHints: [],
  },
  {
    id: 'default',
    label: 'Basic',
    blurb: 'Money in, money out, receipts, splits',
    recommended: false,
    categories: [
      'Food & Dining',
      'Groceries',
      'Rent & Housing',
      'Utilities',
      'Transportation',
      'Shopping',
      'Travel',
      'Entertainment',
      'Healthcare',
      'Work & Office',
      'Miscellaneous',
    ],
    quickActions: ['income', 'expense', 'receipt', 'split'],
    nameHints: [],
  },
];

export const RECOMMENDED_PURPOSES = PURPOSE_TEMPLATES.filter((t) => t.recommended && t.id !== 'other');

export function getPurposeTemplate(id?: string | null): PurposeTemplate {
  const found = PURPOSE_TEMPLATES.find((t) => t.id === id);
  return found || PURPOSE_TEMPLATES.find((t) => t.id === 'default')!;
}

export type PurposeDetection = {
  purposeId: PurposeId;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

/** Deterministic book-name → purpose matching (no AI). */
export function detectPurposeFromName(name: string): PurposeDetection | null {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;

  let best: { id: PurposeId; score: number; hint: string } | null = null;
  for (const tpl of PURPOSE_TEMPLATES) {
    if (tpl.id === 'default' || tpl.id === 'other') continue;
    for (const hint of tpl.nameHints) {
      if (!hint) continue;
      if (n === hint || n.includes(hint) || hint.includes(n)) {
        const score = n === hint ? 100 : n.startsWith(hint) || n.endsWith(hint) ? 80 : 60;
        if (!best || score > best.score) best = { id: tpl.id, score, hint };
      }
    }
  }
  if (!best) return null;
  if (best.score >= 80) {
    return {
      purposeId: best.id,
      confidence: 'high',
      reason: `Name mentions “${best.hint}”`,
    };
  }
  if (best.score >= 60) {
    return {
      purposeId: best.id,
      confidence: 'medium',
      reason: `Name looks related to ${getPurposeTemplate(best.id).label}`,
    };
  }
  return null;
}

/** Suggest categories for free-text “Other” purpose (deterministic keyword map). */
export function suggestCustomPurposeConfig(label: string): {
  label: string;
  categories: string[];
  entities: string[];
  isAiStyle: true;
} {
  const raw = String(label || '').trim() || 'Custom';
  const lower = raw.toLowerCase();
  const base = ['Registration', 'Travel', 'Food', 'Equipment', 'Fees', 'Miscellaneous'];
  const extras: string[] = [];
  const entities: string[] = [];

  if (/cricket|sport|tournament|match|league/.test(lower)) {
    extras.push('Teams', 'Players', 'Ground', 'Officials', 'Prize', 'Sponsorship');
    entities.push('Team', 'Player', 'Venue', 'Sponsor');
  } else if (/startup|saas|app|product/.test(lower)) {
    extras.push('Hosting', 'Marketing', 'Salaries', 'Legal', 'Tools');
    entities.push('Vendor', 'Contractor');
  } else if (/clinic|hospital|medical|health/.test(lower)) {
    extras.push('Supplies', 'Staff', 'Equipment', 'Rent', 'Utilities');
    entities.push('Supplier', 'Staff');
  } else if (/farm|agriculture|crop/.test(lower)) {
    extras.push('Seeds', 'Fertilizer', 'Labour', 'Equipment', 'Transport');
    entities.push('Supplier', 'Labour');
  } else {
    extras.push('Materials', 'Services', 'People', 'Logistics');
    entities.push('Vendor', 'Person');
  }

  const categories = Array.from(new Set([...extras, ...base]));
  return { label: raw, categories, entities, isAiStyle: true };
}

export function quickActionLabel(id: QuickActionId): string {
  const map: Record<QuickActionId, string> = {
    expense: 'Expense',
    income: 'Money In',
    receipt: 'Receipt',
    split: 'Split',
    upcoming: 'Upcoming',
    material: 'Material',
    labour: 'Labour',
    payment: 'Payment',
    vendor: 'Vendor',
    booking: 'Booking',
    fuel: 'Fuel',
    service: 'Service',
    reminder: 'Reminder',
    bills: 'Bills',
  };
  return map[id] || id;
}

export type BookPurposeConfig = {
  purposeId: PurposeId;
  purposeLabel?: string;
  customLabel?: string;
  categories: string[];
  quickActions: QuickActionId[];
  entities?: string[];
  detectedFromName?: boolean;
  confirmedAt?: string;
};
