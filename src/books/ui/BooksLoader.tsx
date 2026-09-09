import React from 'react';
import BrandLogo from '../../components/BrandLogo';
import { BooksGlyph, glyphForHref, type BooksGlyphName } from './icons';

export function BooksLoader({
  feature = 'Books',
  href = '/books',
  compact = false,
}: {
  feature?: string;
  href?: string;
  compact?: boolean;
}) {
  const glyph: BooksGlyphName = glyphForHref(href);
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-[#0B1F3A]" role="status" aria-label={`Opening ${feature}`}>
        <span className="books-loader-stage books-loader-stage-sm">
          <span className="books-loader-spine" />
          <span className="books-loader-page" />
          <span className="books-loader-cover" />
        </span>
        <BooksGlyph name={glyph} className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-5" role="status" aria-live="polite">
      <div className="relative">
        <div className="absolute -top-3 -left-3 z-10">
          <BrandLogo size="sm" />
        </div>
        <div className="books-loader-stage">
          <span className="books-loader-spine" />
          <span className="books-loader-page">
            <BooksGlyph name={glyph} className="w-8 h-8" />
          </span>
          <span className="books-loader-cover" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-display text-lg text-[#0B1F3A] tracking-tight">Byjan Books</p>
        <p className="text-sm text-slate-500 mt-1">Opening {feature}…</p>
      </div>
    </div>
  );
}
