import { lineAmount, percentOf } from '../core/money';
import type { DocumentLineInput, TaxBreakdown, TaxCode } from '../core/types';
import { BooksError } from './journal';

export function computeTax(exclusiveMinor: number, rateBps: number, interstate: boolean): TaxBreakdown {
  const taxMinor = percentOf(exclusiveMinor, rateBps);
  if (interstate || rateBps === 0) {
    return { exclusiveMinor, taxMinor, cgstMinor: 0, sgstMinor: 0, igstMinor: taxMinor };
  }
  const cgstMinor = Math.floor(taxMinor / 2);
  return { exclusiveMinor, taxMinor, cgstMinor, sgstMinor: taxMinor - cgstMinor, igstMinor: 0 };
}

export function computeDocument(
  lines: DocumentLineInput[],
  taxCodes: Map<string, TaxCode>,
  interstate: boolean
): { lines: DocumentLineInput[]; tax: TaxBreakdown; totalMinor: number } {
  if (lines.length === 0) throw new BooksError('Add at least one line');
  let exclusive = 0;
  let taxMinor = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const line of lines) {
    if (!line.description.trim()) throw new BooksError('Each line needs a description');
    if (!line.accountId) throw new BooksError('Each line needs an account');
    const code = taxCodes.get(line.taxCode);
    if (!code || !code.active) throw new BooksError(`Unknown tax code ${line.taxCode}`);
    const amt = lineAmount(line.qtyMilli, line.unitPriceMinor);
    const split = computeTax(amt, code.rateBps, interstate);
    exclusive += split.exclusiveMinor;
    taxMinor += split.taxMinor;
    cgst += split.cgstMinor;
    sgst += split.sgstMinor;
    igst += split.igstMinor;
  }
  return {
    lines,
    tax: { exclusiveMinor: exclusive, taxMinor, cgstMinor: cgst, sgstMinor: sgst, igstMinor: igst },
    totalMinor: exclusive + taxMinor,
  };
}
