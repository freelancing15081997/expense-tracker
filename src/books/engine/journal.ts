import type { FinanceAccount, JournalLineInput } from '../core/types';

export class BooksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BooksError';
  }
}

export function assertBalanced(lines: JournalLineInput[]): { debit: number; credit: number } {
  if (lines.length < 2) throw new BooksError('A journal needs at least two lines');
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (!line.accountId) throw new BooksError('Every line needs an account');
    if (!Number.isInteger(line.debitMinor) || !Number.isInteger(line.creditMinor)) {
      throw new BooksError('Journal amounts must be integer minor units');
    }
    if (line.debitMinor < 0 || line.creditMinor < 0) throw new BooksError('Debit and credit cannot be negative');
    if (line.debitMinor > 0 && line.creditMinor > 0) throw new BooksError('A line cannot have both debit and credit');
    if (line.debitMinor === 0 && line.creditMinor === 0) throw new BooksError('A line cannot be zero');
    debit += line.debitMinor;
    credit += line.creditMinor;
  }
  if (debit !== credit) throw new BooksError('Journal is unbalanced: debits must equal credits');
  if (debit === 0) throw new BooksError('Journal total cannot be zero');
  return { debit, credit };
}

export function assertPostable(accounts: Map<string, FinanceAccount>, lines: JournalLineInput[]): void {
  for (const line of lines) {
    const account = accounts.get(line.accountId);
    if (!account) throw new BooksError('Account not found');
    if (!account.active) throw new BooksError(`${account.code} is inactive`);
    if (!account.allowPosting) throw new BooksError(`${account.code} ${account.name} does not allow posting`);
  }
}

export function invertLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    ...line,
    debitMinor: line.creditMinor,
    creditMinor: line.debitMinor,
    memo: line.memo ? `Reversal: ${line.memo}` : 'Reversal',
  }));
}

export function nextNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(5, '0')}`;
}
