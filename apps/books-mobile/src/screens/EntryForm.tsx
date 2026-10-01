import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Paperclip, X, Calendar, Clock, Flag, Users, AlertTriangle, ChevronDown, ChevronUp, Camera as CamIcon, Image as ImgIcon } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { getBook, listEntries, createEntry, updateEntry, checkDuplicate, accountsOf, categoriesOf, KIND_OPTIONS, PAYMENT_METHODS, DOC_TYPES, type Book, type Expense } from '../lib/books';
import { saveSplit, learnCorrection, processReceipt, type CapturePreview } from '../lib/money';
import { blankDraft, draftFromExpense, draftToExpense, validateDraft, autofill, FIELD_LABELS, type EntryDraft, type DraftKey } from '../lib/autofill';
import { prepareFile, uploadPrepared, fileToDataUrl } from '../lib/receipts';
import { enqueue } from '../lib/offline';
import { ApiError, fileUrl } from '../lib/api';
import { useSession } from '../lib/session';
import { inr, newId, todayIso } from '../lib/format';
import { AppBar, Field, Seg, Toggle, SourceLogo, useConfirm, useToast } from '../ui';
import { Press, Sheet, AutoGlow, SuccessMark, motion, AnimatePresence } from '../motion';
import { success } from '../lib/haptics';

export type CaptureState = { draft: EntryDraft; filled: DraftKey[]; low: DraftKey[]; preview?: CapturePreview | null; queue?: CaptureState[]; batchIndex?: number; batchTotal?: number };

export default function EntryForm() {
  const { bookId = '', entryId } = useParams();
  const loc = useLocation() as { state?: { capture?: CaptureState; duplicateOf?: Expense } };
  const nav = useNavigate(); const s = useSession(); const toast = useToast(); const confirm = useConfirm();
  const uid = s.user?.uid || '';
  const capture = loc.state?.capture;
  const [book, setBook] = useState<Book | null>(null);
  const [d, setD] = useState<EntryDraft | null>(null);
  const [orig, setOrig] = useState<EntryDraft | null>(null);
  const [filled, setFilled] = useState<Set<DraftKey>>(new Set(capture?.filled || []));
  const [low, setLow] = useState<Set<DraftKey>>(new Set(capture?.low || []));
  const [touched, setTouched] = useState<Set<DraftKey>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<Expense[] | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const idemKey = useRef(newId('entry'));
  const isEdit = !!entryId;

  useEffect(() => {
    void (async () => {
      try {
        const b = await getBook(bookId); setBook(b);
        let start: EntryDraft;
        if (isEdit) {
          const e = (await listEntries(bookId)).find((x) => x.id === entryId);
          if (!e) { toast({ text: 'That entry no longer exists', tone: 'error' }); nav(`/book/${bookId}`, { replace: true }); return; }
          start = draftFromExpense(e, b, uid);
        } else if (capture) {
          start = { ...blankDraft(b, uid), ...capture.draft };
        } else if (loc.state?.duplicateOf) {
          start = { ...draftFromExpense(loc.state.duplicateOf, b, uid), date: todayIso(), receiptPath: '', receiptName: '', upiRef: '', captureId: '', source: 'duplicate' };
        } else start = blankDraft(b, uid);
        setD(start); setOrig(start);
        if (start.vpa || start.upiRef || start.fundSource || start.invoiceNumber || start.taxAmount || start.adjustments) setMore(true);
      } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
    })();
  }, [bookId, entryId]);

  const { errors, warnings } = useMemo(() => (d ? validateDraft(d) : { errors: {}, warnings: {} }), [d]);
  const errList = Object.entries(errors) as Array<[DraftKey, string]>;
  const dirty = !!d && !!orig && JSON.stringify(d) !== JSON.stringify(orig);
  const members = useMemo(() => Object.entries(book?.roles || {}).map(([id, r]) => ({ uid: id, name: r.displayName || r.email?.split('@')[0] || 'Member', email: r.email })), [book]);
  const accounts = accountsOf(book);
  const cats = categoriesOf(book);

  if (!d) return <div className="screen no-nav"><AppBar back title={isEdit ? 'Edit entry' : 'New entry'} rule /></div>;

  const set = <K extends DraftKey>(k: K, v: EntryDraft[K]) => { setD({ ...d, [k]: v }); setTouched((t) => new Set(t).add(k)); setLow((l) => { const n = new Set(l); n.delete(k); return n; }); };
  const err = (k: DraftKey) => (showErrors || touched.has(k) ? errors[k] : undefined);
  const cls = (k: DraftKey) => `input ${err(k) ? 'bad' : low.has(k) ? 'low' : filled.has(k) && !touched.has(k) ? 'auto' : ''}`;
  const order = ['amount', 'txType', 'merchant', 'description', 'category', 'date', 'time', 'paymentMethod', 'accountId', 'fundSource', 'upiRef', 'vpa', 'invoiceNumber', 'taxAmount', 'documentType', 'notes'] as DraftKey[];
  const glow = (k: DraftKey) => filled.has(k) && !touched.has(k);
  const delay = (k: DraftKey) => Math.max(0, order.indexOf(k)) * 0.06;
  const autoLabel = (k: DraftKey) => (low.has(k) ? <span className="badge amber" style={{ marginLeft: 'auto' }}>Check this</span> : glow(k) ? <span className="badge teal" style={{ marginLeft: 'auto', gap: 4 }}><Sparkles size={11} />Auto</span> : null);

  const goBack = async () => {
    if (dirty && !done) { const { ok } = await confirm({ title: 'Discard this entry?', body: 'Your changes will be lost.', confirm: 'Discard', danger: true }); if (!ok) return; }
    if (capture?.queue?.length) nav('/capture', { replace: true, state: { resumeQueue: capture.queue } }); else nav(-1);
  };

  const attach = async (dataUrl: string, name: string, mime: string, read: boolean) => {
    setUploading(true);
    try {
      const f = await prepareFile(dataUrl, name, mime);
      const up = await uploadPrepared(bookId, f);
      let next = { ...d, receiptPath: up.receiptPath, receiptName: up.receiptName, receiptDataUrl: f.isImage ? f.dataUrl : '' };
      if (read && s.can('money_scan') && s.guard('receipt_scans')) {
        const r = await processReceipt({ bookId, receiptPath: up.receiptPath, receiptName: up.receiptName, source: 'attach', idempotencyKey: newId('rx'), imageBase64: f.isImage ? f.base64 : undefined, imageMime: f.mime, mimeType: f.mime });
        s.bump('receipt_scans');
        const a = autofill(next, book, { preview: r.preview, receiptPath: up.receiptPath, receiptName: up.receiptName });
        // keep anything the person already typed
        touched.forEach((k) => { (a.draft as Record<string, unknown>)[k] = (d as Record<string, unknown>)[k]; a.filled.delete(k); });
        next = a.draft; setFilled(a.filled); setLow(a.low); success();
        toast({ text: `Filled ${a.filled.size} fields from the receipt` });
      }
      setD(next);
    } catch (e) { if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' }); } finally { setUploading(false); }
  };
  const pickCamera = async () => {
    try { const p = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.DataUrl, quality: 85, correctOrientation: true }); if (p.dataUrl) await attach(p.dataUrl, 'receipt.jpg', 'image/jpeg', !filled.size); }
    catch (e) { if (!/cancel/i.test(String((e as Error).message))) toast({ text: 'Camera unavailable', tone: 'error' }); }
  };

  const save = async (force = false) => {
    setShowErrors(true);
    if (errList.length) { document.querySelector('.screen')?.scrollTo({ top: 0, behavior: 'smooth' }); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const exp = draftToExpense(d);
    setBusy(true);
    try {
      if (!isEdit && !force) {
        const matches = await checkDuplicate(bookId, exp).catch(() => []);
        if (matches.length) { setDup(matches); setBusy(false); return; }
      }
      let saved: Expense;
      if (isEdit) saved = await updateEntry(bookId, entryId!, exp);
      else saved = await createEntry(bookId, exp, { force, idempotencyKey: idemKey.current });
      if (d.splitEqually && members.length > 1 && saved?.id && s.can('money_split_equal')) {
        const total = Math.round(Number(exp.amount) * 100); const each = Math.floor(total / members.length); let rem = total - each * members.length;
        await saveSplit(bookId, saved.id, { method: 'equal', paidByUid: d.paidByUid, parts: members.map((m) => ({ uid: m.uid, name: m.name, sharePaise: each + (rem-- > 0 ? 1 : 0) })) }).catch(() => toast({ text: 'Saved, but the split failed. Open the entry to split again.', tone: 'error' }));
      }
      if (capture && d.captureId) {
        const before = capture.draft as unknown as Record<string, unknown>; const after = d as unknown as Record<string, unknown>;
        const changed = Object.fromEntries(Object.keys(FIELD_LABELS).filter((k) => before[k] !== after[k]).map((k) => [k, after[k]]));
        if (Object.keys(changed).length) void learnCorrection(bookId, d.captureId, before, changed);
      }
      finish(isEdit ? 'Changes saved' : `${inr(Number(exp.amount))} added`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0 && !isEdit) { enqueue(bookId, exp, idemKey.current); finish('Saved offline — will sync'); return; }
      if (e instanceof ApiError && e.status === 409 && !force) { setDup((e.extra.matches as Expense[]) || []); return; }
      if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' });
    } finally { setBusy(false); }
  };
  const finish = (msg: string) => {
    setDone(true); success();
    setTimeout(() => {
      toast({ text: msg });
      const q = capture?.queue || [];
      if (q.length) nav(`/book/${bookId}/new`, { replace: true, state: { capture: { ...q[0], queue: q.slice(1) } } });
      else nav(isEdit ? `/book/${bookId}/entry/${entryId}` : `/book/${bookId}`, { replace: true });
    }, 900);
  };

  const filledCount = [...filled].filter((k) => !touched.has(k)).length;
  const isTransfer = d.entryType === 'transfer';

  return (
    <div className="screen no-nav">
      <header className="appbar rule">
        <Press className="icon-btn" title="Close" onClick={goBack}><X size={22} /></Press>
        <div className="grow"><p className="kicker">{book?.name}{capture?.batchTotal ? ` · ${(capture.batchIndex || 0) + 1} of ${capture.batchTotal}` : ''}</p><h1 style={{ padding: 0, marginTop: 4 }}>{isEdit ? 'Edit entry' : capture ? 'Check and save' : 'New entry'}</h1></div>
        <Press className="btn btn-primary btn-sm" disabled={busy || done} onClick={() => save(false)}>{busy ? 'Saving…' : 'Save'}</Press>
      </header>

      <AnimatePresence>
        {capture && filledCount > 0 && (
          <motion.div className="banner info" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Sparkles size={16} /><span className="grow">Filled {filledCount} fields from the {capture.preview?.source === 'sms' ? 'message' : 'receipt'}{low.size ? ` · ${low.size} need a look` : ''}</span>
            <SourceLogo name={d.fundSource || capture.preview?.source} size={20} />
          </motion.div>
        )}
      </AnimatePresence>

      {showErrors && errList.length > 0 && (
        <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }} style={{ margin: '12px 16px 0', padding: '12px 14px', border: '1px solid #E7B4AD', background: 'var(--red-50)', borderRadius: 8 }}>
          <p style={{ font: '600 14px var(--font)', color: 'var(--red-700)' }}>Fix {errList.length === 1 ? 'this' : `these ${errList.length}`} to save</p>
          {errList.map(([k, m]) => <p key={k} style={{ font: '400 13.5px var(--font)', color: '#7D1F15', marginTop: 4 }}>{FIELD_LABELS[k] || k}: {m}</p>)}
        </motion.div>
      )}

      <div className="stack" style={{ padding: 16, gap: 18 }}>
        <AutoGlow active={glow('amount')} delay={0}>
          <div className="card card-pad" style={{ borderColor: err('amount') ? 'var(--red)' : low.has('amount') ? '#E9C48F' : undefined }}>
            <div className="row"><span className="label">Amount</span>{autoLabel('amount')}</div>
            <div className="row" style={{ marginTop: 6, gap: 4 }}>
              <span style={{ font: '600 32px var(--font)', color: 'var(--muted)' }}>{d.currency === 'INR' ? '₹' : d.currency}</span>
              <input className="amount-input" inputMode="decimal" placeholder="0" value={d.amount} autoFocus={!capture && !isEdit}
                onChange={(e) => set('amount', e.target.value.replace(/[^0-9.,]/g, ''))} onBlur={() => setTouched((t) => new Set(t).add('amount'))} />
            </div>
            {err('amount') && <span className="err">{err('amount')}</span>}
            <div className="chips" style={{ marginTop: 12 }}>
              {KIND_OPTIONS.map((k) => (
                <button key={k.txType} className={`chip ${d.txType === k.txType ? 'on' : ''}`} onClick={() => setD({ ...d, txType: k.txType, entryType: k.entryType })}>{k.label}</button>
              ))}
            </div>
          </div>
        </AutoGlow>

        <AutoGlow active={glow('merchant')} delay={delay('merchant')}>
          <Field label={<>{d.entryType === 'in' ? 'Received from' : isTransfer ? 'Note' : 'Paid to'}{autoLabel('merchant')}</>}>
            <input className={cls('merchant')} value={d.merchant} placeholder={d.entryType === 'in' ? 'Who paid you' : 'Shop, person or company'} onChange={(e) => set('merchant', e.target.value)} />
          </Field>
        </AutoGlow>
        <AutoGlow active={glow('description')} delay={delay('description')}>
          <Field label={<>For what{autoLabel('description')}</>} optional>
            <input className={cls('description')} value={d.description} placeholder="e.g. Team lunch, diesel, rent" onChange={(e) => set('description', e.target.value)} />
          </Field>
        </AutoGlow>
        {!isTransfer && (
          <AutoGlow active={glow('category')} delay={delay('category')}>
            <Field label={<>Category{autoLabel('category')}</>} warning={showErrors ? warnings.category : undefined}>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {cats.map((c) => <motion.button key={c} layout className={`chip ${d.category === c ? 'on' : ''}`} onClick={() => set('category', d.category === c ? '' : c)}>{c}</motion.button>)}
                {d.category && !cats.includes(d.category) && <button className="chip on">{d.category}</button>}
              </div>
            </Field>
          </AutoGlow>
        )}
        <div className="grid2">
          <AutoGlow active={glow('date')} delay={delay('date')}>
            <Field label={<><Calendar size={14} />Date{autoLabel('date')}</>} error={err('date')} warning={warnings.date}>
              <input type="date" className={cls('date')} value={d.date} max="2099-12-31" onChange={(e) => set('date', e.target.value)} />
            </Field>
          </AutoGlow>
          <AutoGlow active={glow('time')} delay={delay('time')}>
            <Field label={<><Clock size={14} />Time{autoLabel('time')}</>} error={err('time')} optional>
              <input type="time" className={cls('time')} value={d.time} onChange={(e) => set('time', e.target.value)} />
            </Field>
          </AutoGlow>
        </div>

        <div className="h-section" style={{ margin: '6px 0 0' }}>Payment</div>
        <AutoGlow active={glow('paymentMethod')} delay={delay('paymentMethod')}>
          <Field label={<>Paid by{autoLabel('paymentMethod')}</>}>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map((m) => <button key={m.id} className={`chip ${d.paymentMethod === m.id ? 'on' : ''}`} onClick={() => {
                const a = accounts.find((x) => (m.id === 'upi' ? x.kind === 'upi' : m.id === 'cash' ? x.kind === 'cash' : m.id === 'card' ? x.kind.includes('card') : m.id === 'bank' ? x.kind === 'bank' : m.id === 'wallet' ? x.kind === 'wallet' : false));
                setD({ ...d, paymentMethod: d.paymentMethod === m.id ? '' : m.id, accountId: a?.id || d.accountId }); setTouched((t) => new Set(t).add('paymentMethod'));
              }}>{m.id === 'upi' && <img src="/brands/upi.svg" alt="" width={16} height={16} />}{m.label}</button>)}
            </div>
          </Field>
        </AutoGlow>
        <div className={isTransfer ? 'grid2' : ''}>
          <AutoGlow active={glow('accountId')} delay={delay('accountId')}>
            <Field label={<>{isTransfer ? 'From account' : 'Account'}{autoLabel('accountId')}</>} error={err('accountId')}>
              <select className={cls('accountId')} value={d.accountId} onChange={(e) => set('accountId', e.target.value)}>
                <option value="">Choose…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </AutoGlow>
          {isTransfer && (
            <Field label="To account" error={err('toAccountId')}>
              <select className={cls('toAccountId')} value={d.toAccountId} onChange={(e) => set('toAccountId', e.target.value)}>
                <option value="">Choose…</option>{accounts.filter((a) => a.id !== d.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setMore(!more)}>
          {more ? <ChevronUp size={18} /> : <ChevronDown size={18} />}{more ? 'Fewer details' : 'UPI ref, bill number, GST and more'}
        </button>
        <AnimatePresence initial={false}>
          {more && (
            <motion.div className="stack" style={{ gap: 18, overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <AutoGlow active={glow('fundSource')} delay={delay('fundSource')}>
                <Field label={<>Paid from{autoLabel('fundSource')}</>} optional hint="Bank, card or app — e.g. HDFC ••4421 via PhonePe">
                  <div className="row"><SourceLogo name={d.fundSource} size={26} /><input className={cls('fundSource')} value={d.fundSource} onChange={(e) => set('fundSource', e.target.value)} /></div>
                </Field>
              </AutoGlow>
              <div className="grid2">
                <AutoGlow active={glow('upiRef')} delay={delay('upiRef')}>
                  <Field label={<>UPI ref / UTR{autoLabel('upiRef')}</>} optional><input className={`${cls('upiRef')} mono`} inputMode="numeric" value={d.upiRef} onChange={(e) => set('upiRef', e.target.value.trim())} /></Field>
                </AutoGlow>
                <AutoGlow active={glow('vpa')} delay={delay('vpa')}>
                  <Field label={<>UPI ID{autoLabel('vpa')}</>} optional error={err('vpa')}><input className={cls('vpa')} value={d.vpa} placeholder="name@bank" autoCapitalize="off" onChange={(e) => set('vpa', e.target.value.trim())} /></Field>
                </AutoGlow>
              </div>
              <div className="grid2">
                <AutoGlow active={glow('invoiceNumber')} delay={delay('invoiceNumber')}>
                  <Field label={<>Bill / invoice no.{autoLabel('invoiceNumber')}</>} optional><input className={cls('invoiceNumber')} value={d.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} /></Field>
                </AutoGlow>
                <AutoGlow active={glow('taxAmount')} delay={delay('taxAmount')}>
                  <Field label={<>GST / tax ₹{autoLabel('taxAmount')}</>} optional error={err('taxAmount')}><input className={cls('taxAmount')} inputMode="decimal" value={d.taxAmount} onChange={(e) => set('taxAmount', e.target.value.replace(/[^0-9.]/g, ''))} /></Field>
                </AutoGlow>
              </div>
              <Field label={<>Document type{autoLabel('documentType')}</>} optional>
                <Seg id="doctype" value={d.documentType || 'none'} onChange={(v) => set('documentType', v === 'none' ? '' : v)} options={[{ value: 'none', label: 'None' }, ...DOC_TYPES.map((x) => ({ value: x.id, label: x.label }))]} />
              </Field>
              <Field label={<>Adjustments{autoLabel('adjustments')}</>} optional hint="e.g. ₹200 of this is personal"><input className={cls('adjustments')} value={d.adjustments} onChange={(e) => set('adjustments', e.target.value)} /></Field>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-section" style={{ margin: '6px 0 0' }}>Receipt & notes</div>
        {d.receiptPath ? (
          <motion.div className="card row" style={{ padding: 10 }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            {d.receiptDataUrl || /\.(jpe?g|png|webp)$/i.test(d.receiptPath) ? <img src={d.receiptDataUrl || fileUrl(d.receiptPath)} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
              : <span className="avatar" style={{ width: 56, height: 56 }}><Paperclip size={20} /></span>}
            <div className="grow"><p className="t ellipsis" style={{ font: '500 14px var(--font)' }}>{d.receiptName || 'Receipt'}</p><p className="hint">Attached</p></div>
            <button className="icon-btn" title="Remove receipt" onClick={() => setD({ ...d, receiptPath: '', receiptName: '', receiptDataUrl: '' })}><X size={18} /></button>
          </motion.div>
        ) : (
          <div className="grid2">
            <Press className="btn btn-secondary" disabled={uploading} onClick={pickCamera}><CamIcon size={18} />{uploading ? 'Reading…' : 'Camera'}</Press>
            <Press className="btn btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}><ImgIcon size={18} />Photo / PDF</Press>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) await attach(await fileToDataUrl(file), file.name, file.type, !filled.size); }} />
          </div>
        )}
        <AutoGlow active={glow('notes')} delay={delay('notes')}>
          <Field label={<>Notes{autoLabel('notes')}</>} optional><textarea className={cls('notes')} rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </AutoGlow>

        {members.length > 1 && (
          <>
            <div className="h-section" style={{ margin: '6px 0 0' }}>People</div>
            <Field label={<><Users size={14} />Who paid</>}>
              <select className="input" value={d.paidByUid} onChange={(e) => set('paidByUid', e.target.value)}>{members.map((m) => <option key={m.uid} value={m.uid}>{m.uid === uid ? 'You' : m.name}</option>)}</select>
            </Field>
            {!isEdit && s.can('money_split_equal') && <Toggle on={d.splitEqually} onChange={(v) => set('splitEqually', v)} label="Split equally with everyone" hint={`${members.length} people · ${inr(Number(d.amount || 0) / members.length)} each`} />}
          </>
        )}
        {s.can('money_flag') && <Toggle on={d.flagged} onChange={(v) => set('flagged', v)} label={<span className="row" style={{ gap: 6 }}><Flag size={15} />Flag for follow-up</span>} />}

        <Press className="btn btn-primary btn-block" disabled={busy || done} onClick={() => save(false)} style={{ marginTop: 6, minHeight: 52 }}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : `Save ${d.amount ? inr(Number(d.amount.replace(/,/g, '')) || 0) : 'entry'}`}
          {capture?.queue?.length ? <span className="btn-trail hint" style={{ color: '#CFEDE6' }}>then next ({capture.queue.length})</span> : null}
        </Press>
      </div>

      <Sheet open={!!dup} onClose={() => setDup(null)} title={<span className="row" style={{ gap: 8 }}><AlertTriangle size={18} color="var(--amber)" />Looks like a duplicate</span>}
        footer={<><Press className="btn btn-secondary" onClick={() => { const m = dup?.[0]; setDup(null); if (m) nav(`/book/${bookId}/entry/${m.id}`); }}>Open existing</Press><Press className="btn btn-primary grow" onClick={() => { setDup(null); void save(true); }}>Save anyway</Press></>}>
        <p style={{ color: 'var(--ink-2)' }}>This book already has an entry with the same amount{d.upiRef ? ' or UPI reference' : ''} around this date.</p>
        {(dup || []).slice(0, 3).map((m) => (
          <div key={m.id} className="card card-pad row"><div className="grow"><p style={{ font: '500 15px var(--font)' }}>{m.merchant || m.description || 'Entry'}</p><p className="hint">{m.date} {m.time || ''} {m.upiRef ? `· ${m.upiRef}` : ''}</p></div><span className="mono">{inr(Number(m.amount))}</span></div>
        ))}
      </Sheet>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(255,255,255,.94)', display: 'grid', placeItems: 'center' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 16 }}>
              <SuccessMark confettiOn={!!capture} />
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ font: '600 20px var(--font)' }}>{d.amount ? inr(Number(d.amount.replace(/,/g, ''))) : ''} saved</motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
