/**
 * Warranty / return extraction — only from explicit receipt text.
 * Never invents missing terms.
 */
export type WarrantyHint = {
  product?: string;
  merchant?: string;
  warrantyDays?: number;
  returnDays?: number;
  warrantyExpiry?: string;
  returnDeadline?: string;
  purchaseDate?: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
};

function addDays(iso: string, days: number): string | undefined {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse warranty/return windows from OCR or receipt text. */
export function extractWarrantyHints(input: {
  text?: string;
  merchant?: string;
  product?: string;
  purchaseDate?: string;
}): WarrantyHint | null {
  const text = String(input.text || '');
  if (!text.trim()) return null;
  const reasons: string[] = [];
  let warrantyDays: number | undefined;
  let returnDays: number | undefined;

  const warrantyMatch = text.match(/warranty\s*(?:period|of|:)?\s*(\d+)\s*(day|days|month|months|year|years)/i)
    || text.match(/(\d+)\s*(day|days|month|months|year|years)\s*warranty/i);
  if (warrantyMatch) {
    const n = Number(warrantyMatch[1]);
    const unit = warrantyMatch[2].toLowerCase();
    warrantyDays = /year/.test(unit) ? n * 365 : /month/.test(unit) ? n * 30 : n;
    reasons.push(`Warranty text: ${warrantyMatch[0]}`);
  }

  const returnMatch = text.match(/(?:return|exchange)\s*(?:within|period|policy|:)?\s*(\d+)\s*(day|days)/i)
    || text.match(/(\d+)\s*(day|days)\s*(?:return|exchange)/i);
  if (returnMatch) {
    returnDays = Number(returnMatch[1]);
    reasons.push(`Return text: ${returnMatch[0]}`);
  }

  if (warrantyDays == null && returnDays == null) return null;

  const purchaseDate = input.purchaseDate || undefined;
  const confidence: WarrantyHint['confidence'] = reasons.length >= 2 ? 'high' : 'medium';

  return {
    product: input.product,
    merchant: input.merchant,
    warrantyDays,
    returnDays,
    purchaseDate,
    warrantyExpiry: purchaseDate && warrantyDays != null ? addDays(purchaseDate, warrantyDays) : undefined,
    returnDeadline: purchaseDate && returnDays != null ? addDays(purchaseDate, returnDays) : undefined,
    confidence,
    reasons,
  };
}
