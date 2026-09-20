/**
 * Regression: mixed UPI / bank / international payment receipts.
 */
import {
  extractMoneyAmount,
  extractMoneyEntries,
} from '../src/lib/amount-parse.ts';

type Case = {
  name: string;
  text: string;
  want: number | number[];
  merchants?: string[];
  note?: string;
};

const cases: Case[] = [
  {
    name: 'ScanPay RM 15',
    want: 15,
    merchants: ['MUHAMMADHELMIBINMOHDISA'],
    text: `Payment successful
RM 15.00
MUHAMMADHELMIBINMOHDISA
Reference ID 05556064
Date & time 31 Mar 2024, 3:43 PM
Transaction type Scan & Pay
Share Receipt Done`,
  },
  {
    name: 'Breadfast EGP Total not items',
    want: 190,
    merchants: ['Breadfast'],
    text: `Breadfast
Order #2020-00108289
Thank you for ordering from Breadfast.
Product Qty Price Total
Nefertoot Raspberries 1 160.00 160.00
Subtotal EGP 160.00
Delivery EGP 25.00
Service Fees EGP 5.00
Payment method Cash On Delivery
Total EGP 190.00
VAT value of 0 EGP is already included`,
  },
  {
    name: 'Paytm 20000 Pushpa',
    want: 20000,
    merchants: ['Pushpa'],
    text: `paytm PAYMENT RECEIPT
Payment Successful
₹20,000
Rupees Twenty Thousand Only
To: Pushpa .
A/c XX 6300
From: Chakshu Raghuvanshi
Paytm Payments Bank A/c XX 1537
IMPS Ref ID: 2204H503hLYJ
13 Oct, 03:18 PM`,
  },
  {
    name: 'PIPAL SINGH Total Payment',
    want: 2687,
    merchants: ['PIPAL SINGH'],
    text: `Cash Payments Collected
PIPAL SINGH
Receipt No. M150865015
LAN P31JPRP7209792
Receipt Date 21-06-2025 05:43:50 PM
Total Payment ₹ 2687.00
EMI Collected ₹ 0.00
Charges Collected ₹ 0.00
Payment Source CASH`,
  },
  {
    name: 'upaisa Total Amount',
    want: 1600,
    merchants: ['DANIYAL JAMEEL'],
    text: `upaisa
Transaction Successful
Transaction Receipt
Transaction ID 354116275541
Date 10/01/2026 00:12
Transaction Type Other Wallets
Receiver Name DANIYAL JAMEEL
Bank Easypaisa Bank Limited
Receiver A/C No 03336667163
Amount Rs. 1,600
Fee Rs. 0
Total Amount Rs. 1,600`,
  },
  {
    name: 'GPay GoodenGates 50',
    want: 50,
    merchants: ['GoodenGates'],
    text: `₹ 50
Paid to GoodenGates
Agathiyan Essay - Dream India Competition
Paid ₹ 50
Sep 30, 2020 8:19 AM
UPI Transaction ID 027408475429
Google Transaction ID CICAgKC1puHfUg
From PRIYADHARSHINI S R
priyausend@oksbi
To Ending in .... 6390
G Pay`,
  },
  {
    name: 'TVSCREDIT Collected amount',
    want: 5049,
    merchants: ['TVSCREDIT', 'MUNNAKUMAR'],
    text: `TVSCREDIT
Receipt of Collection
Agreement no BR3058TW0222211
Customer name Mr.MUNNAKUMAR
Receipt no 100023
Receipt date 04-11-2023 14_48
Collected amount 5049.0
Collected amount in words five thousand forty nine rupees only
Mode of payment Cash
Collector Name Nandan Kumar Singh`,
  },
  {
    name: 'Indian Curry AMT 309',
    want: 309,
    text: `Indian Curry Place
RECEIPT 564
DATE 25/02/2021
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
    name: 'Prabhu Bank NPR 10000',
    want: 10000,
    text: `PRABHU BANK
Payment Receipt
Amount (NPR) 10,000.00
Date/Time 10 Apr 2026, 07:24 pm
Service Name INTERNAL FUND TRANSFER
Status SUCCESS
Reference Code 159838058
Thank you, Prabhu Bank`,
  },
  {
    name: 'Eastern power Amount Paid',
    want: 142,
    text: `Eastern power
PAYMENT RECEIPT
Transaction No PYTM25329167167
Consumer No 121101K047003986
Date 25-11-2025
Received From MACHARLASAI LAKSHMI
Bill Amount 142
RC Amount 0
Amount Paid 142.00
Contact Info Call center 1912`,
  },
  {
    name: 'UPI History multi skip failed',
    want: [1, 195, 10],
    merchants: ['Partha Sarathi Das', 'Sujeet Kumar Nagar', 'WinZO'],
    note: 'only successful received/sent/paid — not Failed rows',
    text: `Balance & History
Payment History
Received from Partha Sarathi Das
Today, 10:52 PM
+ ₹1
Received In
Money transfer failed to Sujeet Kumar Nagar
Today, 07:36 PM
₹99
Failed
Money sent to Sujeet Kumar Nagar
Today, 07:36 PM
- ₹195
Sent From
Money transfer failed to Sujeet Kumar Nagar
Today, 07:35 PM
₹800
Failed
Money transfer failed to Vivek Kumar
Today, 07:33 PM
₹800
Failed
Money transfer failed to Vivek Kumar
Today, 06:47 PM
₹1
Failed
Paid to WinZO
11 Feb, 11:09 AM
- ₹10
Paid from`,
  },
  {
    name: 'AYA PAY Total MMK',
    want: 18000,
    text: `AYA PAY
E-Receipt
YESCEM Bill Payment
Transaction Code 256303819204
Transaction Status done
Amount 17,900 MMK
Fee 100 MMK
Total Amount 18,000 MMK
Powered by AYA Bank`,
  },
  {
    name: 'GPay Sarifa 1 crore',
    want: 10000000,
    merchants: ['Sarifa Begum'],
    text: `G Pay
Payment successful
₹1,00,00,000
Rupees One Crore Only
Sarifa Begum
sarifa.begum@okhdfcbank
Paid to Sarifa Begum
UPI ID sarifa.begum@okhdfcbank
Date & time 17 July 2026, 7:20 PM
UPI transaction ID 312626113255
Share receipt`,
  },
];

function almost(a: number, b: number) {
  return Math.abs(a - b) < 0.05;
}

function merchantOk(got: string, wants?: string[]) {
  if (!wants?.length) return true;
  const g = got.toLowerCase();
  return wants.some((w) => g.includes(w.toLowerCase().slice(0, 12)));
}

let fail = 0;
for (const c of cases) {
  const entries = extractMoneyEntries(c.text);
  const one = extractMoneyAmount(c.text);
  const got = entries.length > 1 ? entries.map((e) => e.amount) : one ? [one.amount] : [];
  const want = Array.isArray(c.want) ? c.want : [c.want];
  let ok = want.length === got.length && want.every((w, i) => almost(w, got[i]));
  if (ok && c.merchants && entries.length) {
    ok = entries.every((e, i) => merchantOk(e.merchant, c.merchants) || merchantOk(e.merchant, [c.merchants![Math.min(i, c.merchants!.length - 1)]]));
    // For multi, check pairwise if merchants length matches
    if (c.merchants.length === entries.length) {
      ok = entries.every((e, i) => merchantOk(e.merchant, [c.merchants![i]]));
    } else if (entries.length === 1) {
      ok = merchantOk(entries[0].merchant, c.merchants);
    }
  }
  if (!ok) fail += 1;
  console.log(
    ok ? 'OK  ' : 'FAIL',
    c.name.padEnd(36),
    'got',
    got.length ? got.map((g) => Number(g.toFixed(2))) : 'NULL',
    'merchants',
    entries.map((e) => e.merchant || '-').join(' | ') || (one?.merchant || '-'),
    'want',
    want,
    c.note || '',
  );
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
