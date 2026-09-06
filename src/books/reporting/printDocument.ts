import { formatMoney } from '../core/money';
import type { FinanceDocument, FinanceParty, FinanceTenant } from '../core/types';

export function printFinanceDocument(input: {
  tenant: FinanceTenant;
  document: FinanceDocument;
  party: FinanceParty | null;
  companyLogo?: string;
  partyLogo?: string;
}) {
  const { tenant, document, party, companyLogo, partyLogo } = input;
  const win = window.open('', '_blank', 'noopener,width=900,height=1100');
  if (!win) throw new Error('Allow pop-ups to print this document');
  const lines = document.lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.description)}</td>
      <td class="num">${(line.qtyMilli / 1000).toFixed(3)}</td>
      <td class="num">${formatMoney(line.unitPriceMinor, tenant.baseCurrency)}</td>
      <td class="num">${escapeHtml(line.taxCode)}</td>
    </tr>
  `).join('');
  win.document.write(`<!doctype html><html><head><title>${document.number}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #0B1F3A; padding: 32px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      img.logo { max-height: 64px; max-width: 140px; object-fit: contain; }
      h1 { margin: 8px 0 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #E5E7EB; text-align: left; padding: 8px 6px; font-size: 13px; }
      .num { text-align: right; }
      .foot { margin-top: 28px; display: flex; justify-content: space-between; }
      .muted { color: #6B7280; font-size: 12px; }
    </style>
  </head><body>
    <div class="top">
      <div>
        ${companyLogo ? `<img class="logo" src="${companyLogo}" alt="Company" />` : ''}
        <h1>${escapeHtml(tenant.name)}</h1>
        <p class="muted">Byjan · Trace Financials Easily</p>
      </div>
      <div style="text-align:right">
        ${partyLogo ? `<img class="logo" src="${partyLogo}" alt="Party" />` : ''}
        <p><strong>${escapeHtml(party?.name || '')}</strong></p>
        <p class="muted">${escapeHtml(party?.taxId || '')}</p>
        <p class="muted">${escapeHtml([party?.address, party?.city].filter(Boolean).join(', '))}</p>
      </div>
    </div>
    <p style="margin-top:28px"><strong>${escapeHtml(document.kind.replace('_', ' '))}</strong> ${escapeHtml(document.number)} · ${escapeHtml(document.date)}</p>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Tax</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="foot">
      <p class="muted">${escapeHtml(document.memo || '')}</p>
      <div>
        <p>Tax ${formatMoney(document.tax.taxMinor, tenant.baseCurrency)}</p>
        <p><strong>Total ${formatMoney(document.totalMinor, tenant.baseCurrency)}</strong></p>
      </div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function printCustomerStatement(input: {
  tenant: FinanceTenant;
  party: FinanceParty | null;
  rows: Array<{ number: string; date: string; dueDate?: string | null; kind: string; totalMinor: number; outstanding: number; status: string }>;
  outstanding: number;
  companyLogo?: string;
  partyLogo?: string;
}) {
  const { tenant, party, rows, outstanding, companyLogo, partyLogo } = input;
  const win = window.open('', '_blank', 'noopener,width=900,height=1100');
  if (!win) throw new Error('Allow pop-ups to print this statement');
  const body = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.number)}</td>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.dueDate || '—')}</td>
      <td>${escapeHtml(row.kind.replace('_', ' '))}</td>
      <td class="num">${formatMoney(row.totalMinor, tenant.baseCurrency)}</td>
      <td class="num">${formatMoney(row.outstanding, tenant.baseCurrency)}</td>
    </tr>
  `).join('');
  win.document.write(`<!doctype html><html><head><title>Statement ${escapeHtml(party?.name || '')}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #0B1F3A; padding: 32px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      img.logo { max-height: 64px; max-width: 140px; object-fit: contain; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #E5E7EB; text-align: left; padding: 8px 6px; font-size: 13px; }
      .num { text-align: right; }
      .muted { color: #6B7280; font-size: 12px; }
    </style>
  </head><body>
    <div class="top">
      <div>
        ${companyLogo ? `<img class="logo" src="${companyLogo}" alt="Company" />` : ''}
        <h1>${escapeHtml(tenant.name)}</h1>
        <p class="muted">Byjan · Trace Financials Easily</p>
      </div>
      <div style="text-align:right">
        ${partyLogo ? `<img class="logo" src="${partyLogo}" alt="Customer" />` : ''}
        <p><strong>${escapeHtml(party?.name || '')}</strong></p>
        <p class="muted">${escapeHtml(party?.taxId || '')}</p>
        <p class="muted">${escapeHtml([party?.address, party?.city].filter(Boolean).join(', '))}</p>
      </div>
    </div>
    <p style="margin-top:28px"><strong>Customer statement</strong></p>
    <table>
      <thead><tr><th>Number</th><th>Date</th><th>Due</th><th>Type</th><th class="num">Total</th><th class="num">Outstanding</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p style="margin-top:24px"><strong>Balance due ${formatMoney(outstanding, tenant.baseCurrency)}</strong></p>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}
