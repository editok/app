import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import { Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

export default function PasswordRecovery() {
  const { clearPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError('Authentication is not configured.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        clearPasswordRecovery();
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-animated-mesh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 rounded-full bg-primary-500/15 blur-3xl animate-drift" />
        <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 rounded-full bg-pink-500/12 blur-3xl animate-drift" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl animate-drift" style={{ animationDelay: '6s' }} />
        <div className="absolute inset-0 bg-dot-grid opacity-40" />
      </div>

      <div className="relative w-full max-w-md animate-bounce-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-vibrant-gradient items-center justify-center text-white font-bold text-2xl shadow-glow mb-3 animate-pulse-glow">
            E
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Set New Password</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Enter your new password below</p>
        </div>

        <div className="glass rounded-2xl shadow-float p-6 sm:p-8 animate-slide-up">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-600 dark:text-error-400 text-sm animate-scale-in mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-success-600 dark:text-success-400 text-sm animate-scale-in flex items-center gap-2 mb-4">
              <Check className="w-4 h-4" /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
