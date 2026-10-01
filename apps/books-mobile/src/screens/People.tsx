import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Link2, Mail, Trash2, LogOut, Plus, X, Copy } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { getBook, updateBook, deleteBook, leaveBook, removeMember, setMemberRole, createInvite, ensureMailbox, accountsOf, categoriesOf, canManage, roleOf, type Book, type Role, type MoneyAccount } from '../lib/books';
import { useSession } from '../lib/session';
import { isNative } from '../lib/api';
import { newId } from '../lib/format';
import { AppBar, Avatar, Field, Seg, ListSkeleton, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, motion, AnimatePresence } from '../motion';

const ROLE_COPY: Record<Role, string> = { owner: 'Owner', admin: 'Admin · can manage people', contributor: 'Can add & edit', viewer: 'View only' };

export function BookPeople() {
  const { bookId = '' } = useParams();
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const uid = s.user?.uid || '';
  const [book, setBook] = useState<Book | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [role, setRole] = useState<Role>('contributor'); const [email, setEmail] = useState(''); const [link, setLink] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => getBook(bookId).then(setBook).catch((e) => toast({ text: e.message, tone: 'error' }));
  useEffect(() => { void load(); }, [bookId]);
  if (!book) return <div className="screen no-nav"><AppBar back title="People" rule /><ListSkeleton rows={4} /></div>;

  const manage = canManage(book, uid) && s.can('money_people');
  const members = Object.entries(book.roles || {}).map(([id, r]) => ({ uid: id, role: (book.ownerId === id ? 'owner' : r.role || 'viewer') as Role, name: r.displayName || r.email?.split('@')[0] || 'Member', email: r.email || '' }))
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.name.localeCompare(b.name)));
  const limit = s.usage?.meters?.members_per_book?.limit ?? -1;
  const full = !s.isOwner && limit >= 0 && members.length >= limit;

  const makeLink = async () => {
    setBusy(true);
    try { const r = await createInvite(bookId, role, email.trim() || undefined); setLink(r.link || `https://www.easypado.com/invite/${r.code}`); if (email.trim()) toast({ text: `Invite emailed to ${email.trim()}` }); }
    catch (e) { if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <div className="screen no-nav">
      <AppBar back={`/book/${bookId}`} title="People" kicker={book.name} rule
        right={manage ? <Press className="btn btn-primary btn-sm" onClick={() => { if (full) { s.openPaywall('members_per_book'); return; } setLink(''); setEmail(''); setInviteOpen(true); }}><UserPlus size={16} />Invite</Press> : null} />
      {limit >= 0 && !s.isOwner && <p className="hint pad" style={{ padding: '10px 16px' }}>{members.length} of {limit} people on your plan</p>}
      <Stagger className="list">
        <AnimatePresence>
          {members.map((m) => (
            <motion.div key={m.uid} layout exit={{ opacity: 0, height: 0 }}>
              <Item className="list-row" style={{ cursor: 'default' }}>
                <Avatar name={m.name} />
                <div className="grow"><p className="t">{m.uid === uid ? `${m.name} (you)` : m.name}</p><p className="s ellipsis">{m.email}</p></div>
                {manage && m.role !== 'owner' && m.uid !== uid ? (
                  <select className="input" style={{ width: 132, minHeight: 38, fontSize: 14 }} value={m.role} onChange={async (e) => {
                    const r = e.target.value as Role;
                    try { setBook(await setMemberRole(bookId, m.uid, r)); toast({ text: `${m.name} is now ${ROLE_COPY[r].split(' ·')[0].toLowerCase()}` }); } catch (err) { toast({ text: (err as Error).message, tone: 'error' }); }
                  }}>{(['admin', 'contributor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_COPY[r].split(' ·')[0]}</option>)}</select>
                ) : <span className="badge">{ROLE_COPY[m.role].split(' ·')[0]}</span>}
                {manage && m.role !== 'owner' && m.uid !== uid && (
                  <Press className="icon-btn" title="Remove" onClick={async () => {
                    const { ok } = await confirm({ title: `Remove ${m.name}?`, body: 'They lose access to this book. Their past entries stay.', confirm: 'Remove', danger: true });
                    if (ok) { setBook(await removeMember(bookId, m.uid)); toast({ text: `${m.name} removed` }); }
                  }}><X size={18} /></Press>
                )}
              </Item>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stagger>
      {roleOf(book, uid) !== 'owner' && (
        <div className="pad" style={{ paddingTop: 20 }}>
          <Press className="btn btn-danger btn-block" onClick={async () => { const { ok } = await confirm({ title: 'Leave this book?', body: 'You’ll need a new invite to come back.', confirm: 'Leave', danger: true }); if (ok) { await leaveBook(bookId); nav('/', { replace: true }); } }}><LogOut size={18} />Leave book</Press>
        </div>
      )}

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite to this book">
        <Field label="They can"><Seg id="invrole" value={role} onChange={setRole} options={[{ value: 'contributor', label: 'Add & edit' }, { value: 'viewer', label: 'View' }, { value: 'admin', label: 'Admin' }]} /></Field>
        <Field label={<><Mail size={14} />Email</>} optional hint="Leave empty to just get a link to share"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" /></Field>
        {!link ? <Press className="btn btn-primary btn-block" disabled={busy} onClick={makeLink}><Link2 size={18} />{busy ? 'Creating…' : email ? 'Send invite' : 'Create invite link'}</Press> : (
          <motion.div className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card card-pad row"><span className="grow mono ellipsis">{link}</span><Press className="icon-btn" title="Copy" onClick={async () => { await Clipboard.write({ string: link }); toast({ text: 'Link copied' }); }}><Copy size={18} /></Press></div>
            <Press className="btn btn-primary btn-block" onClick={async () => { const text = `Join "${book.name}" on Byjan: ${link}`; if (isNative()) await Share.share({ text, dialogTitle: 'Share invite' }); else { await navigator.clipboard.writeText(text); toast({ text: 'Copied' }); } }}><img src="/brands/whatsapp.svg" alt="" width={18} height={18} />Share on WhatsApp or anywhere</Press>
            <p className="hint">Link works once and expires in 7 days.</p>
          </motion.div>
        )}
      </Sheet>
    </div>
  );
}

export function BookSettings() {
  const { bookId = '' } = useParams();
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [book, setBook] = useState<Book | null>(null);
  const [name, setName] = useState(''); const [budget, setBudget] = useState(''); const [cats, setCats] = useState<string[]>([]); const [accs, setAccs] = useState<MoneyAccount[]>([]);
  const [newCat, setNewCat] = useState(''); const [mail, setMail] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    void getBook(bookId).then((b) => { setBook(b); setName(b.name); setBudget(b.monthlyBudget ? String(b.monthlyBudget) : ''); setCats(categoriesOf(b)); setAccs(accountsOf(b)); });
    if (s.can('money_email_mailbox')) void ensureMailbox(bookId).then(setMail).catch(() => undefined);
  }, [bookId]);
  if (!book) return <div className="screen no-nav"><AppBar back title="Book settings" rule /><ListSkeleton rows={4} /></div>;
  const manage = canManage(book, s.user?.uid || '');

  const save = async () => {
    if (!name.trim()) { toast({ text: 'Book needs a name', tone: 'error' }); return; }
    setBusy(true);
    try { const b = await updateBook(bookId, { name: name.trim(), monthlyBudget: budget ? Number(budget) : 0, categories: cats, moneyAccounts: accs }); setBook(b); toast({ text: 'Saved' }); }
    catch (e) { toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <div className="screen no-nav">
      <AppBar back={`/book/${bookId}`} title="Book settings" kicker={book.name} rule right={manage ? <Press className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Press> : null} />
      <div className="stack" style={{ padding: 16, gap: 18 }}>
        <Field label="Name"><input className="input" value={name} disabled={!manage} onChange={(e) => setName(e.target.value)} /></Field>
        {s.can('money_budget') && <Field label="Monthly budget ₹" optional hint="We’ll warn you at 80% and 100%"><input className="input" inputMode="numeric" disabled={!manage} value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} /></Field>}
        <div className="h-section" style={{ margin: 0 }}>Categories</div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          <AnimatePresence>{cats.map((c) => <motion.span key={c} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="chip">{c}{manage && <X size={14} onClick={() => setCats(cats.filter((x) => x !== c))} />}</motion.span>)}</AnimatePresence>
        </div>
        {manage && <div className="row"><input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newCat.trim() && !cats.includes(newCat.trim())) { setCats([...cats, newCat.trim()]); setNewCat(''); } }} /><Press className="btn btn-secondary" onClick={() => { if (newCat.trim() && !cats.includes(newCat.trim())) { setCats([...cats, newCat.trim()]); setNewCat(''); } }}><Plus size={18} /></Press></div>}
        <div className="h-section" style={{ margin: 0 }}>Accounts</div>
        {accs.map((a, i) => (
          <div key={a.id} className="row">
            <input className="input grow" value={a.name} disabled={!manage} onChange={(e) => setAccs(accs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <select className="input" style={{ width: 130 }} disabled={!manage} value={a.kind} onChange={(e) => setAccs(accs.map((x, j) => (j === i ? { ...x, kind: e.target.value as MoneyAccount['kind'] } : x)))}>
              {['cash', 'bank', 'upi', 'debit_card', 'credit_card', 'wallet', 'custom'].map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
            </select>
            {manage && accs.length > 1 && <Press className="icon-btn" title="Archive" onClick={() => setAccs(accs.filter((_, j) => j !== i))}><X size={18} /></Press>}
          </div>
        ))}
        {manage && <Press className="btn btn-secondary" onClick={() => setAccs([...accs, { id: newId('acc'), name: 'New account', kind: 'bank' }])}><Plus size={18} />Add account</Press>}
        {mail && (
          <>
            <div className="h-section" style={{ margin: 0 }}>Email-in address</div>
            <div className="card card-pad row"><span className="grow mono" style={{ wordBreak: 'break-all' }}>{mail}</span><Press className="icon-btn" onClick={async () => { await Clipboard.write({ string: mail }); toast({ text: 'Copied' }); }}><Copy size={18} /></Press></div>
            <p className="hint">Forward bills and payment emails here — they become entries in this book.</p>
          </>
        )}
        {manage && roleOf(book, s.user?.uid || '') === 'owner' && s.can('money_delete_book') && (
          <Press className="btn btn-danger btn-block" style={{ marginTop: 12 }} onClick={async () => {
            const { ok } = await confirm({ title: `Delete “${book.name}”?`, body: 'Everyone loses access. Entries and receipts are removed after 30 days.', confirm: 'Delete book', danger: true });
            if (ok) { await deleteBook(bookId); toast({ text: 'Book deleted' }); nav('/', { replace: true }); }
          }}><Trash2 size={18} />Delete book</Press>
        )}
      </div>
    </div>
  );
}
