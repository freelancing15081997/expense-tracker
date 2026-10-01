import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Clock, AlertTriangle, Send } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { getBook, type Book, type Expense } from '../lib/books';
import { saveSplit, listSettlements, listMemberUpi, requestMemberUpi, startUpiPayment, reportUpiReturn, confirmReceived, markReview, type SplitMethod, type Settlement } from '../lib/money';
import { useSession } from '../lib/session';
import { inr, inrPaise, paise } from '../lib/format';
import { AppBar, Avatar, Empty, Field, ListSkeleton, Seg, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, SuccessMark, motion } from '../motion';
import { isNative } from '../lib/api';

/** Split an entry four ways: equal, exact ₹, percent, shares. Always reconciles to the paise. */
export function SplitSheet({ open, onClose, book, entry, onSaved }: { open: boolean; onClose: () => void; book: Book; entry: Expense; onSaved: () => void }) {
  const s = useSession(); const toast = useToast();
  const members = useMemo(() => Object.entries(book.roles || {}).map(([uid, r]) => ({ uid, name: r.displayName || r.email?.split('@')[0] || 'Member' })), [book]);
  const total = paise(entry.amount);
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [paidBy, setPaidBy] = useState(entry.paidByUid || s.user?.uid || '');
  const [inc, setInc] = useState<Record<string, boolean>>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setInc(Object.fromEntries(members.map((m) => [m.uid, true]))); setVals({}); setMethod('equal'); } }, [open]);

  const chosen = members.filter((m) => inc[m.uid]);
  const parts = useMemo(() => {
    const n = chosen.length || 1;
    let raw: number[];
    if (method === 'equal') raw = chosen.map(() => total / n);
    else if (method === 'exact') raw = chosen.map((m) => paise(vals[m.uid] || 0));
    else if (method === 'percent') raw = chosen.map((m) => (total * Number(vals[m.uid] || 0)) / 100);
    else { const sh = chosen.map((m) => Number(vals[m.uid] || 1)); const sum = sh.reduce((a, b) => a + b, 0) || 1; raw = sh.map((x) => (total * x) / sum); }
    const floor = raw.map((x) => Math.floor(x));
    let rem = (method === 'exact' ? 0 : total - floor.reduce((a, b) => a + b, 0));
    return chosen.map((m, i) => ({ uid: m.uid, name: m.name, sharePaise: floor[i] + (rem-- > 0 ? 1 : 0), value: Number(vals[m.uid] || 0) }));
  }, [chosen, method, vals, total]);
  const sum = parts.reduce((a, p) => a + p.sharePaise, 0);
  const pctSum = method === 'percent' ? chosen.reduce((a, m) => a + Number(vals[m.uid] || 0), 0) : 100;
  const error = !chosen.length ? 'Pick at least one person' : method === 'exact' && sum !== total ? `Shares add up to ${inrPaise(sum)} — need ${inrPaise(total)}` : method === 'percent' && Math.abs(pctSum - 100) > 0.01 ? `Percent adds up to ${pctSum}% — need 100%` : '';

  return (
    <Sheet open={open} onClose={onClose} title={`Split ${inr(Number(entry.amount))}`} tall
      footer={<Press className="btn btn-primary btn-block" disabled={!!error || busy} onClick={async () => {
        setBusy(true);
        try { const r = await saveSplit(book.id, entry.id, { method, paidByUid: paidBy, parts }); toast({ text: r.toast || 'Split saved — balances updated' }); onSaved(); }
        catch (e) { toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
      }}>{busy ? 'Saving…' : 'Save split'}</Press>}>
      <Seg id="splitm" value={method} onChange={setMethod} options={[{ value: 'equal', label: 'Equal' }, { value: 'exact', label: '₹' }, { value: 'percent', label: '%' }, { value: 'shares', label: 'Shares' }]} />
      <Field label="Paid by"><select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{members.map((m) => <option key={m.uid} value={m.uid}>{m.uid === s.user?.uid ? 'You' : m.name}</option>)}</select></Field>
      <div className="list" style={{ margin: '0 -16px' }}>
        {members.map((m) => {
          const p = parts.find((x) => x.uid === m.uid);
          return (
            <div key={m.uid} className="list-row" style={{ cursor: 'default' }}>
              <input type="checkbox" checked={!!inc[m.uid]} onChange={(e) => setInc({ ...inc, [m.uid]: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--teal-700)' }} />
              <Avatar name={m.name} size={32} /><span className="grow t">{m.uid === s.user?.uid ? 'You' : m.name}</span>
              {method !== 'equal' && inc[m.uid] && <input className="input mono" style={{ width: 84, minHeight: 38 }} inputMode="decimal" placeholder={method === 'shares' ? '1' : '0'} value={vals[m.uid] || ''} onChange={(e) => setVals({ ...vals, [m.uid]: e.target.value.replace(/[^0-9.]/g, '') })} />}
              <motion.span key={p?.sharePaise} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="mono" style={{ width: 82, textAlign: 'right' }}>{p ? inrPaise(p.sharePaise) : '—'}</motion.span>
            </div>
          );
        })}
      </div>
      {error ? <p className="err">{error}</p> : <p className="hint">Each person’s share is saved and they see what they owe {members.find((m) => m.uid === paidBy)?.name || 'the payer'}.</p>}
    </Sheet>
  );
}

const UPI_APPS = [{ id: 'phonepe', label: 'PhonePe' }, { id: 'gpay', label: 'Google Pay' }, { id: 'paytm', label: 'Paytm' }, { id: 'bhim', label: 'BHIM' }, { id: 'any', label: 'Other UPI app' }];

export function SettleUp() {
  const { bookId = '' } = useParams();
  const s = useSession(); const toast = useToast(); const confirm = useConfirm();
  const uid = s.user?.uid || '';
  const [book, setBook] = useState<Book | null>(null);
  const [rows, setRows] = useState<Settlement[] | null>(null);
  const [upi, setUpi] = useState<Record<string, { upiId: string; hasUpi: boolean }>>({});
  const [paying, setPaying] = useState<Settlement | null>(null);
  const [attempt, setAttempt] = useState<{ id: string; uri?: string; fallback?: { upiId: string; amount: string; note: string } | null } | null>(null);
  const [paidOk, setPaidOk] = useState(false);

  const load = async () => {
    const [b, r, m] = await Promise.all([getBook(bookId), listSettlements(bookId), listMemberUpi(bookId).catch(() => [])]);
    setBook(b); setRows(r); setUpi(Object.fromEntries(m.map((x) => [x.uid, x])));
  };
  useEffect(() => { void load().catch((e) => toast({ text: e.message, tone: 'error' })); }, [bookId]);

  // When the person comes back from the UPI app, ask how it went.
  useEffect(() => {
    if (!attempt || !isNative()) return;
    const h = CapApp.addListener('appStateChange', (st) => { if (st.isActive && attempt) void askOutcome(); });
    return () => { void h.then((x) => x.remove()); };
  }, [attempt]);

  const askOutcome = async () => {
    if (!attempt || !paying) return;
    const { ok } = await confirm({ title: 'Did the payment go through?', body: `${inrPaise(paying.amountPaise)} to ${paying.receiverNameSnapshot || 'them'}`, confirm: 'Yes, paid' });
    const r = await reportUpiReturn(bookId, attempt.id, ok ? 'submitted' : 'cancelled').catch(() => null);
    setAttempt(null);
    if (ok) { setPaidOk(true); setTimeout(() => { setPaidOk(false); setPaying(null); }, 1400); toast({ text: r?.message || 'Marked as paid — waiting for them to confirm' }); }
    void load();
  };

  const pay = async (st: Settlement, app: string) => {
    try {
      const r = await startUpiPayment(bookId, st.id, app);
      setAttempt({ id: r.attemptId || '', uri: r.upiUri, fallback: r.fallback });
      if (r.upiUri) window.location.href = r.upiUri;
    } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
  };

  if (!rows) return <div className="screen no-nav"><AppBar back title="Settle up" rule /><ListSkeleton rows={4} /></div>;
  const open = rows.filter((r) => !['SETTLED', 'CONFIRMED'].includes(r.status));
  const done = rows.filter((r) => ['SETTLED', 'CONFIRMED'].includes(r.status));
  const iOwe = open.filter((r) => r.fromUid === uid); const owedMe = open.filter((r) => r.toUid === uid);
  const name = (id: string) => book?.roles?.[id]?.displayName || book?.roles?.[id]?.email?.split('@')[0] || 'Member';

  return (
    <div className="screen no-nav">
      <AppBar back={`/book/${bookId}`} title="Settle up" kicker={book?.name} rule />
      {!open.length ? <Empty icon={<Check size={36} />} title="Everyone is settled" body="New splits will show balances here." /> : (
        <Stagger>
          {iOwe.length > 0 && <Item><div className="h-section">You owe</div></Item>}
          {iOwe.map((r) => (
            <Item key={r.id} className="list-row" style={{ cursor: 'default' }}>
              <Avatar name={name(r.toUid)} />
              <div className="grow"><p className="t">{name(r.toUid)}</p><p className="s ellipsis">{r.expenseDescription || r.merchant} · {r.status === 'PAYMENT_SUBMITTED' ? 'waiting for them to confirm' : 'pending'}</p></div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <span className="mono">{inrPaise(r.amountPaise)}</span>
                {r.status !== 'PAYMENT_SUBMITTED' && (upi[r.toUid]?.hasUpi
                  ? <Press className="btn btn-primary btn-sm" onClick={() => setPaying(r)}>Pay</Press>
                  : <Press className="btn btn-secondary btn-sm" onClick={async () => { await requestMemberUpi(bookId, r.toUid); toast({ text: `Asked ${name(r.toUid)} to add their UPI ID` }); }}><Send size={14} />Ask UPI</Press>)}
              </div>
            </Item>
          ))}
          {owedMe.length > 0 && <Item><div className="h-section">Owed to you</div></Item>}
          {owedMe.map((r) => (
            <Item key={r.id} className="list-row" style={{ cursor: 'default' }}>
              <Avatar name={name(r.fromUid)} />
              <div className="grow"><p className="t">{name(r.fromUid)}</p><p className="s ellipsis">{r.expenseDescription || r.merchant} · {r.status === 'PAYMENT_SUBMITTED' ? 'says they paid' : 'pending'}</p></div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <span className="mono amt-in">{inrPaise(r.amountPaise)}</span>
                <div className="row" style={{ gap: 6 }}>
                  {r.status === 'PAYMENT_SUBMITTED' && <Press className="btn btn-secondary btn-sm" onClick={async () => { const { ok, reason } = await confirm({ title: 'Not received?', body: 'We’ll let them know to check.', reason: true, reasonLabel: 'What happened', confirm: 'Send' }); if (ok) { await markReview(bookId, r.id, reason); void load(); } }}><AlertTriangle size={14} /></Press>}
                  <Press className="btn btn-primary btn-sm" onClick={async () => { await confirmReceived(bookId, r.id); toast({ text: 'Marked as received' }); void load(); }}><Check size={14} />Received</Press>
                </div>
              </div>
            </Item>
          ))}
        </Stagger>
      )}
      {done.length > 0 && (
        <>
          <div className="h-section">Settled</div>
          <div className="list">{done.slice(0, 20).map((r) => <div key={r.id} className="list-row" style={{ cursor: 'default' }}><Clock size={16} color="var(--faint)" /><span className="grow s">{name(r.fromUid)} → {name(r.toUid)}</span><span className="mono hint">{inrPaise(r.amountPaise)}</span></div>)}</div>
        </>
      )}

      <Sheet open={!!paying} onClose={() => { setPaying(null); setAttempt(null); }} title={paying ? `Pay ${inrPaise(paying.amountPaise)}` : ''}>
        {paidOk ? <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><SuccessMark /></div> : paying && (
          <>
            <p style={{ color: 'var(--ink-2)' }}>To {paying.receiverNameSnapshot || name(paying.toUid)} · <span className="mono">{paying.receiverUpiSnapshot || upi[paying.toUid]?.upiId}</span></p>
            <div className="grid2">
              {UPI_APPS.map((a) => (
                <Press key={a.id} className="card card-pad row" style={{ cursor: 'pointer' }} onClick={() => pay(paying, a.id)}>
                  {a.id !== 'any' ? <img src={`/brands/${a.id}.svg`} alt="" width={26} height={26} /> : <img src="/brands/upi.svg" alt="" width={26} height={26} />}<span style={{ font: '500 14px var(--font)' }}>{a.label}</span>
                </Press>
              ))}
            </div>
            {attempt?.fallback && (
              <div className="card card-pad stack" style={{ gap: 6 }}>
                <p className="label">Or pay manually</p>
                <p className="mono">{attempt.fallback.upiId}</p><p className="mono">{attempt.fallback.amount}</p><p className="hint">{attempt.fallback.note}</p>
                <Press className="btn btn-secondary btn-sm" onClick={askOutcome}>I’ve paid</Press>
              </div>
            )}
            {attempt && !isNative() && <Press className="btn btn-secondary btn-block" onClick={askOutcome}>I’m back from the UPI app</Press>}
          </>
        )}
      </Sheet>
    </div>
  );
}
