import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PageHeader from './PageHeader.jsx';
import Toast from '../../overlays/Toast.jsx';

const baseV = (over = {}) => ({
  hello: true,
  modN: 'Invoices',
  blurb: 'Quotes, invoices, and unpaid bills.',
  pg: { noGreet: true, acts: [] },
  showPer: false,
  per: [],
  ...over,
});

describe('PageHeader cosmetics', () => {
  it('shows status line when hello', () => {
    const { getByText, container } = render(<PageHeader v={baseV()} />);
    expect(getByText(/all systems synced/)).toBeInTheDocument();
    const dot = [...container.querySelectorAll('span')].find(
      (el) => el.style.background === 'rgb(18, 183, 106)'
    );
    expect(dot).toBeTruthy();
  });

  it('renders module title + blurb for noGreet pages', () => {
    const { getByText } = render(<PageHeader v={baseV()} />);
    const h1 = getByText('Invoices');
    expect(h1.tagName).toBe('H1');
    expect(h1.style.fontSize).toBe('32px');
    expect(h1.style.letterSpacing).toBeTruthy();
    expect(getByText('Quotes, invoices, and unpaid bills.')).toBeInTheDocument();
  });

  it('renders greeting + summary for greet pages', () => {
    const v = baseV({ pg: { hasGreet: true, greet: 'Good morning, Arjun', sum: 'Here is your day.' } });
    const { getByText } = render(<PageHeader v={v} />);
    expect(getByText('Good morning, Arjun')).toBeInTheDocument();
    expect(getByText('Here is your day.')).toBeInTheDocument();
  });

  it('period pills render with active styling and fire go()', () => {
    const go = vi.fn();
    const v = baseV({
      showPer: true,
      per: [
        { n: 'Month', bg: '#fff', fg: '#0A1020', sh: '0 1px 2px #000', go },
        { n: 'Year', bg: 'transparent', fg: '#667085', sh: 'none', go: vi.fn() },
      ],
    });
    const { getByText } = render(<PageHeader v={v} />);
    const month = getByText('Month');
    expect(month.style.background).toBe('rgb(255, 255, 255)');
    expect(getByText('Year').style.background).toBe('transparent');
    fireEvent.click(month);
    expect(go).toHaveBeenCalled();
  });
});

describe('PageHeader action buttons (appearance + icons)', () => {
  const v = () => baseV({
    pg: {
      noGreet: true,
      acts: [
        { n: 'New invoice', ic: 'https://cdn/i/plus.svg', bg: '#12B8A8', fg: '#fff', bd: 'transparent', go: vi.fn() },
        { n: 'Export', ic: 'https://cdn/i/down.svg', bg: '#fff', fg: '#344054', bd: '#E9EBEF', go: vi.fn() },
      ],
    },
  });

  it('renders label + icon for each action', () => {
    const { getByText } = render(<PageHeader v={v()} />);
    const btn = getByText('New invoice').closest('span[style]');
    const icon = [...btn.querySelectorAll('span')].find(
      (el) => (el.style.webkitMask || el.style.mask).includes('plus.svg')
    );
    expect(icon).toBeTruthy();
    // icon uses currentColor so it inherits the button text colour
    expect(icon.style.background).toBe('currentcolor');
  });

  it('applies button cosmetics: bg, fg, border, radius, weight, cursor', () => {
    const { getByText } = render(<PageHeader v={v()} />);
    const btn = getByText('New invoice').closest('span[style]');
    expect(btn.style.background).toBe('rgb(18, 184, 168)');
    expect(btn.style.color).toBe('rgb(255, 255, 255)');
    expect(btn.style.borderRadius).toBe('11px');
    expect(btn.style.height).toBe('38px');
    expect(btn.style.cursor).toBe('pointer');
    const ghost = getByText('Export').closest('span[style]');
    expect(ghost.style.border).toContain('rgb(233, 235, 239)');
    expect(ghost.style.color).toBe('rgb(52, 64, 84)');
  });

  it('fires action go() on click', () => {
    const vv = v();
    const { getByText } = render(<PageHeader v={vv} />);
    fireEvent.click(getByText('New invoice'));
    expect(vv.pg.acts[0].go).toHaveBeenCalledTimes(1);
  });

  it('hover dims the button (filter brightness) and press scales it', () => {
    const { getByText } = render(<PageHeader v={v()} />);
    const btn = getByText('New invoice').closest('span[style]');
    fireEvent.mouseEnter(btn);
    expect(btn.style.filter).toContain('brightness');
    fireEvent.mouseDown(btn);
    expect(btn.style.transform).toBe('scale(.97)');
    fireEvent.mouseUp(btn);
    expect(btn.style.transform).toBe('');
  });
});

describe('Toast cosmetics', () => {
  const toastV = (over = {}) => ({
    toastT: 'Invoice sent to Mehta Builders',
    toastC: '#7FE3D8',
    toastIc: 'https://cdn/i/check.svg',
    hasUndo: false,
    undo: vi.fn(),
    closeToast: vi.fn(),
    ...over,
  });

  it('renders message with icon', () => {
    const { getByText, container } = render(<Toast v={toastV()} />);
    expect(getByText('Invoice sent to Mehta Builders')).toBeInTheDocument();
    const icon = [...container.querySelectorAll('span')].find(
      (el) => (el.style.webkitMask || el.style.mask).includes('check.svg')
    );
    expect(icon).toBeTruthy();
  });

  it('shows Undo button only when hasUndo, and fires undo', () => {
    const v = toastV({ hasUndo: true });
    const { getByText } = render(<Toast v={v} />);
    const undo = getByText('Undo');
    expect(undo.style.color).toBe('rgb(11, 107, 97)');
    fireEvent.click(undo);
    expect(v.undo).toHaveBeenCalledTimes(1);
  });

  it('close icon fires closeToast', () => {
    const v = toastV();
    const { container } = render(<Toast v={v} />);
    const x = [...container.querySelectorAll('span')].find(
      (el) => (el.style.webkitMask || el.style.mask).includes('/x.svg')
    );
    fireEvent.click(x.closest('span[style*="cursor"]'));
    expect(v.closeToast).toHaveBeenCalledTimes(1);
  });

  it('tone colour applied to icon wrapper', () => {
    const { container } = render(<Toast v={toastV({ toastC: '#FDA29B' })} />);
    const wrap = [...container.querySelectorAll('span')].find(
      (el) => el.style.color === 'rgb(253, 162, 155)'
    );
    expect(wrap).toBeTruthy();
  });
});
