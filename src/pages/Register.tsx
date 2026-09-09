import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authClient } from '../lib/auth-client';
import { Mail, Lock, AlertCircle, User } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const result = await authClient.signUp.email({
        name: email.split('@')[0] || 'User',
        email,
        password,
      });
      if ((result as any)?.error) throw new Error((result as any).error.message || 'Failed to create an account');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Create a Byjan account
        </h2>
        <p className="mt-1 text-center text-xs font-semibold tracking-[0.18em] text-slate-500">Trace Financials Easily</p>
        <p className="mt-2 text-center text-sm text-slate-600">
          Or{' '}
          <Link to="/login" className="font-medium text-teal-700 hover:text-teal-600">
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="byjan-panel py-8 px-4 sm:px-10">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="byjan-input pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="byjan-input pl-10"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="byjan-btn w-full"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
