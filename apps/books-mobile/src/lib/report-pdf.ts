import type { Book, Expense } from './books';

/** Format paise as "Rs 1,234.50" — the built-in PDF fonts have no ₹ glyph. */
const rs = (paise: number) => `Rs ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type ReportPdf = { base64: string; filename: string; subject: string; message: string };

/**
 * Build the "Email PDF report" attachment for a book on the device, in the shape
 * /api/email/send-report expects (subject + message + base64 PDF).
 */
export async function buildBookReportPdf(book: Book | null, rows: Expense[], period: string): Promise<ReportPdf> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const name = book?.name || 'Book';
  const label = period || 'All time';

  let inP = 0;
  let outP = 0;
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    const p = Math.round(Number(r.amount || 0) * 100);
    if (r.entryType === 'in') inP += p;
    else if (r.entryType !== 'transfer') {
      outP += p;
      const c = String(r.category || 'Uncategorized');
      byCategory.set(c, (byCategory.get(c) || 0) + p);
    }
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const navy: [number, number, number] = [11, 31, 58];
  const teal: [number, number, number] = [18, 184, 168];
  doc.setFillColor(...navy);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, 'F');
  doc.setFillColor(...teal);
  doc.rect(0, 72, doc.internal.pageSize.getWidth(), 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(name, 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Byjan report · ${label}`, 40, 60);

  doc.setTextColor(15, 23, 41);
  doc.setFontSize(11);
  doc.text(`Money in: ${rs(inP)}`, 40, 104);
  doc.text(`Money out: ${rs(outP)}`, 220, 104);
  doc.text(`Net: ${rs(inP - outP)}`, 400, 104);
  doc.text(`Entries: ${rows.length}`, 40, 122);

  autoTable(doc, {
    startY: 140,
    head: [['Date', 'Type', 'Paid to / For', 'Category', 'Method', 'Amount']],
    body: rows.map((r) => [
      r.date || '',
      r.entryType === 'in' ? 'In' : r.entryType === 'transfer' ? 'Transfer' : 'Out',
      [r.merchant, r.description].filter(Boolean).join(' · '),
      r.category || '',
      r.paymentMethod || '',
      rs(Math.round(Number(r.amount || 0) * 100)),
    ]),
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: navy, textColor: 255 },
    columnStyles: { 5: { halign: 'right' } },
  });

  if (byCategory.size) {
    const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
    autoTable(doc, {
      startY: after + 20,
      head: [['Category', 'Spent']],
      body: [...byCategory].sort((a, b) => b[1] - a[1]).map(([c, p]) => [c, rs(p)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: teal, textColor: 255 },
      columnStyles: { 1: { halign: 'right' } },
    });
  }

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const filename = `${name.replace(/\W+/g, '-')}-${period || 'all'}.pdf`;
  const subject = `${name} — Byjan report (${label})`;
  const message = `Your Byjan report for ${name} (${label}) is attached.\n\nMoney in: ${rs(inP)}\nMoney out: ${rs(outP)}\nNet: ${rs(inP - outP)}\nEntries: ${rows.length}`;
  return { base64, filename, subject, message };
}
