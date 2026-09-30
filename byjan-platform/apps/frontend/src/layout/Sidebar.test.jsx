import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';

const baseV = (over = {}) => ({
  sbW: '272px',
  sbExp: true,
  sbCol: false,
  wsLbl: 'BUSINESS',
  wsCo: 'Sharma Traders',
  wsSub: '27AAKCS8841D1Z6',
  wsIni: 'ST',
  goHome: vi.fn(),
  toggleSb: vi.fn(),
  toggleWs: vi.fn(),
  openCmd: vi.fn(),
  favs: [
    { n: 'Home', ic: 'https://cdn/i/home.svg', icBg: '#E6FAF6', icFg: '#0B7A6F',
      bg: '#F0FAF8', bd: 'none', fg: '#0A1020', go: vi.fn(), hover: vi.fn() },
    { n: 'Invoices', ic: 'https://cdn/i/inv.svg', icBg: '#E8F0FE', icFg: '#1D4ED8',
      bg: 'transparent', bd: 'none', fg: '#344054', go: vi.fn(), hover: vi.fn() },
  ],
  nav: [
    { n: 'Sales', ic: 'https://cdn/i/sales.svg', icBg: '#EEF1F5', icFg: '#0B1F3A',
      icSh: 'none', fg: '#344054', open: true, rot: 'rotate(180deg)',
      toggle: vi.fn(), hover: vi.fn(),
      items: [
        { n: 'Invoices', ic: 'https://cdn/i/inv.svg', icFg: '#0B7A6F', bg: '#F0FAF8',
          sh: 'none', fg: '#0B7A6F', fw: '600', bar: '#12B8A8', go: vi.fn(),
          hasB: true, b: '12' },
        { n: 'Quotes', ic: 'https://cdn/i/q.svg', icFg: '#475467', bg: 'transparent',
          sh: 'none', fg: '#344054', fw: '500', bar: 'transparent', go: vi.fn() },
      ] },
  ],
  sbc: { l: 'Cash across banks', v: '₹24,89,360' },
  sbSp: { a: 'M0,30 L120,0', d: 'M0,30 L120,20' },
  me: { ini: 'AK', n: 'Arjun Kumar', r: 'Owner · Super user' },
  goSettings: vi.fn(),
  togglePm: vi.fn(),
  sbLeave: vi.fn(),
  ...over,
});

const iconMasks = (root) =>
  [...root.querySelectorAll('*')].filter(
    (el) => (el.style.webkitMask || el.style.mask || '').includes('url(')
  );

describe('Sidebar cosmetics — expanded', () => {
  it('renders brand logo SVG and wordmark', () => {
    const { container, getByText } = render(<Sidebar v={baseV()} />);
    // ByjanMark renders a 200×200 viewBox svg with the trace-loop path
    const logo = container.querySelector('svg[viewBox="0 0 200 200"]');
    expect(logo).toBeTruthy();
    expect(logo.querySelectorAll('path,circle').length).toBeGreaterThanOrEqual(3);
    expect(getByText('byjan')).toBeInTheDocument();
    expect(getByText('BUSINESS')).toBeInTheDocument();
  });

  it('uses the width from the view model', () => {
    const { container } = render(<Sidebar v={baseV()} />);
    expect(container.querySelector('aside').style.width).toBe('272px');
  });

  it('workspace card shows company, gstin, initials and caret icon', () => {
    const { getByText, container } = render(<Sidebar v={baseV()} />);
    expect(getByText('Sharma Traders')).toBeInTheDocument();
    expect(getByText('27AAKCS8841D1Z6')).toBeInTheDocument();
    expect(getByText('ST')).toBeInTheDocument();
    const caret = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('caret-up-down')
    );
    expect(caret).toBeTruthy();
  });

  it('pinned favourites render labels and per-item icons', () => {
    const { getByText, getAllByText, container } = render(<Sidebar v={baseV()} />);
    expect(getByText('PINNED')).toBeInTheDocument();
    expect(getByText('Home')).toBeInTheDocument();
    // 'Invoices' exists both in pinned favourites and the nav items
    expect(getAllByText('Invoices').length).toBeGreaterThanOrEqual(1);
    const homeIcon = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('home.svg')
    );
    expect(homeIcon).toBeTruthy();
    // icon chip styling
    const chip = homeIcon.parentElement;
    expect(chip.style.borderRadius).toBe('8px');
  });

  it('favourite row fires its go callback on click and hover callback on enter', () => {
    const v = baseV();
    const { getByText } = render(<Sidebar v={v} />);
    const row = getByText('Home').closest('div[style*="cursor"]') ?? getByText('Home');
    fireEvent.click(getByText('Home'));
    expect(v.favs[0].go).toHaveBeenCalled();
    fireEvent.mouseEnter(getByText('Home'));
    expect(v.favs[0].hover).toHaveBeenCalled();
  });

  it('nav group expands with rotated caret and renders child items with badges', () => {
    const { getByText, getAllByText, container } = render(<Sidebar v={baseV()} />);
    expect(getByText('WORKSPACE')).toBeInTheDocument();
    expect(getByText('Sales')).toBeInTheDocument();
    // caret rotated when open
    const caretWrap = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('caret-down')
    );
    expect(caretWrap).toBeTruthy();
    expect(caretWrap.parentElement.style.transform).toContain('rotate(180deg)');
    // items + count badge
    expect(getByText('Quotes')).toBeInTheDocument();
    expect(getByText('12')).toBeInTheDocument();
    // active item has the teal accent bar (hex normalized to rgb)
    const bar = [...container.querySelectorAll('span')].find(
      (el) => (el.style.background || '').includes('184, 168') && el.style.position === 'absolute'
    );
    expect(bar).toBeTruthy();
    expect(bar.style.left).toBe('-12.5px');
  });

  it('collapsed nav group shows no children', () => {
    const v = baseV();
    v.nav[0].open = false;
    const { queryByText } = render(<Sidebar v={v} />);
    expect(queryByText('Quotes')).toBeNull();
  });

  it('live stats card shows sparkline svg paths', () => {
    const { getByText, container } = render(<Sidebar v={baseV()} />);
    expect(getByText('Cash across banks')).toBeInTheDocument();
    expect(getByText('₹24,89,360')).toBeInTheDocument();
    expect(getByText('LIVE')).toBeInTheDocument();
    const paths = container.querySelectorAll('svg path[d^="M0,30"]');
    expect(paths.length).toBe(2); // area + line
  });

  it('user footer shows avatar initials, name, role, online dot, settings gear', () => {
    const v = baseV();
    const { getByText, container } = render(<Sidebar v={v} />);
    expect(getByText('AK')).toBeInTheDocument();
    expect(getByText('Arjun Kumar')).toBeInTheDocument();
    expect(getByText('Owner · Super user')).toBeInTheDocument();
    const gear = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('gear-six')
    );
    expect(gear).toBeTruthy();
    // user row doubles as the profile-menu trigger
    fireEvent.click(getByText('Arjun Kumar'));
    expect(v.togglePm).toHaveBeenCalled();
  });

  it('settings gear fires goSettings', () => {
    const v = baseV();
    const { container } = render(<Sidebar v={v} />);
    const gear = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('gear-six')
    );
    fireEvent.click(gear.closest('span[style*="cursor"]'));
    expect(v.goSettings).toHaveBeenCalled();
  });

  it('collapse button fires toggleSb', () => {
    const v = baseV();
    const { container } = render(<Sidebar v={v} />);
    const btn = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('sidebar-simple')
    );
    fireEvent.click(btn.closest('span[style*="cursor"]'));
    expect(v.toggleSb).toHaveBeenCalled();
  });
});

describe('Sidebar cosmetics — collapsed rail', () => {
  const colV = () => baseV({ sbW: '84px', sbExp: false, sbCol: true });

  it('hides labels and wordmark', () => {
    const { queryByText } = render(<Sidebar v={colV()} />);
    expect(queryByText('byjan')).toBeNull();
    expect(queryByText('PINNED')).toBeNull();
    expect(queryByText('WORKSPACE')).toBeNull();
    expect(queryByText('Arjun Kumar')).toBeNull();
    expect(queryByText('Cash across banks')).toBeNull();
  });

  it('shrinks to rail width', () => {
    const { container } = render(<Sidebar v={colV()} />);
    expect(container.querySelector('aside').style.width).toBe('84px');
  });

  it('still shows logo and favourite icons', () => {
    const { container } = render(<Sidebar v={colV()} />);
    expect(container.querySelector('svg[viewBox="0 0 200 200"]')).toBeTruthy();
    const icons = iconMasks(container);
    expect(icons.some(el => (el.style.webkitMask || el.style.mask).includes('home.svg'))).toBe(true);
  });

  it('rail buttons: expand (flipped sidebar icon) and search', () => {
    const v = colV();
    const { container } = render(<Sidebar v={v} />);
    const flip = container.querySelector('span[style*="scaleX(-1)"]');
    expect(flip).toBeTruthy();
    fireEvent.click(flip.closest('span[style*="cursor"]'));
    expect(v.toggleSb).toHaveBeenCalled();
    const search = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('magnifying-glass')
    );
    fireEvent.click(search.closest('span[style*="cursor"]'));
    expect(v.openCmd).toHaveBeenCalled();
  });
});
