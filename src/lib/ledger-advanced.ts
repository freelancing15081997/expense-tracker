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

export function todayOut(expenses: Array<Record<string, unknown>>, day = isoDay()) {
  return expenses.reduce((sum, exp) => {
    if (String(exp.entryType || 'out') !== 'out') return sum;
    if (!String(exp.date || '').startsWith(day)) return sum;
    return sum + Number(exp.amount || 0);
  }, 0);
}

export function wouldBreakDailyCap(expenses: Array<Record<string, unknown>>, cap: number, extra: number, day = isoDay()) {
  if (!cap || extra <= 0) return false;
  return todayOut(expenses, day) + extra > cap;
}

export function anomalyIds(expenses: Array<Record<string, unknown>>) {
  const outs = expenses.filter((exp) => String(exp.entryType || 'out') === 'out').map((exp) => Number(exp.amount || 0)).filter((n) => n > 0);
  if (outs.length < 4) return new Set<string>();
  const sorted = [...outs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const cutoff = median * 2.5;
  return new Set(
    expenses
      .filter((exp) => String(exp.entryType || 'out') === 'out' && Number(exp.amount || 0) > cutoff)
      .map((exp) => String(exp.id || '')),
  );
}

export function nearDupeIds(expenses: Array<Record<string, unknown>>, windowDays = 3) {
  const hits = new Set<string>();
  const rows = expenses.filter((exp) => String(exp.entryType || 'out') === 'out');
  for (let i = 0; i < rows.length; i += 1) {
    const a = rows[i];
    const dayA = String(a.date || '').slice(0, 10);
    const amtA = Number(a.amount || 0);
    const descA = String(a.description || '').trim().toLowerCase();
    if (!dayA || !amtA) continue;
    const tA = Date.parse(`${dayA}T12:00:00`);
    for (let j = i + 1; j < rows.length; j += 1) {
      const b = rows[j];
      if (Number(b.amount || 0) !== amtA) continue;
      const dayB = String(b.date || '').slice(0, 10);
      const tB = Date.parse(`${dayB}T12:00:00`);
      if (!Number.isFinite(tA) || !Number.isFinite(tB) || Math.abs(tA - tB) > windowDays * 86400000) continue;
      const descB = String(b.description || '').trim().toLowerCase();
      if (descA && descB && descA !== descB && !descA.includes(descB) && !descB.includes(descA)) continue;
      hits.add(String(a.id || ''));
      hits.add(String(b.id || ''));
    }
  }
  return hits;
}

export function staleReimburseIds(expenses: Array<Record<string, unknown>>, days = 14) {
  const cutoff = Date.now() - days * 86400000;
  return new Set(
    expenses
      .filter((exp) => exp.reimbursable && Date.parse(`${String(exp.date || isoDay())}T12:00:00`) < cutoff)
      .map((exp) => String(exp.id || '')),
  );
}

export function methodMix(expenses: Array<Record<string, unknown>>) {
  const mix = new Map<string, number>();
  for (const exp of expenses) {
    if (String(exp.entryType || 'out') !== 'out') continue;
    const method = String(exp.paymentMethod || 'cash');
    mix.set(method, (mix.get(method) || 0) + Number(exp.amount || 0));
  }
  return [...mix.entries()].sort((a, b) => b[1] - a[1]);
}

export function weekOverWeek(expenses: Array<Record<string, unknown>>) {
  const today = new Date();
  const startThis = new Date(today);
  startThis.setDate(today.getDate() - 6);
  const startLast = new Date(today);
  startLast.setDate(today.getDate() - 13);
  const thisFrom = isoDay(startThis);
  const lastFrom = isoDay(startLast);
  const lastTo = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  let thisWeek = 0;
  let lastWeek = 0;
  for (const exp of expenses) {
    if (String(exp.entryType || 'out') !== 'out') continue;
    const day = String(exp.date || '').slice(0, 10);
    const amt = Number(exp.amount || 0);
    if (day >= thisFrom) thisWeek += amt;
    else if (day >= lastFrom && day <= lastTo) lastWeek += amt;
  }
  const delta = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : ((thisWeek - lastWeek) / lastWeek) * 100;
  return { thisWeek, lastWeek, delta };
}

export function budgetDaysLeft(monthOut: number, budget: number) {
  if (!budget || budget <= monthOut) return 0;
  const dayNum = new Date().getDate();
  const pace = monthOut / Math.max(1, dayNum);
  if (pace <= 0) return 99;
  return Math.max(0, Math.floor((budget - monthOut) / pace));
}

export function toLedgerCsv(expenses: Array<Record<string, unknown>>) {
  const header = 'Date,Type,Category,Description,Merchant,Method,Amount,Notes,Flagged,Reimbursable';
  const rows = expenses.map((exp) => [
    exp.date || '',
    exp.entryType || 'out',
    csvQuote(exp.category),
    csvQuote(exp.description),
    csvQuote(exp.merchant),
    exp.paymentMethod || '',
    Number(exp.amount || 0).toFixed(2),
    csvQuote(exp.notes),
    exp.flagged ? 'yes' : '',
    exp.reimbursable ? 'yes' : '',
  ].join(','));
  return [header, ...rows].join('\n');
}

function csvQuote(value: unknown) {
  const text = String(value || '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toOfx(expenses: Array<Record<string, unknown>>, name: string) {
  const body = expenses.map((exp) => {
    const sign = exp.entryType === 'in' ? 1 : -1;
    const amt = (sign * Number(exp.amount || 0)).toFixed(2);
    const day = String(exp.date || isoDay()).replace(/-/g, '');
    return `<STMTTRN><TRNTYPE>${sign > 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE><DTPOSTED>${day}</DTPOSTED><TRNAMT>${amt}</TRNAMT><FITID>${exp.id || newId('ofx')}</FITID><NAME>${String(exp.merchant || exp.description || '').slice(0, 32)}</NAME><MEMO>${String(exp.description || '')}</MEMO></STMTTRN>`;
  }).join('');
  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>${body}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n<!-- ${name} -->`;
}

export function entryPlainText(exp: Record<string, unknown>, symbol: string) {
  const sign = exp.entryType === 'in' ? '+' : exp.entryType === 'transfer' ? '' : '−';
  return `${exp.date || ''}  ${sign}${symbol}${Number(exp.amount || 0).toLocaleString()}  ${exp.description || ''}  ${exp.category || ''}  ${exp.merchant || ''}`.replace(/\s+/g, ' ').trim();
}

export function readWatchMerchants(book: Record<string, unknown> | null | undefined) {
  return Array.isArray(book?.watchMerchants) ? book.watchMerchants.map(String) : [];
}

export function touchRecentLedger(id: string) {
  try {
    const prev = readRecentLedgers().filter((row) => row !== id);
    localStorage.setItem('byjan.recent.ledgers', JSON.stringify([id, ...prev].slice(0, 8)));
  } catch { /* ignore */ }
}

export function readRecentLedgers() {
  try {
    const raw = JSON.parse(localStorage.getItem('byjan.recent.ledgers') || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [] as string[];
  }
}

export function readLastQuick(bookId: string) {
  try {
    return JSON.parse(localStorage.getItem(`byjan.quick.${bookId}`) || '{}') as { category?: string; merchant?: string };
  } catch {
    return {};
  }
}

export function missingReceiptIds(expenses: Array<Record<string, unknown>>, min = 200) {
  return new Set(
    expenses
      .filter((exp) => String(exp.entryType || 'out') === 'out' && Number(exp.amount || 0) >= min && !exp.receiptPath && !exp.receiptUrl)
      .map((exp) => String(exp.id || '')),
  );
}

export function taxYearRange(kind: 'calendar' | 'fy-in', now = new Date()) {
  const year = now.getFullYear();
  if (kind === 'calendar') return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
  const start = now.getMonth() >= 3 ? year : year - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31`, label: `FY ${start}-${String(start + 1).slice(2)}` };
}

export function writeLastQuick(bookId: string, patch: { category?: string; merchant?: string }) {
  try {
    localStorage.setItem(`byjan.quick.${bookId}`, JSON.stringify({ ...readLastQuick(bookId), ...patch }));
  } catch { /* ignore */ }
}
