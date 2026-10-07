import { useState, useEffect, useRef } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Mail, Phone, MapPin, Briefcase, Star, Calendar, Save, Camera, Lock, Eye, EyeOff, Upload, Shield, Volume2, VolumeX, Sun, Moon, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSound } from '../contexts/SoundContext';
import * as db from '../data/db';
import type { Profile as ProfileType, AdminRole } from '../data/db';

const INDIAN_LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Gujarati',
  'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Maithili',
  'Sanskrit', 'Konkani', 'Sindhi', 'Nepali', 'Bhojpuri', 'Haryanvi', 'Rajasthani',
  'Marwari', 'Tulu', 'Kashmiri', 'Santali', 'Dogri', 'Manipuri', 'Bodo',
];

export default function Profile() {
  const { user, role, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { enabled: soundEnabled, toggle: toggleSound } = useSound();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState({ projects: 0, years: 0, rating: 0 });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const p = await db.fetchProfile(user.id);
      if (!active) return;
      setProfile(p);
      setFullName(p?.full_name || '');
      setEmail(p?.email || user.email || '');
      setPhone(p?.phone || '');
      setAddress(p?.address || '');
      setAvatarUrl(p?.avatar_url || null);
      setLanguage(p?.language || 'English');
      setAdminRole((p?.admin_role as AdminRole) || null);
      setLoading(false);
      if (role === 'editor') {
        const { count: taskCount } = await supabase!
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', p?.id || user.id);
        if (!active) return;
        const years = p ? Math.max(1, new Date().getFullYear() - new Date(p.created_at).getFullYear()) : 1;
        setStats({ projects: taskCount || 0, years, rating: 4.9 });
      }
    })();
    return () => { active = false; };
  }, [user, role]);

  const handleAvatarUpload = async (file: File) => {
    if (!user || !supabase) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      await db.upsertProfile({
        id: user.id,
        email,
        full_name: fullName,
        avatar_url: url,
        role: role || 'customer',
        admin_role: adminRole,
        provider: profile?.provider || 'email',
        language,
      });
      setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await db.upsertProfile({
      id: user.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: role || 'customer',
      admin_role: adminRole,
      provider: profile?.provider || 'email',
      language,
      phone,
      address,
    });
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!supabase || !user?.email) {
      setPasswordError('Authentication is not configured.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      if (currentPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyError) {
          setPasswordError('Current password is incorrect.');
          setPasswordSaving(false);
          return;
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 4000);
      }
    } catch {
      setPasswordError('Failed to update password. Please try again.');
    }
    setPasswordSaving(false);
  };

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (email || 'U').slice(0, 2).toUpperCase();

  const roleLabel = role === 'admin' ? (adminRole === 'manager' ? 'Manager' : adminRole === 'finance' ? 'Finance Admin' : 'Administrator') : role === 'editor' ? 'Editor' : 'Customer';

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <div className="space-y-6">
      <Card className="animate-slide-up">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-2xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-bold">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 flex items-center justify-center hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors disabled:opacity-50"
              aria-label="Change profile picture"
            >
              {uploadingAvatar ? <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" /> : <Camera className="w-4 h-4 text-ink-500 dark:text-ink-400" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }}
            />
          </div>
          <div className="w-full min-w-0 text-center sm:flex-1 sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{fullName || 'Unknown User'}</h2>
              <Badge status="active">{roleLabel}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-500 dark:text-ink-400 sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {email}
                {user?.email_confirmed_at && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-success-50 dark:bg-success-500/15 text-success-600 dark:text-success-400 text-[10px] font-semibold border border-success-200 dark:border-success-500/30" title="Email verified">
                    <BadgeCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </span>
              {phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {phone}</span>}
              {address && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {address}</span>}
            </div>
          </div>
          <Button className="w-full sm:w-auto" variant="primary" icon={<Save className="w-4 h-4" />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </Card>

      {role === 'editor' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
          <StatCard label="Tasks Managed" value={String(stats.projects)} icon={<Briefcase className="w-5 h-5" />} color="primary" />
          <StatCard label="Years Active" value={String(stats.years)} icon={<Calendar className="w-5 h-5" />} color="warning" />
          <StatCard label="Avg Rating" value={stats.rating.toFixed(1)} icon={<Star className="w-5 h-5" />} color="purple" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger">
        <Card className="animate-slide-up hover:-translate-y-0.5">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Add phone number" inputMode="tel" pattern="[0-9]*" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Profile Picture
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="input text-left text-ink-500 dark:text-ink-400 hover:border-primary-300 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change picture' : 'Upload picture'}
              </button>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Address</label>
              <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Add your address" />
            </div>
          </div>
        </Card>

        <Card className="animate-slide-up hover:-translate-y-0.5">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Account Settings</h3>
          <div className="space-y-4">
            {role !== 'customer' && (
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Role</label>
              <select className="input" disabled>
                <option>{roleLabel}</option>
              </select>
            </div>
            )}
            {role === 'admin' && (
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Admin Sub-Role
                </label>
                <select className="input" value={adminRole || 'main'} onChange={(e) => setAdminRole(e.target.value as AdminRole)}>
                  <option value="main">Main Admin (full access)</option>
                  <option value="manager">Manager (no finance access)</option>
                  <option value="finance">Finance Admin (no approval access)</option>
                </select>
              </div>
            )}
            <div className="p-4 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2 block">Theme</label>
                <div className="flex gap-2">
                  <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400'}`}>
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button onClick={() => theme === 'light' && toggleTheme()} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400'}`}>
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2 block">Sound Effects</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSound}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${soundEnabled ? 'bg-primary-600' : 'bg-ink-200 dark:bg-ink-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300">
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-primary-500" /> : <VolumeX className="w-4 h-4 text-ink-400" />}
                    {soundEnabled ? 'On' : 'Off'}
                  </span>
                  <span className="text-xs text-ink-400">Clicks, navigation, scrolling, and tab sounds</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Timezone</label>
              <select className="input" defaultValue="IST">
                <option value="IST">IST (UTC+5:30)</option>
                <option value="EST">EST (UTC-5:00)</option>
                <option value="PST">PST (UTC-8:00)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Language</label>
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {INDIAN_LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
            </div>
            <div className="p-4 rounded-xl bg-error-50/60 border border-error-100 dark:bg-ink-800/50 dark:border-ink-800">
              <p className="text-sm font-semibold text-error-700">Sign Out</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">You'll be signed out of this session. You can sign back in anytime.</p>
              <Button variant="danger" size="sm" className="mt-3" onClick={() => {
                if (confirm('Are you sure you want to sign out? You can sign back in anytime.')) {
                  signOut();
                }
              }}>Sign Out</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="animate-slide-up hover:-translate-y-0.5">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary-500" /> Change Password
        </h3>
        {passwordError && (
          <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400 mb-4">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 mb-4">
            Password updated successfully!
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                className="input pr-10"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="input pr-10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="input pr-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="primary"
            size="sm"
            icon={<Lock className="w-3.5 h-3.5" />}
            onClick={handleChangePassword}
            disabled={passwordSaving || !newPassword || !confirmPassword}
          >
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
