import React, { useState } from 'react';
import { BookOpen, Mic, ScanLine, Split, BarChart3, ChevronRight } from 'lucide-react';
import BrandLogo from './BrandLogo';

const SLIDES = [
  {
    id: 'books',
    kicker: 'Money books',
    title: 'Every rupee in a book you own',
    body: 'Shared ledgers for family, trips, and work. Open a book and the story of the money is already there.',
    art: 'books',
  },
  {
    id: 'capture',
    kicker: 'Capture',
    title: 'Add, scan, or speak an entry',
    body: 'Type it, photograph a receipt, or dictate. Byjan files the amount, merchant, and date for you.',
    art: 'capture',
  },
  {
    id: 'split',
    kicker: 'Settle',
    title: 'Split, then pay with the real UPI apps',
    body: 'Swipe to unlock, then pay through PhonePe, Google Pay, Paytm, or CRED. Success comes back into the book.',
    art: 'split',
  },
  {
    id: 'insight',
    kicker: 'Clarity',
    title: 'Reports when you need them, not noise',
    body: 'Inbox reminders, upcoming bills, and downloadable reports — organized instead of dumped on one screen.',
    art: 'insight',
  },
] as const;

export default function OnboardingSlides({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <div className="onboard-shell">
      <div className="onboard-top">
        <BrandLogo size="md" />
        <button type="button" className="onboard-skip" onClick={onDone}>Skip</button>
      </div>
      <div className={`onboard-art is-${slide.art}`} aria-hidden>
        {slide.art === 'books' && (
          <div className="onboard-stack">
            <span /><span /><span />
            <BookOpen className="onboard-art-icon" />
          </div>
        )}
        {slide.art === 'capture' && (
          <div className="onboard-capture">
            <span className="onboard-scan" />
            <ScanLine className="onboard-art-icon" />
            <Mic className="onboard-art-icon onboard-art-mic" />
          </div>
        )}
        {slide.art === 'split' && (
          <div className="onboard-split">
            <span /><span /><span />
            <Split className="onboard-art-icon" />
          </div>
        )}
        {slide.art === 'insight' && (
          <div className="onboard-bars">
            <i /><i /><i /><i />
            <BarChart3 className="onboard-art-icon" />
          </div>
        )}
      </div>
      <p className="onboard-kicker">{slide.kicker}</p>
      <h1 className="onboard-title">{slide.title}</h1>
      <p className="onboard-body">{slide.body}</p>
      <div className="onboard-dots" role="tablist" aria-label="Onboarding slides">
        {SLIDES.map((row, i) => (
          <button
            key={row.id}
            type="button"
            className={`onboard-dot${i === index ? ' is-on' : ''}`}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <button
        type="button"
        className="byjan-btn w-full h-11 onboard-next"
        onClick={() => {
          if (last) onDone();
          else setIndex((n) => n + 1);
        }}
      >
        {last ? 'Continue to sign in' : 'Next'}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
