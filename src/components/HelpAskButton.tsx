import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { CircleHelp, Loader2, Send } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { createSupportTicket } from '../lib/support';

function screenLabel(path: string) {
  if (path === '/' || path === '') return 'Home';
  if (path.startsWith('/book/')) return 'Money book';
  if (path.startsWith('/expenses')) return 'Money books';
  if (path.startsWith('/settings')) return 'Settings';
  if (path.startsWith('/help')) return 'Help';
  if (path.startsWith('/activity')) return 'Activity';
  if (path.startsWith('/books')) return 'Business';
  return 'Byjan';
}

/** Header help. Sends a ticket from the current screen and does not touch the page underneath. */
export default function HelpAskButton() {
  const location = useLocation();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const screen = screenLabel(location.pathname);

  const close = () => {
    if (sending) return;
    setOpen(false);
  };

  const send = async () => {
    const text = message.trim();
    if (text.length < 8 || sending) return;
    setSending(true);
    try {
      await createSupportTicket({
        category: 'other',
        subject: `Issue on ${screen}`,
        message: `${text}\n\nScreen: ${location.pathname || '/'}`,
      });
      setMessage('');
      setOpen(false);
      addToast('Sent to Byjan. We will reply on this account.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not send that. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" className="byjan-bell" title="Send an issue" aria-label="Send an issue" data-testid="help-ask" onClick={() => setOpen(true)}>
        <CircleHelp className="w-5 h-5" />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <>
          <div className="fixed inset-0 bg-slate-900/50 z-[190]" onClick={close} />
          <div className="byjan-dialog z-[200] w-[min(100%-1.5rem,24rem)] rounded-[22px] bg-white border border-slate-200 p-5 shadow-[0_28px_72px_-18px_rgba(30,45,120,0.42)]" role="dialog" aria-label="Send an issue" data-testid="help-ask-sheet">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{screen}</p>
            <h2 className="text-base font-semibold text-[#0B1F3A] mt-1">Send an issue</h2>
            <p className="text-sm text-slate-500 mt-1">This stays on this screen. Nothing else is saved or changed.</p>
            <textarea
              className="byjan-input mt-3 min-h-[120px] resize-y"
              placeholder="What went wrong?"
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="help-ask-message"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="byjan-btn-ghost" onClick={close} disabled={sending}>Close</button>
              <button type="button" className="byjan-btn" data-testid="help-ask-send" disabled={sending || message.trim().length < 8} onClick={() => void send()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}
