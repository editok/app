import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useRef } from 'react';
import { Building2, Clock, Mail, Shield, Palette, Save, Upload, Pencil, Copy, Users, UserCog, ShieldCheck, Lock, Eye, EyeOff, Landmark, Smartphone, Volume2, CheckCircle2, Plus } from 'lucide-react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { supabase, useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSound } from '../contexts/SoundContext';
import * as db from '../data/db';
import type { EmailTemplate } from '../data/db';

const sections = [
  { key: 'company', label: 'Company Profile', icon: <Building2 className="w-4 h-4" /> },
  { key: 'hours', label: 'Business Hours', icon: <Clock className="w-4 h-4" /> },
  { key: 'bank', label: 'Bank Details', icon: <Landmark className="w-4 h-4" /> },
  { key: 'email', label: 'Email Templates', icon: <Mail className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { key: 'branding', label: 'Branding', icon: <Palette className="w-4 h-4" /> },
];

const defaultCompany = {
  name: 'EDITOK Post Production',
  email: 'contact@editok.com',
  phone: '+91 98765 43210',
  gst: '29ABCDE1234F1Z5',
  address: '123 Business Park, Bangalore, Karnataka 560001',
};

const defaultBank = {
  bankName: '',
  branchName: '',
  accountHolder: '',
  accountNumber: '',
  ifscCode: '',
  upiName: '',
  upiId: '',
  upiMobile: '',
};

const defaultHours = [
  { day: 'Monday', open: true, start: '09:00', end: '18:00' },
  { day: 'Tuesday', open: true, start: '09:00', end: '18:00' },
  { day: 'Wednesday', open: true, start: '09:00', end: '18:00' },
  { day: 'Thursday', open: true, start: '09:00', end: '18:00' },
  { day: 'Friday', open: true, start: '09:00', end: '18:00' },
  { day: 'Saturday', open: true, start: '09:00', end: '18:00' },
  { day: 'Sunday', open: false, start: '09:00', end: '18:00' },
];

export default function Settings() {
  const themeCtx = useTheme();
  const soundCtx = useSound();
  const [active, setActive] = useState('company');
  const [company, setCompany] = useState(defaultCompany);
  const [hours, setHours] = useState(defaultHours);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [branding, setBranding] = useState<{ logoUrl: string; slogan: string; primaryColor?: string }>({ logoUrl: '', slogan: '' });
  const [bank, setBank] = useState(defaultBank);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: '', body_content: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    template_name: '',
    display_name: '',
    subject: '',
    body_content: '',
    target_role: 'customer',
    available_variables: '',
  });
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) { if (active) setLoading(false); return; }
      try {
        const [settingsResult, templatesResult] = await Promise.allSettled([
          supabase.from('settings').select('key, value').in('key', ['company', 'hours', 'branding', 'bank']),
          db.fetchEmailTemplates(),
        ]);
        if (!active) return;
        if (settingsResult.status === 'fulfilled' && settingsResult.value.data) {
          const data = settingsResult.value.data;
          const companyRow = data.find((r) => r.key === 'company');
          if (companyRow) setCompany({ ...defaultCompany, ...companyRow.value });
          const hoursRow = data.find((r) => r.key === 'hours');
          if (hoursRow) setHours({ ...defaultHours, ...hoursRow.value });
          const brandingRow = data.find((r) => r.key === 'branding');
          if (brandingRow) setBranding({ logoUrl: brandingRow.value?.logoUrl || '', slogan: brandingRow.value?.slogan || '', primaryColor: brandingRow.value?.primaryColor || undefined });
          const bankRow = data.find((r) => r.key === 'bank');
          if (bankRow) setBank({ ...defaultBank, ...bankRow.value });
        }
        if (templatesResult.status === 'fulfilled') {
          setEmailTemplates(templatesResult.value);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const loadEmailTemplates = async () => {
    const templates = await db.fetchEmailTemplates();
    setEmailTemplates(templates);
  };

  const openTemplateEditor = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ subject: t.subject, body_content: t.body_content });
  };

  const createTemplate = async () => {
    if (!newTemplateForm.template_name.trim() || !newTemplateForm.display_name.trim() || !newTemplateForm.subject.trim() || !newTemplateForm.body_content.trim()) {
      setTemplateError('Template name, display name, subject, and body are all required.');
      return;
    }
    setCreatingTemplate(true);
    setTemplateError(null);
    try {
      const variables = newTemplateForm.available_variables
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      await db.createEmailTemplate({
        template_name: newTemplateForm.template_name.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: newTemplateForm.display_name.trim(),
        subject: newTemplateForm.subject.trim(),
        body_content: newTemplateForm.body_content.trim(),
        target_role: newTemplateForm.target_role,
        available_variables: variables,
      });
      setShowNewTemplate(false);
      setNewTemplateForm({ template_name: '', display_name: '', subject: '', body_content: '', target_role: 'customer', available_variables: '' });
      loadEmailTemplates();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to create template.');
    }
    setCreatingTemplate(false);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await db.updateEmailTemplate(editingTemplate.id, {
        subject: templateForm.subject,
        body_content: templateForm.body_content,
      });
      setEditingTemplate(null);
      loadEmailTemplates();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError('Failed to save template.');
    }
    setSavingTemplate(false);
  };

  const copyVariable = (v: string) => {
    navigator.clipboard.writeText(v).then();
  };

  const roleIcon = (role: string) => role === 'customer' ? <Users className="w-3.5 h-3.5" /> : role === 'editor' ? <UserCog className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />;
  const roleLabel = (role: string) => role === 'customer' ? 'Customer' : role === 'editor' ? 'Editor' : 'Admin';
  const roleColor = (role: string) => role === 'customer' ? 'processing' : role === 'editor' ? 'review' : 'completed';

  const templatesByRole = (role: string) => emailTemplates.filter((t) => t.target_role === role);

  const handleLogoUpload = async (file: File) => {
    if (!supabase) return;
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to upload a logo.');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/branding-logo.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setBranding({ ...branding, logoUrl: `${data.publicUrl}?t=${Date.now()}` });
    } catch (error) {
      console.error('Logo upload error:', error);
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSetting = async (key: string, value: Record<string, unknown>) => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      if (supabase) {
        const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
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
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
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

  if (loading) return <FullPageSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 stagger">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card padding={false} className="animate-slide-up">
          <div className="p-3 space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => { setActive(s.key); soundCtx.play('select'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active === s.key ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800/50'
                }`}
              >
                <span className={active === s.key ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400 dark:text-ink-500'}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Content */}
      <div className="lg:col-span-3">
        <Card className="animate-slide-up">
          {active === 'company' && (
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Company Profile</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">Update your company information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Company Name</label>
                  <input className="input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
                  <input className="input" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
                  <input className="input" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">GST Number</label>
                  <input className="input" value={company.gst} onChange={(e) => setCompany({ ...company, gst: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Address</label>
                  <textarea className="input" rows={2} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                </div>
              </div>
              {saveSuccess && <div className="mb-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 flex items-center gap-2 animate-slide-up"><CheckCircle2 className="w-4 h-4" /> Saved successfully!</div>}
              {saveError && active === 'company' && <div className="mb-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{saveError}</div>}
              <div className="flex justify-end mt-5">
                <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={() => saveSetting('company', company)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {active === 'hours' && (
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Business Hours</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">Set your working hours</p>
              <div className="space-y-2">
                {hours.map((h, i) => (
                  <div key={h.day} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-200 w-20 sm:w-24">{h.day}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={h.open} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, open: e.target.checked } : x))} className="sr-only peer" />
                      <div className="w-10 h-5 bg-ink-200 dark:bg-ink-700 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                    {h.open && <div className="flex gap-2 items-center">
                      <input type="time" className="input py-1.5" value={h.start} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                      <span className="text-ink-400 dark:text-ink-500">to</span>
                      <input type="time" className="input py-1.5" value={h.end} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                    </div>}
                  </div>
                ))}
              </div>
              {saveSuccess && <div className="mb-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 flex items-center gap-2 animate-slide-up"><CheckCircle2 className="w-4 h-4" /> Saved successfully!</div>}
              {saveError && active === 'hours' && <div className="mb-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{saveError}</div>}
              <div className="flex justify-end mt-5">
                <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={() => saveSetting('hours', { hours })} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {active === 'bank' && (
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Bank & UPI Details</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">These details appear on every customer invoice so they can pay you easily</p>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="w-4 h-4 text-primary-500" />
                    <h4 className="text-sm font-bold text-ink-700 dark:text-ink-200">Bank Account</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Bank Name</label>
                      <input className="input" placeholder="e.g. HDFC Bank" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Branch Name</label>
                      <input className="input" placeholder="e.g. MG Road Branch" value={bank.branchName} onChange={(e) => setBank({ ...bank, branchName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Account Holder Name</label>
                      <input className="input" placeholder="e.g. EDITOK Post Production" value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Account Number</label>
                      <input className="input" placeholder="e.g. 12345678901234" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">IFSC Code</label>
                      <input className="input" placeholder="e.g. HDFC0001234" value={bank.ifscCode} onChange={(e) => setBank({ ...bank, ifscCode: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-ink-100 dark:border-ink-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="w-4 h-4 text-primary-500" />
                    <h4 className="text-sm font-bold text-ink-700 dark:text-ink-200">UPI Details</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">UPI Name</label>
                      <input className="input" placeholder="e.g. EDITOK" value={bank.upiName} onChange={(e) => setBank({ ...bank, upiName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">UPI ID</label>
                      <input className="input" placeholder="e.g. editok@hdfcbank" value={bank.upiId} onChange={(e) => setBank({ ...bank, upiId: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">UPI Mobile Number</label>
                      <input className="input" placeholder="e.g. 9876543210" value={bank.upiMobile} onChange={(e) => setBank({ ...bank, upiMobile: e.target.value })} />
                    </div>
                  </div>
                  {bank.upiId && (
                    <div className="mt-4 flex flex-col items-center p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-xs text-ink-400 mb-2">Auto-generated UPI QR Code</p>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(bank.upiId)}&pn=${encodeURIComponent(bank.upiName || bank.accountHolder || '')}&am=0&cu=INR`} alt="UPI QR Code" className="w-44 h-44 rounded-xl border border-ink-100 dark:border-ink-700" />
                      <p className="text-xs text-ink-500 dark:text-ink-400 mt-2">Scan to pay via UPI</p>
                    </div>
                  )}
                </div>
              </div>
              {saveSuccess && <div className="mb-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 flex items-center gap-2 animate-slide-up"><CheckCircle2 className="w-4 h-4" /> Saved successfully!</div>}
              {saveError && active === 'bank' && <div className="mb-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{saveError}</div>}
              <div className="flex justify-end mt-5">
                <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={() => saveSetting('bank', bank)} disabled={saving}>{saving ? 'Saving...' : 'Save Bank Details'}</Button>
              </div>
            </div>
          )}

          {active === 'email' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-ink-900 dark:text-white">Email Templates</h3>
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setShowNewTemplate(true); setTemplateError(null); }}>New Template</Button>
              </div>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">Customize automated email templates sent to customers, editors, and admins</p>
              {['customer', 'editor', 'admin'].map((role) => (
                <div key={role} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    {roleIcon(role)}
                    <h4 className="text-sm font-bold text-ink-700 dark:text-ink-200">{roleLabel(role)} Templates</h4>
                    <Badge status={roleColor(role) as 'completed'}>{templatesByRole(role).length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {templatesByRole(role).map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 dark:hover:border-primary-700 transition-all">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{t.display_name}</span>
                            {!t.enabled && <Badge status="review">Disabled</Badge>}
                          </div>
                          <p className="text-xs text-ink-400 mt-0.5 truncate">{t.subject}</p>
                        </div>
                        <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openTemplateEditor(t)}>Edit</Button>
                      </div>
                    ))}
                    {templatesByRole(role).length === 0 && (
                      <p className="text-sm text-ink-400 py-2">No templates for this role.</p>
                    )}
                  </div>
                </div>
              ))}
              {saveError && active === 'email' && <div className="mb-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{saveError}</div>}
          {saveSuccess && active === 'email' && <div className="mb-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 flex items-center gap-2 animate-slide-up"><CheckCircle2 className="w-4 h-4" /> Saved successfully!</div>}
        </div>
          )}

          {active === 'security' && (
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Security</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">Manage your password and security settings</p>
              {passwordError && (
                <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400 mb-4 max-w-md">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 mb-4 max-w-md">Password updated successfully!</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl stagger">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Current Password</label>
                  <div className="relative">
                    <input type={showCurrent ? 'text' : 'password'} className="input pr-10" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }} placeholder="Enter current password" />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"><span className="sr-only">Toggle visibility</span>{showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Password</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} className="input pr-10" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }} placeholder="At least 6 characters" />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"><span className="sr-only">Toggle visibility</span>{showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} className="input pr-10" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }} placeholder="Re-enter new password" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"><span className="sr-only">Toggle visibility</span>{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-5">
                <Button variant="primary" icon={<Lock className="w-4 h-4" />} onClick={handlePasswordChange} disabled={passwordSaving || !newPassword || !confirmPassword}>{passwordSaving ? 'Updating...' : 'Update Password'}</Button>
              </div>
            </div>
          )}

          {active === 'branding' && (
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Branding</h3>
              <p className="text-xs text-ink-400 dark:text-ink-500 mb-5">Customize your brand appearance</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Logo</label>
                  <div className="flex items-center gap-4">
                    {branding.logoUrl ? <img src={branding.logoUrl} alt="Company logo" className="w-16 h-16 rounded-2xl object-contain border border-ink-100 dark:border-ink-800" /> : <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white font-bold text-2xl">E</div>}
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
                    <Button variant="outline" size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Slogan</label>
                  <input className="input" value={branding.slogan} onChange={(e) => setBranding({ ...branding, slogan: e.target.value })} placeholder="e.g. From raw footage to final cut" />
                  <p className="text-xs text-ink-400 mt-1">Shown beneath your logo in outgoing emails.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Primary Color</label>
                  <div className="flex gap-2">
                    {['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444'].map((c) => (
                      <button key={c} onClick={() => setBranding({ ...branding, primaryColor: c })} className={`w-10 h-10 rounded-xl border-2 shadow-soft transition-transform hover:scale-110 ${branding.primaryColor === c ? 'border-ink-900 dark:border-white ring-2 ring-primary-500' : 'border-white dark:border-ink-700'}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Theme</label>
                  <div className="flex gap-2">
                    <button onClick={() => themeCtx.theme === 'dark' && themeCtx.toggle()} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${themeCtx.theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400'}`}>Light</button>
                    <button onClick={() => themeCtx.theme === 'light' && themeCtx.toggle()} className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${themeCtx.theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400'}`}>Dark</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Sound Effects</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={soundCtx.toggle}
                      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${soundCtx.enabled ? 'bg-primary-600' : 'bg-ink-200 dark:bg-ink-700'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${soundCtx.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-ink-600 dark:text-ink-300">{soundCtx.enabled ? 'On' : 'Off'}</span>
                    <span className="text-xs text-ink-400">Play sounds for clicks, menu navigation, scrolling, and tab switches</span>
                  </div>
                  {role === 'admin' && (
                    <div className="mt-3 p-3 rounded-xl bg-primary-50/50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-primary-700 dark:text-primary-300 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5" /> Sound Volume (applies to all users)
                        </label>
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{Math.round(soundCtx.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={soundCtx.volume}
                        onChange={(e) => soundCtx.setVolume(parseFloat(e.target.value))}
                        className="w-full accent-primary-600 cursor-pointer"
                      />
                      <p className="text-[10px] text-ink-400 mt-1">Controls the volume level of all sound effects for every user in the app</p>
                    </div>
                  )}
                </div>
              </div>
              {saveSuccess && <div className="mb-3 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 text-sm text-success-700 dark:text-success-400 flex items-center gap-2 animate-slide-up"><CheckCircle2 className="w-4 h-4" /> Saved successfully!</div>}
              {saveError && active === 'branding' && <div className="mb-3 p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{saveError}</div>}
              <div className="flex justify-end mt-5">
                <Button variant="primary" icon={<Save className="w-4 h-4" />} onClick={() => saveSetting('branding', branding)} disabled={saving}>{saving ? 'Saving...' : 'Save Branding'}</Button>
              </div>
            </div>
          )}

        </Card>
      </div>

      <Modal open={!!editingTemplate} onClose={() => setEditingTemplate(null)} title={`Edit Template — ${editingTemplate?.display_name || ''}`} size="lg">
        <div className="space-y-4">
          {editingTemplate && (
            <div className="flex items-center gap-2">
              <Badge status={roleColor(editingTemplate.target_role) as 'completed'}>{roleLabel(editingTemplate.target_role)}</Badge>
              <span className="text-xs text-ink-400">{editingTemplate.template_name}</span>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Subject</label>
            <input className="input" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Body</label>
            <textarea className="input font-mono text-sm" rows={12} value={templateForm.body_content} onChange={(e) => setTemplateForm({ ...templateForm, body_content: e.target.value })} />
          </div>
          {editingTemplate && editingTemplate.available_variables.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Available Variables (click to copy)</label>
              <div className="flex flex-wrap gap-2">
                {editingTemplate.available_variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => copyVariable(v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 text-xs font-mono text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
                    title={`Copy ${v}`}
                  >
                    <Copy className="w-3 h-3" />
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-400 mt-2">Paste these placeholders into the subject or body. They will be replaced with real data when the email is sent.</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={saveTemplate} disabled={savingTemplate}>{savingTemplate ? 'Saving...' : 'Save Template'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showNewTemplate} onClose={() => setShowNewTemplate(false)} title="Create New Email Template" size="lg">
        <div className="space-y-4">
          {templateError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 text-sm text-error-700 dark:text-error-400">{templateError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Display Name <span className="text-error-500">*</span></label>
              <input className="input" placeholder="e.g. Birthday Greeting" value={newTemplateForm.display_name} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, display_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Template Key <span className="text-error-500">*</span></label>
              <input className="input font-mono text-sm" placeholder="auto-generated from name" value={newTemplateForm.template_name || newTemplateForm.display_name.trim().toLowerCase().replace(/\s+/g, '_')} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, template_name: e.target.value })} />
              <p className="text-xs text-ink-400 mt-1">Unique identifier used in code (lowercase, underscores)</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Target Role <span className="text-error-500">*</span></label>
            <select className="input" value={newTemplateForm.target_role} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, target_role: e.target.value })}>
              <option value="customer">Customer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Subject <span className="text-error-500">*</span></label>
            <input className="input" placeholder="e.g. Happy birthday, {{customer_name}}!" value={newTemplateForm.subject} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, subject: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Body <span className="text-error-500">*</span></label>
            <textarea className="input font-mono text-sm" rows={8} placeholder="Hi {{customer_name}},\n\nWrite your email content here...\n\nBest regards,\nThe EDITOK Team" value={newTemplateForm.body_content} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body_content: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Available Variables (comma-separated)</label>
            <input className="input font-mono text-sm" placeholder="customer_name, project_name, order_number" value={newTemplateForm.available_variables} onChange={(e) => setNewTemplateForm({ ...newTemplateForm, available_variables: e.target.value })} />
            <p className="text-xs text-ink-400 mt-1">Variables that can be used as <code className="text-primary-600">{'{{variable_name}}'}</code> placeholders in the subject or body</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={createTemplate} disabled={creatingTemplate}>{creatingTemplate ? 'Creating...' : 'Create Template'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
