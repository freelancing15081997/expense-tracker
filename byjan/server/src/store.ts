import * as M from '../../src/api/mocks.ts';

export type DB = {
  user: typeof M.me;
  prefs: Record<string, boolean>;
  books: typeof M.books;
  entries: typeof M.entries;
  deleted: typeof M.entries;
  home: typeof M.home;
  settle: typeof M.settle;
  insights: typeof M.insights;
  accounts: typeof M.accounts;
  accountTxns: typeof M.accountTxns;
  dues: typeof M.dues;
  activity: typeof M.activity;
  inbox: typeof M.inbox;
  vault: typeof M.vault;
  sms: typeof M.sms;
  templates: typeof M.templates;
  recurring: typeof M.recurring;
  plans: typeof M.plans;
  usage: typeof M.usage;
  approvals: typeof M.approvals;
  admin: typeof M.adminOverview;
  tickets: typeof M.tickets;
  notifPrefs: typeof M.notifPrefs;
  contacts: typeof M.contacts;
  subscription: typeof M.subscription;
  recentPayees: typeof M.recentPayees;
  roles: typeof M.roleConfigs;
  recentSearches: string[];
  policies: Record<string, boolean>;
  payments: Record<string, { status: 'PENDING' | 'SUCCESS' | 'FAILED'; amount: number; to: string; app: string; utr?: string }>;
  orders: Record<string, { status: 'PENDING' | 'PAID'; plan: string }>;
  otps: Record<string, { phone: string; code: string }>;
  refresh: Set<string>;
  devices: Array<{ token: string; platform: string }>;
};

export function seed(): DB {
  return {
    user: structuredClone(M.me),
    prefs: { lock: true, bio: true, alerts: true, daily: false },
    books: structuredClone(M.books),
    entries: structuredClone(M.entries),
    deleted: [],
    home: structuredClone(M.home),
    settle: structuredClone(M.settle),
    insights: structuredClone(M.insights),
    accounts: structuredClone(M.accounts),
    accountTxns: structuredClone(M.accountTxns),
    dues: structuredClone(M.dues),
    activity: structuredClone(M.activity),
    inbox: structuredClone(M.inbox),
    vault: structuredClone(M.vault),
    sms: structuredClone(M.sms),
    templates: structuredClone(M.templates),
    recurring: structuredClone(M.recurring),
    plans: structuredClone(M.plans),
    usage: structuredClone(M.usage),
    approvals: structuredClone(M.approvals),
    admin: structuredClone(M.adminOverview),
    tickets: structuredClone(M.tickets),
    notifPrefs: structuredClone(M.notifPrefs),
    contacts: structuredClone(M.contacts),
    subscription: structuredClone(M.subscription),
    recentPayees: structuredClone(M.recentPayees),
    roles: structuredClone(M.roleConfigs),
    recentSearches: [...M.recentSearches],
    policies: { twoStep: true, receipts: true, lockMonth: false, exportR: true },
    payments: {},
    orders: {},
    otps: {},
    refresh: new Set(),
    devices: [],
  };
}

let db = seed();
export const state = () => db;
export function reset() { db = seed(); }
