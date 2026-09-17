import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { signedBalance } from '../../engine/chartOfAccounts';
import { reconWorksheet } from '../../reporting/statements';
import { parseBankCsv } from '../../reporting/bankCsv';
import { btnGhost, Card, DateField, Field, FileField, IconBtn, inputClass, Kpi, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { BankTxn } from '../../core/types';

type Tab = 'recon' | 'move' | 'import' | 'rules';

export default function Banking() {
  const books = useBooks();
  const { postingAccounts, bankTxns, bankRules, currency, can, transfer, createBankTxn, importBankTxns, reconcileTxn, postJournal, createBankRule } = books;
  const banks = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const cashOrAsset = banks.length ? banks : postingAccounts.filter((a) => a.type === 'asset');
  const [tab, setTab] = useState<Tab>('recon');
  const [accountId, setAccountId] = useState(cashOrAsset.find((a) => a.systemKey === 'bank')?.id || cashOrAsset[0]?.id || '');
  const [fromAccountId, setFrom] = useState(cashOrAsset.find((a) => a.systemKey === 'bank')?.id || cashOrAsset[0]?.id || '');
  const [toAccountId, setTo] = useState(cashOrAsset.find((a) => a.systemKey === 'cash')?.id || cashOrAsset[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('Bank transfer');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnMemo, setTxnMemo] = useState('');
  const [statement, setStatement] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [ruleContains, setRuleContains] = useState('');
  const [ruleAccountId, setRuleAccountId] = useState('');

  const account = cashOrAsset.find((a) => a.id === accountId) || cashOrAsset[0];
  const bookBalance = account ? signedBalance(account) : 0;
  const accountTxns = useMemo(
    () => bankTxns.filter((t) => !account || t.accountId === account.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || ''))),
    [account, bankTxns],
  );
  const visibleTxns = filter === 'open' ? accountTxns.filter((t) => !t.reconciled) : accountTxns;
  const statementMinor = (() => {
    try {
      return statement.trim() ? parseMoney(statement) : 0;
    } catch {
      return null;
    }
  })();
  const sheet = reconWorksheet(bookBalance, statementMinor || 0, accountTxns);
  const balanced = statementMinor != null && statement.trim() !== '' && sheet.difference === 0;

  return (
    <PageShell title="Banking" subtitle="Reconcile statement to books. Transfers and CSV post journals. Live bank feeds are not connected.">
      <div className="flex flex-wrap gap-2">
        {([['recon', 'Reconcile'], ['move', 'Transfer / journal'], ['import', 'CSV import'], ['rules', 'Matching rules']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-9 px-3 rounded-lg text-sm font-semibold ${tab === id ? 'bg-[#0B1F3A] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {(error || ok) && (
        <p className={`text-sm ${error ? 'text-rose-600' : 'text-emerald-700'}`}>{error || ok}</p>
      )}

      {tab === 'recon' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Account">
              <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <Field label={`Statement balance (${currency})`}>
              <input className={inputClass} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="0.00" />
            </Field>
            <Kpi label="Book balance"><Money minor={bookBalance} currency={currency} /></Kpi>
            <Kpi label={balanced ? 'Difference (balanced)' : 'Difference'}>
              <span className={sheet.difference === 0 && statement.trim() ? 'text-emerald-700' : 'text-rose-700'}>
                <Money minor={sheet.difference} currency={currency} />
              </span>
            </Kpi>
          </div>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Statement balance</span><Money minor={statementMinor || 0} currency={currency} /></div>
            <div className="flex justify-between"><span>Book balance</span><Money minor={bookBalance} currency={currency} /></div>
            <div className="flex justify-between"><span>Outstanding deposits (in books, not on statement)</span><Money minor={sheet.deposits} currency={currency} /></div>
            <div className="flex justify-between"><span>Outstanding withdrawals</span><Money minor={sheet.withdrawals} currency={currency} /></div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-2">
              <span>Cleared book (book − outstanding)</span>
              <Money minor={sheet.clearedBook} currency={currency} />
            </div>
            <p className="text-xs text-slate-500">
              Difference = statement − cleared book. Complete only when this is zero. Tick items that appear on the bank statement.
            </p>
            <p className={`text-sm font-semibold ${balanced ? 'text-emerald-700' : 'text-slate-600'}`}>
              {statement.trim() === '' ? 'Enter the statement ending balance to start.' : balanced ? 'Reconciliation is balanced.' : 'Reconciliation is not complete while a difference remains.'}
            </p>
          </Card>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" className={filter === 'open' ? 'byjan-btn' : 'byjan-btn-ghost'} onClick={() => setFilter('open')}>Outstanding</button>
              <button type="button" className={filter === 'all' ? 'byjan-btn' : 'byjan-btn-ghost'} onClick={() => setFilter('all')}>All</button>
            </div>
            {can('post') && visibleTxns.some((t) => !t.reconciled) && (
              <button
                type="button"
                className="byjan-btn-ghost"
                onClick={() => {
                  void Promise.all(visibleTxns.filter((t) => !t.reconciled).slice(0, 25).map((t) => reconcileTxn(t)));
                }}
              >
                Mark page reconciled
              </button>
            )}
          </div>
          <PagedTable<BankTxn> rows={visibleTxns} empty="No bank journals for this account." pageSize={15}>
            {(slice) => (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Memo</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5">{row.date}</td>
                      <td className="px-4 py-2.5">{row.memo}</td>
                      <td className="px-4 py-2.5 text-right"><Money minor={row.amountMinor} currency={currency} /></td>
                      <td className="px-4 py-2.5"><Status value={row.reconciled ? 'reconciled' : 'open'} /></td>
                      <td className="px-4 py-2.5 text-right">
                        {can('post') && (
                          <button className={btnGhost} onClick={() => void reconcileTxn(row)}>{row.reconciled ? 'Unreconcile' : 'Clear'}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PagedTable>
        </>
      )}

      {tab === 'move' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Transfer</h2>
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setBusy(true);
                  setError('');
                  setOk('');
                  await transfer({ fromAccountId, toAccountId, amountMinor: parseMoney(amount), date, memo });
                  setOk('Transfer posted.');
                  setAmount('');
                } catch (err: any) {
                  setError(err.message || 'Transfer failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="From">
                <select className={inputClass} value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
                  {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </Field>
              <Field label="To">
                <select className={inputClass} value={toAccountId} onChange={(e) => setTo(e.target.value)}>
                  {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </Field>
              <Field label={`Amount (${currency})`}><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
              <Field label="Date"><DateField value={date} onChange={setDate} /></Field>
              <Field label="Memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
              <IconBtn action="post" type="submit" busy={busy} disabled={!can('post')}>{busy ? 'Posting transfer' : 'Post transfer'}</IconBtn>
            </form>
          </Card>
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Bank journal</h2>
            <p className="text-xs text-slate-500 mb-3">Positive = deposit. Negative = withdrawal.</p>
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setError('');
                  setOk('');
                  await createBankTxn({ accountId, date, amountMinor: parseMoney(txnAmount), memo: txnMemo });
                  setTxnAmount('');
                  setTxnMemo('');
                  setOk('Bank journal posted.');
                } catch (err: any) {
                  setError(err.message || 'Bank journal failed');
                }
              }}
            >
              <Field label="Account">
                <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </Field>
              <Field label="Signed amount"><input className={inputClass} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} required /></Field>
              <Field label="Memo"><input className={inputClass} value={txnMemo} onChange={(e) => setTxnMemo(e.target.value)} required /></Field>
              <IconBtn action="post" disabled={!can('post')}>Post bank journal</IconBtn>
            </form>
          </Card>
          <Card className="p-4 lg:col-span-2">
            <h2 className="font-semibold mb-2">Opening balance</h2>
            <p className="text-xs text-slate-500 mb-3">Posts Bank Dr / Retained earnings Cr. Use once per account for books that start mid-year.</p>
            <form
              className="grid md:grid-cols-4 gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setBusy(true);
                  setError('');
                  const equity = postingAccounts.find((a) => a.systemKey === 'retained_earnings');
                  if (!equity) throw new Error('Retained earnings account is missing');
                  const minor = parseMoney(openingAmount);
                  await postJournal({
                    date,
                    description: 'Opening balance',
                    lines: [
                      { accountId, debitMinor: minor, creditMinor: 0, memo: 'Opening balance' },
                      { accountId: equity.id, debitMinor: 0, creditMinor: minor, memo: 'Opening equity' },
                    ],
                  });
                  setOpeningAmount('');
                } catch (err: any) {
                  setError(err.message || 'Opening balance failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Bank account">
                <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </Field>
              <Field label={`Amount (${currency})`}><input className={inputClass} value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} required /></Field>
              <Field label="Date"><DateField value={date} onChange={setDate} /></Field>
              <div className="flex items-end"><IconBtn action="post" disabled={busy || !can('post')}>Post opening</IconBtn></div>
            </form>
          </Card>
        </div>
      )}

      {tab === 'import' && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">CSV statement import</h2>
          <p className="text-sm text-slate-500 mb-3">Posts up to 50 rows as bank journals on the selected account, then refreshes once. Not a live bank feed.</p>
          <Field label="Post to">
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {cashOrAsset.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <div className="mt-3">
            <FileField
              label="Statement CSV"
              hint="Date + Amount, or Debit/Credit · 50 rows max"
              accept=".csv,text/csv"
              onFiles={async (picked) => {
                const file = picked[0];
                if (!file) return;
                try {
                  setCsvBusy(true);
                  setError('');
                  setOk('');
                  if (!can('post')) throw new Error('You cannot post bank journals');
                  const rows = parseBankCsv(await file.text()).map((row) => ({ ...row, accountId }));
                  const posted = await importBankTxns(rows);
                  setOk(`Posted ${posted} row${posted === 1 ? '' : 's'}. Reconcile them against the statement.`);
                  setTab('recon');
                } catch (err: any) {
                  setError(err.message || 'CSV import failed');
                } finally {
                  setCsvBusy(false);
                }
              }}
            />
          </div>
          {csvBusy && <p className="text-sm text-slate-500 mt-2">Posting CSV rows…</p>}
        </Card>
      )}

      {tab === 'rules' && (
        <Card className="p-4 space-y-4">
          <p className="text-sm text-slate-600">If a statement memo contains the phrase, the journal uses that expense/income account instead of the default operating expense. Not a live bank feed.</p>
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                await createBankRule({ contains: ruleContains, clearingAccountId: ruleAccountId || postingAccounts[0]?.id });
                setRuleContains('');
              } catch (err: any) {
                setError(err.message || 'Could not save rule');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Memo contains">
              <input className={inputClass} value={ruleContains} onChange={(e) => setRuleContains(e.target.value)} placeholder="UBER, AWS, rent" required />
            </Field>
            <Field label="Post against">
              <select className={inputClass} value={ruleAccountId || postingAccounts.find((a) => a.systemKey === 'operating_expense')?.id || ''} onChange={(e) => setRuleAccountId(e.target.value)}>
                {postingAccounts.filter((a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'revenue' || a.type === 'other_income').map((a) => (
                  <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end"><IconBtn action="create" type="submit" busy={busy} disabled={!can('create')}>{busy ? 'Saving rule' : 'Save rule'}</IconBtn></div>
          </form>
          {bankRules.length === 0 ? (
            <p className="text-sm text-slate-500">No matching rules yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 font-medium">Contains</th>
                  <th className="py-2 font-medium">Account</th>
                </tr>
              </thead>
              <tbody>
                {bankRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{rule.contains}</td>
                    <td className="py-2">{postingAccounts.find((a) => a.id === rule.clearingAccountId)?.name || rule.clearingAccountId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </PageShell>
  );
}
