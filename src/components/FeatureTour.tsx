import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CapacitorService } from '../lib/capacitor';

type Step = { title: string; body: string };

const TOURS: Record<string, { id: string; steps: Step[] }> = {
  home: {
    id: 'home',
    steps: [
      { title: 'Home', body: 'This is your command center. Money and Business are separate, so each tab looks different.' },
      { title: 'Tabs', body: 'Home, Money, Business, and Settings stay at the bottom. You only see the tabs you are allowed to use.' },
    ],
  },
  money: {
    id: 'money',
    steps: [
      { title: 'Money books', body: 'Each book is a shared list of money in and money out. Totals at the top are for these books only.' },
      { title: 'People', body: 'On a book you run, tap People to invite someone and choose their access.' },
    ],
  },
  ledger: {
    id: 'ledger',
    steps: [
      { title: 'Two ways to add', body: 'Add expense (dark button) is for bills, photos, and full details. Fast add below is optional — type Swiggy 349 or paste a UPI SMS.' },
      { title: 'Team alerts', body: 'When anyone records an entry, the rest of the book gets a sound, a light vibrate, and a notification.' },
      { title: 'People & access', body: 'The People button opens invites and roles for this book.' },
    ],
  },
  books: {
    id: 'books',
    steps: [
      { title: 'Business', body: 'Invoices, bills, GST, and reports live here. Daily shared spend stays under Money.' },
    ],
  },
  settings: {
    id: 'settings',
    steps: [
      { title: 'Settings', body: 'Name, currency, and display options. Sign out is on your photo.' },
    ],
  },
  access: {
    id: 'access',
    steps: [
      { title: 'Access & roles', body: 'Search a person by name or email. Turn features on or off. Inviting someone to a money book is still inside that book’s People button.' },
    ],
  },
};

function tourKey(id: string) {
  return `byjan.tour.${id}`;
}

function tourFor(pathname: string) {
  if (pathname === '/') return TOURS.home;
  if (pathname === '/expenses') return TOURS.money;
  if (pathname.startsWith('/book/')) return TOURS.ledger;
  if (pathname.startsWith('/books')) return TOURS.books;
  if (pathname === '/settings') return TOURS.settings;
  if (pathname === '/access') return TOURS.access;
  return null;
}

export default function FeatureTour() {
  const location = useLocation();
  const tour = useMemo(() => tourFor(location.pathname), [location.pathname]);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tour) {
      setOpen(false);
      return;
    }
    let seen = '';
    try { seen = localStorage.getItem(tourKey(tour.id)) || ''; } catch { /* ignore */ }
    setStep(0);
    setOpen(!seen);
  }, [tour?.id]);

  if (!tour || !open) return null;
  const current = tour.steps[step];
  if (!current) return null;

  const finish = (how: 'done' | 'skipped') => {
    try { localStorage.setItem(tourKey(tour.id), how); } catch { /* ignore */ }
    void CapacitorService.hapticTick();
    setOpen(false);
  };

  const next = () => {
    void CapacitorService.hapticTick();
    if (step + 1 >= tour.steps.length) finish('done');
    else setStep((n) => n + 1);
  };

  return (
    <div className="ios-tour" role="dialog" aria-labelledby="ios-tour-title">
      <div className="ios-tour-card">
        <p className="ios-tour-kicker">Quick tour · {step + 1} of {tour.steps.length}</p>
        <h2 id="ios-tour-title" className="ios-tour-title">{current.title}</h2>
        <p className="ios-tour-body">{current.body}</p>
        <div className="ios-tour-dots" aria-hidden>
          {tour.steps.map((_, i) => <span key={i} data-on={i === step} />)}
        </div>
        <div className="ios-tour-actions">
          <button type="button" className="ios-tour-skip" onClick={() => finish('skipped')}>Skip tour</button>
          <button type="button" className="ios-tour-next" onClick={next}>
            {step + 1 >= tour.steps.length ? 'Got it' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
