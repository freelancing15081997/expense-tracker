import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ProfileMenu from './ProfileMenu.jsx';

const baseV = (over = {}) => ({
  togglePm: vi.fn(),
  me: { n: 'Ravi Sharma' },
  meSub: 'ravi@sharmatraders.in',
  pmItems: [
    { n: 'My profile', ic: 'duotone/user-circle-duotone.svg', go: vi.fn() },
    { n: 'Devices and sessions', ic: 'duotone/devices-duotone.svg', go: vi.fn() },
    { n: 'Switch workspace', ic: 'duotone/arrows-left-right-duotone.svg', go: vi.fn() },
  ],
  signOut: vi.fn(),
  ...over,
});

describe('ProfileMenu', () => {
  it('renders identity header with name and subtitle', () => {
    const { getByText } = render(<ProfileMenu v={baseV()} />);
    expect(getByText('Ravi Sharma')).toBeInTheDocument();
    expect(getByText('ravi@sharmatraders.in')).toBeInTheDocument();
  });

  it('renders every menu item with its phosphor icon', () => {
    const { getByText, container } = render(<ProfileMenu v={baseV()} />);
    for (const n of ['My profile', 'Devices and sessions', 'Switch workspace']) {
      expect(getByText(n)).toBeInTheDocument();
    }
    const icons = [...container.querySelectorAll('span')].filter(
      (el) => (el.style.webkitMask || el.style.mask || '').includes('phosphor-icons')
    );
    expect(icons.length).toBeGreaterThanOrEqual(4); // 3 items + sign-out
  });

  it('item click fires its go callback', () => {
    const v = baseV();
    const { getByText } = render(<ProfileMenu v={v} />);
    fireEvent.click(getByText('My profile'));
    expect(v.pmItems[0].go).toHaveBeenCalledTimes(1);
  });

  it('sign-out row is danger-coloured and fires signOut', () => {
    const v = baseV();
    const { getByText } = render(<ProfileMenu v={v} />);
    const row = getByText('Sign out').closest('div[role="menuitem"]');
    expect(row.style.color).toBe('rgb(180, 35, 24)');
    fireEvent.click(getByText('Sign out'));
    expect(v.signOut).toHaveBeenCalledTimes(1);
  });

  it('backdrop click dismisses via togglePm', () => {
    const v = baseV();
    const { container } = render(<ProfileMenu v={v} />);
    // first absolutely-positioned inset-0 div is the dismiss layer
    const overlay = container.firstChild;
    const dismiss = overlay.children[0];
    fireEvent.click(dismiss);
    expect(v.togglePm).toHaveBeenCalledTimes(1);
  });
});
