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

export type CategoryRule = { id: string; match: string; category: string };

export function readCategoryRules(book: Record<string, unknown> | null | undefined): CategoryRule[] {
  return Array.isArray(book?.categoryRules) ? book.categoryRules as CategoryRule[] : [];
}

export function applyCategoryRules(description: string, merchant: string, rules: CategoryRule[]) {
  const hay = `${description} ${merchant}`.toLowerCase();
  return rules.find((rule) => rule.match.trim() && hay.includes(rule.match.trim().toLowerCase()))?.category || '';
}

export function tileHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 33 + name.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string) {
  const parts = String(name || 'L').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || 'L').join('') || 'L';
}

export function monthKey(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function sparkDays(expenses: Array<Record<string, unknown>>, days = 7) {
  const out = Array.from({ length: days }, () => 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (const exp of expenses) {
    if (exp.entryType === 'in' || exp.entryType === 'transfer') continue;
    const day = String(exp.date || '').slice(0, 10);
    if (!day) continue;
    const diff = Math.round((today.getTime() - new Date(`${day}T12:00:00`).getTime()) / 86400000);
    if (diff >= 0 && diff < days) out[days - 1 - diff] += Number(exp.amount || 0);
  }
  return out;
}

export function ledgerInsights(expenses: Array<Record<string, unknown>>, budget = 0) {
  const thisKey = monthKey(0);
  const lastKey = monthKey(-1);
  let monthOut = 0;
  let lastOut = 0;
  let monthIn = 0;
  let weekend = 0;
  let weekday = 0;
  const merchants = new Map<string, number>();
  const people = new Map<string, number>();
  const clusters = new Map<string, number>();
  for (const exp of expenses) {
    const amount = Number(exp.amount || 0);
    const type = String(exp.entryType || 'out');
    const day = String(exp.date || '');
    const person = String(exp.enteredBy || exp.paidByName || 'Someone');
    if (type !== 'transfer') people.set(person, (people.get(person) || 0) + (type === 'in' ? amount : -amount));
    if (type === 'out') {
      if (day.startsWith(thisKey)) monthOut += amount;
      if (day.startsWith(lastKey)) lastOut += amount;
      const merchant = String(exp.merchant || '').trim();
      if (merchant) merchants.set(merchant, (merchants.get(merchant) || 0) + amount);
      const dow = new Date(`${day}T12:00:00`).getDay();
      if (dow === 0 || dow === 6) weekend += amount;
      else weekday += amount;
      const key = `${day}|${amount}|${String(exp.description || '').toLowerCase()}`;
      clusters.set(key, (clusters.get(key) || 0) + 1);
    }
    if (type === 'in' && day.startsWith(thisKey)) monthIn += amount;
  }
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayNum = new Date().getDate();
  const pace = budget > 0 ? (monthOut / Math.max(1, dayNum)) * daysInMonth : 0;
  const topMerchants = [...merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const settlement = [...people.entries()].sort((a, b) => a[1] - b[1]);
  const dupes = [...clusters.values()].filter((n) => n > 1).length;
  return { monthOut, lastOut, monthIn, weekend, weekday, topMerchants, settlement, pace, budget, dupes };
}

export function toQif(expenses: Array<Record<string, unknown>>, name: string) {
  const lines = ['!Type:Bank', `N${name}`];
  for (const exp of expenses) {
    const sign = exp.entryType === 'in' ? 1 : -1;
    lines.push(`D${String(exp.date || isoDay())}`, `T${(sign * Number(exp.amount || 0)).toFixed(2)}`, `P${exp.merchant || exp.description || ''}`, `L${exp.category || ''}`, `M${exp.description || ''}`, '^');
  }
  return lines.join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
