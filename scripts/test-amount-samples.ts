import {
  extractMoneyAmount,
  extractMoneyEntries,
} from '../src/lib/amount-parse.ts';

const samples: Array<[string, string, number | number[]]> = [
  ['CRED 18685', `bill payment receipt
order ID 2WG1L52256Z3
transaction reference id DP015238155824oCyYRb
date 26 Aug, 2025 3:58 PM
amount ₹18685.04
payment method UPI
biller name ICICI Bank
category CREDIT CARD
Customer ID XXXX-5008
paid via CRED app`, 18685.04],
  ['CRED 100000', `bill payment receipt
order ID 2D4ZWYX0NYVN
amount ₹100000
payment method UPI
biller name RBL Bank
Customer ID XXXX-7452`, 100000],
  ['CRED 182961', `bill payment receipt
amount ₹182961
payment method UPI
biller name IndusInd Bank
Customer ID XXXX-0600`, 182961],
  ['PhonePe 550', `Transaction Successful
Paid to
S CHAND BASHA
Vyapar.********0112@hdfcbank
₹550
Debited from
Nagaveni
UTR: 493604088625
₹550`, 550],
  ['PhonePe 1000', `Transaction Successful
Paid to
Nunna Mahesh Car
+919966021112
₹1,000
Debited from Badrinath
UTR: 129370881060
₹1,000`, 1000],
  ['GPay 400 not 10', `RONTE VENKANNA
₹400
12 Sept, 10:42 pm
claim ₹10 cashback
EXPIRES IN 7 DAYS`, 400],
  ['Handwritten multi', `Seenu - Rs 1016 /-
Raghu - Rs 5016 /-`, [1016, 5016]],
  ['CRED no rupee OCR', `amount 18685.04
payment method UPI
biller ICICI`, 18685.04],
  ['CRED amount 4 junk', `amount 4 18685.04
payment method UPI`, 18685.04],
  ['Customer ID trap', `Customer ID XXXX-7452
amount ₹100000`, 100000],
  ['Rapido not download2025', `PhonePe
Transaction Successful
Paid to
Rapido
₹150
phon.pe/download2025`, 150],
  ['Medical paid-to amount then name', `Transaction Successful
Paid to
1,007
SREEVEERABHADRA SWAMY MEDICAL
balakumari
Debited from
₹1,007`, 1007],
  ['CRED Axis payable not customer id', `CRED
bill payment
amount ₹484.25
biller name Axis Bank
Customer ID XXXX-6173`, 484.25],
  ['GPay 7400 is 400', `GPay
RONTE VENKANNA
7400
12 Sept, 10:42 pm
claim ₹10 cashback`, 400],
  ['Seenapujari 1000', `Transaction Successful
Paid to
Seenapujari
1,000
Debited from
₹1,000`, 1000],
  ['PhonePe history rows', `History
Paid to
S CHAND BASHA
30
Paid to
Nunna Mahesh Car
10
Paid to
Rapido
80
Paid to
Foo Bar
150
Paid to
Baz Qux
1000
Sep 2026 ₹1,54,010.75`, [30, 10, 80, 150, 1000]],
];

let fail = 0;
for (const [name, text, expect] of samples) {
  const all = extractMoneyEntries(text);
  const one = extractMoneyAmount(text);
  const got = all.length > 1 ? all.map((a) => a.amount) : (one ? [one.amount] : []);
  const want = Array.isArray(expect) ? expect : [expect];
  const ok = want.length === got.length && want.every((w, i) => Math.abs(w - got[i]) < 0.001);
  if (!ok) fail += 1;
  console.log(ok ? 'OK ' : 'FAIL', name, 'got', got, 'want', want, one ? `score=${one.score}` : '');
}
process.exit(fail ? 1 : 0);

