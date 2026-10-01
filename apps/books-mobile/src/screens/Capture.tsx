import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera as CamIcon, Images, FileText, MessageSquareText, Mail, Mic, PenLine, Check, BookOpen, Copy, RotateCcw, AlertCircle } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Clipboard } from '@capacitor/clipboard';
import { listBooks, ensureMailbox, getBook, type Book } from '../lib/books';
import { processReceipt, rankContexts, parseText, type CapturePreview } from '../lib/money';
import { prepareFile, uploadPrepared, fileToDataUrl } from '../lib/receipts';
import { takePending, setPending, type CaptureInput } from '../lib/share';
import { autofill, blankDraft, extractLocal, FIELD_LABELS, type DraftKey } from '../lib/autofill';
import { useSession } from '../lib/session';
import { isNative } from '../lib/api';
import { inr, newId } from '../lib/format';
import { AppBar, Empty, SourceLogo, useToast } from '../ui';
import { Press, Sheet, ScanBeam, Stagger, Item, motion, AnimatePresence, BrandLoader } from '../motion';
import type { CaptureState } from './EntryForm';
import { tick, success } from '../lib/haptics';

const lastBook = () => localStorage.getItem('byjan.lastBook') || '';

/** "Add" sheet: every way money can come in. */
export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'menu' | 'paste' | 'email' | 'voice'>('menu');
  const [text, setText] = useState('');
  const [mail, setMail] = useState('');
  const [listening, setListening] = useState(false);
  useEffect(() => { if (open) { setMode('menu'); setText(''); } }, [open]);

  const go = (items: CaptureInput[], source: string) => { setPending({ items, source, receivedAt: Date.now(), text: items[0]?.text }); onClose(); nav('/capture', { state: { fromSheet: Date.now() } }); };
  const scanOk = () => s.can('money_scan') && s.guard('receipt_scans');

  const camera = async () => {
    if (!scanOk()) return;
    try { const p = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.DataUrl, quality: 88, correctOrientation: true }); if (p.dataUrl) go([{ dataUrl: p.dataUrl, fileName: 'scan.jpg', mimeType: 'image/jpeg', source: 'camera' }], 'camera'); }
    catch (e) { if (!/cancel/i.test(String((e as Error).message))) toast({ text: 'Camera is not available. Allow camera access in Settings.', tone: 'error' }); }
  };
  const gallery = async () => {
    if (!scanOk()) return;
    if (!isNative()) { fileRef.current?.click(); return; }
    try {
      const r = await Camera.pickImages({ limit: 10, quality: 88 });
      const items = await Promise.all(r.photos.map(async (p) => {
        const blob = await (await fetch(p.webPath)).blob();
        return { dataUrl: await fileToDataUrl(new File([blob], `photo.${p.format}`, { type: blob.type })), fileName: `photo.${p.format}`, mimeType: blob.type, source: 'gallery' };
      }));
      if (items.length) go(items, 'gallery');
    } catch (e) { if (!/cancel/i.test(String((e as Error).message))) toast({ text: 'Could not open your gallery', tone: 'error' }); }
  };
  const voice = async () => {
    if (!s.can('money_voice') || !s.guard('voice_entries')) return;
    setMode('voice');
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) { toast({ text: 'Voice isn’t supported on this phone yet — type it instead.' }); return; }
    const r = new SR(); r.lang = 'en-IN'; r.interimResults = true; r.continuous = false;
    r.onresult = (ev) => setText(Array.from(ev.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    setListening(true); tick(); r.start();
  };

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'paste' ? 'Paste SMS or text' : mode === 'email' ? 'Email bills to this book' : mode === 'voice' ? 'Say the entry' : 'Add money'}>
      <AnimatePresence mode="wait">
        {mode === 'menu' && (
          <Stagger key="menu" className="stack" style={{ gap: 10 }}>
            <Item className="grid2">
              {s.can('money_scan') && <Press className="card card-pad" style={{ display: 'grid', gap: 10, textAlign: 'left', cursor: 'pointer' }} onClick={camera}><CamIcon size={24} color="var(--teal-700)" /><span><b style={{ fontWeight: 600 }}>Scan</b><br /><span className="hint">Bill or receipt</span></span></Press>}
              {s.can('money_scan') && <Press className="card card-pad" style={{ display: 'grid', gap: 10, textAlign: 'left', cursor: 'pointer' }} onClick={gallery}><Images size={24} color="var(--teal-700)" /><span><b style={{ fontWeight: 600 }}>Screenshots</b><br /><span className="hint">UPI apps · up to 10</span></span></Press>}
            </Item>
            <Item className="list" style={{ margin: '0 -16px' }}>
              {s.can('money_scan') && <div className="list-row" onClick={() => { if (scanOk()) fileRef.current?.click(); }}><FileText size={20} /><div className="grow"><p className="t">PDF or file</p><p className="s">Invoices, statements, Excel</p></div></div>}
              <div className="list-row" onClick={async () => { setMode('paste'); try { const c = await Clipboard.read(); if (c.value && /₹|rs\.?|inr|debited|credited|upi/i.test(c.value)) setText(c.value); } catch { /* no clipboard */ } }}><MessageSquareText size={20} /><div className="grow"><p className="t">Paste bank / UPI SMS</p><p className="s">Or long-press an SMS → Share → Byjan</p></div></div>
              {s.can('money_voice') && <div className="list-row" onClick={voice}><Mic size={20} /><div className="grow"><p className="t">Voice</p><p className="s">“Paid 450 for diesel by UPI”</p></div>{s.remaining('voice_entries') !== Infinity && <span className="badge">{s.remaining('voice_entries')} left</span>}</div>}
              {s.can('money_email_mailbox') && <div className="list-row" onClick={async () => { setMode('email'); const b = lastBook(); if (b) setMail(await ensureMailbox(b).catch(() => '')); }}><Mail size={20} /><div className="grow"><p className="t">Email forward</p><p className="s">Forward bills to your book’s address</p></div></div>}
              {s.can('money_add') && <div className="list-row" onClick={() => { onClose(); const b = lastBook(); nav(b ? `/book/${b}/new` : '/capture', { state: b ? undefined : { manual: true } }); }}><PenLine size={20} /><div className="grow"><p className="t">Type it in</p><p className="s">Manual entry</p></div></div>}
            </Item>
            {s.remaining('receipt_scans') !== Infinity && <Item><p className="hint">{s.remaining('receipt_scans')} smart scans left this month · <a onClick={() => { onClose(); nav('/plans'); }}>Get more</a></p></Item>}
          </Stagger>
        )}
        {(mode === 'paste' || mode === 'voice') && (
          <motion.div key="paste" className="stack" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {mode === 'voice' && <motion.div animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 72, height: 72, borderRadius: 36, background: listening ? 'var(--teal-700)' : 'var(--sunk)', color: listening ? '#fff' : 'var(--ink-2)', display: 'grid', placeItems: 'center', alignSelf: 'center' }} onClick={voice}><Mic size={30} /></motion.div>}
            <textarea className="input" rows={6} value={text} placeholder={mode === 'voice' ? 'Listening…' : 'Rs.450.00 debited from A/c XX4421 on 01-10-26 to VPA shell.fuel@okaxis UPI Ref 427512345678'} onChange={(e) => setText(e.target.value)} autoFocus={mode === 'paste'} />
            {text && <LocalPreview text={text} />}
            <Press className="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => go([{ text: text.trim(), source: mode === 'voice' ? 'voice' : 'sms' }], mode === 'voice' ? 'voice' : 'sms')}>Fill the entry</Press>
            <button className="btn btn-ghost" onClick={() => setMode('menu')}>Back</button>
          </motion.div>
        )}
        {mode === 'email' && (
          <motion.div key="email" className="stack" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <p style={{ color: 'var(--ink-2)' }}>Forward any bill, invoice or payment email here. Byjan reads it and creates the entry in your last-opened book.</p>
            {mail ? (
              <div className="card card-pad row"><span className="grow mono" style={{ wordBreak: 'break-all' }}>{mail}</span><Press className="icon-btn" title="Copy" onClick={async () => { await Clipboard.write({ string: mail }); toast({ text: 'Address copied' }); }}><Copy size={18} /></Press></div>
            ) : <p className="hint">Open a book first, then come back here to get its address.</p>}
            <button className="btn btn-ghost" onClick={() => setMode('menu')}>Back</button>
          </motion.div>
        )}
      </AnimatePresence>
      <input ref={fileRef} type="file" accept="image/*,application/pdf,.csv,.xls,.xlsx,text/plain" multiple hidden onChange={async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 10); e.target.value = '';
        if (!files.length) return;
        const items = await Promise.all(files.map(async (f) => ({ dataUrl: await fileToDataUrl(f), fileName: f.name, mimeType: f.type, source: 'file' })));
        go(items, 'file');
      }} />
    </Sheet>
  );
}

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };

function LocalPreview({ text }: { text: string }) {
  const x = extractLocal(text);
  const keys = (['amount', 'merchant', 'date', 'time', 'upiRef', 'paymentMethod', 'category'] as DraftKey[]).filter((k) => (x as Record<string, unknown>)[k]);
  if (!keys.length) return null;
  return (
    <div className="chips" style={{ flexWrap: 'wrap' }}>
      {keys.map((k, i) => <motion.span key={k} className="badge teal" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>{FIELD_LABELS[k]}: {k === 'amount' ? inr(Number(x.amount)) : String((x as Record<string, unknown>)[k])}</motion.span>)}
    </div>
  );
}

type Step = { key: string; label: string; state: 'wait' | 'run' | 'done' | 'fail' };
type Job = { id: string; input: CaptureInput; status: 'queued' | 'reading' | 'ready' | 'failed'; error?: string; result?: CaptureState; thumb?: string; isPdf?: boolean };

/** Share/scan → pick book → upload → read → open the filled form. Handles batches of up to 10. */
export function CaptureFlow() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const loc = useLocation() as { state?: { resumeQueue?: CaptureState[]; manual?: boolean } };
  const [books, setBooks] = useState<Book[] | null>(null);
  const [bookId, setBookId] = useState('');
  const [suggested, setSuggested] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [found, setFound] = useState<Array<{ k: string; v: string }>>([]);
  const started = useRef(false);
  const pendingRef = useRef(takePending());
  const jobList = useRef<Job[]>([]);

  useEffect(() => {
    if (loc.state?.resumeQueue?.length && lastBook()) { const q = loc.state.resumeQueue; nav(`/book/${lastBook()}/new`, { replace: true, state: { capture: { ...q[0], queue: q.slice(1) } } }); return; }
    const p = pendingRef.current;
    if (!p && !loc.state?.manual) { nav('/', { replace: true }); return; }
    jobList.current = (p?.items || []).map((input) => ({ id: newId('job'), input, status: 'queued' as const, thumb: input.dataUrl && input.mimeType?.startsWith('image/') ? input.dataUrl : undefined, isPdf: input.mimeType === 'application/pdf' }));
    setJobs(jobList.current);
    void (async () => {
      const list = await listBooks().catch(() => [] as Book[]);
      setBooks(list);
      if (p?.preferredBookId && list.some((b) => b.id === p.preferredBookId)) { setBookId(p.preferredBookId); return; }
      if (list.length === 1) { setBookId(list[0].id); return; }
      const hintText = p?.items.map((i) => i.text || i.fileName || '').join(' ') || '';
      const local = extractLocal(hintText);
      const r = await rankContexts({ merchant: local.merchant, category: local.category, text: hintText.slice(0, 500) }).catch(() => ({ autoSelectId: null, contexts: [] }));
      setSuggested(r.autoSelectId || lastBook());
    })();
  }, []);

  useEffect(() => {
    if (!bookId || started.current) return;
    if (loc.state?.manual) { nav(`/book/${bookId}/new`, { replace: true }); return; }
    started.current = true;
    void run(bookId);
  }, [bookId]);

  const mark = (key: string, state: Step['state']) => setSteps((x) => x.map((st) => (st.key === key ? { ...st, state } : st)));

  const readOne = async (b: Book, job: Job, i: number, total: number): Promise<CaptureState | null> => {
    const inp = job.input;
    setJobs((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'reading' } : j)));
    let receiptPath = ''; let receiptName = ''; let preview: CapturePreview | null = null; let dataUrlForForm = '';
    const text = inp.text || '';
    if (text) { const local = extractLocal(text); setFound(Object.entries(local).filter(([, v]) => v).slice(0, 6).map(([k, v]) => ({ k, v: String(v) }))); }
    try {
      if (inp.dataUrl) {
        mark('upload', 'run');
        const f = await prepareFile(inp.dataUrl, inp.fileName || 'receipt.jpg', inp.mimeType);
        dataUrlForForm = f.isImage ? f.dataUrl : '';
        const up = await uploadPrepared(b.id, f); receiptPath = up.receiptPath; receiptName = up.receiptName;
        mark('upload', 'done'); mark('read', 'run');
        const r = await processReceipt({ bookId: b.id, receiptPath, receiptName, text: text || undefined, source: inp.source, idempotencyKey: `${job.id}`, imageBase64: f.isImage && f.base64.length < 600_000 ? f.base64 : undefined, imageMime: f.mime, mimeType: f.mime });
        preview = r.preview || r.previews?.[0] || null;
        s.bump('receipt_scans');
      } else if (text) {
        mark('upload', 'done'); mark('read', 'run');
        preview = inp.source === 'voice' ? await parseText(b.id, text, 'voice') : (await processReceipt({ bookId: b.id, text, source: inp.source, idempotencyKey: job.id })).preview || null;
        s.bump(inp.source === 'voice' ? 'voice_entries' : 'receipt_scans');
      }
      mark('read', 'done'); mark('match', 'run');
      if (preview) setFound((f0) => [...f0.filter((x) => x.k !== 'amount' && x.k !== 'merchant'), ...(preview!.amountPaise ? [{ k: 'amount', v: String(preview!.amountPaise / 100) }] : []), ...(preview!.merchant ? [{ k: 'merchant', v: preview!.merchant }] : []), ...(preview!.category ? [{ k: 'category', v: preview!.category }] : [])]);
      await new Promise((r) => setTimeout(r, 250));
      mark('match', 'done'); mark('dup', preview?.duplicateOf ? 'fail' : 'done');
    } catch (e) {
      if (s.handleQuotaError(e)) { setJobs((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'failed', error: 'Monthly scan limit reached' } : j))); return null; }
      mark('read', 'fail');
      setJobs((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'failed', error: (e as Error).message } : j)));
      if (!receiptPath && !text) return null;
      toast({ text: 'Couldn’t read everything — filled what we could. Check the fields.', tone: 'error' });
    }
    const a = autofill(blankDraft(b, s.user?.uid || ''), b, { text, preview, receiptPath, receiptName, receiptDataUrl: dataUrlForForm, source: inp.source });
    setJobs((x) => x.map((j) => (j.id === job.id ? { ...j, status: 'ready' } : j)));
    return { draft: a.draft, filled: [...a.filled], low: [...a.low], preview, batchIndex: i, batchTotal: total };
  };

  const run = async (id: string) => {
    const b = (books || []).find((x) => x.id === id) || (await getBook(id));
    localStorage.setItem('byjan.lastBook', id);
    const list = jobList.current;
    const results: CaptureState[] = [];
    for (let i = 0; i < list.length; i++) {
      setSteps([{ key: 'upload', label: list[i].input.dataUrl ? 'Uploading securely' : 'Reading message', state: 'wait' }, { key: 'read', label: 'Reading amount, date, payee, UPI ref', state: 'wait' }, { key: 'match', label: 'Matching category & account', state: 'wait' }, { key: 'dup', label: 'Checking for duplicates', state: 'wait' }]);
      setFound([]);
      const r = await readOne(b, list[i], i, list.length);
      if (r) results.push(r);
    }
    if (!results.length) return;
    success();
    nav(`/book/${id}/new`, { replace: true, state: { capture: { ...results[0], queue: results.slice(1) } } });
  };

  const current = jobs.find((j) => j.status === 'reading') || jobs[0];
  const failedAll = jobs.length > 0 && jobs.every((j) => j.status === 'failed');

  if (!bookId) {
    const sorted = (books || []).slice().sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested));
    return (
      <div className="screen no-nav">
        <AppBar back="/" title="Which book?" kicker={`${jobs.length || 1} item${jobs.length > 1 ? 's' : ''} to add`} rule />
        {current?.thumb && <div className="pad" style={{ paddingTop: 14 }}><img src={current.thumb} alt="" style={{ height: 120, borderRadius: 8, border: '1px solid var(--line)' }} /></div>}
        {!books ? <BrandLoader label="Loading your books…" /> : !books.length ? (
          <Empty icon={<BookOpen size={34} />} title="Create a book first" body="Entries live inside a money book." action={<Press className="btn btn-primary" onClick={() => nav('/')}>Go to Home</Press>} />
        ) : (
          <Stagger className="list" style={{ marginTop: 14 }}>
            {sorted.map((b) => (
              <Item key={b.id} className="list-row" onClick={() => { tick(); setBookId(b.id); }}>
                <span className="avatar" style={{ background: 'var(--teal-50)', color: 'var(--teal-700)' }}>{b.name[0]?.toUpperCase()}</span>
                <div className="grow"><p className="t">{b.name}</p><p className="s">{b.purposeLabel || 'Everyday'}</p></div>
                {b.id === suggested && <span className="badge teal">Suggested</span>}
              </Item>
            ))}
          </Stagger>
        )}
      </div>
    );
  }

  return (
    <div className="screen no-nav" style={{ background: 'var(--navy)', color: '#fff' }}>
      <div style={{ padding: 'calc(16px + var(--safe-t)) 16px 0' }}>
        <p className="kicker" style={{ color: '#5EEAD4' }}>{jobs.length > 1 ? `Reading ${jobs.findIndex((j) => j === current) + 1} of ${jobs.length}` : 'Reading your receipt'}</p>
        <h1 style={{ marginTop: 8, font: '600 24px var(--font)' }}>{failedAll ? 'We couldn’t read that' : 'Filling every field for you'}</h1>
      </div>
      <div style={{ padding: 16 }}><ScanBeam src={current?.thumb} isPdf={current?.isPdf} active={!failedAll} /></div>
      {jobs.length > 1 && (
        <div className="chips pad">{jobs.map((j) => (
          <motion.span key={j.id} layout className="badge" style={{ background: j.status === 'ready' ? 'var(--teal)' : j.status === 'failed' ? 'var(--red)' : 'rgba(255,255,255,.12)', color: '#fff' }}>
            {j.status === 'ready' ? <Check size={12} /> : j.status === 'failed' ? <AlertCircle size={12} /> : j.status === 'reading' ? '…' : '·'}
          </motion.span>))}</div>
      )}
      <div className="stack pad" style={{ gap: 10, paddingTop: 12 }}>
        {steps.map((st) => (
          <motion.div key={st.key} className="row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: st.state === 'wait' ? 0.45 : 1, x: 0 }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', background: st.state === 'done' ? 'var(--teal)' : st.state === 'fail' ? 'var(--amber)' : 'rgba(255,255,255,.14)' }}>
              {st.state === 'done' ? <Check size={13} color="#0B1F3A" strokeWidth={3} /> : st.state === 'run' ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: 6, border: '2px solid #5EEAD4', borderTopColor: 'transparent' }} /> : null}
            </span>
            <span style={{ font: '500 14.5px var(--font)' }}>{st.label}</span>
          </motion.div>
        ))}
        <div className="chips" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          <AnimatePresence>
            {found.map((f, i) => (
              <motion.span key={f.k + f.v} initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 24 }}
                className="badge" style={{ background: 'rgba(94,234,212,.16)', color: '#B9F4EA', height: 28, gap: 6 }}>
                {f.k === 'fundSource' && <SourceLogo name={f.v} size={14} />}{FIELD_LABELS[f.k as DraftKey] || f.k}: {f.k === 'amount' ? inr(Number(f.v)) : f.v}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        {failedAll && (
          <div className="stack" style={{ marginTop: 10 }}>
            <p style={{ color: 'rgba(255,255,255,.8)' }}>{jobs[0]?.error || 'The file could not be read.'}</p>
            <Press className="btn btn-block" style={{ background: 'var(--teal)', color: 'var(--navy)' }} onClick={() => { started.current = false; setJobs((x) => x.map((j) => ({ ...j, status: 'queued', error: undefined }))); void run(bookId); }}><RotateCcw size={18} />Try again</Press>
            <Press className="btn btn-block" style={{ border: '1px solid rgba(255,255,255,.3)', color: '#fff' }} onClick={() => nav(`/book/${bookId}/new`, { replace: true })}><PenLine size={18} />Type it in instead</Press>
          </div>
        )}
      </div>
    </div>
  );
}
