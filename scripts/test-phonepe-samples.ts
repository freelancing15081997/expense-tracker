import { extractMoneyAmount, extractMoneyEntries } from '../src/lib/amount-parse.ts';

const samples: Array<[string, string]> = [
  [
    'apollo',
    `Transaction Successful
18 September 2026 at 9:04 PM
Paid to
APOLLO PHARMACY
APOLLOPHARMACYOFFLINE@ybl
₹164
Payment Details
Message Payment for 154561300016544539
PhonePe Transaction ID T2609182104039831994632
Debited from Badrinath
₹164
UTR 590641031504`,
  ],
  [
    'sharadha',
    `Transaction Successful
19 September 2026 at 9:57 PM
Paid to
Sharadha Medicals
Q135994664@ybl
₹10
PhonePe Transaction ID T2609192157196424876447
Debited from Badrinath
₹10
UTR 308464448116`,
  ],
  [
    'history',
    `History
Sep 2026 ₹1,54,010.75
Paid to
S CHAND BASHA
₹30
2 hours ago Debited from
Paid to
S CHAND BASHA
₹150
2 hours ago Debited from
Paid to
Nunna Mahesh Car
₹1,000
Yesterday Debited from
Paid to
Sharadha Medicals
₹10
Yesterday Debited from
Paid to
JAYA LAKSHMI MEDICAL AND GE
₹80
Yesterday Debited from`,
  ],
  ['flat-apollo', 'Paid to APOLLO PHARMACY APOLLOPHARMACYOFFLINE@ybl ₹164 Debited from Badrinath ₹164'],
  ['ocr-rs10', 'Paid to Sharadha Medicals Q135994664@ybl Rs 10 Debited from'],
];

for (const [name, text] of samples) {
  const one = extractMoneyAmount(text);
  const multi = extractMoneyEntries(text);
  console.log(
    name,
    'one=',
    one ? { a: one.amount, m: one.merchant, s: one.score } : null,
    'entries=',
    multi.map((e) => ({ a: e.amount, m: e.merchant })),
  );
}
