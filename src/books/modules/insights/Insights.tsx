import React, { useMemo } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { todayISO } from '../../core/money';
import { Card, Money, PageShell } from '../../ui';

export default function Insights() {
  const { accounts, documents, journals, bankTxns, currency } = useBooks();

  const insights = useMemo(() => {
    const items: { title: string; body: string; tone: 'ok' | 'warn' }[] = [];
    const debit = accounts.reduce((s, a) => s + a.debitTotalMinor, 0);
    const credit = accounts.reduce((s, a) => s + a.creditTotalMinor, 0);
    items.push(debit === credit
      ? { title: 'Trial balance', body: 'Debits equal credits on posted accounts.', tone: 'ok' }
      : { title: 'Trial balance', body: 'Debits and credits do not match. Inspect journals before closing.', tone: 'warn' });

    const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
    const overdueAmt = overdue.reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);
    items.push(overdue.length
      ? { title: 'Collections', body: `${overdue.length} overdue invoice(s) totalling posted outstanding.`, tone: 'warn' }
      : { title: 'Collections', body: 'No overdue posted invoices.', tone: 'ok' });

    const unrec = bankTxns.filter((t) => !t.reconciled);
    items.push(unrec.length
      ? { title: 'Bank', body: `${unrec.length} bank journal(s) are not marked reconciled.`, tone: 'warn' }
      : { title: 'Bank', body: 'No unreconciled bank journals in the register.', tone: 'ok' });

    const large = journals.filter((j) => j.status === 'posted' && j.debitTotalMinor >= 10000000);
    items.push(large.length
      ? { title: 'Large journals', body: `${large.length} posted journal(s) are ₹1,00,000 or more. Review source documents.`, tone: 'warn' }
      : { title: 'Large journals', body: 'No posted journals at or above ₹1,00,000.', tone: 'ok' });

    const drafts = documents.filter((d) => d.status === 'draft');
    items.push(drafts.length
      ? { title: 'Unposted drafts', body: `${drafts.length} document(s) are still draft and have not hit the ledger.`, tone: 'warn' }
      : { title: 'Unposted drafts', body: 'No draft documents waiting to post.', tone: 'ok' });

    return { items, overdueAmt };
  }, [accounts, bankTxns, documents, journals]);

  return (
    <PageShell title="Insights" subtitle="No AI provider is connected. These are rule-based checks on posted books. A model must never post.">
      <Card className="p-4 border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-900">Adapter: OCR, bank feeds, e-invoice, and generative AI stay unconnected. Human approval is required before any journal posts.</p>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {insights.items.map((item) => (
          <Card key={item.title} className={`p-4 ${item.tone === 'warn' ? 'border-amber-200' : ''}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{item.title}</p>
            <p className="mt-2 text-sm text-slate-700">{item.body}</p>
          </Card>
        ))}
      </div>
      {insights.overdueAmt > 0 && (
        <Card className="p-4">
          <p className="text-sm text-slate-600">Overdue outstanding</p>
          <p className="text-xl mt-1"><Money minor={insights.overdueAmt} currency={currency} /></p>
        </Card>
      )}
    </PageShell>
  );
}
