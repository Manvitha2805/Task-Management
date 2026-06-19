import React, { useState } from 'react';
import { useAuth } from '../App.jsx';
import { Mail, Lock, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA Flow States
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(data.userId);
        setLoading(false);
      } else {
        login(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mfaUserId, code: otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification code failed.');
      }

      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden px-4">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse duration-5000"></div>

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl relative z-10 border border-slate-800">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 items-center justify-center font-bold text-2xl text-white shadow-xl shadow-blue-500/25 mb-4">
            TM
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Task Manager</h2>
          <p className="text-sm text-slate-400 mt-2">Enterprise Project & Attendance Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!mfaRequired ? (
          /* Step 1: Email and Password */
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-350 mb-2 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-355 mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-white text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          /* Step 2: MFA OTP Verification */
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div className="text-center p-4 rounded-2xl bg-blue-950/20 border border-blue-900/30 mb-2">
              <ShieldCheck className="w-10 h-10 text-blue-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">MFA Authentication</h4>
              <p className="text-xs text-slate-400 mt-1">Please enter the 6-digit verification code from Google or Microsoft Authenticator.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-350 mb-2 uppercase tracking-wider text-center">6-Digit Code</label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.6em] py-3.5 rounded-xl glass-input text-white font-bold"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false);
                  setOtpCode('');
                  setError('');
                }}
                className="flex-1 py-3.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-semibold text-sm transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-slate-900 pt-6">
          <p>Demo Accounts:</p>
          <p className="mt-1 font-mono text-[10px] text-slate-400">admin@taskmanager.com | password123</p>
          <p className="font-mono text-[10px] text-slate-400">employee@taskmanager.com | password123</p>
        </div>
      </div>
    </div>
  );
}
