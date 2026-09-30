import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Topbar from './Topbar.jsx';

// Minimal view-model that satisfies Topbar.
const baseV = (over = {}) => ({
  busy: false,
  crumbBlk: 'Sales',
  modN: 'Invoices',
  openCmd: vi.fn(),
  toggleNew: vi.fn(),
  newOpen: false,
  newGroups: [],
  toggleBell: vi.fn(),
  bell: false,
  bellN: '0',
  notes: [],
  ...over,
});

const iconMasks = (root) =>
  [...root.querySelectorAll('*')].filter(
    (el) => (el.style.webkitMask || el.style.mask || '').includes('url(')
  );

describe('Topbar cosmetics', () => {
  it('renders breadcrumb with block and module names', () => {
    const { getByText } = render(<Topbar v={baseV()} />);
    expect(getByText('Sales')).toBeInTheDocument();
    expect(getByText('Invoices')).toBeInTheDocument();
  });

  it('renders icon glyphs as masked spans (non-empty icon set)', () => {
    const { container } = render(<Topbar v={baseV()} />);
    // buildings crumb icon + magnifier + plus + bell = at least 4 masked icons
    expect(iconMasks(container).length).toBeGreaterThanOrEqual(4);
  });

  it('icon mask URLs point at the phosphor CDN', () => {
    const { container } = render(<Topbar v={baseV()} />);
    for (const el of iconMasks(container)) {
      const mask = el.style.webkitMask || el.style.mask;
      expect(mask).toContain('phosphor-icons');
      expect(mask).toContain('.svg');
    }
  });
});

describe('Topbar buttons', () => {
  it('New button: teal gradient, white text, plus icon, pointer cursor', () => {
    const { getByText } = render(<Topbar v={baseV()} />);
    const btn = getByText('New').closest('span[style]') ?? getByText('New');
    const s = btn.style;
    expect(s.background).toContain('linear-gradient');
    expect(s.color).toBe('rgb(255, 255, 255)');
    expect(s.borderRadius).toBe('12px');
    expect(s.cursor).toBe('pointer');
    expect(s.fontWeight).toBe('600');
    // plus icon inside
    const icons = iconMasks(btn);
    expect(icons.length).toBe(1);
    expect(icons[0].style.webkitMask || icons[0].style.mask).toContain('plus.svg');
  });

  it('New button fires toggleNew on click', () => {
    const v = baseV();
    const { getByText } = render(<Topbar v={v} />);
    fireEvent.click(getByText('New'));
    expect(v.toggleNew).toHaveBeenCalledTimes(1);
  });

  it('New button brightens on hover (Hx h style)', () => {
    const { getByText } = render(<Topbar v={baseV()} />);
    const btn = getByText('New').closest('span[style]');
    fireEvent.mouseEnter(btn);
    expect(btn.style.filter).toContain('brightness');
    fireEvent.mouseLeave(btn);
    expect(btn.style.filter).toBe('');
  });

  it('search pill shows ⌘K and fires openCmd', () => {
    const v = baseV();
    const { getByText } = render(<Topbar v={v} />);
    const kbd = getByText('⌘K');
    expect(kbd).toBeInTheDocument();
    const pill = getByText('Search or run a command…');
    fireEvent.click(pill);
    expect(v.openCmd).toHaveBeenCalledTimes(1);
    // magnifier icon inside the pill
    expect(iconMasks(pill.parentElement).length).toBeGreaterThanOrEqual(1);
  });

  it('bell button shows notification dot and icon, fires toggleBell', () => {
    const v = baseV();
    const { container } = render(<Topbar v={v} />);
    const bellIcon = iconMasks(container).find(
      (el) => (el.style.webkitMask || el.style.mask).includes('bell-duotone')
    );
    expect(bellIcon).toBeTruthy();
    const bellBtn = bellIcon.parentElement;
    fireEvent.click(bellBtn);
    expect(v.toggleBell).toHaveBeenCalledTimes(1);
    // red unread dot (hex normalizes to rgb in jsdom)
    const dot = bellBtn.querySelector('span[style*="240, 68, 56"]');
    expect(dot).toBeTruthy();
    expect(dot.style.borderRadius).toBe('50%');
  });
});

describe('Topbar busy indicator', () => {
  it('shows animated progress bar when busy', () => {
    const { container } = render(<Topbar v={baseV({ busy: true })} />);
    const bar = [...container.querySelectorAll('span')].find(
      (el) => el.style.animationName === 'busy' || (el.style.animation || '').includes('busy')
    );
    expect(bar).toBeTruthy();
  });

  it('no progress bar when idle', () => {
    const { container } = render(<Topbar v={baseV({ busy: false })} />);
    const bar = [...container.querySelectorAll('span')].find(
      (el) => el.style.animationName === 'busy'
    );
    expect(bar).toBeUndefined();
  });
});

describe('Topbar dropdowns', () => {
  it('new-menu opens with grouped actions, each with an icon', () => {
    const v = baseV({
      newOpen: true,
      newGroups: [
        { g: 'Sales', items: [
          { n: 'Invoice', ic: 'https://cdn/i/invoice.svg', go: vi.fn() },
          { n: 'Quote', ic: 'https://cdn/i/quote.svg', go: vi.fn() },
        ] },
      ],
    });
    const { getByText, getAllByText } = render(<Topbar v={v} />);
    // 'Sales' appears in the breadcrumb AND the menu group header
    expect(getAllByText('Sales').length).toBeGreaterThanOrEqual(2);
    expect(getByText('Invoice')).toBeInTheDocument();
    expect(getByText('Quote')).toBeInTheDocument();
    const inv = v.newGroups[0].items[0];
    fireEvent.click(getByText('Invoice'));
    expect(inv.go).toHaveBeenCalledTimes(1);
  });

  it('notifications panel lists notes with icons and count badge', () => {
    const v = baseV({
      bell: true,
      bellN: '2',
      notes: [
        { t: 'Bill received', w: 'Now', ic: 'https://cdn/i/inbox.svg', go: vi.fn() },
        { t: 'GST due', w: '1h', ic: 'https://cdn/i/tax.svg', go: vi.fn() },
      ],
    });
    const { getByText } = render(<Topbar v={v} />);
    expect(getByText('Notifications')).toBeInTheDocument();
    expect(getByText('2 new')).toBeInTheDocument();
    fireEvent.click(getByText('Bill received'));
    expect(v.notes[0].go).toHaveBeenCalled();
  });
});
