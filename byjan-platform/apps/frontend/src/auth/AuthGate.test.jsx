import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import * as auth from './authApi.js';

// Stub the app shell so the gate can be tested in isolation.
vi.mock('../App.jsx', () => ({
  default: ({ user, onAskSignOut }) => (
    <div data-testid="app-shell">
      <span data-testid="user-name">{user && user.name}</span>
      <button data-testid="ask-signout" onClick={onAskSignOut}>menu-signout</button>
    </div>
  ),
}));

// Mock module resolution inside AuthGate happens before imports complete —
// import after the mock declaration is hoisted correctly by vitest.
import AuthGate from './AuthGate.jsx';

describe('AuthGate', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('shows the loader while checking, then sign-in when no session', async () => {
    render(<AuthGate />);
    // restore() sleeps ~250ms in mock mode, then lands on sign-in
    expect(await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('restores a stored mock session straight into the app', async () => {
    sessionStorage.setItem('byjanMockSession', JSON.stringify({ id: 'u1', name: 'Ravi Sharma', email: 'ravi@x.in', role: 'Owner' }));
    render(<AuthGate />);
    expect(await screen.findByTestId('app-shell', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('user-name')).toHaveTextContent('Ravi Sharma');
  });

  it('sign-out request shows the confirm dialog, cancel dismisses it', async () => {
    sessionStorage.setItem('byjanMockSession', JSON.stringify({ id: 'u1', name: 'Ravi', otherDevices: 2 }));
    render(<AuthGate />);
    await screen.findByTestId('app-shell', {}, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('ask-signout'));
    expect(await screen.findByText('Sign out of Byjan?')).toBeInTheDocument();
    // all-devices option shown because otherDevices > 0
    expect(screen.getByText(/Also sign out my other devices/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Sign out of Byjan?')).toBeNull());
  });

  it('confirming sign-out ends the session and shows the signed-out banner', async () => {
    sessionStorage.setItem('byjanMockSession', JSON.stringify({ id: 'u1', name: 'Ravi' }));
    render(<AuthGate />);
    await screen.findByTestId('app-shell', {}, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('ask-signout'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    // mock signOut resolves → phase 'out' with reason 'manual'
    expect(await screen.findByText('You’re signed out', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(sessionStorage.getItem('byjanMockSession')).toBeNull();
  });
});
