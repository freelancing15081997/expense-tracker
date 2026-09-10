import React, { useEffect, useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { buildOrgTree, MAX_ORG_DEPTH } from '../../core/hierarchy';
import { Card, Field, IconBtn, inputClass, PageShell } from '../../ui';
import { Pager, usePaging } from '../../ui/PagedList';

export default function Companies() {
  const { tenant, tenantId, orgs, can, switchWorkspace, createCompany } = useBooks();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState(tenantId || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tree = useMemo(() => buildOrgTree(orgs), [orgs]);
  const paging = usePaging(tree, 10);
  const parent = orgs.find((row) => row.id === (parentId || tenantId));
  const canNest = Number(parent?.depth || 0) < MAX_ORG_DEPTH;

  useEffect(() => {
    if (tenantId) setParentId(tenantId);
  }, [tenantId]);

  return (
    <PageShell
      title="Companies"
      subtitle="Create and switch isolated Books companies under your account. Each company has its own ledgers, invoices, tax, and files. Legal entities inside a company are not separate companies."
    >
      {can('manage_settings') && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">New company or subsidiary</h2>
          <form
            className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                await createCompany(name, parentId || tenantId || undefined);
                setName('');
              } catch (err: any) {
                setError(err.message || 'Could not create company');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Company name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
            <Field label="Create under">
              <select className={inputClass} value={parentId || tenantId || ''} onChange={(e) => setParentId(e.target.value)}>
                {tree.map((row) => (
                  <option key={row.id} value={row.id}>
                    {'— '.repeat(row.indent)}{row.name}
                  </option>
                ))}
              </select>
            </Field>
            <IconBtn action="create" type="submit" busy={busy} disabled={!canNest}>{busy ? 'Creating company' : 'Create company'}</IconBtn>
          </form>
          {!canNest && <p className="text-sm text-slate-500">This company is already at the maximum nesting depth ({MAX_ORG_DEPTH}).</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </Card>
      )}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Your companies</h2>
        <ul className="divide-y divide-slate-100">
          {paging.slice.map((row) => {
            const active = row.id === tenantId;
            return (
              <li key={row.id} className="py-3 flex items-center gap-3" style={{ paddingLeft: row.indent * 16 }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0B1F3A] truncate">{row.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {row.kind === 'root' ? 'Root workspace' : row.kind === 'company' ? 'Company' : 'Subsidiary'}
                    {active ? ' · open now' : ''}
                  </p>
                </div>
                {active ? (
                  <span className="text-xs font-semibold text-teal-700">Current</span>
                ) : (
                  <button type="button" className="text-sm text-slate-600 underline" onClick={() => switchWorkspace(row.id)}>
                    Open books
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Open books always stay inside one company. {tenant?.name} does not mix invoices or journals with a sibling or child. Group consolidation is an adapter and does not invent combined balances.
        </p>
      </Card>
    </PageShell>
  );
}
