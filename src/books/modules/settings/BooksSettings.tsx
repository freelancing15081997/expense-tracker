import React, { useEffect, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { booksFileUrl } from '../../storage/adapter';
import { btnPrimary, Card, Field, FileField, inputClass, PageShell, Status } from '../../ui';
import { BOOKS_CATALOG } from '../../catalog';

export default function BooksSettings() {
  const { tenant, periods, role, can, rename, close, reopen, uploadFile } = useBooks();
  const [name, setName] = useState(tenant?.name || '');
  const [message, setMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!tenant?.logoPath) {
      setLogoUrl('');
      return;
    }
    booksFileUrl(tenant.logoPath).then(setLogoUrl).catch(() => setLogoUrl(''));
  }, [tenant?.logoPath]);

  return (
    <PageShell title="Books Settings" subtitle="Workspace controls. Currency is locked to the tenant base currency used by every journal.">
      <Card className="p-4 space-y-3">
        <Field label="Workspace name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={!can('manage_settings')} />
        </Field>
        <p className="text-sm text-slate-500">Base currency: <strong>{tenant?.baseCurrency}</strong> · Your role: <strong>{role}</strong></p>
        {logoUrl && (
          <div className="w-20 h-20 rounded-2xl border border-[#E5E7EB] overflow-hidden bg-white">
            <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
          </div>
        )}
        {can('manage_settings') && (
          <FileField
            label="Company logo (shown on invoices, bills, and statements)"
            accept="image/png,image/jpeg,image/webp"
            hint="PNG, JPG, or WEBP · 8 MB max. Used when you print or send a customer/vendor report."
            onFiles={async (files) => {
              const file = files[0];
              if (!file) return;
              try {
                const stored = await uploadFile({ domain: 'workspace-logo', file });
                await rename(name || tenant?.name || 'Byjan Books', stored.path);
                setMessage('Company logo saved. It will appear on customer/vendor prints.');
              } catch (err: any) {
                setMessage(err.message || 'Logo upload failed');
              }
            }}
          />
        )}
        {can('manage_settings') && (
          <button
            className={btnPrimary}
            onClick={async () => {
              try {
                await rename(name);
                setMessage('Saved');
              } catch (err: any) {
                setMessage(err.message || 'Save failed');
              }
            }}
          >
            Save
          </button>
        )}
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Accounting periods</h2>
        <ul className="space-y-2">
          {periods.sort((a, b) => b.id.localeCompare(a.id)).map((period) => (
            <li key={period.id} className="flex items-center justify-between text-sm">
              <span>{period.id}</span>
              <span className="flex items-center gap-2">
                <Status value={period.status} />
                {period.status === 'open' && can('close_period') && (
                  <button className="text-slate-600 underline" onClick={() => close(period.id)}>Close</button>
                )}
                {period.status === 'closed' && can('close_period') && (
                  <button className="text-slate-600 underline" onClick={() => reopen(period.id)}>Reopen</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Requirement coverage</h2>
        <p className="text-sm text-slate-500">Live items post real journals. Adapter items are interfaces only — they are not fake operational screens.</p>
        {BOOKS_CATALOG.map((group) => (
          <div key={group.domain}>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">{group.domain}</h3>
            <ul className="text-sm space-y-1">
              {group.items.map((item) => (
                <li key={item.name} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className={item.status === 'live' ? 'text-emerald-700' : 'text-slate-400'}>{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}
