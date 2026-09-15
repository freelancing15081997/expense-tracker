/**
 * Quick self-test for spreadsheet → ledger rows.
 * Run: npx tsx scripts/excel-ledger-test.ts
 */
import { parseSpreadsheetBuffer } from '../api/_lib/excel-ledger.ts';

async function main() {
  const csv = [
    'Date,Type,Merchant,Amount,Category',
    '2026-09-01,out,Swiggy,450,Meals',
    '2026-09-02,in,Salary,80000,Income',
    '2026-09-03,transfer,Self,1000,Transfer',
    '2026-09-04,Debit,Electricity,2340,Utilities',
  ].join('\n');
  const b64 = Buffer.from(csv, 'utf8').toString('base64');
  const result = await parseSpreadsheetBuffer({
    base64: b64,
    mimeType: 'text/csv',
    fileName: 'test.csv',
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.rows.length < 4) throw new Error(`Expected >=4 rows, got ${result.rows.length}`);
  if (result.rows[0].entryType !== 'out') throw new Error('row0 should be out');
  if (result.rows[1].entryType !== 'in') throw new Error('row1 should be in');
  if (result.rows[2].entryType !== 'transfer') throw new Error('row2 should be transfer');
  console.log('excel-ledger-test: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
