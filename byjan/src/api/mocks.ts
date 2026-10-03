// Mock data taken from the design. Used by every service while USE_MOCKS is true.
import type {
  Account, AccountTxn, RecentPayee, RoleConfig, Subscription, ActivityItem, AdminOverview, Approval, BookDetail, BookSummary, Due, Entry, HomeSummary, ImportPreview,
  InboxItem, InsightsData, Invite, NotifPrefs, Plan, Recurring, SearchResult, SettleSummary, SmsTxn, Template, Ticket,
  Usage, User, VaultDoc,
} from './types';

export const me: User = { id: 'u_ak', name: 'Arjun Kumar', initials: 'AK', phone: '+91 98450 12345', email: 'arjun@byjan.app', upiId: 'arjun@okhdfc', plan: 'pro' };

export const people: Record<string, string> = { AK: 'Arjun (you)', PS: 'Priya Sharma', RV: 'Rahul Verma', KS: 'Kabir Shah', MI: 'Meera Iyer' };

export const books: BookSummary[] = [
  { id: 'goa', name: 'Goa Trip', kind: 'Trip', people: 5, pinned: true, tone: 'po', badge: 'Owed to you', label: "You'll get back", big: '₹2,850', foot: '₹11,500 of ₹40,000 · 12 days left', pct: 29, members: ['PS', 'RV', 'KS', 'MI'], filter: 'Owed to you', gradient: 'c1', hk: 'TRIP · 18 – 26 SEP', total: 11500, l2: 'Budget left', v2: 28500 },
  { id: 'home', name: 'Home & Family', kind: 'Household', people: 4, tone: 'ne', badge: 'You owe', label: 'You owe Meera', big: '₹800', foot: '₹26,940 of ₹35,000 this month', pct: 77, members: ['PS', 'MI', 'KS'], filter: 'You owe', gradient: 'c2', hk: 'HOUSEHOLD · SEPTEMBER', total: 26940, l2: 'Budget left', v2: 8060 },
  { id: 'site', name: 'Site Work', kind: 'Business', people: 6, tone: 'wa', badge: '2 to approve', label: 'Needs approval', big: '2 entries', foot: '₹9,770 of ₹20,000 this month', pct: 49, members: ['RV', 'KS', 'PS'], filter: 'Needs action', gradient: 'c3', hk: 'BUSINESS · SEPTEMBER', total: 9770, l2: 'Budget left', v2: 10230 },
  { id: 'studio', name: 'Studio Books', kind: 'Personal', people: 1, tone: 'mu', badge: 'All settled', label: 'Spent this month', big: '₹4,120', foot: '₹4,120 of ₹10,000 budget', pct: 41, members: ['AK'], filter: 'Settled', gradient: 'c4', hk: 'PERSONAL · SEPTEMBER', total: 4120, l2: 'Budget left', v2: 5880 },
];

export const bookDetail: BookDetail = {
  id: 'goa', name: 'Goa Trip', kind: 'Trip', dates: '18 – 26 SEP', totalSpent: 11500, youGetBack: 2850, budget: 40000, budgetLeft: 28500, budgetPct: 29,
  members: ['AK', 'PS', 'RV', 'KS', 'MI'].map(i => ({ id: 'p_' + i, initials: i, name: people[i] })), inviteLink: 'byjan.app/j/GT-7Q4K',
  hk: 'TRIP · 18 – 26 SEP', gradient: 'c1', label: "You'll get back", big: '₹2,850', l2: 'Budget left', v2: 28500,
};
/** Detail for any book, derived from its summary (the tapped book drives the hero). */
export const bookDetailFor = (id: string): BookDetail => {
  const b = books.find(x => x.id === id) ?? books[0];
  return { ...bookDetail, id: b.id, name: b.name, kind: b.kind, totalSpent: b.total, budgetPct: b.pct, budgetLeft: b.v2, hk: b.hk, gradient: b.gradient, label: b.label, big: b.big, l2: b.l2, v2: b.v2,
    members: ['AK', ...b.members.filter(m => m !== 'AK')].map(i => ({ id: 'p_' + i, initials: i, name: people[i] })) };
};

const mk = (e: Omit<Entry, 'yourNet'>): Entry => {
  const share = e.amount / e.splitWith.length;
  return { ...e, yourNet: e.paidBy === 'AK' ? e.amount - share : -share };
};
export const entries: Entry[] = [
  mk({ id: 'e1', bookId: 'goa', dayLabel: 'Today', daySub: 'Tue 23', title: 'Dinner at Toit', category: 'Food', icon: 'utensils', paidBy: 'PS', amount: 4800, splitWith: ['AK', 'PS', 'RV', 'KS', 'MI'], time: '9:42 pm', hasReceipt: true }),
  mk({ id: 'e2', bookId: 'goa', dayLabel: 'Yesterday', daySub: 'Mon 22', title: 'Scooter rental · 3 days', category: 'Travel', icon: 'bike', paidBy: 'AK', amount: 2500, splitWith: ['AK', 'PS', 'RV', 'KS'], time: '10:05 am', pending: true }),
  mk({ id: 'e3', bookId: 'goa', dayLabel: 'Yesterday', daySub: 'Mon 22', title: 'Fuel', category: 'Travel', icon: 'fuel', paidBy: 'RV', amount: 900, splitWith: ['AK', 'PS', 'RV', 'KS'], time: '1:20 pm', hasReceipt: true }),
  mk({ id: 'e4', bookId: 'goa', dayLabel: 'Yesterday', daySub: 'Mon 22', title: 'Groceries · Mapusa market', category: 'Groceries', icon: 'cart', paidBy: 'KS', amount: 1440, splitWith: ['AK', 'PS', 'RV', 'KS', 'MI'], time: '6:40 pm' }),
  mk({ id: 'e5', bookId: 'goa', dayLabel: 'Sun, 21 Sep', daySub: 'Sun 21', title: 'Beach shack lunch', category: 'Food', icon: 'palm', paidBy: 'AK', amount: 1860, splitWith: ['AK', 'PS', 'RV', 'KS', 'MI'], time: '2:15 pm', hasReceipt: true }),
];

export const home: HomeSummary = {
  monthLabel: 'September', spent: 48210.4, vsLastMonth: -6240, budget: 70000, budgetUsedPct: 68,
  trend: [12, 18, 14, 9, 16, 22, 15, 19, 26, 21, 17, 24, 30, 28],
  attentionCount: 3,
  nudge: { who: 'RV', name: 'Rahul', amount: 1200, book: 'Goa Trip' },
  today: [
    { id: 'e1', title: 'Dinner at Toit', sub: 'Goa Trip · Priya paid', amount: '₹4,800', note: 'Your share ₹960', tone: 'tx', mono: 'T', monoBg: '#2A1E14', monoFg: '#F5B041' },
    { id: 'x2', title: 'Swiggy', sub: 'Home & Family · from SMS', amount: '−₹1,240', note: 'You paid', tone: 'tx', mono: 'S', monoBg: '#FC8019', monoFg: '#FFFFFF' },
    { id: 'x3', title: 'Kabir paid you back', sub: 'Goa Trip · via UPI', amount: '+₹1,250', note: 'Settled', tone: 'po', mono: 'KS', monoBg: '#FFE9B8', monoFg: '#5A3E00' },
  ],
};

export const settle: SettleSummary = {
  net: 2050, youGetBack: 2850, fromCount: 3, youOwe: 800, toCount: 1,
  smartNote: 'Smart settle turned 7 IOUs into 4 payments, so fewer UPI transfers for everyone.',
  owe: [{ initials: 'MI', name: 'Meera Iyer', note: 'Goa Trip · scooter rental · 3 days', amount: 800 }],
  owed: [
    { initials: 'RV', name: 'Rahul Verma', note: 'Goa Trip · 2 entries', amount: 1200 },
    { initials: 'KS', name: 'Kabir Shah', note: 'Goa Trip · dinner', amount: 1250 },
    { initials: 'PS', name: 'Priya Sharma', note: 'Home & Family · groceries', amount: 400 },
  ],
};

export const insights: Record<string, InsightsData> = Object.fromEntries(
  (['Jul', 'Aug', 'Sep'] as const).map((m, i) => [m, {
    month: m, total: [52880, 54450, 48210][i],
    categories: [{ name: 'Food', pct: 38, color: 'wa' }, { name: 'Travel', pct: 20, color: 'a2' }, { name: 'Bills', pct: 17, color: 'ac' }, { name: 'Shopping', pct: 14, color: 'ne' }, { name: 'Other', pct: 11, color: 'mu' }],
    weeks: [{ label: 'W1', amount: 9800 }, { label: 'W2', amount: 12400 }, { label: 'W3', amount: 16200, current: true }, { label: 'W4', amount: 9810 }, { label: 'Now', amount: 0, forecast: true }],
    avgWeek: 11200,
    tips: [
      { title: 'Food is up 18% on August', body: 'Mostly Swiggy: 11 orders, ₹4,980. Set a ₹3,000 limit?' },
      { title: '₹6,240 less than last month', body: 'Bills and travel both dropped. Nice going.' },
      { title: '2 bills due this week', body: 'BESCOM ₹1,860 on Friday, Netflix ₹649 on Sunday.' },
    ],
  } as InsightsData]),
);

export const accounts: Account[] = [
  { id: 'cash', name: 'Cash in hand', sub: 'Wallet', balance: 3450, icon: 'money', note: 'counted today' },
  { id: 'hdfc', name: 'HDFC Savings', sub: '•• 4821 · via SMS', balance: 148230, icon: 'bank', note: 'updated 2m ago', isDefault: true, last4: '4821' },
  { id: 'icici', name: 'ICICI Current', sub: '•• 0937 · business', balance: 212400, icon: 'bank', note: 'updated 2m ago', last4: '0937' },
  { id: 'card', name: 'Amazon Pay ICICI', sub: 'Credit card · due 5 Oct', balance: -18640, icon: 'card', note: 'to pay' },
];

export const dues: Due[] = [
  { id: 'bescom', title: 'BESCOM electricity', when: 'Overdue by 2 days', amount: 1860, icon: 'lightning', overdue: true, dueDay: 1 },
  { id: 'rent', title: 'Rent · Mr. Rao', when: 'Wed, 1 Oct · in 8 days', amount: 25000, icon: 'house', dueDay: 1 },
  { id: 'cc', title: 'Amazon Pay card', when: 'Sun, 5 Oct · autopay off', amount: 18640, icon: 'card', dueDay: 5 },
  { id: 'nf', title: 'Netflix', when: 'Sun, 5 Oct · autopay on', amount: 649, icon: 'tv', dueDay: 5 },
  { id: 'emi', title: 'Car loan EMI', when: 'Tue, 7 Oct · auto-debit', amount: 14250, icon: 'car', dueDay: 7 },
];

export const activity: ActivityItem[] = [
  { id: 'a1', day: 'Today', who: 'PS', name: 'Priya', text: 'added ₹4,800 · Dinner at Toit', sub: 'Goa Trip · 9:48 PM', dot: 'wa', mine: false },
  { id: 'a2', day: 'Today', who: 'AK', name: 'You', text: 'split Dinner at Toit 5 ways', sub: 'Goa Trip · 9:52 PM', dot: 'a2', mine: true },
  { id: 'a3', day: 'Today', who: 'KS', name: 'Kabir', text: 'paid you back ₹1,250 on UPI', sub: 'Goa Trip · 4:10 PM', dot: 'po', mine: false },
  { id: 'a4', day: 'Yesterday', who: 'AK', name: 'You', text: 'created the book Site Work', sub: 'Site Work · 11:02 AM', dot: 'ac', mine: true },
  { id: 'a5', day: 'Yesterday', who: 'RV', name: 'Rahul', text: 'joined Goa Trip from your invite', sub: 'Goa Trip · 8:30 AM', dot: 'a2', mine: false },
];

export const inbox: InboxItem[] = [
  { id: 'req', kind: 'Requests', title: 'Kabir requested ₹1,250', sub: "Goa Trip · dinner at Fisherman's Wharf", when: '5m', icon: 'handCoins', actions: ['Decline', 'Pay ₹1,250'] },
  { id: 'sec', kind: 'Security', title: 'New sign-in on Pixel 8', sub: 'Bengaluru · 11:02 AM. Not you? Secure your account now.', when: '2h', icon: 'shieldWarning', actions: ["It's me", 'Secure account'] },
  { id: 'bill', kind: 'Reminders', title: 'BESCOM bill due Friday', sub: 'Usually about ₹1,860 · Home & Family', when: '3h', icon: 'calendarCheck', actions: ['Snooze', 'Mark paid'] },
  { id: 'paid', kind: 'Reminders', title: 'Rahul paid you ₹1,200', sub: 'Goa Trip · via PhonePe · settled', when: 'Yday', icon: 'sealCheck' },
  { id: 'sms', kind: 'Reminders', title: 'Salary credited · ₹84,000', sub: 'ICICI ••0937 · picked up from SMS', when: 'Mon', icon: 'chat' },
];

export const searchIndex: SearchResult[] = [
  { id: 's1', kind: 'Entries', title: 'Dinner at Toit', sub: 'Goa Trip · today · Food', amount: '₹4,800', icon: 'utensils', target: { screen: 'Entry', params: { id: 'e1' } } },
  { id: 's2', kind: 'Entries', title: 'Scooter rental', sub: 'Goa Trip · yesterday · Travel', amount: '₹2,500', icon: 'bike', target: { screen: 'Book', params: { id: 'goa' } } },
  { id: 's3', kind: 'Entries', title: 'Swiggy', sub: 'Home & Family · today · Food', amount: '₹1,240', icon: 'bag', target: { screen: 'Book', params: { id: 'home' } } },
  { id: 's4', kind: 'Entries', title: 'Rent · Mr. Rao', sub: 'Home & Family · 1 Sep · Bills', amount: '₹25,000', icon: 'house', target: { screen: 'Book', params: { id: 'home' } } },
  { id: 's5', kind: 'Entries', title: 'BESCOM electricity', sub: 'Home & Family · 22 Sep · Bills', amount: '₹4,860', icon: 'lightning', target: { screen: 'Attention' } },
  { id: 's6', kind: 'Books', title: 'Goa Trip', sub: 'Book · 5 people · ₹11,500', icon: 'books', target: { screen: 'Book', params: { id: 'goa' } } },
  { id: 's7', kind: 'Books', title: 'Home & Family', sub: 'Book · 4 people · ₹26,940', icon: 'books', target: { screen: 'Book', params: { id: 'home' } } },
  { id: 's8', kind: 'People', title: 'Priya Sharma', sub: 'Owes you ₹400 · 2 books', initials: 'PS', target: { screen: 'Spaces', params: { space: 'Settle' } } },
  { id: 's9', kind: 'People', title: 'Rahul Verma', sub: 'Owes you ₹1,200 · Goa Trip', initials: 'RV', target: { screen: 'Spaces', params: { space: 'Settle' } } },
  { id: 's10', kind: 'People', title: 'Meera Iyer', sub: 'You owe ₹800 · Goa Trip', initials: 'MI', target: { screen: 'Pay' } },
];

export const vault: VaultDoc[] = [
  { id: 'd1', name: 'Toit Brewpub receipt', folder: 'Receipts', sub: 'Goa Trip · ₹4,800 · today', icon: 'receipt', ext: 'JPG' },
  { id: 'd2', name: 'Samsung fridge warranty', folder: 'Warranties', sub: 'Croma · 2 years', expiry: 'Ends in 5 months', icon: 'file', ext: 'PDF' },
  { id: 'd3', name: 'Star Health policy', folder: 'IDs', sub: 'Family floater · ₹10L', expiry: 'Renews in 29 days', icon: 'shield', ext: 'PDF' },
  { id: 'd4', name: 'BESCOM September bill', folder: 'Bills', sub: 'Home & Family · ₹4,860', expiry: 'Due Friday', icon: 'lightning', ext: 'PDF' },
  { id: 'd5', name: 'Aadhaar card', folder: 'IDs', sub: 'Arjun Kumar', icon: 'user', ext: 'PDF' },
];

export const sms: SmsTxn[] = [
  { id: 's1', bank: 'HDFC Bank', when: '1:14 PM', raw: 'Rs.349.00 debited from A/c XX4821 to ZOMATO on 23-09-26. UPI Ref 426610', merchant: 'Zomato', meta: 'Home & Family · Food', amount: 349, debit: true },
  { id: 's2', bank: 'HDFC Bank', when: '8:12 PM', raw: 'Rs.1,240.00 debited from A/c XX4821 to SWIGGY on 23-09-26. UPI Ref 426102', merchant: 'Swiggy', meta: 'Home & Family · Food', amount: 1240, debit: true, duplicate: true },
  { id: 's3', bank: 'ICICI Bank', when: 'Mon', raw: 'INR 84,000.00 credited to A/c XX0937. Info: SALARY SEP. Avl Bal INR 2,12,400', merchant: 'Salary', meta: 'Personal · Income', amount: 84000, debit: false },
  { id: 's4', bank: 'Paytm', when: 'Yesterday', raw: 'Paid Rs.60 to Ramesh Auto from Paytm UPI. Ref 88120', merchant: 'Auto ride', meta: 'Goa Trip · Travel', amount: 60, debit: true },
];

export const templates: Template[] = [
  { id: 't1', name: 'Morning milk', amount: 60, meta: 'Home & Family · Cash', icon: 'milk' },
  { id: 't2', name: 'Petrol', amount: 500, meta: 'Home & Family · Card', icon: 'fuel' },
  { id: 't3', name: 'Maid salary', amount: 4000, meta: 'Home & Family · UPI', icon: 'coins' },
  { id: 't4', name: 'Site labour · daily', amount: 12000, meta: 'Site Work · Cash', icon: 'hand' },
  { id: 't5', name: 'Auto to office', amount: 180, meta: 'Personal · UPI', icon: 'bike' },
];

export const recurring: Recurring[] = [
  { id: 'rent', name: 'Rent · Mr. Rao', meta: 'Monthly · next 1 Oct', amount: 25000, mono: 'R', bg: '#1F2A44', fg: '#9DB4FF' },
  { id: 'sip', name: 'Index fund SIP', meta: 'Monthly · next 10 Oct', amount: 5000, mono: 'I', bg: '#0E3B2E', fg: '#5EE6B5' },
  { id: 'nf', name: 'Netflix', meta: 'Monthly · next 5 Oct', amount: 649, mono: 'N', bg: '#E50914', fg: '#FFFFFF' },
  { id: 'gym', name: 'Cult.fit', meta: 'Monthly · next 12 Oct', amount: 1499, mono: 'C', bg: '#2B2B2B', fg: '#FF5A5F' },
  { id: 'adobe', name: 'Adobe Creative Cloud', meta: 'Yearly · next 14 Oct', amount: 2850, mono: 'A', bg: '#FA0F00', fg: '#FFFFFF' },
];

export const plans: Plan[] = [
  { id: 'free', name: 'Free', tag: 'For trying it out', monthly: 0, annual: 0, limits: ['30 scans/mo', '20 voice entries', '5 books', '3 people/book'] },
  { id: 'plus', name: 'Plus', tag: 'For busy households', monthly: 99, annual: 999, limits: ['300 scans/mo', '200 voice entries', '20 books', '8 people/book'] },
  { id: 'pro', name: 'Pro', tag: 'For trips and power users', monthly: 199, annual: 1999, limits: ['Unlimited scans', 'Unlimited voice', 'Unlimited books', '20 people/book'] },
  { id: 'biz', name: 'Business', tag: 'For teams · per seat', monthly: 149, annual: 1499, limits: ['Everything in Pro', 'Approvals & roles', 'Tally export', 'GST invoices'] },
];

export const usage: Usage[] = [
  { label: 'Scans', used: 24, limit: 30, icon: 'scan' }, { label: 'Voice entries', used: 12, limit: 20, icon: 'mic' }, { label: 'Books', used: 4, limit: 5, icon: 'books' },
];

export const approvals: Approval[] = [
  { id: 'p1', title: 'Cement & tiles', meta: 'Neha Rao · today', amount: 18600, hasReceipt: true },
  { id: 'p2', title: 'MacBook Air for studio', meta: 'Kabir Shah · yesterday', amount: 94900, hasReceipt: true },
  { id: 'p3', title: 'Client dinner · Olive', meta: 'Rahul Verma · 21 Sep', amount: 12400, hasReceipt: false },
];

export const adminOverview: AdminOverview = {
  spentThisMonth: 977000, pending: 3, members: 6, overLimit: 1,
  recent: [{ text: 'Priya approved Tiles advance · ₹42,000', when: '2h' }, { text: 'Neha added Cement & tiles · ₹18,600', when: '5h' }, { text: 'You set Accountant limit to ₹50,000', when: 'Yday' }],
};

export const invite: Invite = { bookId: 'goa', bookName: 'Goa Trip', invitedBy: 'Priya Sharma', members: ['PS', 'RV', 'KS', 'MI'], spent: 11500, dates: '18 — 26 Sep · Trip', role: 'Contributor', status: 'ok' };

export const tickets: Ticket[] = [{ id: 'BJ-2790', title: 'Split not showing for Meera', when: '12 Sep', status: 'Answered' }];

export const notifPrefs: NotifPrefs = {
  channels: { pay: [true, true, true], apr: [true, true, false], rem: [true, false, true], bill: [true, true, false], dig: [false, true, false], sec: [true, true, true] },
  hideAmounts: false, quietHours: true, bundle: false,
};

export const importPreview: ImportPreview = {
  rows: 212,
  columns: [
    { name: 'Vch Date', example: '01-04-2025, 02-04-2025', mapTo: 'Date' },
    { name: 'Particulars', example: 'Cement bags, Tiles advance', mapTo: 'Description' },
    { name: 'Debit', example: '12,400 · 42,000', mapTo: 'Money out' },
    { name: 'Credit', example: '— · 84,000', mapTo: 'Money in' },
    { name: 'Ledger', example: 'Shree Cement, Kajaria', mapTo: 'Party' },
  ],
  errors: [
    { row: '47', problem: 'Date missing', line: 'Cement bags · ₹12,400 · Shree Cement' },
    { row: '118', problem: 'Amount not a number', line: 'Labour · "twelve k" · Site crew' },
  ],
};

export const contacts = [
  { id: 'p_AK', initials: 'AK', name: 'Arjun Kumar', short: 'You', upiId: 'arjun@okhdfc' },
  { id: 'p_PS', initials: 'PS', name: 'Priya Sharma', short: 'Priya', upiId: 'priya@okicici' },
  { id: 'p_RV', initials: 'RV', name: 'Rahul Verma', short: 'Rahul', upiId: 'rahul@ybl' },
  { id: 'p_KS', initials: 'KS', name: 'Kabir Shah', short: 'Kabir', upiId: 'kabir@paytm' },
  { id: 'p_MI', initials: 'MI', name: 'Meera Iyer', short: 'Meera', upiId: 'meera@okaxis' },
];
export const subscription: Subscription = { plan: 'pro', planName: 'Pro', renewsOn: '1 Nov', status: 'active' };
export const recentPayees: RecentPayee[] = [
  { initials: 'CP', name: 'Chai Point', vpa: 'chaipoint.blr@icici', bg: '#2A1E14', fg: '#F5B041' },
  { initials: 'MI', name: 'Meera', vpa: 'meera@okaxis', bg: '#DCEBFF', fg: '#14366B' },
  { initials: 'RA', name: 'Ramesh Auto', vpa: 'rameshauto@ybl', bg: '#1F2A44', fg: '#9DB4FF' },
];
export const accountTxns: Record<string, AccountTxn[]> = {
  hdfc: [{ id: 't1', title: 'Swiggy', when: 'Today, 8:12 PM', amount: -1240 }, { id: 't2', title: 'Zomato', when: 'Today, 1:14 PM', amount: -349 }, { id: 't3', title: 'Kabir · UPI', when: 'Today, 4:10 PM', amount: 1250 }],
  cash: [{ id: 't4', title: 'Morning milk', when: 'Today, 7:02 AM', amount: -60 }, { id: 't5', title: 'Cash counted', when: 'Today', amount: 3450 }],
  icici: [{ id: 't6', title: 'Salary SEP', when: 'Mon', amount: 84000 }, { id: 't7', title: 'Cement & tiles', when: 'Fri', amount: -18600 }],
  card: [{ id: 't8', title: 'Amazon', when: 'Sat', amount: -2399 }, { id: 't9', title: 'Netflix', when: '5 Sep', amount: -649 }],
};
const ROLE_DEF: Record<string, Record<string, boolean>> = { Owner: { add: true, editAll: true, del: true, approve: true, invite: true, export: true }, Admin: { add: true, editAll: true, del: true, approve: true, invite: true, export: true }, Accountant: { add: true, editAll: true, export: true }, Contributor: { add: true }, Viewer: {} };
export const roleConfigs: RoleConfig[] = (['Owner', 'Admin', 'Accountant', 'Contributor', 'Viewer'] as const).map(r => ({ role: r, perms: ROLE_DEF[r], approvalLimit: r === 'Accountant' ? 50000 : r === 'Contributor' ? 10000 : null, members: r === 'Contributor' ? 2 : 1 }));
export const recentSearches = ['Toit', 'Rent', 'Priya'];
