import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { AccountType } from '../../core/types';

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense', 'other_income', 'other_expense'];

export default function Accounts() {
  const { accounts, currency, can, createAccount } = useBooks();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      await createAccount({ code, name, type, parentId: parentId || null });
      setOpen(false);
      setCode('');
      setName('');
    } catch (err: any) {
      setError(err.message || 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Chart of Accounts"
      subtitle="Hierarchical accounts. Parent accounts cannot be posted to."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>Add account</button>}
    >
      {open && (
        <Card className="p-4">
          <form className="grid md:grid-cols-4 gap-3" onSubmit={submit}>
            <Field label="Code"><input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6000.50" required /></Field>
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Type">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Parent">
              <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">None</option>
                {accounts.filter((a) => !a.allowPosting).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <div className="md:col-span-4 flex gap-2 items-center">
              <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      <PagedTable rows={accounts} empty="No accounts yet.">
        {(slice) => (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((account) => (
                  <tr key={account.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{account.code}</td>
                    <td className="px-4 py-2.5">
                      {account.allowPosting ? (
                        <Link to={`/books/ledger/${account.id}`} className="text-slate-900 hover:underline">{account.name}</Link>
                      ) : (
                        <span className="font-semibold text-slate-800">{account.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-slate-500">{account.type.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={signedBalance(account)} currency={currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </PagedTable>
    </PageShell>
  );
}
