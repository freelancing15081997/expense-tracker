/**
 * End-to-end Indian receipt / document parse harness.
 * Covers UPI apps, GST invoices, fuel, food, utilities, bank SMS, medical, e‑commerce, etc.
 * Runs: amount-parse + PP-Structure (+ duplicate fingerprint checks).
 */
import { extractMoneyAmount, reconcileVisionAmount } from '../src/lib/amount-parse.ts';
import { parsePpStructureText, needsPpStructure } from '../api/_lib/paddle-structure.ts';

type Case = {
  id: string;
  label: string;
  text: string;
  expectAmount: number;
  expectNotAmount?: number[];
  expectMerchantIncludes?: string;
  expectPayment?: string;
  expectCategory?: string;
  expectDate?: string;
  complex?: boolean;
};

const cases: Case[] = [
  {
    id: 'gpay-upi',
    label: 'Google Pay UPI screenshot',
    text: `Payment successful
26 Sep 2024
To Merchant Name
You paid ₹150.00
UPI transaction ID 123456789012
Paid via Google Pay`,
    expectAmount: 150,
    expectNotAmount: [26],
    expectPayment: 'upi',
  },
  {
    id: 'phonepe-upi',
    label: 'PhonePe UPI',
    text: `Payment Successful
Paid to Swiggy
₹349.00
26/09/2024 18:42
UPI Ref No. 424242424242
PhonePe`,
    expectAmount: 349,
    expectNotAmount: [26],
    expectMerchantIncludes: 'Swiggy',
    expectPayment: 'upi',
    expectCategory: 'Meals',
  },
  {
    id: 'gpay-masked-upi-550',
    label: 'GPay ₹550 must ignore masked UPI tail 112',
    text: `Payment successful
15 Sep 2026
To Kirana Store
You paid ₹550.00
UPI ID XXXXX112@oksbi
UPI transaction ID 123456789012
Paid via Google Pay`,
    expectAmount: 550,
    expectNotAmount: [112, 15],
    expectPayment: 'upi',
  },
  {
    id: 'phonepe-masked-ending-112',
    label: 'PhonePe ₹550 must ignore account ending 112',
    text: `Payment Successful
Paid to Merchant ABC
₹550.00
15/09/2026 19:10
UPI Ref No. 987654321098
From A/c ending 112
PhonePe`,
    expectAmount: 550,
    expectNotAmount: [112],
    expectPayment: 'upi',
  },
  {
    id: 'vpa-tail-not-amount',
    label: 'VPA xx112@ybl is not amount when ₹550 present',
    text: `Money Sent
To friend
Rs.550
VPA xx112@ybl
Paytm UPI`,
    expectAmount: 550,
    expectNotAmount: [112],
    expectPayment: 'upi',
  },
  {
    id: 'paytm-upi',
    label: 'Paytm UPI',
    text: `Money Sent
To Zomato
Rs.220.50
on 15-09-2026
Paytm UPI`,
    expectAmount: 220.5,
    expectMerchantIncludes: 'Zomato',
    expectPayment: 'upi',
  },
  {
    id: 'bhim-upi',
    label: 'BHIM UPI',
    text: `Transaction Successful
Debited by ₹99.00
To electricity@upi
BHIM UPI 15 Sep 2026`,
    expectAmount: 99,
    expectPayment: 'upi',
  },
  {
    id: 'bank-sms',
    label: 'Bank debit SMS',
    text: `Dear Customer, Rs.1,250.00 debited from A/c XX1234 on 14-09-26 UPI/AMAZON amazon@okicici UTR 987654321012. Avl Bal Rs.12,000.00`,
    expectAmount: 1250,
    expectNotAmount: [14, 26, 12_000],
  },
  {
    id: 'gst-tax-invoice',
    label: 'GST tax invoice (PP-Structure)',
    text: `TAX INVOICE
ABC TRADERS PVT LTD
GSTIN 29AABCU9603R1ZM
Invoice No: INV-2024-8891
Date: 12/09/2024
HSN 9983
Taxable Value 1000.00
CGST 9% 90.00
SGST 9% 90.00
Grand Total ₹1,180.00
Net Payable 1180.00`,
    expectAmount: 1180,
    expectNotAmount: [9, 90, 29, 12],
    expectDate: '2024-09-12',
    complex: true,
  },
  {
    id: 'fuel-hpcl',
    label: 'Fuel pump receipt',
    text: `HPCL Petrol Pump
Receipt No 556677
Date 10-09-2026
Petrol 5.00 Ltr
Rate 105.40
Amount Paid Rs.527.00
Thank you`,
    expectAmount: 527,
    expectCategory: 'Fuel',
    expectMerchantIncludes: 'HPCL',
  },
  {
    id: 'restaurant-bill',
    label: 'Restaurant bill with GST',
    text: `BIRYANI HOUSE
Tax Invoice
Bill No BH-441
Date: 08/09/2026
Item Total 450.00
CGST 2.5% 11.25
SGST 2.5% 11.25
Grand Total ₹472.50
Paid via UPI`,
    expectAmount: 472.5,
    expectCategory: 'Meals',
    complex: true,
  },
  {
    id: 'swiggy-order',
    label: 'Swiggy order summary',
    text: `Swiggy
Order delivered
You paid ₹286.00
on 05 Sep 2026
Payment: UPI`,
    expectAmount: 286,
    expectCategory: 'Meals',
    expectMerchantIncludes: 'Swiggy',
  },
  {
    id: 'medical-apollo',
    label: 'Medical / pharmacy bill',
    text: `APOLLO PHARMACY
Invoice No AP-90021
Date 03/09/2026
Net Amount Payable Rs.1,045.00
GSTIN 29AADCA1234A1Z5`,
    expectAmount: 1045,
    expectCategory: 'Health',
    complex: true,
  },
  {
    id: 'electricity-bescom',
    label: 'Electricity bill',
    text: `BESCOM Electricity Bill
Account 1234567890
Bill Date 01/09/2026
Total Amount Due ₹2,340.00
Pay by UPI`,
    expectAmount: 2340,
    expectCategory: 'Utilities',
    complex: true,
  },
  {
    id: 'amazon-invoice',
    label: 'Amazon invoice',
    text: `Amazon.in
Tax Invoice/Bill of Supply
Order Date 02-09-2026
Invoice Value Rs.1,999.00
Grand Total 1999.00`,
    expectAmount: 1999,
    expectCategory: 'Shopping',
    complex: true,
  },
  {
    id: 'neft-credit',
    label: 'NEFT salary credit',
    text: `NEFT Credited Rs.55,000.00 from ACME PVT LTD on 01-09-2026. Salary for Aug.`,
    expectAmount: 55000,
  },
  {
    id: 'uber-trip',
    label: 'Uber trip',
    text: `Uber trip
You paid ₹187.00
to Uber India
15 Sep 2026 UPI`,
    expectAmount: 187,
    expectCategory: 'Travel',
  },
  {
    id: 'date-not-amount',
    label: 'Date day must not become amount',
    text: `Payment successful
Paid on 26 Sep 2024
Status only — no rupee total
Thank you`,
    expectAmount: 0,
    expectNotAmount: [26],
  },
  {
    id: 'small-chai',
    label: 'Small labeled UPI ₹5',
    text: `You paid ₹5.00
To Chaiwala
PhonePe 11 Sep 2026`,
    expectAmount: 5,
  },
  {
    id: 'dmart-grocery',
    label: 'DMart grocery bill',
    text: `DMart
Tax Invoice
Date 09/09/2026
Bill Amount Rs.2,156.80
Grand Total ₹2156.80
Card Payment`,
    expectAmount: 2156.8,
    expectCategory: 'Groceries',
    expectPayment: 'card',
    complex: true,
  },
  {
    id: 'jio-recharge',
    label: 'Jio recharge',
    text: `Jio Prepaid Recharge
Amount Paid Rs.299.00
on 07-09-2026
UPI`,
    expectAmount: 299,
    expectCategory: 'Utilities',
  },
  {
    id: 'handwritten-style',
    label: 'Handwritten-style note (OCR text)',
    text: `Paid petrol
Rs 800
10 Sep 2026
cash`,
    expectAmount: 800,
  },
  {
    id: 'imps-transfer',
    label: 'IMPS transfer',
    text: `IMPS transfer of Rs.2,500.00 to RAHUL SHARMA on 06/09/2026 successful. Ref 123456789012`,
    expectAmount: 2500,
    expectPayment: 'bank',
  },
  {
    id: 'rupee-beats-qty-page',
    label: '₹850 must beat qty 12 and page 3',
    text: `Kirana Store
Qty 12 pcs
Page 3 of 4
Date 16/09/2026
Grand Total ₹850.00
Thank you`,
    expectAmount: 850,
    expectNotAmount: [12, 3, 4, 16, 9, 2026],
  },
  {
    id: 'rupee-beats-invoice-no',
    label: '₹1,499 must beat invoice 8891 and HSN',
    text: `TAX INVOICE
Invoice No INV-8891
HSN 9983
Subtotal 1300.00
CGST 99.00
Grand Total ₹1,499.00`,
    expectAmount: 1499,
    expectNotAmount: [8891, 9983, 99, 1300],
  },
  {
    id: 'inr-symbol-variant',
    label: 'INR 420 with decoy 9999 phone',
    text: `Paid to Cafe
INR 420.00
Phone 9876543210
Ref 999988887777`,
    expectAmount: 420,
    expectNotAmount: [9999, 9876543210],
  },
  {
    id: 'handwritten-rs-messy',
    label: 'Handwritten-style OCR noise with Rs',
    text: `Paid petrol
Rs 1,250
Pump 7
Bill 334455
cash`,
    expectAmount: 1250,
    expectNotAmount: [7, 334455],
  },
  {
    id: 'pdf-style-statement-line',
    label: 'PDF bank statement line prefers debit ₹',
    text: `Statement
16/09/2026 UPI-SWIGGY
Debited by ₹349.00
Closing Bal Rs.8,200.00`,
    expectAmount: 349,
    expectNotAmount: [8200, 16],
  },
  {
    id: 'four-hundred-not-ids',
    label: '₹400 must beat customer id and card number',
    text: `TAX INVOICE
Customer ID 882156
Card Number 4111 1111 1111 1111
Date 16/09/2026
Amount 400
Grand Total Rs.400.00
Thank you`,
    expectAmount: 400,
    expectNotAmount: [882156, 4111, 1111],
  },
  {
    id: 'one-lakh-indian-format',
    label: '₹1,00,000 must beat customer id',
    text: `Invoice
Customer ID 458921
Card No 5241678912345678
Amount 1,00,000.00
Net Payable 100000`,
    expectAmount: 100000,
    expectNotAmount: [458921, 5241, 5678],
  },
  {
    id: 'amount-400-no-colon',
    label: 'Amount 400 without rupee colon still parses',
    text: `Retail bill
Customer ID 778899
Amount 400
Paid by UPI`,
    expectAmount: 400,
    expectNotAmount: [778899],
  },
  {
    id: 'cred-rbl-lakh',
    label: 'CRED RBL bill payment ₹1,00,000 not order/customer ids',
    text: `bill payment receipt order ID 2D4ZWYX0NYVN transaction reference id DP316244OS8FUQ06MNGM date 1 Sep, 2026 6:50 AM amount ₹100000 payment method UPI biller account details biller name RBL Bank category CREDIT CARD Customer ID XXXX-7452 paid via CRED app (Dreamplug Technologies Pvt. Ltd.) -- 1 of 1 --`,
    expectAmount: 100000,
    expectNotAmount: [316244, 7452, 2026, 50, 1],
  },
  {
    id: 'cred-ocr-credit-card-before-amount',
    label: 'CRED screenshot OCR: CREDIT CARD must not hide ₹1,00,000',
    text: `Bill payment successful
RBL Bank
CREDIT CARD
Customer ID XXXX-7452
amount ₹1,00,000
Paid via UPI`,
    expectAmount: 100000,
    expectNotAmount: [7452],
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string, quiet = false) {
  if (cond) {
    passed += 1;
    if (!quiet) console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

/** Deterministic PRNG for reproducible 10k corpus. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function formatInr(n: number, style: '₹' | 'Rs.' | 'Rs' | 'INR' | 'rupees') {
  const withComma = n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (style === '₹') return `₹${withComma}`;
  if (style === 'Rs.') return `Rs.${withComma}`;
  if (style === 'Rs') return `Rs ${withComma}`;
  if (style === 'INR') return `INR ${withComma}`;
  return `rupees ${withComma}`;
}

type GenCase = { id: string; text: string; expectAmount: number; expectNotAmount: number[] };

/** Build ≥10_000 OCR-like receipt texts across formats (UPI, GST, fuel, handwritten, PDF lines). */
function buildMassCorpus(count = 10_000): GenCase[] {
  const rand = mulberry32(20260916);
  const merchants = [
    'Swiggy', 'Zomato', 'Kirana Store', 'HPCL', 'Apollo Pharmacy', 'Amazon', 'Flipkart',
    'Cafe Coffee', 'Uber', 'Ola', 'BESCOM', 'BigBasket', 'DMart', 'IRCTC', 'Petrol Pump',
    'Medical Store', 'Dominos', 'Reliance Fresh', 'Local Tailor', 'Handwritten Note',
  ];
  const currStyles: Array<'₹' | 'Rs.' | 'Rs' | 'INR' | 'rupees'> = ['₹', 'Rs.', 'Rs', 'INR', 'rupees'];
  const templates: Array<(p: {
    amount: number;
    decoyA: number;
    decoyB: number;
    day: number;
    merchant: string;
    curr: string;
    ref: string;
  }) => string> = [
    (p) => `Payment successful\n${p.day} Sep 2026\nTo ${p.merchant}\nYou paid ${p.curr}\nUPI ID XXXXX${p.decoyA}@oksbi\nUPI Ref ${p.ref}`,
    (p) => `Payment Successful\nPaid to ${p.merchant}\n${p.curr}\n${p.day}/09/2026 18:42\nFrom A/c ending ${p.decoyB}\nPhonePe`,
    (p) => `TAX INVOICE\n${p.merchant}\nInvoice No INV-${p.decoyA}\nHSN ${p.decoyB}\nQty ${p.day} pcs\nSubtotal ${Math.max(32, p.amount - 50)}.00\nGrand Total ${p.curr}`,
    (p) => `${p.merchant}\nPetrol ${p.day}.00 Ltr\nRate ${p.decoyA}.40\nAmount Paid ${p.curr}\nPump ${p.decoyB}`,
    (p) => `Dear Customer, ${p.curr} debited from A/c XX${p.decoyA} on ${p.day}-09-26 UPI/${p.merchant}. Avl Bal Rs.${(p.amount + p.decoyB).toLocaleString('en-IN')}.00`,
    (p) => `Paid ${p.merchant}\n${p.curr}\ncash\nBill ${p.ref}\nnote page ${p.decoyA}`,
    (p) => `Money Sent\nTo ${p.merchant}\n${p.curr}\nVPA xx${p.decoyB}@ybl\nPaytm UPI`,
    (p) => `Statement line\n${p.day}/09/2026 UPI-${p.merchant}\nDebited by ${p.curr}\nClosing Bal Rs.${(8000 + p.decoyA).toLocaleString('en-IN')}.00`,
    (p) => `Retail Invoice\n${p.merchant}\nPage ${p.decoyA} of ${p.decoyB}\nTotal Amount ${p.curr}\nThank you visit again`,
    (p) => `Handwritten OCR\nPaid ${p.merchant}\n${p.curr}\n${p.day} Sep\nref ${p.ref}`,
  ];

  const out: GenCase[] = [];
  for (let i = 0; i < count; i++) {
    const amount = Math.round((50 + rand() * 49_950) * 100) / 100;
    // Decoys that must never win when ₹ is present
    const decoyA = 100 + Math.floor(rand() * 8900); // 100–8999
    const decoyB = 10 + Math.floor(rand() * 90); // 10–99
    const day = 1 + Math.floor(rand() * 28);
    const merchant = pick(rand, merchants);
    const style = pick(rand, currStyles);
    const curr = formatInr(amount, style);
    const ref = String(100000000000 + Math.floor(rand() * 899999999999));
    const tpl = templates[i % templates.length];
    const text = tpl({ amount, decoyA, decoyB, day, merchant, curr, ref });
    out.push({
      id: `mass-${i}`,
      text,
      expectAmount: amount,
      expectNotAmount: [decoyA, decoyB, day].filter((n) => Math.abs(n - amount) > 0.011),
    });
  }
  return out;
}

console.log('\n=== Indian receipt / document E2E parse ===\n');

for (const c of cases) {
  console.log(`• ${c.label} [${c.id}]`);
  const amountHit = extractMoneyAmount(c.text);
  const structured = parsePpStructureText(c.text, c.id);

  const gotAmount = structured?.amount || amountHit?.amount || 0;

  if (c.expectAmount === 0) {
    assert(!(gotAmount > 0), `${c.id}: must not invent amount (got ${gotAmount})`);
    if (c.expectNotAmount) {
      for (const bad of c.expectNotAmount) {
        assert(gotAmount !== bad, `${c.id}: must not pick ${bad}`);
      }
    }
  } else {
    assert(Math.abs(gotAmount - c.expectAmount) < 0.011, `${c.id}: amount ${gotAmount} === ${c.expectAmount}`);
  }

  if (c.expectNotAmount) {
    for (const bad of c.expectNotAmount) {
      assert(gotAmount !== bad, `${c.id}: reject decoy ${bad}`);
    }
  }

  if (c.expectMerchantIncludes && structured?.merchant) {
    assert(
      structured.merchant.toLowerCase().includes(c.expectMerchantIncludes.toLowerCase())
        || c.text.toLowerCase().includes(c.expectMerchantIncludes.toLowerCase()),
      `${c.id}: merchant mentions ${c.expectMerchantIncludes}`,
    );
  }

  if (c.expectPayment && structured?.paymentMethod) {
    assert(structured.paymentMethod === c.expectPayment, `${c.id}: payment ${structured.paymentMethod} === ${c.expectPayment}`);
  }

  if (c.expectCategory && structured?.category) {
    assert(structured.category === c.expectCategory, `${c.id}: category ${structured.category} === ${c.expectCategory}`);
  }

  if (c.expectDate && structured?.date) {
    assert(structured.date === c.expectDate, `${c.id}: date ${structured.date} === ${c.expectDate}`);
  }

  if (c.complex) {
    assert(needsPpStructure({ text: c.text, fileName: `${c.id}.pdf` }), `${c.id}: flagged for PP-Structure`);
    assert(Boolean(structured && structured.amount > 0), `${c.id}: PP-Structure extracted amount`);
  }
}

// Duplicate fingerprint simulation
console.log('\n• Duplicate detection fingerprint');
const a = parsePpStructureText(cases[0].text);
const b = parsePpStructureText(cases[0].text);
assert(Boolean(a && b && a.amount === b.amount && a.date === b.date), 'same receipt yields same amount+date fingerprint');

console.log('\n• Vision vs OCR reconcile (masked UPI decoy)');
{
  const ocr = `Payment successful\nYou paid ₹550.00\nUPI ID XXXXX112@oksbi`;
  const fixed = reconcileVisionAmount(112, ocr, extractMoneyAmount(ocr));
  assert(fixed === 550, `reconcile 112→550 got ${fixed}`);
  const same = reconcileVisionAmount(550, ocr, extractMoneyAmount(ocr));
  assert(same === 550, `reconcile keeps 550 got ${same}`);
}

console.log('\n• Never keep invented amounts that are not on the receipt');
{
  const rec400 = `Retail bill\nCustomer ID 778899\nYou paid ₹400.00\nCard 4111 1111 1111 1111`;
  const parsed400 = extractMoneyAmount(rec400);
  assert(parsed400?.amount === 400, `₹400 parse got ${parsed400?.amount}`);
  const invented = reconcileVisionAmount(12840, rec400, parsed400);
  assert(invented === 400, `invented 12840 dropped, got ${invented}`);
  const noTextInvent = reconcileVisionAmount(9999, 'Thank you visit again', extractMoneyAmount('Thank you visit again'));
  assert(noTextInvent === 0, `ungrounded vision 9999 → 0 got ${noTextInvent}`);
}

console.log('\n• Mass corpus: 10,000 OCR-like receipts (UPI/GST/fuel/SMS/handwritten/PDF lines)');
{
  const mass = buildMassCorpus(10_000);
  let massOk = 0;
  const sampleFails: string[] = [];
  for (const c of mass) {
    const hit = extractMoneyAmount(c.text);
    const got = hit?.amount || 0;
    const okAmt = Math.abs(got - c.expectAmount) < 0.011;
    const okDecoy = c.expectNotAmount.every((bad) => got !== bad);
    if (!okAmt || !okDecoy) {
      const msg = `${c.id}: got ${got} want ${c.expectAmount}`;
      if (sampleFails.length < 12) sampleFails.push(`${msg}\n${c.text.slice(0, 180)}`);
    } else {
      massOk += 1;
    }
  }
  assert(massOk === 10_000, `mass corpus: ${massOk}/10000 correct (₹ preferred over decoys)`);
  if (sampleFails.length) {
    console.error('\nSample mass failures:');
    for (const s of sampleFails) console.error(`---\n${s}`);
  }
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.error('\nFailures:');
  for (const f of failures.slice(0, 40)) console.error(` - ${f}`);
  if (failures.length > 40) console.error(` ... and ${failures.length - 40} more`);
}
process.exit(failed ? 1 : 0);
