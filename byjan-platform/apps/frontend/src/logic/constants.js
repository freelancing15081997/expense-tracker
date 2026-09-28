// Seed data, lookup tables and pure helpers for Byjan Business.
// Everything here is sample data — swap each collection for its API hook (see README · API map).

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fd = (o, y) => { const d = new Date(2026, 8, 24 + o); return d.getDate() + ' ' + MON[d.getMonth()] + (y ? ' ' + d.getFullYear() : ''); };
const inr = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const inr2 = n => (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const inrS = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e7 ? s + '₹' + (a / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? s + '₹' + (a / 1e5).toFixed(2) + ' L' : s + '₹' + Math.round(a).toLocaleString('en-IN'); };
const ICO = 'https://unpkg.com/lucide-static@0.460.0/icons/';
const CO = {n: 'Sharma Traders Pvt Ltd', g: '27AAKCS8841D1Z6', st: 'Maharashtra', addr: 'Plot 14, MIDC, Andheri East, Mumbai 400093', e: 'accounts@sharmatraders.in', bank: 'HDFC Bank · A/c 5020 0041 8812 · IFSC HDFC0000240', upi: 'sharmatraders@hdfcbank'};
const NAV = [
  {id: 'dashboard', n: 'Home', ic: 'layout-dashboard', blurb: 'See balances, work waiting, and what needs attention.', items: [['Home', 'home'], ['Analytics', 'analytics'], ['Money overview', 'cfo'], ['Watch list', 'control-tower']]},
  {id: 'accounting', n: 'Accounts', ic: 'book-open', blurb: 'Your account list, typed entries, and month close.', items: [['Account list', 'chart-of-accounts'], ['Manual entries', 'journals'], ['Repeat entries', 'recurring'], ['Account history', 'ledger'], ['Months', 'periods'], ['Close the month', 'close']]},
  {id: 'sales', n: 'Sales', ic: 'receipt-indian-rupee', blurb: 'Customers, quotes, invoices, and unpaid bills they owe you.', items: [['Customers', 'customers'], ['Estimates', 'estimates'], ['Quotes', 'quotes'], ['Orders', 'sales-orders'], ['Invoices', 'invoices'], ['Refund notes', 'credit-notes'], ['Extra charges', 'debit-notes'], ['Customer statements', 'statements'], ['Unpaid invoices', 'collections']]},
  {id: 'purchases', n: 'Buying', ic: 'shopping-cart', blurb: 'Suppliers, buy orders, bills, and paying what you owe.', items: [['Suppliers', 'vendors'], ['Buy requests', 'purchase-requests'], ['Buy orders', 'purchase-orders'], ['Goods received', 'purchase-receipts'], ['Supplier bills', 'bills'], ['Supplier refunds', 'vendor-credits'], ['Pay bills', 'payment-run']]},
  {id: 'banking', n: 'Bank', ic: 'landmark', blurb: 'Bank moves and business spends. Daily money books stay under Money.', items: [['Bank', 'banking'], ['Business spends', 'expenses']]},
  {id: 'operations', n: 'Operations', ic: 'boxes', blurb: 'Stock, equipment, projects, budgets, and rentals.', items: [['Stock', 'inventory'], ['Equipment', 'assets'], ['Projects', 'projects'], ['Budgets', 'budgets'], ['Cash plan', 'forecast'], ['Income deals', 'revenue'], ['Rentals', 'leases']]},
  {id: 'control', n: 'Reports & tax', ic: 'chart-column', blurb: 'Tax, reports, accountant tools, inbox, and settings.', items: [['Tax', 'tax'], ['Reports', 'reports'], ['GST entities', 'entities'], ['Companies', 'companies'], ['Accountant', 'workbench'], ['Inbox', 'inbox'], ['Approvals', 'approvals'], ['Insights', 'insights'], ['Change log', 'audit'], ['Settings', 'settings']]},
  {id: 'admin', n: 'Admin', ic: 'shield-check', blurb: 'People, roles, permissions and the super user console.', items: [['Organisation', 'org'], ['Users', 'users'], ['Roles & permissions', 'roles'], ['Super user console', 'console']]}];
const MOD = {}; NAV.forEach(b => b.items.forEach(([n, k]) => { MOD[k] = {n, b}; }));
const PARTIES = [
  {id: 'c1', k: 'c', n: 'Mehta Builders', g: '27AABCM4521K1Z3', city: 'Mumbai', st: 'Maharashtra', e: 'accounts@mehtabuilders.in', ph: '+91 98200 41122', terms: 30},
  {id: 'c2', k: 'c', n: 'Kapoor Interiors', g: '07AAFCK2210L1Z9', city: 'New Delhi', st: 'Delhi', e: 'finance@kapoorinteriors.com', ph: '+91 98110 22871', terms: 15},
  {id: 'c3', k: 'c', n: 'Sunrise Hotels Pvt Ltd', g: '27AAECS9912M1Z1', city: 'Pune', st: 'Maharashtra', e: 'ap@sunrisehotels.in', ph: '+91 98230 11456', terms: 45},
  {id: 'c4', k: 'c', n: 'Orbit Retail LLP', g: '29AAHFO3321P1Z5', city: 'Bengaluru', st: 'Karnataka', e: 'bills@orbitretail.in', ph: '+91 99005 77210', terms: 30},
  {id: 'c5', k: 'c', n: 'Greenfield Schools Trust', g: '27AAATG1180Q1Z2', city: 'Nashik', st: 'Maharashtra', e: 'office@greenfield.edu.in', ph: '+91 97654 30912', terms: 30},
  {id: 'c6', k: 'c', n: 'Nair Logistics', g: '32AAGFN7781R1Z8', city: 'Kochi', st: 'Kerala', e: 'accounts@nairlogistics.com', ph: '+91 94470 55120', terms: 15},
  {id: 'v1', k: 'v', n: 'Shree Cement Ltd', g: '08AAACS1234F1Z6', city: 'Jaipur', st: 'Rajasthan', e: 'dispatch@shreecement.com', ph: '+91 141 222 1100', terms: 30},
  {id: 'v2', k: 'v', n: 'Raju Transport Co', g: '27AAKFR5520H1Z4', city: 'Thane', st: 'Maharashtra', e: 'raju.transport@gmail.com', ph: '+91 98921 44310', terms: 15},
  {id: 'v3', k: 'v', n: 'Ultratech Steel Traders', g: '27AAECU8812J1Z7', city: 'Mumbai', st: 'Maharashtra', e: 'sales@utsteel.in', ph: '+91 98200 99812', terms: 30},
  {id: 'v4', k: 'v', n: 'Kumar Hardware', g: '27AAIPK4410K1Z2', city: 'Navi Mumbai', st: 'Maharashtra', e: 'kumarhw@gmail.com', ph: '+91 99300 12877', terms: 7},
  {id: 'v5', k: 'v', n: 'Tata Power', g: '27AAACT0054A1Z9', city: 'Mumbai', st: 'Maharashtra', e: 'business@tatapower.com', ph: '1800 209 8282', terms: 15},
  {id: 'v6', k: 'v', n: 'OfficeMart Supplies', g: '27AAFCO6621B1Z3', city: 'Mumbai', st: 'Maharashtra', e: 'orders@officemart.in', ph: '+91 22 4012 7788', terms: 30}];
const PBY = {}; PARTIES.forEach(p => { PBY[p.id] = p; });
const ITEMS = [
  {id: 'i1', n: 'Cement OPC 53 grade', u: 'bag', r: 390, hsn: '2523', g: 28, qx: 400},
  {id: 'i2', n: 'TMT steel bar 12 mm', u: 'kg', r: 68, hsn: '7214', g: 18, qx: 2400},
  {id: 'i3', n: 'Vitrified tiles 2×2 ft', u: 'box', r: 1150, hsn: '6907', g: 18, qx: 120},
  {id: 'i4', n: 'Site supervision', u: 'day', r: 3500, hsn: '9954', g: 18, qx: 26},
  {id: 'i5', n: 'Interior design fee', u: 'hour', r: 2500, hsn: '9983', g: 18, qx: 60},
  {id: 'i6', n: 'Transport · full truck', u: 'trip', r: 8500, hsn: '9965', g: 12, qx: 8},
  {id: 'i7', n: 'Asian Paints Apex 20 L', u: 'bucket', r: 6400, hsn: '3209', g: 18, qx: 30}];
const IBY = {}; ITEMS.forEach(i => { IBY[i.id] = i; });
const ACCS = ['Cash in hand', 'HDFC Current A/c', 'ICICI OD A/c', 'Sundry debtors', 'Sundry creditors', 'Sales · goods', 'Service income', 'Purchases', 'Salaries', 'Rent', 'Power & fuel', 'Depreciation', 'GST payable', 'GST input credit', 'TDS payable', 'Loan from director', 'Prepaid expenses', 'Bank charges', 'Accumulated depreciation'];
const JPAIRS = [['Depreciation', 'Accumulated depreciation'], ['Salaries', 'Sundry creditors'], ['HDFC Current A/c', 'Loan from director'], ['GST payable', 'GST input credit'], ['Prepaid expenses', 'HDFC Current A/c'], ['Bank charges', 'HDFC Current A/c']];
const JNAR = ['Depreciation for August', 'Salary accrual · September', 'Director loan received', 'GST set-off · August', 'Prepaid insurance adjustment', 'Bank charges · September'];
const RNAME = ['Office rent · Andheri', 'Internet · Jio Business', 'Accountant retainer', 'Security services', 'Software subscriptions'];
const DOC_T = {
  invoices: {n: 'Invoice', pre: 'INV-', party: 'c', sts: ['Draft', 'Sent', 'Overdue', 'Partly paid', 'Paid', 'Void'], post: 'Approve & send', ic: 'file-text'},
  estimates: {n: 'Estimate', pre: 'EST-', party: 'c', sts: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'], post: 'Send estimate', ic: 'file-pen-line'},
  quotes: {n: 'Quote', pre: 'QT-', party: 'c', sts: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'], post: 'Send quote', ic: 'file-spreadsheet'},
  'sales-orders': {n: 'Order', pre: 'SO-', party: 'c', sts: ['Draft', 'Confirmed', 'Invoiced'], post: 'Confirm order', ic: 'clipboard-list'},
  'credit-notes': {n: 'Refund note', pre: 'CN-', party: 'c', sts: ['Draft', 'Open', 'Applied', 'Void'], post: 'Post refund note', ic: 'file-minus'},
  'debit-notes': {n: 'Extra charge', pre: 'DN-', party: 'c', sts: ['Draft', 'Open', 'Applied', 'Void'], post: 'Post extra charge', ic: 'file-plus'},
  'purchase-requests': {n: 'Buy request', pre: 'PR-', party: 'v', sts: ['Draft', 'Pending approval', 'Approved', 'Rejected', 'Ordered'], post: 'Submit for approval', ic: 'hand'},
  'purchase-orders': {n: 'Buy order', pre: 'PO-', party: 'v', sts: ['Draft', 'Sent', 'Partly received', 'Received', 'Billed'], post: 'Send to supplier', ic: 'package'},
  'purchase-receipts': {n: 'Goods received note', pre: 'GRN-', party: 'v', sts: ['Draft', 'Posted'], post: 'Post receipt', ic: 'package-check'},
  bills: {n: 'Supplier bill', pre: 'BILL-', party: 'v', sts: ['Draft', 'Open', 'Overdue', 'Partly paid', 'Paid', 'Void'], post: 'Post bill', ic: 'receipt'},
  'vendor-credits': {n: 'Supplier refund', pre: 'VC-', party: 'v', sts: ['Open', 'Applied', 'Void'], post: 'Post supplier refund', ic: 'undo-2'},
  journals: {n: 'Manual entry', pre: 'JV-', party: null, sts: ['Draft', 'Posted', 'Reversed'], post: 'Post entry', ic: 'book-open-check'},
  recurring: {n: 'Repeat entry', pre: 'RJ-', party: 'v', sts: ['Active', 'Paused'], post: 'Activate', ic: 'repeat'},
  expenses: {n: 'Business spend', pre: 'EXP-', party: 'v', sts: ['Draft', 'Posted', 'Reimbursed', 'Void'], post: 'Post spend', ic: 'wallet'}};
const DIST = {invoices: ['Paid', 'Sent', 'Overdue', 'Paid', 'Partly paid', 'Sent', 'Overdue', 'Paid', 'Draft', 'Sent', 'Overdue', 'Paid', 'Partly paid', 'Draft', 'Void'], estimates: ['Draft', 'Sent', 'Accepted', 'Sent', 'Declined', 'Expired', 'Converted'], quotes: ['Sent', 'Draft', 'Accepted', 'Sent', 'Accepted', 'Declined', 'Converted', 'Expired'], 'sales-orders': ['Confirmed', 'Draft', 'Confirmed', 'Invoiced', 'Invoiced', 'Confirmed'], 'credit-notes': ['Open', 'Applied', 'Draft', 'Applied', 'Void'], 'debit-notes': ['Open', 'Draft', 'Applied', 'Open'], 'purchase-requests': ['Pending approval', 'Draft', 'Pending approval', 'Approved', 'Ordered', 'Rejected'], 'purchase-orders': ['Sent', 'Draft', 'Partly received', 'Received', 'Billed', 'Sent', 'Billed'], 'purchase-receipts': ['Posted', 'Draft', 'Posted', 'Posted', 'Posted'], bills: ['Open', 'Overdue', 'Paid', 'Open', 'Partly paid', 'Draft', 'Overdue', 'Paid', 'Open', 'Paid', 'Open', 'Void'], 'vendor-credits': ['Open', 'Applied', 'Open', 'Void'], journals: ['Posted', 'Draft', 'Posted', 'Posted', 'Reversed', 'Posted'], recurring: ['Active', 'Active', 'Paused', 'Active', 'Active'], expenses: ['Posted', 'Draft', 'Reimbursed', 'Posted', 'Posted', 'Void', 'Posted', 'Reimbursed']};
const STC = {Draft: ['#EEF1F5', '#475467'], Sent: ['#E8F0FE', '#1D4ED8'], Open: ['#E8F0FE', '#1D4ED8'], Confirmed: ['#E8F0FE', '#1D4ED8'], 'Pending approval': ['#FFF4E0', '#B54708'], 'Partly received': ['#E8F0FE', '#1D4ED8'], Active: ['#E3F7F4', '#0B7A6F'], Overdue: ['#FDECEA', '#B42318'], Rejected: ['#FDECEA', '#B42318'], Declined: ['#FDECEA', '#B42318'], 'Partly paid': ['#FFF4E0', '#B54708'], Paid: ['#E7F8F0', '#067647'], Accepted: ['#E7F8F0', '#067647'], Approved: ['#E7F8F0', '#067647'], Received: ['#E7F8F0', '#067647'], Posted: ['#E7F8F0', '#067647'], Applied: ['#E7F8F0', '#067647'], Reimbursed: ['#E7F8F0', '#067647'], Invoiced: ['#E7F8F0', '#067647'], Billed: ['#E7F8F0', '#067647'], Converted: ['#E7F8F0', '#067647'], Ordered: ['#E7F8F0', '#067647'], Filed: ['#E7F8F0', '#067647'], Void: ['#F2F4F7', '#667085'], Expired: ['#F2F4F7', '#667085'], Paused: ['#F2F4F7', '#667085'], Reversed: ['#F2F4F7', '#667085'], Locked: ['#EEF1F5', '#0B1F3A'], Closed: ['#E7F8F0', '#067647'], High: ['#FDECEA', '#B42318'], Medium: ['#FFF4E0', '#B54708'], Low: ['#E8F0FE', '#1D4ED8'], 'Ready to file': ['#E3F7F4', '#0B7A6F'], 'Not started': ['#EEF1F5', '#475467'], 'Needs review': ['#FFF4E0', '#B54708'], 'On track': ['#E7F8F0', '#067647'], 'At risk': ['#FFF4E0', '#B54708'], 'Over budget': ['#FDECEA', '#B42318'], 'In use': ['#E7F8F0', '#067647'], Disposed: ['#F2F4F7', '#667085'], 'Low stock': ['#FFF4E0', '#B54708'], 'In stock': ['#E7F8F0', '#067647'], 'Out of stock': ['#FDECEA', '#B42318'], Answered: ['#E7F8F0', '#067647'], New: ['#E8F0FE', '#1D4ED8'], Done: ['#E7F8F0', '#067647'], Ignored: ['#F2F4F7', '#667085'], Ended: ['#F2F4F7', '#667085'], Primary: ['#E3F7F4', '#0B7A6F'], Regular: ['#EEF1F5', '#475467'], Current: ['#E3F7F4', '#0B7A6F']};
function calc(d) {
  if (d.tk === 'journals') { const dr = d.lines.reduce((a, l) => a + (+l.dr || 0), 0), cr = d.lines.reduce((a, l) => a + (+l.cr || 0), 0); return {sub: dr, disc: 0, taxable: dr, tax: 0, cg: 0, sg: 0, ig: 0, ro: 0, total: dr, dr, cr, inter: false}; }
  const p = PBY[d.party]; const inter = !!(p && p.st !== CO.st);
  const sub = d.lines.reduce((a, l) => a + (+l.q || 0) * (+l.r || 0), 0); const disc = Math.min(+d.disc || 0, sub); const f = sub ? (sub - disc) / sub : 0;
  const tax = d.lines.reduce((a, l) => a + (+l.q || 0) * (+l.r || 0) * (+l.g || 0) / 100, 0) * f; const raw = sub - disc + tax; const total = Math.round(raw);
  return {sub, disc, taxable: sub - disc, tax, cg: inter ? 0 : tax / 2, sg: inter ? 0 : tax / 2, ig: inter ? tax : 0, ro: total - raw, total, inter};
}
function genDocs() {
  let SEED = 11; const rnd = () => (SEED = (SEED * 9301 + 49297) % 233280) / 233280;
  const out = []; let id = 1;
  Object.keys(DOC_T).forEach(tk => { const T = DOC_T[tk]; const ps = PARTIES.filter(p => p.k === T.party);
    DIST[tk].forEach((st, j) => {
      const p = T.party ? ps[(j * 3 + tk.length) % ps.length] : null; const terms = p ? p.terms : 0;
      let dt = -(j * 5 + 1); if (st === 'Overdue') dt = -(terms + 6 + j * 4); if (['Sent', 'Open', 'Pending approval', 'Confirmed'].includes(st) && p && dt + terms < 0) dt = -(1 + j % 5);
      const lines = [];
      if (tk === 'journals') { const amt = (Math.round(rnd() * 40) + 5) * 1000; const pr = JPAIRS[j % JPAIRS.length]; lines.push({acc: pr[0], dr: amt, cr: 0}, {acc: pr[1], dr: 0, cr: amt}); }
      else { const n = tk === 'expenses' || tk === 'recurring' ? 1 : 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) { const it = ITEMS[(j + k * 2 + tk.length) % ITEMS.length]; lines.push({item: it.id, q: Math.max(1, Math.round(rnd() * it.qx / (tk === 'expenses' ? 8 : 1))), r: it.r, g: it.g}); } }
      const d = {id: 'd' + (id++), tk, no: T.pre + String(1041 + j), party: p ? p.id : null, dt, terms, due: dt + terms, st, lines, disc: 0, notes: '', nar: tk === 'journals' ? JNAR[j % JNAR.length] : tk === 'recurring' ? RNAME[j % RNAME.length] : '', paid: 0, act: []};
      const tot = calc(d).total;
      d.paid = st === 'Paid' || st === 'Reimbursed' ? tot : st === 'Partly paid' ? Math.round(tot * 0.4 / 100) * 100 : 0;
      d.act = [{t: 'Created by ' + (j % 3 ? 'Priya Sharma' : 'Arjun Kumar'), w: fd(dt, 1), ic: 'file-plus-2'}];
      if (st !== 'Draft') d.act.push({t: p && T.party === 'c' && st !== 'Void' ? 'Emailed to ' + p.e : 'Posted to books', w: fd(dt, 1), ic: 'send'});
      if (d.paid) d.act.push({t: 'Payment ' + (T.party === 'c' ? 'received' : 'made') + ' · ' + inr(d.paid) + ' via NEFT', w: fd(Math.min(0, dt + 6), 1), ic: 'indian-rupee'});
      if (st === 'Void') d.act.push({t: 'Voided · raised by mistake', w: fd(dt + 1, 1), ic: 'ban'});
      out.push(d); }); });
  return out;
}
const LOG0 = [
  {w: 'Today, 11:20 AM', who: 'Priya Sharma', t: 'Approved buy request PR-1044 · Ultratech Steel', m: 'Buying', ic: 'check-circle-2'},
  {w: 'Today, 10:42 AM', who: 'Byjan', t: 'Read a bill from dispatch@shreecement.com into Inbox', m: 'Inbox', ic: 'inbox'},
  {w: 'Today, 9:05 AM', who: 'Arjun Kumar', t: 'Sent INV-1050 to Orbit Retail LLP', m: 'Sales', ic: 'send'},
  {w: 'Yesterday, 6:30 PM', who: 'CA Ramesh Iyer', t: 'Locked June 2026 after review', m: 'Accounts', ic: 'lock'},
  {w: 'Yesterday, 4:12 PM', who: 'Neha Rao', t: 'Received goods on PO-1043 · 12 of 20 bags short', m: 'Buying', ic: 'package-check'},
  {w: 'Yesterday, 1:00 PM', who: 'Byjan', t: 'Matched 14 bank lines automatically', m: 'Bank', ic: 'link'},
  {w: '22 Sep, 3:40 PM', who: 'Priya Sharma', t: 'Posted JV-1043 · GST set-off August', m: 'Accounts', ic: 'book-open-check'},
  {w: '22 Sep, 11:15 AM', who: 'Arjun Kumar', t: 'Changed payment terms for Sunrise Hotels to Net 45', m: 'Sales', ic: 'pencil'},
  {w: '21 Sep, 5:55 PM', who: 'Rahul Verma', t: 'Exported GSTR-1 working for August', m: 'Tax', ic: 'file-down'},
  {w: '20 Sep, 10:00 AM', who: 'Arjun Kumar', t: 'Filed GSTR-3B August · ARN AA2708260412345', m: 'Tax', ic: 'badge-check'}];
const FEED0 = [
  {id: 'f1', d: -1, desc: 'NEFT CR · MEHTA BUILDERS · UTR 88213', amt: 350000, sk: 'inv', sug: 'Invoice from Mehta Builders', conf: 97},
  {id: 'f2', d: -1, desc: 'UPI DR · HP PETROL PUMP ANDHERI', amt: -4200, sk: 'exp', sug: 'Fuel · Business spend', conf: 84},
  {id: 'f3', d: -2, desc: 'IMPS DR · RAJU TRANSPORT CO', amt: -32000, sk: 'bill', sug: 'Bill from Raju Transport Co', conf: 91},
  {id: 'f4', d: -2, desc: 'NACH DR · TATA POWER CO LTD', amt: -21840, sk: 'bill', sug: 'Bill from Tata Power', conf: 99},
  {id: 'f5', d: -3, desc: 'CHQ DEP 004411 · SUNRISE HOTELS', amt: 185000, sk: 'inv', sug: 'Invoice from Sunrise Hotels', conf: 88},
  {id: 'f6', d: -4, desc: 'CHARGES · SMS ALERT + NEFT FEE', amt: -590, sk: 'exp', sug: 'Bank charges', conf: 95},
  {id: 'f7', d: -5, desc: 'RTGS CR · ORBIT RETAIL LLP · 7710', amt: 240000, sk: 'none', sug: '', conf: 0}];
const PER0 = [{m: 'April 2026', st: 'Locked', by: 'CA Ramesh Iyer', on: '8 May'}, {m: 'May 2026', st: 'Locked', by: 'CA Ramesh Iyer', on: '7 Jun'}, {m: 'June 2026', st: 'Locked', by: 'CA Ramesh Iyer', on: '23 Sep'}, {m: 'July 2026', st: 'Closed', by: 'Arjun Kumar', on: '6 Aug'}, {m: 'August 2026', st: 'Closed', by: 'Arjun Kumar', on: '5 Sep'}, {m: 'September 2026', st: 'Open', by: '', on: ''}];
const CHK0 = [
  {id: 'k1', t: 'Match all bank lines', m: 'Bank', own: 'Priya Sharma', done: false, go: 'banking'},
  {id: 'k2', t: 'Post every supplier bill received', m: 'Supplier bills', own: 'Neha Rao', done: true, go: 'bills'},
  {id: 'k3', t: 'Record depreciation for September', m: 'Equipment', own: 'Arjun Kumar', done: false, go: 'assets'},
  {id: 'k4', t: 'Accrue September salaries', m: 'Manual entries', own: 'Priya Sharma', done: true, go: 'journals'},
  {id: 'k5', t: 'Review unpaid invoices over 60 days', m: 'Unpaid invoices', own: 'Arjun Kumar', done: true, go: 'collections'},
  {id: 'k6', t: 'Reconcile GSTR-2B with supplier bills', m: 'Tax', own: 'CA Ramesh Iyer', done: false, go: 'tax'},
  {id: 'k7', t: 'Stock count adjustment', m: 'Stock', own: 'Neha Rao', done: true, go: 'inventory'},
  {id: 'k8', t: 'Review with your accountant', m: 'Accountant', own: 'CA Ramesh Iyer', done: false, go: 'workbench'}];
const STOCK0 = [
  {id: 's1', sku: 'CEM-OPC53', n: 'Cement OPC 53 grade', u: 'bag', oh: 420, ro: 300, cost: 360, loc: 'Bhiwandi godown'},
  {id: 's2', sku: 'TMT-12', n: 'TMT steel bar 12 mm', u: 'kg', oh: 1850, ro: 2500, cost: 61, loc: 'Bhiwandi godown'},
  {id: 's3', sku: 'TIL-VT22', n: 'Vitrified tiles 2×2 ft', u: 'box', oh: 96, ro: 60, cost: 980, loc: 'Andheri store'},
  {id: 's4', sku: 'PNT-APX20', n: 'Asian Paints Apex 20 L', u: 'bucket', oh: 0, ro: 10, cost: 5600, loc: 'Andheri store'},
  {id: 's5', sku: 'PLY-18', n: 'Marine plywood 18 mm', u: 'sheet', oh: 140, ro: 80, cost: 2350, loc: 'Bhiwandi godown'},
  {id: 's6', sku: 'SAN-M', n: 'River sand', u: 'brass', oh: 12, ro: 15, cost: 6200, loc: 'Site yard · Thane'}];
const ASSETS0 = [
  {id: 'a1', n: 'Tata Ace delivery van', cat: 'Vehicles', dt: 'Apr 2024', cost: 780000, rate: 15, acc: 175500, st: 'In use'},
  {id: 'a2', n: 'Forklift · Godrej 2.5 T', cat: 'Machinery', dt: 'Aug 2023', cost: 1240000, rate: 15, acc: 372000, st: 'In use'},
  {id: 'a3', n: 'Office furniture · Andheri', cat: 'Furniture', dt: 'Jun 2022', cost: 420000, rate: 10, acc: 168000, st: 'In use'},
  {id: 'a4', n: 'Dell laptops × 6', cat: 'Computers', dt: 'Jan 2025', cost: 468000, rate: 40, acc: 234000, st: 'In use'},
  {id: 'a5', n: 'Old Mahindra pickup', cat: 'Vehicles', dt: 'Mar 2018', cost: 540000, rate: 15, acc: 510000, st: 'Disposed'}];
const PROJ0 = [
  {id: 'p1', n: 'Mehta Heights · Tower B', c: 'c1', bud: 4800000, sp: 3120000, inv: 3600000, due: 'Dec 2026'},
  {id: 'p2', n: 'Sunrise Hotels · Pune lobby', c: 'c3', bud: 1850000, sp: 1720000, inv: 1400000, due: 'Oct 2026'},
  {id: 'p3', n: 'Greenfield campus · Block C', c: 'c5', bud: 3200000, sp: 3460000, inv: 2900000, due: 'Nov 2026'},
  {id: 'p4', n: 'Orbit Retail · 4 stores fit-out', c: 'c4', bud: 2600000, sp: 640000, inv: 780000, due: 'Feb 2027'}];
const BUD0 = [{a: 'Salaries', b: 1950000, act: 1860000}, {a: 'Rent', b: 720000, act: 720000}, {a: 'Power & fuel', b: 180000, act: 214000}, {a: 'Transport', b: 420000, act: 486000}, {a: 'Professional fees', b: 240000, act: 180000}, {a: 'Office expenses', b: 150000, act: 112000}, {a: 'Marketing', b: 300000, act: 96000}];
const DEALS0 = [{id: 'r1', c: 'c3', n: 'Annual maintenance · Sunrise Hotels', v: 1200000, rec: 600000, m: 12, start: 'Apr 2026'}, {id: 'r2', c: 'c1', n: 'Design retainer · Mehta Builders', v: 900000, rec: 450000, m: 12, start: 'Apr 2026'}, {id: 'r3', c: 'c4', n: 'Store upkeep · Orbit Retail', v: 480000, rec: 80000, m: 12, start: 'Aug 2026'}];
const LEASE0 = [{id: 'l1', n: 'Andheri office', ll: 'Kohinoor Estates', rent: 120000, next: '1 Oct', end: 'Mar 2029', dep: 360000, st: 'Active'}, {id: 'l2', n: 'Bhiwandi godown', ll: 'Patil Warehousing', rent: 85000, next: '5 Oct', end: 'Dec 2027', dep: 255000, st: 'Active'}, {id: 'l3', n: 'Forklift rental · backup', ll: 'Speedlift Rentals', rent: 18000, next: '10 Oct', end: 'Nov 2026', dep: 0, st: 'Active'}];
const RET0 = [{id: 't1', n: 'GSTR-1', p: 'September 2026', due: '11 Oct', st: 'Ready to file', sum: '48 invoices · ₹38.4 L taxable'}, {id: 't2', n: 'GSTR-3B', p: 'September 2026', due: '20 Oct', st: 'Needs review', sum: 'Net payable ₹4.86 L'}, {id: 't3', n: 'GSTR-2B match', p: 'September 2026', due: 'Before 3B', st: 'Needs review', sum: '3 mismatches · ₹21,435 ITC'}, {id: 't4', n: 'TDS return · 26Q', p: 'Q2 FY 2026-27', due: '31 Oct', st: 'Not started', sum: '14 deductions · ₹62,400'}, {id: 't5', n: 'GSTR-3B', p: 'August 2026', due: '20 Sep', st: 'Filed', sum: 'ARN AA2708260412345'}, {id: 't6', n: 'GSTR-1', p: 'August 2026', due: '11 Sep', st: 'Filed', sum: 'ARN AA2708260398812'}];
const MIS0 = [{id: 'm1', v: 'Kumar Hardware', t: 'Bill of ₹1,24,000 is in your books but not in GSTR-2B', itc: 18915}, {id: 'm2', v: 'Raju Transport Co', t: 'GSTR-2B shows ₹32,000, your books show ₹30,000', itc: 240}, {id: 'm3', v: 'OfficeMart Supplies', t: 'Invoice OM/4471 is in GSTR-2B but not in your books', itc: 2280}];
const ENT0 = [{id: 'e1', g: '27AAKCS8841D1Z6', st: 'Maharashtra', n: 'Head office · Mumbai', pri: true, reg: 'Regular'}, {id: 'e2', g: '29AAKCS8841D1Z2', st: 'Karnataka', n: 'Branch · Bengaluru', pri: false, reg: 'Regular'}];
const CO0 = [{id: 'co1', n: 'Sharma Traders Pvt Ltd', g: '27AAKCS8841D1Z6', fy: 'FY 2026-27', role: 'Owner', cur: true, ppl: 6}, {id: 'co2', n: 'Sharma Infra LLP', g: '27AAQFS2231E1Z8', fy: 'FY 2026-27', role: 'Owner', cur: false, ppl: 3}, {id: 'co3', n: 'Kavya Designs', g: '27AABFK0912C1Z4', fy: 'FY 2026-27', role: 'Accountant', cur: false, ppl: 2}];
const Q0 = [{id: 'q1', q: 'Please share the bill for ₹1,24,000 paid to Kumar Hardware on 12 Sep. It is missing in GSTR-2B.', by: 'CA Ramesh Iyer', w: '2 days ago', st: 'Open', m: 'Supplier bills'}, {id: 'q2', q: 'Is the ₹5,00,000 from Anil Sharma a loan or new share capital?', by: 'CA Ramesh Iyer', w: '3 days ago', st: 'Open', m: 'Manual entries'}, {id: 'q3', q: 'Confirm the forklift was bought for business use only.', by: 'CA Ramesh Iyer', w: 'Last week', st: 'Answered', m: 'Equipment'}];
const INBOX0 = [{id: 'b1', from: 'dispatch@shreecement.com', subj: 'Tax invoice SC/26-27/4471', v: 'v1', amt: 248600, conf: 98, w: '10:42 AM', kind: 'Bill', st: 'New'}, {id: 'b2', from: 'WhatsApp · Raju Transport', subj: 'Photo of lorry receipt 88120', v: 'v2', amt: 32000, conf: 86, w: 'Yesterday', kind: 'Bill', st: 'New'}, {id: 'b3', from: 'noreply@tatapower.com', subj: 'Electricity bill · September 2026', v: 'v5', amt: 21840, conf: 99, w: 'Yesterday', kind: 'Bill', st: 'New'}, {id: 'b4', from: 'Upload · Arjun Kumar', subj: 'Fuel receipt · HP Andheri', v: null, amt: 4200, conf: 72, w: '22 Sep', kind: 'Spend', st: 'New'}, {id: 'b5', from: 'accounts@mehtabuilders.in', subj: 'Payment advice · NEFT 88213', v: null, amt: 350000, conf: 94, w: '21 Sep', kind: 'Payment', st: 'New'}];
const APR0 = [{id: 'x1', t: 'Buy request · 40 T TMT steel', by: 'Neha Rao', amt: 186000, k: 'Buying', w: '2 hours ago', why: 'Above ₹1,00,000 limit', src: 'purchase-requests'}, {id: 'x2', t: 'Expense claim · client visit, Pune', by: 'Rahul Verma', amt: 18450, k: 'Spend', w: 'Yesterday', why: '1 of 4 receipts missing', src: 'expenses'}, {id: 'x3', t: '12% discount on invoice for Orbit Retail', by: 'Priya Sharma', amt: 42300, k: 'Sales', w: 'Yesterday', why: 'Discount above 10%', src: 'invoices'}, {id: 'x4', t: 'Pay 5 supplier bills', by: 'Priya Sharma', amt: 612400, k: 'Payment', w: 'Today', why: 'Payments above ₹5,00,000 need owner', src: 'payment-run'}];
const ALERT0 = [{id: 'w1', sev: 'High', t: 'Cash may dip below ₹5 L in the 3rd week of October', m: 'Cash plan', go: 'forecast'}, {id: 'w2', sev: 'High', t: 'Invoices more than 30 days overdue', m: 'Unpaid invoices', go: 'collections'}, {id: 'w3', sev: 'Medium', t: 'GSTR-3B for September is due on 20 Oct', m: 'Tax', go: 'tax'}, {id: 'w4', sev: 'Medium', t: 'Bank lines waiting to be matched', m: 'Bank', go: 'banking'}, {id: 'w5', sev: 'Low', t: 'TMT steel 12 mm is below reorder level', m: 'Stock', go: 'inventory'}, {id: 'w6', sev: 'Low', t: 'Greenfield campus project is 8% over budget', m: 'Projects', go: 'projects'}];
const COA0 = [
  ['1001', 'Cash in hand', 'Assets', 'Cash & bank', 42800], ['1010', 'HDFC Current A/c', 'Assets', 'Cash & bank', 1842560], ['1020', 'ICICI Savings A/c', 'Assets', 'Cash & bank', 604000], ['1100', 'Sundry debtors', 'Assets', 'Receivables', 0], ['1200', 'Stock in trade', 'Assets', 'Inventory', 2840000], ['1300', 'GST input credit', 'Assets', 'Tax', 312000], ['1400', 'Prepaid expenses', 'Assets', 'Current', 64000], ['1500', 'Vehicles', 'Assets', 'Fixed assets', 585000], ['1510', 'Machinery', 'Assets', 'Fixed assets', 868000], ['1520', 'Furniture', 'Assets', 'Fixed assets', 252000],
  ['2001', 'Sundry creditors', 'Liabilities', 'Payables', 0], ['2100', 'GST payable', 'Liabilities', 'Tax', 486000], ['2110', 'TDS payable', 'Liabilities', 'Tax', 62400], ['2200', 'Loan from director', 'Liabilities', 'Loans', 1500000], ['2300', 'ICICI OD A/c', 'Liabilities', 'Loans', 320000],
  ['3001', 'Share capital', 'Equity', 'Capital', 1000000], ['3100', 'Reserves & surplus', 'Equity', 'Reserves', 4820000],
  ['4001', 'Sales · goods', 'Income', 'Sales', 18426000], ['4002', 'Service income', 'Income', 'Sales', 2240000], ['4100', 'Other income', 'Income', 'Other', 86000],
  ['5001', 'Purchases', 'Expenses', 'Cost of sales', 12140000], ['5100', 'Salaries', 'Expenses', 'People', 1860000], ['5110', 'Rent', 'Expenses', 'Premises', 720000], ['5120', 'Power & fuel', 'Expenses', 'Premises', 214000], ['5130', 'Transport', 'Expenses', 'Operations', 486000], ['5140', 'Professional fees', 'Expenses', 'Operations', 180000], ['5150', 'Office expenses', 'Expenses', 'Operations', 112000], ['5160', 'Depreciation', 'Expenses', 'Non-cash', 240000], ['5200', 'Bank charges', 'Expenses', 'Finance', 18600]]
  .map(([code, n, type, grp, bal], j) => ({id: 'ac' + j, code, n, type, grp, bal, arch: false}));
const SET0 = {name: 'Sharma Traders Pvt Ltd', g: '27AAKCS8841D1Z6', pan: 'AAKCS8841D', addr: 'Plot 14, MIDC, Andheri East, Mumbai 400093', e: 'accounts@sharmatraders.in', ph: '+91 22 4917 2200', fy: 'April', invPre: 'INV-', invNext: '1056', terms: 'Net 30', einv: true, ewb: true, tds: true, round: true, remind: true, remindAt: '3 days after due', tally: true, feed: true, approvals: true, lockAfter: true, dateFmt: '24 Sep 2026'};
const CF = [['Oct', 42, 36], ['Nov', 38, 34], ['Dec', 51, 40], ['Jan', 46, 39], ['Feb', 40, 37], ['Mar', 62, 48], ['Apr', 35, 31], ['May', 39, 33], ['Jun', 44, 36], ['Jul', 48, 41], ['Aug', 52, 43], ['Sep', 47, 38]];
const WK = [['1 Oct', 18.6, 14.2], ['8 Oct', 9.4, 12.8], ['15 Oct', 6.2, 11.9], ['22 Oct', 12.8, 8.4], ['29 Oct', 14.1, 9.6], ['5 Nov', 11.2, 10.4], ['12 Nov', 16.4, 9.8], ['19 Nov', 8.8, 12.2], ['26 Nov', 13.5, 10.1], ['3 Dec', 15.2, 11.4], ['10 Dec', 12.6, 9.9], ['17 Dec', 17.8, 12.6], ['24 Dec', 10.4, 13.1]];
const NIC = {home: 'house', cfo: 'chart-line', 'control-tower': 'radar', 'chart-of-accounts': 'list-tree', journals: 'notebook-pen', recurring: 'repeat', ledger: 'scroll-text', periods: 'calendar-range', close: 'calendar-check-2', customers: 'users-round', estimates: 'file-pen-line', quotes: 'file-spreadsheet', 'sales-orders': 'clipboard-list', invoices: 'file-text', 'credit-notes': 'file-minus', 'debit-notes': 'file-plus', statements: 'file-stack', collections: 'hand-coins', vendors: 'store', 'purchase-requests': 'hand', 'purchase-orders': 'package', 'purchase-receipts': 'package-check', bills: 'receipt', 'vendor-credits': 'undo-2', 'payment-run': 'send', banking: 'landmark', expenses: 'wallet', inventory: 'boxes', assets: 'hard-drive', projects: 'folder-kanban', budgets: 'target', forecast: 'trending-up', revenue: 'handshake', leases: 'building', tax: 'percent', reports: 'chart-column', entities: 'badge-check', companies: 'building-2', workbench: 'briefcase', inbox: 'inbox', approvals: 'badge-check', insights: 'sparkles', audit: 'history', settings: 'settings', analytics: 'chart-spline', users: 'users', roles: 'key-round', console: 'monitor-cog', org: 'list-tree'};
function smooth(pts) { if (!pts.length) return ''; let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6, c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6; d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1); } return d; }
function series(vals, W, H, pad) { const mx = Math.max(...vals), mn = Math.min(...vals); const rg = mx - mn || 1; return vals.map((v, i) => [i / (vals.length - 1) * W, pad + (1 - (v - mn) / rg) * (H - pad * 2)]); }
function spark(seed) { let x = 0; for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) % 9973; const v = []; let c = 50; for (let i = 0; i < 14; i++) { x = (x * 9301 + 49297) % 233280; c += (x / 233280 - 0.42) * 18; v.push(c); } const pts = series(v, 120, 36, 3); const d = smooth(pts); return {d, a: d + ' L120,36 L0,36 Z', up: v[v.length - 1] >= v[0]}; }

const ROLE_D = [
  {k: 'Owner', d: 'Everything, including billing and deleting the company.', c: '#0B7A6F', bg: '#CCFBF1', ic: 'star'},
  {k: 'Admin', d: 'Runs the company day to day. Manages people and settings.', c: '#4F46E5', bg: '#E0E7FF', ic: 'shield-check'},
  {k: 'Accountant', d: 'Books, journals, tax, close and reports. No deletes.', c: '#0369A1', bg: '#E0F2FE', ic: 'calculator'},
  {k: 'Sales', d: 'Customers, quotes, orders, invoices and collections.', c: '#067647', bg: '#DCFAE6', ic: 'receipt-indian-rupee'},
  {k: 'Purchase', d: 'Suppliers, buy orders, goods received and bills.', c: '#B54708', bg: '#FEF0C7', ic: 'shopping-cart'},
  {k: 'Auditor', d: 'Read-only access to everything, with exports.', c: '#6D28D9', bg: '#EDE9FE', ic: 'eye'},
  {k: 'Viewer', d: 'Can see dashboards and reports. Changes nothing.', c: '#475467', bg: '#F2F4F7', ic: 'eye'}];
const PACT = [['view', 'View'], ['create', 'Create'], ['edit', 'Edit'], ['delete', 'Delete'], ['approve', 'Approve'], ['post', 'Post / send'], ['export', 'Export']];
const READ_ONLY = ['home', 'cfo', 'control-tower', 'ledger', 'statements', 'reports', 'insights', 'audit', 'analytics', 'forecast'];
const PAPPLY = (mod, a) => { if (READ_ONLY.includes(mod)) return a === 'view' || a === 'export'; if (['settings', 'entities', 'companies', 'periods', 'close', 'users', 'roles', 'console', 'budgets'].includes(mod)) return ['view', 'edit', 'approve'].includes(a) || (a === 'create' && mod !== 'settings'); return true; };
function permsFor(role) { const o = {}; NAV.forEach(b => b.items.forEach(([n, k]) => { const r = {}; PACT.forEach(([a]) => { if (!PAPPLY(k, a)) { r[a] = null; return; } let v = false;
  if (role === 'Owner' || role === 'Admin') v = role === 'Owner' || !['console'].includes(k);
  else if (role === 'Accountant') v = !['users', 'roles', 'console'].includes(k) && a !== 'delete' && !(k === 'settings' && a !== 'view');
  else if (role === 'Sales') v = (b.id === 'sales' && a !== 'delete') || (['home', 'analytics', 'reports', 'inventory', 'projects'].includes(k) && a === 'view');
  else if (role === 'Purchase') v = (b.id === 'purchases' && a !== 'delete') || (['inventory'].includes(k) && ['view', 'edit'].includes(a)) || (['home', 'reports', 'expenses'].includes(k) && a === 'view');
  else if (role === 'Auditor') v = (a === 'view' || a === 'export') && !['console', 'roles'].includes(k);
  else if (role === 'Viewer') v = a === 'view' && ['home', 'analytics', 'reports', 'invoices', 'bills', 'customers', 'vendors'].includes(k);
  r[a] = v; }); o[k] = r; })); return o; }
const RSET0 = {Owner: {lim: 'No limit', scope: 'All branches', cost: true, sal: true, bank: true, inv: true, mfa: true, to: '8 hours'}, Admin: {lim: '₹10,00,000', scope: 'All branches', cost: true, sal: true, bank: true, inv: true, mfa: true, to: '8 hours'}, Accountant: {lim: '₹2,00,000', scope: 'All branches', cost: true, sal: false, bank: true, inv: false, mfa: true, to: '4 hours'}, Sales: {lim: '₹50,000', scope: 'Own branch', cost: false, sal: false, bank: false, inv: false, mfa: false, to: '12 hours'}, Purchase: {lim: '₹1,00,000', scope: 'Own branch', cost: true, sal: false, bank: false, inv: false, mfa: false, to: '12 hours'}, Auditor: {lim: 'Cannot approve', scope: 'All branches', cost: true, sal: true, bank: true, inv: false, mfa: true, to: '2 hours'}, Viewer: {lim: 'Cannot approve', scope: 'Own branch', cost: false, sal: false, bank: false, inv: false, mfa: false, to: '12 hours'}};
const USR0 = [
  {id: 'u1', n: 'Arjun Kumar', e: 'arjun@sharmatraders.in', role: 'Owner', st: 'Active', mfa: true, last: 'Active now', dev: 'MacBook Pro · Chrome', ip: '49.36.112.8', loc: 'Mumbai', scope: 'All branches', sup: true},
  {id: 'u2', n: 'Priya Sharma', e: 'priya@sharmatraders.in', role: 'Admin', st: 'Active', mfa: true, last: '12 min ago', dev: 'Windows · Edge', ip: '103.21.58.4', loc: 'Mumbai', scope: 'All branches'},
  {id: 'u3', n: 'CA Ramesh Iyer', e: 'ramesh@iyerassociates.in', role: 'Accountant', st: 'Active', mfa: true, last: 'Yesterday', dev: 'MacBook Air · Safari', ip: '122.170.4.91', loc: 'Pune', scope: 'All branches', ext: true},
  {id: 'u4', n: 'Neha Rao', e: 'neha@sharmatraders.in', role: 'Purchase', st: 'Active', mfa: false, last: '1 hour ago', dev: 'Byjan Android', ip: '157.48.2.19', loc: 'Thane', scope: 'Mumbai HO'},
  {id: 'u5', n: 'Rahul Verma', e: 'rahul@sharmatraders.in', role: 'Sales', st: 'Active', mfa: false, last: '3 hours ago', dev: 'Byjan iPhone', ip: '49.207.51.3', loc: 'Mumbai', scope: 'Mumbai HO'},
  {id: 'u6', n: 'Kavya Menon', e: 'kavya@sharmatraders.in', role: 'Sales', st: 'Active', mfa: true, last: '2 days ago', dev: 'Windows · Chrome', ip: '106.51.77.20', loc: 'Bengaluru', scope: 'Bengaluru branch'},
  {id: 'u7', n: 'Imran Shaikh', e: 'imran@sharmatraders.in', role: 'Viewer', st: 'Suspended', mfa: false, last: '3 weeks ago', dev: '—', ip: '—', loc: '—', scope: 'Mumbai HO'},
  {id: 'u8', n: 'Anita Desai', e: 'anita@auditfirm.in', role: 'Auditor', st: 'Invited', mfa: false, last: 'Invite sent 2 days ago', dev: '—', ip: '—', loc: '—', scope: 'All branches', ext: true}];
const ISS0 = [
  {id: 'TR-8F21A', sev: 'High', t: 'GST portal rejected GSTR-1 upload · invalid HSN on 2 lines', m: 'Tax', who: 'Arjun Kumar', n: 3, first: 'Today, 9:12 AM', last: 'Today, 11:40 AM', st: 'Open'},
  {id: 'TR-77C03', sev: 'High', t: 'HDFC bank feed stopped syncing · token expired', m: 'Bank', who: 'System', n: 14, first: 'Yesterday, 11:00 PM', last: '8 min ago', st: 'Open'},
  {id: 'TR-51B9E', sev: 'Medium', t: 'Invoice email bounced · accounts@mehtabuilders.in mailbox full', m: 'Sales', who: 'Rahul Verma', n: 1, first: 'Today, 10:05 AM', last: 'Today, 10:05 AM', st: 'Open'},
  {id: 'TR-3A0D2', sev: 'Medium', t: 'Tally sync skipped 4 vouchers · ledger “Freight inward” not found in Tally', m: 'Integrations', who: 'System', n: 4, first: 'Last night, 2:00 AM', last: 'Last night, 2:00 AM', st: 'Open'},
  {id: 'TR-19E44', sev: 'Low', t: 'Slow report · Trial balance took 6.2 s for FY view', m: 'Reports', who: 'CA Ramesh Iyer', n: 2, first: 'Yesterday, 6:30 PM', last: 'Yesterday, 6:41 PM', st: 'Open'},
  {id: 'TR-0C7F1', sev: 'Low', t: 'Duplicate supplier bill blocked · BILL-1046 matches BILL-1043', m: 'Buying', who: 'Neha Rao', n: 1, first: '22 Sep', last: '22 Sep', st: 'Resolved'}];
const SVC0 = [['Web app & API', 'Operational', '42 ms', 99.99], ['Database', 'Operational', '6 ms', 100], ['Bank feeds · HDFC', 'Down', 'token expired', 96.1], ['Bank feeds · ICICI', 'Operational', 'synced 1 hr ago', 99.7], ['GST portal (GSP)', 'Degraded', 'slow responses', 98.4], ['Email & WhatsApp', 'Operational', '0.4 s', 99.9], ['Tally Prime connector', 'Operational', 'nightly', 99.5], ['Bill reading (AI)', 'Operational', '2.1 s per bill', 99.8]];
const JOB0 = [{id: 'j1', n: 'Bank feed · HDFC', sch: 'Every hour', last: '8 min ago', st: 'Failed', dur: '0.8 s'}, {id: 'j2', n: 'Bank feed · ICICI', sch: 'Every hour', last: '1 hour ago', st: 'Done', dur: '3.4 s'}, {id: 'j3', n: 'Payment reminders', sch: 'Daily 10:00 AM', last: 'Today, 10:00 AM', st: 'Done', dur: '12.1 s'}, {id: 'j4', n: 'Tally sync', sch: 'Nightly 2:00 AM', last: 'Last night', st: 'Partly done', dur: '41 s'}, {id: 'j5', n: 'Repeat entries', sch: '1st of month', last: '1 Sep', st: 'Done', dur: '2.2 s'}, {id: 'j6', n: 'Database backup', sch: 'Every 6 hours', last: '2 hours ago', st: 'Done', dur: '1 min 12 s'}, {id: 'j7', n: 'GSTR-2B download', sch: '14th monthly', last: '14 Sep', st: 'Done', dur: '9.8 s'}];
const FLAG0 = {gst2: true, ai: true, wa: true, beta: false, maint: false, strict: true};

const PHI = {"arrow-left-right":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrows-left-right-duotone.svg","arrow-right-left":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrows-left-right-duotone.svg","arrow-right":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-right.svg","badge-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/seal-check-duotone.svg","bell":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bell-duotone.svg","boxes":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cube-duotone.svg","ban":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/prohibit-duotone.svg","building-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/buildings-duotone.svg","bell-ring":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bell-ringing-duotone.svg","book-open-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/notebook-duotone.svg","calendar":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-blank-duotone.svg","clipboard-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/clipboard-text-duotone.svg","chart-line":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/chart-line-up-duotone.svg","chevron-right":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-right.svg","download":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/download-simple-duotone.svg","inbox":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/tray-duotone.svg","calendar-check-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-check-duotone.svg","file-stack":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/files-duotone.svg","info":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/info-duotone.svg","history":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/clock-counter-clockwise-duotone.svg","calculator":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calculator-duotone.svg","folder-kanban":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/kanban-duotone.svg","pencil":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/pencil-simple-duotone.svg","indian-rupee":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/currency-inr-duotone.svg","package-x":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/package-duotone.svg","check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/check.svg","scale":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/scales-duotone.svg","landmark":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bank-duotone.svg","clipboard-list":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/clipboard-text-duotone.svg","plus":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/plus.svg","scan-line":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/scan-duotone.svg","house":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/house-duotone.svg","eye":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg","receipt-indian-rupee":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/receipt-duotone.svg","lock":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/lock-simple-duotone.svg","list-checks":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/list-checks-duotone.svg","copy":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/copy-duotone.svg","repeat":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/repeat-duotone.svg","minus":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/minus.svg","hand":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/hand-duotone.svg","package-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/package-duotone.svg","receipt":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/receipt-duotone.svg","hard-drive":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/hard-drives-duotone.svg","mail":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/envelope-simple-duotone.svg","percent":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/percent-duotone.svg","handshake":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/handshake-duotone.svg","calendar-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-check-duotone.svg","file-minus":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-minus-duotone.svg","file-text":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-text-duotone.svg","file-plus":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-plus-duotone.svg","piggy-bank":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/piggy-bank-duotone.svg","chart-spline":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/chart-line-up-duotone.svg","notebook-pen":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/notebook-duotone.svg","lock-open":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/lock-simple-open-duotone.svg","file-plus-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-plus-duotone.svg","flask-conical":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/flask-duotone.svg","message-circle-question":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/chat-circle-dots-duotone.svg","chevron-down":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-down.svg","list-tree":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/tree-structure-duotone.svg","hand-coins":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/hand-coins-duotone.svg","package":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/package-duotone.svg","scroll-text":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/scroll-duotone.svg","link":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/link-simple-duotone.svg","search":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/magnifying-glass.svg","shield-check":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/shield-check-duotone.svg","sliders-horizontal":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-horizontal-duotone.svg","printer":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/printer-duotone.svg","refresh-cw":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrows-clockwise-duotone.svg","upload":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/upload-simple-duotone.svg","user-plus":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/user-plus-duotone.svg","sheet":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/table-duotone.svg","trending-down":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trend-down-duotone.svg","file-pen":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/note-pencil-duotone.svg","circle-check-big":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/check-circle-duotone.svg","eye-off":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-slash-duotone.svg","upload-cloud":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-arrow-up-duotone.svg","layout-dashboard":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/squares-four-duotone.svg","undo-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrow-u-up-left-duotone.svg","panel-left-close":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/sidebar-simple.svg","circle-alert":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-circle-duotone.svg","rotate-ccw":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrow-counter-clockwise-duotone.svg","archive":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/archive-duotone.svg","arrow-down-left":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-down-left.svg","chart-column":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/chart-bar-duotone.svg","check-circle-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/check-circle-duotone.svg","fuel":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/gas-pump-duotone.svg","flag":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/flag-duotone.svg","shopping-cart":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/shopping-cart-duotone.svg","settings":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/gear-six-duotone.svg","file-pen-line":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/note-pencil-duotone.svg","trending-up":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trend-up-duotone.svg","chevron-left":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-left.svg","send":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paper-plane-tilt-duotone.svg","store":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/storefront-duotone.svg","target":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/target-duotone.svg","star":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/star-duotone.svg","sparkles":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sparkle-duotone.svg","triangle-alert":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/warning-duotone.svg","trash-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/trash-duotone.svg","timer":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/timer-duotone.svg","alarm-clock":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/alarm-duotone.svg","arrow-up-right":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/arrow-up-right.svg","zap":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/lightning-duotone.svg","user-round":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/user-circle-duotone.svg","users-round":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/users-three-duotone.svg","x":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/x.svg","key-round":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/key-duotone.svg","monitor-cog":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/monitor-duotone.svg","wallet":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/wallet-duotone.svg","external-link":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrow-square-out-duotone.svg","at-sign":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/at-duotone.svg","reply":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/arrow-bend-up-left-duotone.svg","bug":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bug-duotone.svg","chart-pie":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/chart-pie-slice-duotone.svg","log-out":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sign-out-duotone.svg","toggle-right":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/toggle-right-duotone.svg","activity":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/pulse-duotone.svg","calendar-days":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-dots-duotone.svg","calendar-clock":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-dots-duotone.svg","paperclip":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/paperclip-duotone.svg","calendar-range":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/calendar-dots-duotone.svg","tag":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/tag-duotone.svg","eye-scan":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/eye-duotone.svg","grip-vertical":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/dots-six-vertical.svg","file-spreadsheet":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-xls-duotone.svg","book-open":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/book-open-duotone.svg","hourglass":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/hourglass-duotone.svg","chevrons-up-down":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/caret-up-down.svg","badge-percent":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/seal-percent-duotone.svg","git-compare":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/git-diff-duotone.svg","file-down":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/file-arrow-down-duotone.svg","save":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/floppy-disk-duotone.svg","list-filter":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/funnel-simple.svg","shield":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/shield-duotone.svg","wand-sparkles":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/magic-wand-duotone.svg","loader":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/spinner-duotone.svg","circle-stop":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/stop-circle-duotone.svg","cloud":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/cloud-duotone.svg","map-pin":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/map-pin-duotone.svg","settings-2":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/sliders-duotone.svg","building":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/building-duotone.svg","bell-off":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/bell-slash-duotone.svg","radar":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/crosshair-duotone.svg","rows":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/rows-duotone.svg","users":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/users-duotone.svg","squares":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/squares-four-duotone.svg","briefcase":"https://unpkg.com/@phosphor-icons/core@2.1.1/assets/duotone/briefcase-duotone.svg"};
const IC = n => PHI[n] || (ICO + n + '.svg');
const PCAT = {c1: ['Builders & developers', 'Mehta Group'], c2: ['Interiors & design', ''], c3: ['Hospitality', 'Sunrise Group'], c4: ['Retail chains', ''], c5: ['Education', ''], c6: ['Logistics', ''], v1: ['Raw materials', 'Shree Group'], v2: ['Transport & freight', ''], v3: ['Raw materials', ''], v4: ['Hardware & tools', ''], v5: ['Utilities', 'Tata Group'], v6: ['Office supplies', '']};
const SHIPTO = {c1: ['Tower B site · Thane', 'Head office · Andheri'], c3: ['Pune lobby project', 'Lonavala resort'], c4: ['Store · Indiranagar', 'Store · Whitefield', 'Store · HSR Layout', 'Warehouse · Hoskote'], v1: ['Plant · Beawar', 'Depot · Bhiwandi'], v5: ['Andheri office meter', 'Bhiwandi godown meter']};
const CATS_C = ['Builders & developers', 'Interiors & design', 'Hospitality', 'Retail chains', 'Education', 'Logistics', 'Government'];
const CATS_V = ['Raw materials', 'Transport & freight', 'Hardware & tools', 'Utilities', 'Office supplies', 'Professional services'];
const CAT_IC = {'Builders & developers': 'building-2', 'Interiors & design': 'sparkles', Hospitality: 'building', 'Retail chains': 'store', Education: 'book-open', Logistics: 'package', Government: 'landmark', 'Raw materials': 'boxes', 'Transport & freight': 'package-check', 'Hardware & tools': 'wand-sparkles', Utilities: 'zap', 'Office supplies': 'file-text', 'Professional services': 'users-round'};
const ORG0 = [
  {id: 'g', p: null, n: 'Sharma Group', t: 'Group', s: 'Holding · 2 companies', head: 'Arjun Kumar', ppl: 42, cc: '—'},
  {id: 'co1', p: 'g', n: 'Sharma Traders Pvt Ltd', t: 'Company', s: 'CIN U51909MH2014PTC2561 · FY Apr–Mar', head: 'Arjun Kumar', ppl: 34, cc: 'ST'},
  {id: 'b1', p: 'co1', n: 'Mumbai head office', t: 'Branch', s: 'GSTIN 27AAKCS8841D1Z6 · Andheri East', head: 'Priya Sharma', ppl: 22, cc: 'ST-MUM'},
  {id: 'd1', p: 'b1', n: 'Sales', t: 'Department', s: '3 teams', head: 'Rahul Verma', ppl: 8, cc: 'ST-MUM-SAL'},
  {id: 'c11', p: 'd1', n: 'Projects sales', t: 'Cost centre', s: 'Builders and hotels', head: 'Rahul Verma', ppl: 4, cc: 'CC-101'},
  {id: 'c12', p: 'd1', n: 'Retail sales', t: 'Cost centre', s: 'Stores and walk-ins', head: 'Kavya Menon', ppl: 4, cc: 'CC-102'},
  {id: 'd2', p: 'b1', n: 'Purchase', t: 'Department', s: 'Suppliers and stock', head: 'Neha Rao', ppl: 4, cc: 'ST-MUM-PUR'},
  {id: 'd3', p: 'b1', n: 'Accounts & finance', t: 'Department', s: 'Books, tax, payroll', head: 'Priya Sharma', ppl: 5, cc: 'ST-MUM-FIN'},
  {id: 'd4', p: 'b1', n: 'Warehouse · Bhiwandi', t: 'Department', s: 'Stock and dispatch', head: 'Imran Shaikh', ppl: 5, cc: 'ST-MUM-WH'},
  {id: 'b2', p: 'co1', n: 'Bengaluru branch', t: 'Branch', s: 'GSTIN 29AAKCS8841D1Z2 · Indiranagar', head: 'Kavya Menon', ppl: 12, cc: 'ST-BLR'},
  {id: 'd5', p: 'b2', n: 'Sales', t: 'Department', s: 'Retail chain accounts', head: 'Kavya Menon', ppl: 7, cc: 'ST-BLR-SAL'},
  {id: 'd6', p: 'b2', n: 'Store operations', t: 'Department', s: '4 client stores', head: 'Kavya Menon', ppl: 5, cc: 'ST-BLR-OPS'},
  {id: 'co2', p: 'g', n: 'Sharma Infra LLP', t: 'Company', s: 'LLPIN AAB-4412 · FY Apr–Mar', head: 'Arjun Kumar', ppl: 8, cc: 'SI'},
  {id: 'b3', p: 'co2', n: 'Thane site office', t: 'Branch', s: 'GSTIN 27AAQFS2231E1Z8', head: 'Arjun Kumar', ppl: 8, cc: 'SI-THN'}];
const OT = {Group: ['layout-dashboard', '#E0E7FF', '#4F46E5'], Company: ['building-2', '#CCFBF1', '#0B7A6F'], Branch: ['map-pin', '#E0F2FE', '#0369A1'], Department: ['users-round', '#FEF0C7', '#B54708'], 'Cost centre': ['target', '#FCE7F6', '#C11574']};

const NAV_CA = [
  {id: 'ca-practice', n: 'Practice', ic: 'briefcase', blurb: 'Your whole practice at a glance: clients, deadlines and work in progress.', items: [['Dashboard', 'ca-home'], ['Clients', 'ca-clients'], ['Compliance calendar', 'ca-cal'], ['Tasks & work', 'ca-tasks']]},
  {id: 'ca-filing', n: 'Filing', ic: 'percent', blurb: 'Prepare and file returns for every client in batches.', items: [['GST returns', 'ca-gst'], ['Income tax & TDS', 'ca-itr'], ['ROC & MCA', 'ca-roc']]},
  {id: 'ca-review', n: 'Review', ic: 'clipboard-check', blurb: 'Check client books, chase documents and answer questions.', items: [['Review queue', 'ca-rq'], ['Document requests', 'ca-docs'], ['Client queries', 'ca-queries']]},
  {id: 'ca-ops', n: 'Practice ops', ic: 'chart-column', blurb: 'Team capacity, time, billing and practice reports.', items: [['Team & capacity', 'ca-team'], ['Time & billing', 'ca-billing'], ['Practice reports', 'ca-reports']]}];
NAV_CA.forEach(b => b.items.forEach(([n, k]) => { MOD[k] = {n, b}; }));
const CAN = {'ca-home': 'squares', 'ca-clients': 'users-round', 'ca-cal': 'calendar-days', 'ca-tasks': 'folder-kanban', 'ca-gst': 'percent', 'ca-itr': 'landmark', 'ca-roc': 'building-2', 'ca-rq': 'clipboard-check', 'ca-docs': 'file-stack', 'ca-queries': 'message-circle-question', 'ca-team': 'users', 'ca-billing': 'timer', 'ca-reports': 'chart-column'};
const STAFF = [{n: 'CA Ramesh Iyer', ini: 'RI', r: 'Partner', cap: 40, hrs: 34}, {n: 'Sneha Kulkarni', ini: 'SK', r: 'Manager', cap: 45, hrs: 44}, {n: 'Aditya Rao', ini: 'AR', r: 'Senior', cap: 45, hrs: 38}, {n: 'Pooja Nair', ini: 'PN', r: 'Associate', cap: 45, hrs: 47}, {n: 'Farhan Ali', ini: 'FA', r: 'Article', cap: 40, hrs: 22}];
const CL0 = [
  {id: 'k1', n: 'Sharma Traders Pvt Ltd', t: 'Pvt Ltd', ind: 'Building materials', g: '27AAKCS8841D1Z6', st: 'Sneha Kulkarni', hl: 82, on: true, books: 'Up to date', fee: 45000, pend: 3, next: 'GSTR-1 · 11 Oct', ph: '+91 98200 11220', city: 'Mumbai'},
  {id: 'k2', n: 'Sharma Infra LLP', t: 'LLP', ind: 'Construction', g: '27AAQFS2231E1Z8', st: 'Sneha Kulkarni', hl: 74, on: true, books: 'Up to date', fee: 30000, pend: 2, next: 'GSTR-3B · 20 Oct', ph: '+91 98200 11220', city: 'Thane'},
  {id: 'k3', n: 'Kavya Designs', t: 'Partnership', ind: 'Interior design', g: '27AABFK0912C1Z4', st: 'Aditya Rao', hl: 91, on: true, books: 'Up to date', fee: 24000, pend: 0, next: 'GSTR-1 · 11 Oct', ph: '+91 99870 33412', city: 'Pune'},
  {id: 'k4', n: 'Mehta Builders', t: 'Pvt Ltd', ind: 'Real estate', g: '27AABCM4521K1Z3', st: 'CA Ramesh Iyer', hl: 58, on: false, books: '2 months behind', fee: 90000, pend: 7, next: 'TDS 26Q · 31 Oct', ph: '+91 98200 41122', city: 'Mumbai'},
  {id: 'k5', n: 'Nair Logistics', t: 'Proprietor', ind: 'Transport', g: '32AAGFN7781R1Z8', st: 'Pooja Nair', hl: 66, on: true, books: '1 month behind', fee: 18000, pend: 4, next: 'GSTR-3B · 20 Oct', ph: '+91 94470 55120', city: 'Kochi'},
  {id: 'k6', n: 'Sunrise Hotels Pvt Ltd', t: 'Pvt Ltd', ind: 'Hospitality', g: '27AAECS9912M1Z1', st: 'CA Ramesh Iyer', hl: 88, on: true, books: 'Up to date', fee: 120000, pend: 1, next: 'AOC-4 · 29 Oct', ph: '+91 98230 11456', city: 'Pune'},
  {id: 'k7', n: 'Orbit Retail LLP', t: 'LLP', ind: 'Retail', g: '29AAHFO3321P1Z5', st: 'Aditya Rao', hl: 79, on: true, books: 'Up to date', fee: 60000, pend: 2, next: 'GSTR-1 · 11 Oct', ph: '+91 99005 77210', city: 'Bengaluru'},
  {id: 'k8', n: 'Greenfield Schools Trust', t: 'Trust', ind: 'Education', g: '27AAATG1180Q1Z2', st: 'Pooja Nair', hl: 71, on: false, books: 'Up to date', fee: 36000, pend: 2, next: 'ITR-7 · 31 Oct', ph: '+91 97654 30912', city: 'Nashik'},
  {id: 'k9', n: 'Dr. Anjali Mehra Clinic', t: 'Proprietor', ind: 'Healthcare', g: '27AAHPM4410J1Z9', st: 'Farhan Ali', hl: 94, on: true, books: 'Up to date', fee: 15000, pend: 0, next: 'Advance tax · 15 Dec', ph: '+91 98191 22004', city: 'Mumbai'},
  {id: 'k10', n: 'Patel Agro Exports', t: 'Pvt Ltd', ind: 'Exports', g: '24AABCP7712F1Z5', st: 'Sneha Kulkarni', hl: 49, on: false, books: '3 months behind', fee: 75000, pend: 9, next: 'GSTR-1 · overdue', ph: '+91 98250 66781', city: 'Ahmedabad'},
  {id: 'k11', n: 'Coastal Seafoods', t: 'Partnership', ind: 'Food processing', g: '32AAFFC2290D1Z1', st: 'Pooja Nair', hl: 63, on: true, books: '1 month behind', fee: 28000, pend: 3, next: 'GSTR-3B · 20 Oct', ph: '+91 94460 11893', city: 'Kochi'},
  {id: 'k12', n: 'Techwave Solutions', t: 'Pvt Ltd', ind: 'Software', g: '29AAGCT5501L1Z6', st: 'Aditya Rao', hl: 86, on: true, books: 'Up to date', fee: 54000, pend: 1, next: 'TDS 24Q · 31 Oct', ph: '+91 99001 44520', city: 'Bengaluru'},
  {id: 'k13', n: 'Rao & Sons Jewellers', t: 'Partnership', ind: 'Jewellery', g: '36AAIFR3309G1Z7', st: 'Farhan Ali', hl: 69, on: false, books: 'Up to date', fee: 42000, pend: 2, next: 'GSTR-1 · 11 Oct', ph: '+91 98490 78112', city: 'Hyderabad'},
  {id: 'k14', n: 'Anil Sharma (individual)', t: 'Individual', ind: 'Director', g: '—', st: 'CA Ramesh Iyer', hl: 90, on: false, books: '—', fee: 12000, pend: 1, next: 'Advance tax · 15 Dec', ph: '+91 98200 11220', city: 'Mumbai'}];
const RET_T = [['GSTR-1', 'gst', 11], ['GSTR-3B', 'gst', 20], ['GSTR-2B match', 'gst', 14], ['TDS 26Q', 'itr', 31], ['TDS 24Q', 'itr', 31], ['Advance tax', 'itr', 15], ['ITR-6', 'itr', 31], ['AOC-4', 'roc', 29], ['MGT-7', 'roc', 29], ['DIR-3 KYC', 'roc', 30]];
const CST = ['Not started', 'Data pending', 'In progress', 'Ready for review', 'Filed'];
function genComp() { const out = []; let id = 1; CL0.forEach((c, i) => RET_T.forEach(([r, g, due], j) => { if (g === 'gst' && c.g === '—') return; if (g === 'roc' && !['Pvt Ltd', 'LLP'].includes(c.t)) return; if (r === 'ITR-6' && c.t !== 'Pvt Ltd') return; if (r === 'TDS 24Q' && !['k6', 'k12', 'k1', 'k4'].includes(c.id)) return; if ((i + j) % 3 === 2 && g !== 'gst') return;
  const st = c.id === 'k10' && r === 'GSTR-1' ? 'Data pending' : CST[(i * 3 + j * 2) % 5]; out.push({id: 'cp' + (id++), cl: c.id, r, g, per: g === 'roc' ? 'FY 2025-26' : r === 'Advance tax' ? 'Q3 FY 26-27' : g === 'itr' && r.startsWith('TDS') ? 'Q2 FY 26-27' : 'Sep 2026', due, st, od: c.id === 'k10' && r === 'GSTR-1', who: c.st, arn: st === 'Filed' ? 'AA27' + (1000000 + id * 7919) : ''}); })); return out; }
const TASK0 = [
  {id: 't1', t: 'Reconcile GSTR-2B for September', cl: 'k1', who: 'Sneha Kulkarni', due: '10 Oct', pr: 'High', col: 'In progress', done: 3, of: 5},
  {id: 't2', t: 'Finalise FY 25-26 audit file', cl: 'k6', who: 'CA Ramesh Iyer', due: '15 Oct', pr: 'High', col: 'Review', done: 11, of: 12},
  {id: 't3', t: 'Catch up July–Sep bookkeeping', cl: 'k10', who: 'Pooja Nair', due: '8 Oct', pr: 'High', col: 'To do', done: 0, of: 6},
  {id: 't4', t: 'Prepare TDS 26Q working', cl: 'k4', who: 'Aditya Rao', due: '25 Oct', pr: 'Medium', col: 'To do', done: 0, of: 4},
  {id: 't5', t: 'Board resolution for AOC-4', cl: 'k2', who: 'Sneha Kulkarni', due: '20 Oct', pr: 'Medium', col: 'In progress', done: 1, of: 3},
  {id: 't6', t: 'Advance tax estimate · Q3', cl: 'k14', who: 'Farhan Ali', due: '5 Dec', pr: 'Low', col: 'To do', done: 0, of: 2},
  {id: 't7', t: 'Fix HSN on 2 invoice lines', cl: 'k1', who: 'Aditya Rao', due: '9 Oct', pr: 'High', col: 'Review', done: 2, of: 2},
  {id: 't8', t: 'LUT renewal for exports', cl: 'k10', who: 'Sneha Kulkarni', due: '31 Mar', pr: 'Low', col: 'Done', done: 3, of: 3},
  {id: 't9', t: 'Payroll & PF for September', cl: 'k12', who: 'Pooja Nair', due: '7 Oct', pr: 'Medium', col: 'Done', done: 4, of: 4}];
const RQ0 = [
  {id: 'q1', cl: 'k1', dt: '22 Sep', d: 'Kumar Hardware · ₹1,24,000', iss: 'Missing in GSTR-2B', fix: 'Hold input credit until supplier files', amt: 124000, mod: 'bills'},
  {id: 'q2', cl: 'k1', dt: '3 Sep', d: 'Anil Sharma transfer · ₹5,00,000', iss: 'Uncategorised', fix: 'Move to Loan from director', amt: 500000, mod: 'journals'},
  {id: 'q3', cl: 'k5', dt: '19 Sep', d: 'Diesel · cash ₹14,500', iss: 'Cash over ₹10,000', fix: 'Split or pay by bank (40A(3))', amt: 14500, mod: 'expenses'},
  {id: 'q4', cl: 'k7', dt: '18 Sep', d: 'BILL-1046 · OfficeMart', iss: 'Possible duplicate', fix: 'Void duplicate of BILL-1043', amt: 18240, mod: 'bills'},
  {id: 'q5', cl: 'k11', dt: '15 Sep', d: 'Freight inward · ₹32,000', iss: 'GST rate looks wrong', fix: 'Apply 12% under RCM', amt: 32000, mod: 'bills'},
  {id: 'q6', cl: 'k12', dt: '12 Sep', d: 'AWS invoice · \u0024 1,240', iss: 'Import of service', fix: 'Book IGST under reverse charge', amt: 103000, mod: 'bills'},
  {id: 'q7', cl: 'k3', dt: '10 Sep', d: 'Client dinner · ₹12,400', iss: 'Blocked credit 17(5)', fix: 'Reverse input credit of ₹2,232', amt: 12400, mod: 'expenses'}];
const DR0 = [{id: 'r1', cl: 'k10', items: ['Bank statements Jul–Sep', 'Sales register', 'Shipping bills'], got: 1, ch: 'WhatsApp', sent: '4 days ago', rem: 2}, {id: 'r2', cl: 'k4', items: ['TDS challans Q2', 'Contractor PANs'], got: 0, ch: 'Email', sent: '2 days ago', rem: 1}, {id: 'r3', cl: 'k8', items: ['Donation receipts', 'Fee register', 'Form 10B draft'], got: 2, ch: 'Email', sent: 'Yesterday', rem: 0}, {id: 'r4', cl: 'k13', items: ['Stock valuation Sep', 'Hallmarking bills'], got: 2, ch: 'WhatsApp', sent: 'Last week', rem: 0}, {id: 'r5', cl: 'k6', items: ['Fixed asset register', 'Director KYC'], got: 1, ch: 'Portal', sent: '3 days ago', rem: 1}];
const CQ0 = [{id: 'x1', cl: 'k1', q: 'Please share the bill for ₹1,24,000 paid to Kumar Hardware on 12 Sep.', w: '2 days ago', st: 'Open', from: 'You'}, {id: 'x2', cl: 'k1', q: 'Is the ₹5,00,000 from Anil Sharma a loan or share capital?', w: '3 days ago', st: 'Open', from: 'You'}, {id: 'x3', cl: 'k10', q: 'Can we claim refund of IGST on the August shipments?', w: 'Today', st: 'New', from: 'Client'}, {id: 'x4', cl: 'k6', q: 'Do we need a tax audit this year with turnover ₹9.6 Cr?', w: 'Yesterday', st: 'New', from: 'Client'}, {id: 'x5', cl: 'k12', q: 'ESOP perquisite: how to show in Form 16?', w: 'Last week', st: 'Answered', from: 'Client'}];
const TIME0 = [{id: 'w1', cl: 'k6', who: 'CA Ramesh Iyer', t: 'Audit review meeting', h: 3, rate: 4000, bill: true, dt: 'Today'}, {id: 'w2', cl: 'k1', who: 'Sneha Kulkarni', t: 'GSTR-2B reconciliation', h: 4.5, rate: 2500, bill: true, dt: 'Today'}, {id: 'w3', cl: 'k10', who: 'Pooja Nair', t: 'Bookkeeping catch-up', h: 6, rate: 1500, bill: true, dt: 'Yesterday'}, {id: 'w4', cl: 'k4', who: 'Aditya Rao', t: 'TDS working', h: 2, rate: 2000, bill: true, dt: 'Yesterday'}, {id: 'w5', cl: 'k12', who: 'Pooja Nair', t: 'Payroll run', h: 2.5, rate: 1500, bill: false, dt: '22 Sep'}, {id: 'w6', cl: 'k2', who: 'Sneha Kulkarni', t: 'Board resolution draft', h: 1.5, rate: 2500, bill: true, dt: '22 Sep'}];

const TEAM = [{n: 'Arjun Kumar', ini: 'AK', r: 'Owner'}, {n: 'Priya Sharma', ini: 'PS', r: 'Admin'}, {n: 'Neha Rao', ini: 'NR', r: 'Contributor'}, {n: 'Rahul Verma', ini: 'RV', r: 'Contributor'}, {n: 'CA Ramesh Iyer', ini: 'RI', r: 'Accountant'}];

const cellN = c => Object.assign({isTx: false, isBd: false, isBar: false, isAc: false, isCk: false, isTg: false, isAv: false, hasS: false, t: '', s: '', al: 'left', jc: 'flex-start', ft: '600 13.5px', fg: '#0B1F3A', bg: '', bd: '', w: '0%', t2: '', c: '', acts: [], j: '', go: null, ini: ''}, c);
const tx = (t, o) => cellN(Object.assign({isTx: true, t: String(t)}, o || {}, o && o.s ? {hasS: true} : {}));
const nm = (t, o) => tx(t, Object.assign({al: 'right', jc: 'flex-end', ft: '700 13.5px'}, o || {}));
const bd = t => { const c = STC[t] || ['#EEF1F5', '#475467']; return cellN({isBd: true, t, bg: c[0], fg: c[1]}); };
const br = (p, t, t2, c) => cellN({isBar: true, w: Math.max(2, Math.min(100, p)).toFixed(0) + '%', t, t2, c: c || '#12B8A8'});
const stop = e => { if (e && e.stopPropagation) e.stopPropagation(); };
const btnS = k => k === 'p' ? {bg: 'linear-gradient(180deg,#22C7B5,#0FA898)', fg: '#fff', bd: '#0FA898'} : k === 't' ? {bg: 'linear-gradient(180deg,#22C7B5,#0FA898)', fg: '#fff', bd: '#0FA898'} : k === 'd' ? {bg: '#FFF6F5', fg: '#B42318', bd: '#FAD4CF'} : k === 'o' ? {bg: '#E6FAF6', fg: '#0B6B61', bd: '#BFEFE6'} : {bg: '#fff', fg: '#0A1020', bd: '#E4E7EC'};
const A = (n, ic, go, k) => Object.assign({n, ic: IC(ic), go: e => { stop(e); go(); }}, btnS(k));
const ac = acts => cellN({isAc: true, jc: 'flex-end', acts});
const ck = (on, fn) => cellN({isCk: true, bg: on ? '#12B8A8' : '#fff', bd: on ? '#12B8A8' : '#C3CCD8', go: e => { stop(e); fn(); }});
const av = (ini, t, s, bg) => cellN({isAv: true, ini, t, s: s || '', hasS: !!s, bg: bg || '#E3F7F4'});
const tgC = (on, fn) => cellN({isTg: true, jc: 'flex-end', bg: on ? '#12B8A8' : '#CBD3DD', j: on ? 'flex-end' : 'flex-start', go: e => { stop(e); fn(); }});
const col = (n, w, al) => ({n, w, al: al || 'left', jc: al === 'right' ? 'flex-end' : 'flex-start', isCk: false, ckBg: '', ckBd: '', go: null});
const kp = (l, v, s, o) => { o = o || {}; return {l, v, s: s || '', ic: IC((o.ic || 'circle')), icBg: o.bg || '#E3F7F4', icFg: o.fg || '#0B7A6F', sFg: o.sFg || '#5B6B82', go: o.go || (() => {}), cur: o.go ? 'pointer' : 'default', bdc: o.hot ? '#12B8A8' : '#E4E8EE'}; };
const AVC = ['#E3F7F4', '#E8F0FE', '#FFF4E0', '#FDECEA', '#EEF1F5', '#F3E8FF'];
const avBg = s => AVC[(s || '').length % AVC.length];
const inis = s => (s || '?').replace(/^CA /, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const TBL = (cols, rows, empty, emptyS) => ({cols, rows, empty: empty || 'Nothing here yet', emptyS: emptyS || ''});
const R = (cells, open, hot) => ({cells, open: open || (() => {}), bg: hot ? '#F0FAF8' : '#fff'});


export {
  MON,
  fd,
  inr,
  inr2,
  inrS,
  ICO,
  CO,
  NAV,
  MOD,
  PARTIES,
  PBY,
  ITEMS,
  IBY,
  ACCS,
  JPAIRS,
  JNAR,
  RNAME,
  DOC_T,
  DIST,
  STC,
  calc,
  genDocs,
  LOG0,
  FEED0,
  PER0,
  CHK0,
  STOCK0,
  ASSETS0,
  PROJ0,
  BUD0,
  DEALS0,
  LEASE0,
  RET0,
  MIS0,
  ENT0,
  CO0,
  Q0,
  INBOX0,
  APR0,
  ALERT0,
  COA0,
  SET0,
  CF,
  WK,
  NIC,
  smooth,
  series,
  spark,
  ROLE_D,
  PACT,
  READ_ONLY,
  PAPPLY,
  permsFor,
  RSET0,
  USR0,
  ISS0,
  SVC0,
  JOB0,
  FLAG0,
  PHI,
  IC,
  PCAT,
  SHIPTO,
  CATS_C,
  CATS_V,
  CAT_IC,
  ORG0,
  OT,
  NAV_CA,
  CAN,
  STAFF,
  CL0,
  RET_T,
  CST,
  genComp,
  TASK0,
  RQ0,
  DR0,
  CQ0,
  TIME0,
  TEAM,
  cellN,
  tx,
  nm,
  bd,
  br,
  stop,
  btnS,
  A,
  ac,
  ck,
  av,
  tgC,
  col,
  kp,
  AVC,
  avBg,
  inis,
  TBL,
  R
};
