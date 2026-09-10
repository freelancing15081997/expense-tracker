import { formatMoney, lineAmount } from '../core/money';
import { formatDisplayDate, getRuntimePrefs } from '../../lib/app-prefs';
import type { FinanceDocument, FinanceParty, FinanceTenant } from '../core/types';

function nl(value?: string | null) {
  return escapeHtml(value || '').replace(/\n/g, '<br/>');
}

function byjanMark() {
  return `<img class="byjan-mark" src="${escapeHtml(`${window.location.origin}/logo.png`)}" alt="Byjan" />`;
}

function companyBlock(tenant: FinanceTenant) {
  const prefs = getRuntimePrefs();
  return [
    nl(tenant.address),
    escapeHtml([tenant.city, tenant.state, tenant.pincode].filter(Boolean).join(', ')),
    prefs.printShowGstin && tenant.gstin ? escapeHtml(`GSTIN ${tenant.gstin}`) : '',
    escapeHtml([tenant.phone, tenant.email].filter(Boolean).join(' · ')),
  ].filter(Boolean).join('<br/>');
}

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
  const billTo = document.billTo || [party?.name, party?.address, [party?.city, party?.state, party?.pincode].filter(Boolean).join(', '), party?.taxId ? `GSTIN ${party.taxId}` : ''].filter(Boolean).join('\n');
  const shipTo = document.shipTo || '';
  const lines = document.lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.description)}</td>
      <td class="num">${(line.qtyMilli / 1000).toFixed(3)}</td>
      <td class="num">${formatMoney(line.unitPriceMinor, tenant.baseCurrency)}</td>
      <td class="num">${escapeHtml(line.taxCode)}</td>
      <td class="num">${formatMoney(lineAmount(line.qtyMilli, line.unitPriceMinor), tenant.baseCurrency)}</td>
    </tr>
  `).join('');
  const taxRows = document.tax.igstMinor > 0
    ? `<p>IGST ${formatMoney(document.tax.igstMinor, tenant.baseCurrency)}</p>`
    : `<p>CGST ${formatMoney(document.tax.cgstMinor, tenant.baseCurrency)}</p><p>SGST ${formatMoney(document.tax.sgstMinor, tenant.baseCurrency)}</p>`;
  win.document.write(`<!doctype html><html><head><title>${document.number}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #0B1F3A; padding: 32px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      img.logo { max-height: 64px; max-width: 140px; object-fit: contain; }
      img.byjan-mark { width: 28px; height: 28px; object-fit: cover; object-position: 50% 10%; border-radius: 6px; border: 1px solid #E5E7EB; background: #fff; }
      h1 { margin: 8px 0 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #E5E7EB; text-align: left; padding: 8px 6px; font-size: 13px; }
      .num { text-align: right; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
      .box { border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px 14px; min-height: 88px; }
      .foot { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; }
      .muted { color: #6B7280; font-size: 12px; }
      .label { color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; margin: 0 0 6px; }
    </style>
  </head><body>
    <div class="top">
      <div>
        ${byjanMark()}
        ${getRuntimePrefs().printShowLogo && companyLogo ? `<img class="logo" src="${companyLogo}" alt="Company" />` : ''}
        <h1>${escapeHtml(tenant.name)}</h1>
        <p class="muted">Byjan · Trace Financials Easily</p>
        <p class="muted">${companyBlock(tenant)}</p>
      </div>
      <div style="text-align:right">
        ${partyLogo ? `<img class="logo" src="${partyLogo}" alt="Party" />` : ''}
        <p><strong>${escapeHtml(document.kind.replace('_', ' '))}</strong></p>
        <p>${escapeHtml(document.number)}</p>
        <p class="muted">Date ${escapeHtml(formatDisplayDate(document.date))}${document.dueDate ? ` · Due ${escapeHtml(formatDisplayDate(document.dueDate))}` : ''}</p>
        ${document.poNumber ? `<p class="muted">Ref ${escapeHtml(document.poNumber)}</p>` : ''}
        ${document.placeOfSupply ? `<p class="muted">Place of supply ${escapeHtml(document.placeOfSupply)}</p>` : ''}
      </div>
    </div>
    <div class="grid">
      <div class="box"><p class="label">Bill to</p><p>${nl(billTo)}</p></div>
      <div class="box"><p class="label">Ship to</p><p>${nl(shipTo) || '—'}</p></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="foot">
      <div class="muted" style="max-width:55%">
        ${document.customerNotes ? `<p><strong>Notes</strong><br/>${nl(document.customerNotes)}</p>` : ''}
        ${document.terms ? `<p style="margin-top:12px"><strong>Terms</strong><br/>${nl(document.terms)}</p>` : ''}
        <p style="margin-top:12px">${escapeHtml(document.memo || '')}</p>
        ${tenant.invoiceFooter ? `<p style="margin-top:12px">${nl(tenant.invoiceFooter)}</p>` : ''}
      </div>
      <div>
        <p>Taxable ${formatMoney(document.tax.exclusiveMinor, tenant.baseCurrency)}</p>
        ${taxRows}
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
      img.byjan-mark { width: 28px; height: 28px; object-fit: cover; object-position: 50% 10%; border-radius: 6px; border: 1px solid #E5E7EB; background: #fff; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #E5E7EB; text-align: left; padding: 8px 6px; font-size: 13px; }
      .num { text-align: right; }
      .muted { color: #6B7280; font-size: 12px; }
    </style>
  </head><body>
    <div class="top">
      <div>
        ${byjanMark()}
        ${getRuntimePrefs().printShowLogo && companyLogo ? `<img class="logo" src="${companyLogo}" alt="Company" />` : ''}
        <h1>${escapeHtml(tenant.name)}</h1>
        <p class="muted">Byjan · Trace Financials Easily</p>
        <p class="muted">${companyBlock(tenant)}</p>
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
