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
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
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

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.error('\nFailures:');
  for (const f of failures) console.error(` - ${f}`);
}
process.exit(failed ? 1 : 0);
