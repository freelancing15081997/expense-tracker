import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import * as auth from './authApi.js';
import AuthScreens from './AuthScreens.jsx';

// VITE_AUTH_MODE defaults to mock → authApi runs the local demo session.
describe('authApi mock mode', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('runs in mock mode without env config', () => {
    expect(auth.MOCK).toBe(true);
    expect(auth.IDLE_MIN).toBe(30);
  });

  it('passwordSignIn resolves an MFA challenge', async () => {
    const r = await auth.passwordSignIn('ravi@x.in', 'anything');
    expect(r).toEqual({ mfa: true, challengeId: 'mock' });
  });

  it('passwordSignIn rejects the demo wrong-password', async () => {
    await expect(auth.passwordSignIn('a@b.in', 'wrong123')).rejects.toThrow(/don’t match/);
  });

  it('mfaChallenge signs in with any code except 000000', async () => {
    const r = await auth.mfaChallenge('mock', '123456');
    expect(r.user.email).toBe('ravi@sharmatraders.in');
    expect(sessionStorage.getItem('byjanMockSession')).toBeTruthy();
  });

  it('mfaChallenge rejects the demo failure code', async () => {
    await expect(auth.mfaChallenge('mock', '000000')).rejects.toThrow(/code didn’t work/);
  });

  it('emailSignUp rejects the taken@ demo email', async () => {
    await expect(auth.emailSignUp('X', 'taken@x.in', 'pw')).rejects.toThrow(/already exists/);
  });

  it('restore() returns the stored mock session, then clearLocal removes it', async () => {
    await auth.mfaChallenge('mock', '654321');
    const u = await auth.restore();
    expect(u.name).toBe('Ravi Sharma');
    auth.clearLocal();
    expect(await auth.restore()).toBeNull();
  });

  it('sendPasswordReset always resolves (no account disclosure)', async () => {
    await expect(auth.sendPasswordReset('nobody@x.in')).resolves.toBeUndefined();
  });
});

describe('AuthScreens — cosmetics + flows', () => {
  it('renders the brand panel and sign-in form', () => {
    const { container, getByText, getByRole } = render(<AuthScreens onSignedIn={vi.fn()} />);
    expect(container.querySelector('svg[viewBox="0 0 200 200"]')).toBeTruthy();
    expect(getByText('byjan')).toBeInTheDocument();
    expect(getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(getByText('Work email')).toBeInTheDocument();
    expect(getByText('Continue with Google')).toBeInTheDocument();
    expect(getByText('Forgot password?')).toBeInTheDocument();
    // demo-mode hint only in mock
    expect(getByText(/Demo mode/)).toBeInTheDocument();
  });

  it('primary CTA is the teal gradient button; ghost button is bordered', () => {
    const { getByRole, getByText } = render(<AuthScreens onSignedIn={vi.fn()} />);
    const cta = getByRole('button', { name: 'Sign in' });
    expect(cta.tagName).toBe('BUTTON');
    expect(cta.style.background).toContain('linear-gradient');
    expect(cta.style.borderRadius).toBe('12px');
    expect(cta.style.height).toBe('48px');
    const ghost = getByText('Continue with Google').closest('button');
    expect(ghost.style.border).toContain('solid');
    // google logo icon inside ghost
    const ic = [...ghost.querySelectorAll('span')].find(el => (el.style.webkitMask || '').includes('google-logo'));
    expect(ic).toBeTruthy();
  });

  it('validates email and password before submitting', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText, findByRole } = render(<AuthScreens onSignedIn={vi.fn()} />);
    const form = getByRole('button', { name: 'Sign in' }).closest('form');
    fireEvent.change(getByPlaceholderText('you@company.in'), { target: { value: 'not-an-email' } });
    fireEvent.submit(form);
    expect(await findByRole('alert')).toHaveTextContent('Enter a valid email');
    fireEvent.change(getByPlaceholderText('you@company.in'), { target: { value: 'a@b.in' } });
    fireEvent.submit(form);
    expect(await findByRole('alert')).toHaveTextContent('Enter your password');
  });

  it('wrong123 surfaces the lockout warning', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText, findByRole } = render(<AuthScreens onSignedIn={vi.fn()} />);
    fireEvent.change(getByPlaceholderText('you@company.in'), { target: { value: 'a@b.in' } });
    fireEvent.change(getByLabelText('Password'), { target: { value: 'wrong123' } });
    fireEvent.submit(getByRole('button', { name: 'Sign in' }).closest('form'));
    expect(await findByRole('alert')).toHaveTextContent(/4 tries left/);
  });

  it('happy path: sign in → 2-step → signed in', async () => {
    const done = vi.fn();
    const { getByRole, getByPlaceholderText, getByLabelText, findByText } = render(<AuthScreens onSignedIn={done} />);
    fireEvent.change(getByPlaceholderText('you@company.in'), { target: { value: 'ravi@x.in' } });
    fireEvent.change(getByLabelText('Password'), { target: { value: 'hunter2' } });
    fireEvent.submit(getByRole('button', { name: 'Sign in' }).closest('form'));
    // MFA screen appears
    expect(await findByText('2-step sign-in')).toBeInTheDocument();
    const code = getByLabelText('Authenticator code');
    fireEvent.change(code, { target: { value: '12ab34' } });
    expect(code.value).toBe('1234'); // strips non-digits
    fireEvent.change(code, { target: { value: '654321' } });
    fireEvent.submit(getByRole('button', { name: 'Verify' }).closest('form'));
    await waitFor(() => expect(done).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ravi Sharma' })));
  });

  it('mfa code 000000 shows the failure message', async () => {
    const { getByRole, getByPlaceholderText, getByLabelText, findByText, findByRole } = render(<AuthScreens onSignedIn={vi.fn()} />);
    fireEvent.change(getByPlaceholderText('you@company.in'), { target: { value: 'a@b.in' } });
    fireEvent.change(getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.submit(getByRole('button', { name: 'Sign in' }).closest('form'));
    await findByText('2-step sign-in');
    fireEvent.change(getByLabelText('Authenticator code'), { target: { value: '000000' } });
    fireEvent.submit(getByRole('button', { name: 'Verify' }).closest('form'));
    expect(await findByRole('alert')).toHaveTextContent(/code didn’t work/);
  });

  it('forgot password → sent screen', async () => {
    const { getByRole, getByText, findByText, getByLabelText } = render(<AuthScreens onSignedIn={vi.fn()} />);
    fireEvent.click(getByText('Forgot password?'));
    expect(await findByText('Reset your password')).toBeInTheDocument();
    fireEvent.change(getByLabelText('Email'), { target: { value: 'a@b.in' } });
    fireEvent.submit(getByRole('button', { name: 'Send reset link' }).closest('form'));
    expect(await findByText('Check your email')).toBeInTheDocument();
  });

  it('sign-up screen validates name/email/password/terms', async () => {
    const { getByText, findByText, getByRole, getByLabelText, getByPlaceholderText } = render(<AuthScreens onSignedIn={vi.fn()} />);
    fireEvent.click(getByText('Create an account'));
    expect(await findByText('Create your account')).toBeInTheDocument();
    // password strength meter shows as typing
    fireEvent.change(getByLabelText('Password'), { target: { value: 'Str0ng!Pass' } });
    expect(getByText('Very strong')).toBeInTheDocument();
    // submit without agreeing → error
    fireEvent.submit(getByRole('button', { name: 'Create account' }).closest('form'));
    expect(await findByText('Enter your full name.')).toBeInTheDocument();
  });

  it('signed-out banner renders the right tone per reason', () => {
    const { getByText, container, rerender } = render(<AuthScreens reason="expired" onSignedIn={vi.fn()} />);
    expect(getByText('Session expired')).toBeInTheDocument();
    const badge = [...container.querySelectorAll('span')].find(el => (el.style.webkitMask || '').includes('clock-countdown'));
    expect(badge).toBeTruthy();
  });
});
