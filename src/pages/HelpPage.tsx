import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleHelp, LifeBuoy, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  HELP_TOPICS,
  createSupportTicket,
  helpTopic,
  listSupportTickets,
  type HelpTopicId,
  type SupportTicket,
} from '../lib/support';

function formatWhen(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function HelpPage() {
  const { isSuperUser } = useAuth();
  const { addToast } = useToast();
  const [topicId, setTopicId] = useState<HelpTopicId>('signin');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const topic = useMemo(() => helpTopic(topicId), [topicId]);
  const needsDetails = topicId === 'other' || !topic.answer;

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSupportTickets(isSuperUser);
      setTickets(rows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }, [isSuperUser]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const details = message.trim();
    if (needsDetails && details.length < 8) {
      setError('Write what happened, or pick a question above if one already answers it.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await createSupportTicket({
        category: topicId,
        subject: subject.trim() || topic.title,
        message: details || topic.answer,
      });
      setMessage('');
      setSubject('');
      addToast(result.mailed ? 'Ticket sent to Byjan Books' : 'Ticket saved. We have it even if email is delayed.', 'success');
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this to Byjan Books.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28 md:pb-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Support</p>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Help</h1>
        <p className="text-sm text-slate-500 mt-1">
          Common answers first. If yours is not listed, choose Other, write it in your own words, and send it to Byjan Books.
          Tickets are stored on your account so you can come back to them.
        </p>
      </div>

      <section className="byjan-card p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <CircleHelp className="w-3.5 h-3.5" /> Common questions
        </p>
        <div className="flex flex-wrap gap-2">
          {HELP_TOPICS.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${topicId === row.id ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]' : 'bg-white text-slate-600 border-slate-200'}`}
              onClick={() => setTopicId(row.id)}
            >
              {row.title}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">{topic.title}</p>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{topic.answer}</p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="byjan-card p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <LifeBuoy className="w-3.5 h-3.5" /> Send to Byjan Books
        </p>
        <p className="text-xs text-slate-500">
          This creates a real ticket and emails <strong>byjanbooks@gmail.com</strong>. You will see it in Your tickets below.
        </p>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Topic</span>
          <select
            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
            value={topicId}
            onChange={(event) => setTopicId(event.target.value as HelpTopicId)}
          >
            {HELP_TOPICS.map((row) => (
              <option key={row.id} value={row.id}>{row.title}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Subject (optional)</span>
          <input
            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={topic.title}
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            {needsDetails ? 'What happened?' : 'Extra detail (optional)'}
          </span>
          <textarea
            className="w-full min-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={needsDetails ? 'Write the issue in your own words.' : 'Add anything the common answer did not cover.'}
            maxLength={4000}
          />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button type="submit" disabled={sending} className="byjan-btn">
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send issue to Byjan Books'}
        </button>
      </form>

      <section className="byjan-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your tickets</p>
          <button type="button" className="text-xs font-semibold text-[#0B8F84]" onClick={() => void loadTickets()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-slate-500">No tickets yet. Send one above and it will show up here.</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-2xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0B1F3A]">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ticket.categoryLabel || ticket.category} · {ticket.id}
                      {isSuperUser && ticket.email ? ` · ${ticket.email}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${ticket.status === 'open' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    {ticket.status}
                  </span>
                </div>
                {ticket.message ? <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{ticket.message}</p> : null}
                <p className="text-[11px] text-slate-400 mt-2">{formatWhen(ticket.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
