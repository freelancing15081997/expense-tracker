/** Same-receipt / near-duplicate matching used before save (mirrors server ledgerFindDuplicateExpense). */

function text(value: unknown) {
  return String(value ?? '').trim();
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normDupLabel(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isGenericDupLabel(value: string) {
  return !value || /^(receipt|bill|invoice|expense|payment|purchase|unnamed|attachment|image|photo|scan|shared receipt|upi|transaction)$/.test(value);
}

export function sameDupMerchant(a: string, b: string) {
  if (!a || !b || isGenericDupLabel(a) || isGenericDupLabel(b)) return false;
  if (a === b) return a.length >= 3;
  if (a.length < 6 || b.length < 6) return false;
  return a.includes(b) || b.includes(a);
}

export type DuplicateCandidate = {
  id?: string;
  amount?: unknown;
  date?: unknown;
  description?: unknown;
  merchant?: unknown;
  receiptHash?: unknown;
  upiRef?: unknown;
  invoiceNumber?: unknown;
};

export type DuplicateProbe = DuplicateCandidate & {
  allowSoft?: unknown;
  exceptId?: string;
};

/** Why a row is treated as a duplicate — used by tests and the confirm sheet. */
export type DuplicateReason = 'receipt_hash' | 'upi_ref' | 'invoice' | 'exact' | 'soft_merchant';

export function matchDuplicateExpenses(
  rows: DuplicateCandidate[],
  input: DuplicateProbe,
): Array<DuplicateCandidate & { reason: DuplicateReason }> {
  const hash = text(input.receiptHash);
  if (hash) {
    const hit = rows.find((row) => text(row.receiptHash) === hash && row.id !== input.exceptId);
    if (hit) return [{ ...hit, reason: 'receipt_hash' }];
  }

  const upiRef = text(input.upiRef).trim();
  const invoiceNumber = normDupLabel(input.invoiceNumber);
  const amount = num(input.amount);
  const date = text(input.date);
  const description = normDupLabel(input.description);
  const merchant = normDupLabel(input.merchant);
  const allowSoft = Boolean(input.allowSoft);

  if (upiRef && upiRef.length >= 6) {
    const byRef = rows.find((row) => row.id !== input.exceptId && text(row.upiRef).trim() === upiRef);
    if (byRef) return [{ ...byRef, reason: 'upi_ref' }];
  }

  if (invoiceNumber && invoiceNumber.length >= 4 && amount > 0) {
    const byInv = rows.find((row) => {
      if (row.id === input.exceptId) return false;
      if (num(row.amount) !== amount) return false;
      return normDupLabel(row.invoiceNumber) === invoiceNumber;
    });
    if (byInv) return [{ ...byInv, reason: 'invoice' }];
  }

  if (amount > 0 && date) {
    const exact = rows.filter((row) => {
      if (row.id === input.exceptId) return false;
      if (num(row.amount) !== amount) return false;
      if (text(row.date) !== date) return false;
      const rowDesc = normDupLabel(row.description);
      const rowMerchant = normDupLabel(row.merchant);
      if (description && rowDesc === description) return true;
      if (merchant && rowMerchant && (rowMerchant === merchant || sameDupMerchant(merchant, rowMerchant))) return true;
      if (description && rowMerchant && rowMerchant === description) return true;
      return false;
    }).slice(0, 5);
    if (exact.length) return exact.map((row) => ({ ...row, reason: 'exact' as const }));
  }

  if (allowSoft && date) {
    const needle = (!isGenericDupLabel(merchant) && merchant.length >= 3)
      ? merchant
      : ((!isGenericDupLabel(description) && description.length >= 3) ? description : '');
    if (needle) {
      const soft = rows.filter((row) => {
        if (row.id === input.exceptId) return false;
        if (text(row.date) !== date) return false;
        const rowMerchant = normDupLabel(row.merchant) || normDupLabel(row.description);
        return sameDupMerchant(needle, rowMerchant);
      }).slice(0, 5);
      if (soft.length) return soft.map((row) => ({ ...row, reason: 'soft_merchant' as const }));
    }
  }

  return [];
}
