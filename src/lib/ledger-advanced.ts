export type EntryTemplate = {
  id: string;
  name: string;
  description: string;
  amount: number;
  category: string;
  entryType: 'in' | 'out' | 'transfer';
  merchant?: string;
  paymentMethod?: string;
};

export type RecurringRule = {
  id: string;
  description: string;
  amount: number;
  category: string;
  entryType: 'in' | 'out';
  merchant?: string;
  paymentMethod?: string;
  cadence: 'weekly' | 'monthly';
  nextDate: string;
  active: boolean;
};

export function isoDay(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readTemplates(book: Record<string, unknown> | null | undefined): EntryTemplate[] {
  return Array.isArray(book?.entryTemplates) ? book.entryTemplates as EntryTemplate[] : [];
}

export function readRecurring(book: Record<string, unknown> | null | undefined): RecurringRule[] {
  return Array.isArray(book?.recurringRules) ? book.recurringRules as RecurringRule[] : [];
}

export function advanceIso(day: string, cadence: RecurringRule['cadence']) {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDay();
  if (cadence === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return isoDay(d);
}

function csvCells(line: string) {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseLedgerCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [] as Array<Record<string, unknown>>;
  const headers = csvCells(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => names.reduce((found, name) => (found >= 0 ? found : headers.indexOf(name)), -1);
  const dateI = idx(['date', 'entry date', 'day']);
  const typeI = idx(['type', 'entrytype', 'entry type']);
  const catI = idx(['category']);
  const descI = idx(['description', 'memo', 'narration']);
  const merchantI = idx(['merchant', 'payee']);
  const methodI = idx(['method', 'payment method', 'mode']);
  const amountI = idx(['amount']);
  const notesI = idx(['notes', 'note']);
  return lines.slice(1).map((line) => {
    const cells = csvCells(line);
    const amount = Number(String(cells[amountI] || '').replace(/[^0-9.-]/g, ''));
    const rawType = String(cells[typeI] || 'out').toLowerCase();
    const entryType = rawType.includes('in') && !rawType.includes('out') ? 'in' : rawType.includes('transfer') ? 'transfer' : 'out';
    return {
      date: cells[dateI] || isoDay(),
      entryType,
      category: cells[catI] || 'Uncategorized',
      description: cells[descI] || 'Imported entry',
      merchant: cells[merchantI] || '',
      paymentMethod: cells[methodI] || 'cash',
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      notes: cells[notesI] || '',
    };
  }).filter((row) => row.amount > 0 && row.description);
}

export function dueRecurringPosts(
  rules: RecurringRule[],
  expenses: Array<Record<string, unknown>>,
  today = isoDay(),
) {
  const posted = new Set(
    expenses
      .filter((exp) => exp.recurringRuleId)
      .map((exp) => `${exp.recurringRuleId}|${exp.date || ''}`),
  );
  const posts: Array<Record<string, unknown>> = [];
  const nextRules = rules.map((rule) => ({ ...rule }));
  for (const rule of nextRules) {
    if (!rule.active || !rule.nextDate) continue;
    let guard = 0;
    while (rule.nextDate <= today && guard < 12) {
      const key = `${rule.id}|${rule.nextDate}`;
      if (!posted.has(key)) {
        posts.push({
          amount: Number(rule.amount || 0),
          description: rule.description,
          category: rule.category,
          entryType: rule.entryType,
          date: rule.nextDate,
          merchant: rule.merchant || '',
          paymentMethod: rule.paymentMethod || 'cash',
          recurringRuleId: rule.id,
          status: Number(rule.amount || 0) > 0 ? 'recorded' : 'draft',
        });
        posted.add(key);
      }
      rule.nextDate = advanceIso(rule.nextDate, rule.cadence);
      guard += 1;
    }
  }
  return { posts, nextRules };
}
