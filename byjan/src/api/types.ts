// Shared API types. These mirror what the screens need; adjust to match the real backend contract.

export type ID = string;
export type Initials = string; // e.g. "PS"

export interface User {
  id: ID; name: string; initials: Initials; phone: string; email?: string;
  upiId?: string; plan: PlanId; avatarBg?: string; avatarFg?: string;
}

export interface Person { id: ID; initials: Initials; name: string; upiId?: string; short?: string }

export type BookKind = 'Trip' | 'Household' | 'Business' | 'Event' | 'Personal';
export type Role = 'Owner' | 'Admin' | 'Accountant' | 'Contributor' | 'Viewer';

export interface BookSummary {
  id: ID; name: string; kind: BookKind; people: number; pinned?: boolean;
  tone: 'po' | 'ne' | 'wa' | 'mu'; badge: string; label: string; big: string;
  foot: string; pct: number; members: Initials[]; filter: 'Owed to you' | 'You owe' | 'Needs action' | 'Settled';
  gradient: 'c1' | 'c2' | 'c3' | 'c4';
  /** hero values shown when the book is opened */
  hk: string; total: number; l2: string; v2: number;
}

export interface BookDetail {
  id: ID; name: string; kind: BookKind; dates: string; totalSpent: number;
  youGetBack: number; budget: number; budgetLeft: number; budgetPct: number;
  members: Person[]; inviteLink: string;
  /** hero card: kicker, gradient, primary stat (label + display value), secondary stat */
  hk: string; gradient: 'c1' | 'c2' | 'c3' | 'c4'; label: string; big: string; l2: string; v2: number;
}

export type Category = 'Food' | 'Travel' | 'Groceries' | 'Bills' | 'Shopping' | 'Stay' | 'Fun' | 'Other';

export interface Entry {
  id: ID; bookId: ID; title: string; category: Category; icon: string;
  paidBy: Initials; amount: number; splitWith: Initials[]; time: string;
  dayLabel: string; daySub?: string; hasReceipt?: boolean; pending?: boolean;
  /** Positive = you get back, negative = you owe (computed server-side). */
  yourNet: number; note?: string;
}

export interface Balance { initials: Initials; name: string; paid: number; share: number; net: number }

export interface HomeSummary {
  monthLabel: string; spent: number; vsLastMonth: number; budget: number; budgetUsedPct: number;
  trend: number[]; attentionCount: number; nudge?: { who: Initials; name: string; amount: number; book: string } | null;
  today: { id: ID; title: string; sub: string; amount: string; note: string; tone: 'tx' | 'po'; mono: string; monoBg: string; monoFg: string }[];
}

export interface SettleSummary {
  net: number; youGetBack: number; fromCount: number; youOwe: number; toCount: number;
  smartNote: string;
  owe: { initials: Initials; name: string; note: string; amount: number }[];
  owed: { initials: Initials; name: string; note: string; amount: number; lastNudge?: string }[];
}

export interface InsightsData {
  month: string; total: number;
  categories: { name: string; pct: number; color: 'ac' | 'a2' | 'wa' | 'ne' | 'mu' }[];
  weeks: { label: string; amount: number; current?: boolean; forecast?: boolean }[];
  avgWeek: number;
  tips: { title: string; body: string }[];
}

export interface Account { id: ID; name: string; sub: string; balance: number; icon: string; note: string; isDefault?: boolean; last4?: string }
export interface AccountTxn { id: ID; title: string; when: string; amount: number }
export interface Due { id: ID; title: string; when: string; amount: number; icon: string; overdue?: boolean; paid?: boolean; dueDay?: number }
export interface ActivityItem { id: ID; who: Initials; name: string; text: string; sub: string; dot: 'wa' | 'a2' | 'po' | 'ac'; mine: boolean; day: string }
export interface InboxItem { id: ID; kind: 'Requests' | 'Reminders' | 'Security'; title: string; sub: string; when: string; icon: string; actions?: [string, string] }
export interface SearchResult { id: ID; kind: 'Entries' | 'Books' | 'People'; title: string; sub: string; amount?: string; icon?: string; initials?: string; target: { screen: string; params?: object } }
export interface AttentionItems { duplicate?: { text: string }; highAmount?: { text: string }; category?: { text: string; options: string[] } }
export interface VaultDoc { id: ID; name: string; folder: 'Receipts' | 'Bills' | 'Warranties' | 'IDs' | 'Tax'; sub: string; expiry?: string; icon: string; ext: 'PDF' | 'JPG' }
export interface SmsTxn { id: ID; bank: string; when: string; raw: string; merchant: string; meta: string; amount: number; debit: boolean; duplicate?: boolean }
export interface Template { id: ID; name: string; amount: number; meta: string; icon: string }
export interface Recurring { id: ID; name: string; meta: string; amount: number; mono: string; bg: string; fg: string; paused?: boolean }
export type PlanId = 'free' | 'plus' | 'pro' | 'biz';
export interface Plan { id: PlanId; name: string; tag: string; monthly: number; annual: number; limits: string[] }
export interface Usage { label: string; used: number; limit: number; icon: string }
export interface Approval { id: ID; title: string; meta: string; amount: number; hasReceipt: boolean }
export interface AdminOverview { spentThisMonth: number; pending: number; members: number; overLimit: number; recent: { text: string; when: string }[] }
export interface ScanResult { merchant: string; amount: number; date: string; items: { name: string; amount: number }[]; confidence: number }
export interface VoiceParse { transcript: string; amount: number; title: string; book: string; splitWays: number }
export interface UpiPayee { name: string; vpa: string; verified: boolean; initials: string }
export interface PaymentResult { status: 'SUCCESS' | 'FAILED' | 'PENDING'; utr?: string; amount: number; app: string; to: string; from: string; time: string; failReason?: string; code?: string }
export interface Invite { bookId: ID; bookName: string; invitedBy: string; members: Initials[]; spent: number; dates: string; role: Role; status: 'ok' | 'member' | 'expired' }
export interface Ticket { id: ID; title: string; when: string; status: 'Open' | 'Answered' }
export interface NotifPrefs { channels: Record<'pay' | 'apr' | 'rem' | 'bill' | 'dig' | 'sec', [boolean, boolean, boolean]>; hideAmounts: boolean; quietHours: boolean; bundle: boolean }
export interface ImportPreview { columns: { name: string; example: string; mapTo: string }[]; errors: { row: string; problem: string; line: string }[]; rows: number }

export interface Subscription { plan: PlanId; planName: string; renewsOn: string; status: 'active' | 'trial' | 'cancelled' }
export interface RecentPayee { initials: string; name: string; vpa: string; bg: string; fg: string }
export interface RoleConfig { role: Role; perms: Record<string, boolean>; approvalLimit: number | null; members: number }
