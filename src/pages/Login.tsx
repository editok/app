import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight, Sparkles, Check, ArrowLeft, MailCheck } from 'lucide-react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showVerifyScreen, setShowVerifyScreen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    sessionStorage.setItem('editok-just-logged-in', '1');
    const { error } = await signInWithGoogle();
    if (error) { setError(error); sessionStorage.removeItem('editok-just-logged-in'); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      sessionStorage.setItem('editok-just-logged-in', '1');
      if (keepSignedIn) {
        localStorage.setItem('editok-keep-signed-in', '1');
      } else {
        localStorage.removeItem('editok-keep-signed-in');
      }
      const { error } = await signIn(email, password);
      if (error) { setError(error); sessionStorage.removeItem('editok-just-logged-in'); }
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error, needsConfirmation } = await signUp(email, password, fullName);
      if (error) setError(error);
      else if (needsConfirmation) {
        setPendingEmail(email);
        setShowVerifyScreen(true);
      } else {
        setSuccess('Account created! You can now sign in.');
        setMode('login');
        setFullName('');
        setPassword('');
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!supabase) {
      setError('Authentication is not configured.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password reset link sent! Check your email inbox.');
    }
    setResetSending(false);
  };

  return (
    <div className="min-h-screen bg-animated-mesh flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated aurora background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 rounded-full bg-primary-500/15 blur-3xl animate-drift" />
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 rounded-full bg-pink-500/12 blur-3xl animate-drift" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl animate-drift" style={{ animationDelay: '6s' }} />

        <svg className="absolute top-20 right-1/4 w-32 h-32 opacity-[0.06] animate-float-shape" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-primary-500" />
          <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-primary-500" />
          <circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-primary-500" />
        </svg>
        <svg className="absolute bottom-32 left-16 w-24 h-24 opacity-[0.05] animate-float-shape" style={{ animationDelay: '2s' }} viewBox="0 0 100 100">
          <polygon points="50,10 90,90 10,90" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-pink-500" />
        </svg>
        <svg className="absolute top-1/3 left-10 w-20 h-20 opacity-[0.04] animate-float-shape" style={{ animationDelay: '4s' }} viewBox="0 0 100 100">
          <rect x="20" y="20" width="60" height="60" rx="12" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-violet-500" transform="rotate(15 50 50)" />
        </svg>

        <div className="absolute inset-0 bg-dot-grid opacity-40" />

        <svg className="absolute bottom-0 left-0 w-full h-40 opacity-[0.04]" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z" fill="currentColor" className="text-primary-500" />
        </svg>
      </div>

      <div className="relative w-full max-w-md mx-4 animate-bounce-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/images/Login_logo.gif"
            alt="Editok"
            className="mx-auto w-44 h-auto max-h-28 object-contain mb-3"
          />
          <p className="text-sm text-ink-500 dark:text-ink-400 font-medium tracking-wide">Shoot. Upload. Editok.</p>
        </div>

        <div className="glass rounded-2xl shadow-float p-6 sm:p-8 animate-slide-up">
          {showVerifyScreen ? (
            <div className="text-center py-4 animate-scale-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-success-50 dark:bg-success-500/15 border-2 border-success-200 dark:border-success-500/30 flex items-center justify-center mb-5">
                <MailCheck className="w-8 h-8 text-success-500" />
              </div>
              <h3 className="text-lg font-bold text-ink-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
                We sent a verification link to <span className="font-semibold text-ink-700 dark:text-ink-200">{pendingEmail}</span>.
                Click the link in the email to confirm your account and sign in.
              </p>
              <div className="p-3 rounded-xl bg-primary-50/60 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50 text-xs text-ink-500 dark:text-ink-400 mb-5">
                Didn't receive the email? Check your spam folder, or
                <button
                  type="button"
                  onClick={async () => {
                    if (!supabase) return;
                    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
                    if (resendError) setError(resendError.message);
                    else setSuccess('Verification email re-sent!');
                  }}
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:underline ml-1"
                >
                  resend it
                </button>
                .
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-600 dark:text-error-400 text-sm mb-4">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-success-600 dark:text-success-400 text-sm mb-4 flex items-center gap-2 justify-center">
                  <Check className="w-4 h-4" /> {success}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowVerifyScreen(false);
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                  setPassword('');
                }}
                className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
          <>
          {/* Mode toggle */}
          {mode !== 'forgot' && (
          <div className="flex bg-ink-100/80 dark:bg-ink-800/50 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white dark:bg-ink-700 text-primary-600 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white dark:bg-ink-700 text-primary-600 shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}
            >
              Sign Up
            </button>
          </div>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 dark:text-ink-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>
          )}

          {/* Google OAuth */}
          {mode !== 'forgot' && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-ink-700 dark:text-ink-200 bg-white dark:bg-ink-800 border-2 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            <GoogleIcon className="w-5 h-5" />
            {loading ? 'Connecting...' : mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
          </button>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-ink-200 dark:bg-ink-700" />
            <span className="text-xs text-ink-400 font-semibold uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-ink-200 dark:bg-ink-700" />
          </div>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input"
                />
                <p className="text-xs text-ink-400 mt-2">Enter your registered email and we'll send you a link to reset your password.</p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-600 dark:text-error-400 text-sm animate-scale-in">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-success-600 dark:text-success-400 text-sm animate-scale-in flex items-center gap-2">
                  <Check className="w-4 h-4" /> {success}
                </div>
              )}

              <button
                type="submit"
                disabled={resetSending}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                {resetSending ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
          /* Login / Signup Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="animate-slide-up">
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="input"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors mt-1.5"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {mode === 'login' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="w-5 h-5 rounded border-ink-300 dark:border-ink-600 text-primary-500 focus:ring-primary-400 cursor-pointer"
                />
                <label htmlFor="keep-signed-in" className="text-xs font-medium text-ink-600 dark:text-ink-300 cursor-pointer select-none">
                  Keep me Signed in
                  {!keepSignedIn && <span className="block text-[10px] text-ink-400 dark:text-ink-500 mt-0.5">Uncheck if using a public device</span>}
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-600 dark:text-error-400 text-sm animate-scale-in">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-success-600 dark:text-success-400 text-sm animate-scale-in flex items-center gap-2">
                <Check className="w-4 h-4" /> {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          <p className="text-xs text-center text-ink-400 mt-5 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Secure authentication powered by Supabase
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
