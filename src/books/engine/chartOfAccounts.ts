import type { AccountType, FinanceAccount, NormalBalance, SystemAccountKey } from '../core/types';
import { DEBIT_TYPES } from '../core/types';

type Seed = {
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string;
  systemKey?: SystemAccountKey;
  allowPosting?: boolean;
};

const SEED: Seed[] = [
  { code: '1000', name: 'Current Assets', type: 'asset', allowPosting: false },
  { code: '1000.10', name: 'Cash', type: 'asset', parentCode: '1000', systemKey: 'cash' },
  { code: '1000.20', name: 'Bank', type: 'asset', parentCode: '1000', systemKey: 'bank' },
  { code: '1000.30', name: 'Accounts Receivable', type: 'asset', parentCode: '1000', systemKey: 'ar' },
  { code: '1000.40', name: 'GST Input', type: 'asset', parentCode: '1000', systemKey: 'tax_input' },
  { code: '1000.50', name: 'Inventory', type: 'asset', parentCode: '1000', systemKey: 'inventory' },
  { code: '1000.60', name: 'Fixed Assets', type: 'asset', parentCode: '1000', systemKey: 'fixed_asset' },
  { code: '1000.70', name: 'Accumulated Depreciation', type: 'asset', parentCode: '1000', systemKey: 'accum_dep' },
  { code: '2000', name: 'Current Liabilities', type: 'liability', allowPosting: false },
  { code: '2000.10', name: 'Accounts Payable', type: 'liability', parentCode: '2000', systemKey: 'ap' },
  { code: '2000.20', name: 'GST Output', type: 'liability', parentCode: '2000', systemKey: 'tax_output' },
  { code: '2000.30', name: 'Deferred Revenue', type: 'liability', parentCode: '2000', systemKey: 'deferred_revenue' },
  { code: '2000.40', name: 'TDS Payable', type: 'liability', parentCode: '2000', systemKey: 'tds_payable' },
  { code: '3000', name: 'Equity', type: 'equity', allowPosting: false },
  { code: '3000.10', name: 'Owner Equity', type: 'equity', parentCode: '3000' },
  { code: '3000.20', name: 'Retained Earnings', type: 'equity', parentCode: '3000', systemKey: 'retained_earnings' },
  { code: '4000', name: 'Income', type: 'revenue', allowPosting: false },
  { code: '4000.10', name: 'Sales', type: 'revenue', parentCode: '4000', systemKey: 'sales' },
  { code: '4000.20', name: 'Other Income', type: 'other_income', parentCode: '4000' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'cogs', systemKey: 'cogs' },
  { code: '6000', name: 'Operating Expenses', type: 'expense', allowPosting: false },
  { code: '6000.10', name: 'General Expenses', type: 'expense', parentCode: '6000', systemKey: 'operating_expense' },
  { code: '6000.20', name: 'Salaries', type: 'expense', parentCode: '6000' },
  { code: '6000.30', name: 'Rent', type: 'expense', parentCode: '6000' },
  { code: '6000.40', name: 'Utilities', type: 'expense', parentCode: '6000' },
  { code: '6000.50', name: 'Depreciation', type: 'expense', parentCode: '6000', systemKey: 'dep_expense' },
];

export const EXTENDED_SEED: Seed[] = SEED.filter((row) =>
  ['inventory', 'fixed_asset', 'accum_dep', 'deferred_revenue', 'tds_payable', 'cogs', 'dep_expense'].includes(row.systemKey || '')
);

export function normalBalanceFor(type: AccountType): NormalBalance {
  return DEBIT_TYPES.includes(type) ? 'debit' : 'credit';
}

export function seedAccounts(): Omit<FinanceAccount, 'id'>[] {
  return SEED.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    parentId: row.parentCode ?? null,
    normalBalance: normalBalanceFor(row.type),
    allowPosting: row.allowPosting ?? true,
    isSystem: Boolean(row.systemKey) || row.allowPosting === false,
    systemKey: row.systemKey ?? null,
    active: true,
    debitTotalMinor: 0,
    creditTotalMinor: 0,
  }));
}

export function signedBalance(account: Pick<FinanceAccount, 'debitTotalMinor' | 'creditTotalMinor' | 'normalBalance'>): number {
  const raw = account.debitTotalMinor - account.creditTotalMinor;
  return account.normalBalance === 'debit' ? raw : -raw;
}

export const TAX_SEED = [
  { id: 'EXEMPT', name: 'Exempt (0%)', rateBps: 0 },
  { id: 'GST5', name: 'GST 5%', rateBps: 500 },
  { id: 'GST12', name: 'GST 12%', rateBps: 1200 },
  { id: 'GST18', name: 'GST 18%', rateBps: 1800 },
  { id: 'GST28', name: 'GST 28%', rateBps: 2800 },
];
