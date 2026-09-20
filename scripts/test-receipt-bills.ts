/**
 * Regression: restaurant / fuel / handwritten invoices — one payable total,
 * not every line-item ₹.
 */
import {
  extractMoneyAmount,
  extractMoneyEntries,
} from '../src/lib/amount-parse.ts';

type Case = { name: string; text: string; want: number | number[]; note?: string };

const cases: Case[] = [
  {
    name: 'Harishanker resto',
    want: 1864.4,
    text: `HARISHANKER VEG RESTO
TRIVENI NAGAR GOPALPURA JAIPUR
Cash Memo
Date 19/04/2025 Bill No 1925 T.No 5
Particulars Qty Rate Amount
HANDI PANEER 2 ₹200 ₹400
SEV TAMATAR 2 ₹150 ₹300
PLAIN RAITA 2 ₹110 ₹220
JEERA RICE 2 ₹110 ₹220
TAVA ROTI BUTTER 10 ₹12 ₹120
TANDURI ROTI BUTTER 8 ₹15 ₹120
VANILA ICE CREAM 5 ₹40 ₹200
Sub Total ₹1580.00
CGST @9 % On ₹1580.00 ₹142.20
SGST @9 % On ₹1580.00 ₹142.20
Food Total ₹1864.4
Total ₹1864.4
Thank You Visit Again`,
  },
  {
    name: 'Indian Curry Place USD',
    want: 309,
    text: `Indian Curry Place
RECEIPT 564
DATE 25/02/2021
PAYMENT METHOD Cash
QTY ITEM AMT.($)
1 Paneer Curry $89
1 Chicken Curry $120
1 Egg Curry $100
SUB-TOTAL $ 309
Tax $0.00
AMT: $ 309.00
THANKS FOR VISIT`,
  },
  {
    name: 'Sen Enterprise handwritten',
    want: 7800,
    text: `Sen Enterprise
Bill of Supply
Invoice No 289 Date 15/12/20
Particulars Qty Amount
1 Wahl performen trimmer 1 3600
2 Super Taper 1 4200
TOTAL 7800`,
  },
  {
    name: 'Summer Town Grand Total',
    want: 1381,
    text: `Summer Town Resto Cafe
Cheesy Bbq Chicken Pizza 1 445.00 445.00
Mineral Water 1 20.00 20.00
Iced Caramel Latte 1 200.00 200.00
Irish Coffee 1 200.00 200.00
Spanish Latte 1 200.00 200.00
Strawberry Lotus Shake 1 250.00 250.00
Total Qty 6
Sub Total 1315.00
CGST 2.5% 32.88
SGST 2.5% 32.88
Round off +0.24
Grand Total ₹ 1381.00
Thanks`,
  },
  {
    name: 'IndianOil Amount(Rs)',
    want: 590,
    text: `IndianOil Welcomes You
START NELL
Inv. No: 44210663640507662
Product Petrol
Rate(Rs/L) : 105.45
Volume(L) : 00005.60
Amount(Rs) : 00590.00
Vehicle No: 5852
Date 06/05/26 Time 11:28`,
  },
  {
    name: 'Murugesh Grand Total',
    want: 49295.36,
    text: `MURUGESH TRADERS TAX INVOICE
Bill No 835 Date 15/3/23
Particulars Qty Rate Amount
1 Cement 145 265.6 38512.00
TOTAL 38512.00
IGST 28% 10783.36
GRAND TOTAL 49295.36`,
  },
  {
    name: 'India Gate Spain Total',
    want: 37,
    text: `INDIA GATE
1 CHICKEN PAKORA 5,00
1 LAMB TIKKA MASSALA 11,50
1 CHICKEN KARAI 8,00
1 RICE 2,50
1 BOTTLE HOUSE WINE 10,00
Subtotal 37,00
IVA 6,42
Total 37,00`,
  },
  {
    name: 'College fee Total not items',
    want: 16750,
    text: `RECEIPT
Tuition Fees Rs. 8,300.00
Citizen Consumer Club Fees Rs. 50.00
ID Card Fees Rs. 150.00
Insurance Fees Rs. 60.00
Library Fees Rs. 100.00
NSS & YRC Fees Rs. 100.00
Sports Fees Rs. 200.00
Stationery Fees Rs. 100.00
Training & Placement Fees Rs. 300.00
University Fees Rs. 390.00
Bus Fee Rs. 7,000.00
Concession Rs. 2700/-
Total Rs. 16,750.00
INR Sixteen thousand seven hundred fifty only`,
  },
  {
    name: 'Rahul Hardware योग total',
    want: 17900,
    text: `राहुल हार्डवेयर ESITMATE
1 Prak 20mm 16000
2 Prak 6mm 1900
योग 17900`,
  },
  {
    name: 'IndianOil blank Amount do not use Atot',
    want: 0,
    note: 'empty Amount(Rs) — must not pick Atot lifetime meter',
    text: `IndianOil Duplicate Receipt
MAHIMAI AGENCY
Product Diesel
Rate(Rs/L) : 092.41
Volume(L) :
Amount(Rs) :
Atot: 00021269861.36
Vtot: 0000230458.010
Date /02/26 Time 22:06`,
  },
  {
    name: 'Handwritten two people still multi',
    want: [1016, 5016],
    text: `Seenu - Rs 1016 /-
Raghu - Rs 5016 /-`,
  },
];

function almost(a: number, b: number) {
  return Math.abs(a - b) < 0.05;
}

let fail = 0;
for (const c of cases) {
  const entries = extractMoneyEntries(c.text);
  const one = extractMoneyAmount(c.text);
  const got = entries.length > 1 ? entries.map((e) => e.amount) : (one ? [one.amount] : []);
  const want = Array.isArray(c.want) ? c.want : [c.want];
  let ok: boolean;
  if (want.length === 1 && want[0] === 0) {
    ok = got.length === 0 || (got.length === 1 && got[0] === 0);
    // Prefer null / refuse Atot
    if (one && one.amount > 1_000_000) ok = false;
    if (!one) ok = true;
  } else {
    ok = want.length === got.length && want.every((w, i) => almost(w, got[i]));
  }
  if (!ok) fail += 1;
  console.log(
    ok ? 'OK  ' : 'FAIL',
    c.name.padEnd(36),
    'got',
    got.length ? got.map((g) => Number(g.toFixed(2))) : 'NULL',
    'want',
    want,
    one ? `score=${one.score}` : '',
    c.note || '',
  );
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
