import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookText,
  ChevronRight,
  CircleHelp,
  Download,
  KeyRound,
  LifeBuoy,
  Lock,
  RefreshCw,
  Send,
  Settings2,
  Share2,
  Smartphone,
  Split,
  Ticket,
  UserX,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createSupportTicket,
  helpGroups,
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

const ICONS: Record<string, React.ReactNode> = {
  signin: <KeyRound />,
  lock: <Lock />,
  display: <Settings2 />,
  account: <UserX />,
  books: <BookText />,
  receipts: <Smartphone />,
  recurring: <RefreshCw />,
  export: <Download />,
  reports: <CircleHelp />,
  splitpay: <Split />,
  upi: <Wallet />,
  sharing: <Share2 />,
  notifications: <Bell />,
  offline: <WifiOff />,
  play: <Smartphone />,
  other: <LifeBuoy />,
};

export default function HelpPage() {
  const { isSuperUser } = useAuth();
  const { addToast } = useToast();
  const groups = useMemo(() => helpGroups(), []);
  const [topicId, setTopicId] = useState<HelpTopicId>('signin');
  const [sub, setSub] = useState('');
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

  const pickTopic = (id: HelpTopicId) => {
    setTopicId(id);
    setSub('');
    setSubject(helpTopic(id).title);
  };

  const pickSub = (label: string) => {
    setSub(label);
    setSubject(`${topic.title}: ${label}`);
    if (!message.trim()) setMessage(`${label}. `);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const details = message.trim();
    if ((needsDetails || topicId === 'other') && details.length < 8) {
      setError('Write what happened, or pick a question above if one already answers it.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await createSupportTicket({
        category: topicId,
        subject: subject.trim() || (sub ? `${topic.title}: ${sub}` : topic.title),
        message: details || `${sub ? `${sub}. ` : ''}${topic.answer}`,
      });
      setMessage('');
      setSubject('');
      setSub('');
      addToast(result.mailed ? 'Ticket sent to Byjan Books' : 'Ticket saved. We have it even if email is delayed.', 'success');
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this to Byjan Books.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="help-page web-page">
      <header className="help-hero">
        <span className="help-hero-mark"><LifeBuoy /></span>
        <div>
          <p className="help-kicker">Byjan Books</p>
          <h1>Help &amp; tickets</h1>
          <p>Pick a topic, then a sub-option. If nothing fits, choose Other and type it. Tickets are stored on your account and emailed to byjanbooks@gmail.com.</p>
        </div>
      </header>

      <div className="help-layout">
        <div className="help-stack">
          {groups.map((group) => (
            <section key={group.title} className="help-group">
              <h2>{group.title}</h2>
              <div className="help-topic-list">
                {group.topics.map((row) => {
                  const on = topicId === row.id;
                  return (
                    <div key={row.id} className={`help-topic ${on ? 'is-on' : ''}`}>
                      <button type="button" className="help-topic-btn" onClick={() => pickTopic(row.id)}>
                        <span className="help-topic-ico">{ICONS[row.id]}</span>
                        <span className="help-topic-copy">
                          <strong>{row.title}</strong>
                          <em>{row.subs.slice(0, 2).join(' · ')}</em>
                        </span>
                        <ChevronRight />
                      </button>
                      {on ? (
                        <div className="help-topic-body">
                          <p>{row.answer}</p>
                          <p className="help-sub-label">Sub-options</p>
                          <div className="help-subs">
                            {row.subs.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className={sub === label ? 'is-on' : ''}
                                onClick={() => pickSub(label)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="help-compose">
          <p className="help-kicker"><Ticket /> Send to Byjan Books</p>
          <h2>{sub || topic.title}</h2>
          <p className="help-compose-hint">This creates a real ticket. You will see it under Your tickets.</p>
          <label>
            <span>Topic</span>
            <select value={topicId} onChange={(event) => pickTopic(event.target.value as HelpTopicId)}>
              {groups.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.topics.map((row) => (
                    <option key={row.id} value={row.id}>{row.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={topic.title}
              maxLength={120}
            />
          </label>
          <label>
            <span>{needsDetails || topicId === 'other' ? 'What happened?' : 'Extra detail'}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={sub ? `Add detail for “${sub}”.` : 'Write the issue in your own words.'}
              maxLength={4000}
            />
          </label>
          {error ? <p className="help-error">{error}</p> : null}
          <button type="submit" disabled={sending} className="byjan-btn help-send">
            <Send />
            {sending ? 'Sending…' : 'Send issue'}
          </button>
        </form>
      </div>

      <section className="help-tickets">
        <div className="help-tickets-head">
          <h2>Your tickets</h2>
          <button type="button" className="byjan-btn-ghost" onClick={() => void loadTickets()}>
            <RefreshCw /> Refresh
          </button>
        </div>
        {loading ? (
          <p className="help-muted">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <div className="help-empty">No tickets yet. Pick a topic and send one — it will show here.</div>
        ) : (
          <ul className="help-ticket-list">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <div>
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.categoryLabel || ticket.category} · {ticket.id}{isSuperUser && ticket.email ? ` · ${ticket.email}` : ''}</span>
                </div>
                <em className={ticket.status === 'open' ? 'is-open' : ''}>{ticket.status}</em>
                {ticket.message ? <p>{ticket.message}</p> : null}
                <time>{formatWhen(ticket.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
