import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { user, loading: sessionLoading, authMode, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="flex items-center gap-2.5 text-[13.5px] font-medium text-[#64748B]">
          <Loader2 className="w-4 h-4 animate-spin text-[#293F2D]" />
          <span>Checking authentication…</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/upload" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(trimmedEmail, password);
      navigate('/upload', { replace: true });
    } catch (err) {
      setErrorMsg(err?.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_10px_32px_-12px_rgba(17,24,39,0.08),0_2px_6px_-1px_rgba(17,24,39,0.04)] px-6 py-7 sm:px-8 sm:py-8">
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-[11px]">
            <span className="w-[34px] h-[34px] rounded-[9px] bg-[#293F2D] text-white flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />
            </span>
            <div>
              <div className="text-[21px] font-bold tracking-[-0.025em] text-[#111827] leading-none">
                VeriForm
              </div>
              <div className="mt-[5px] text-[10px] font-semibold tracking-[0.12em] text-[#6E726B] uppercase">
                Roll Call AI
              </div>
            </div>
          </div>
        </div>

        {/* Heading & Description */}
        <div className="mt-7">
          <h1 className="text-[23px] font-bold tracking-[-0.02em] text-[#111827] leading-tight">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[#64748B] leading-[1.5]">
            Sign in to access your attendance verification workspace.
          </p>
        </div>

        {/* Development-Only / Unconfigured Auth Notice */}
        {authMode === 'dev-mock' && (
          <div className="mt-4 bg-[#FDF5E4] border border-[#F2E2BF] rounded-[10px] px-3.5 py-2.5 text-[12px] text-[#92400E] leading-[1.45]">
            <span className="font-semibold">Development mode:</span> Supabase Auth is not
            configured. Mock session sign-in is enabled for local development only.
          </div>
        )}

        {authMode === 'unconfigured' && (
          <div className="mt-4 bg-[#F9E4E4] border border-[#F1C5C5] rounded-[10px] px-3.5 py-2.5 text-[12px] text-[#991B1B] leading-[1.45]">
            Supabase Auth is not configured. Set{' '}
            <code className="font-mono-tech">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono-tech">VITE_SUPABASE_ANON_KEY</code> to sign in.
          </div>
        )}

        {/* Validation / Auth Error */}
        {errorMsg && (
          <div
            role="alert"
            className="mt-4 bg-[#F9E4E4] border border-[#F1C5C5] rounded-[10px] px-3.5 py-2.5 flex items-start gap-2 text-[12.5px] text-[#991B1B] leading-[1.45]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.9} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-[13px] font-medium text-[#111827] mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="coordinator@institution.edu"
              className="w-full h-[42px] px-3.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[13.5px] text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#293F2D] focus:ring-2 focus:ring-[#293F2D]/10 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[13px] font-medium text-[#111827] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter your password"
                className="w-full h-[42px] pl-3.5 pr-10 rounded-[10px] border border-[#E5E7EB] bg-white text-[13.5px] text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#293F2D] focus:ring-2 focus:ring-[#293F2D]/10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[6px] text-[#64748B] hover:text-[#111827] hover:bg-[#F7F7F5] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-[16px] h-[16px]" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-[16px] h-[16px]" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || authMode === 'unconfigured'}
            className="w-full h-[44px] mt-1 rounded-[10px] bg-[#293F2D] hover:bg-[#203324] disabled:opacity-65 disabled:cursor-not-allowed text-white text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Access Notice */}
        <div className="mt-6 pt-4 border-t border-[#F1F0EC] flex items-center justify-center gap-2 text-[12px] text-[#64748B]">
          <Shield className="w-[14px] h-[14px] text-[#64748B] shrink-0" strokeWidth={1.75} />
          <span>Authorised faculty access only.</span>
        </div>
      </div>
    </div>
  );
}
