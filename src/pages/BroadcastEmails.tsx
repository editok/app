import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Mail, Send, Plus, Trash2, Eye, Users, UserCog, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as db from '../data/db';
import type { BroadcastCampaign, Customer, Employee } from '../data/db';
import { useAuth } from '../contexts/AuthContext';

export default function BroadcastEmails() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [viewing, setViewing] = useState<BroadcastCampaign | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number; failedCount: number; total: number } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({
    subject: '',
    bodyContent: '',
    audience: 'customer' as 'customer' | 'editor',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [campaignData, customerData, employeeData] = await Promise.all([
        db.fetchBroadcastCampaigns(),
        db.fetchCustomers(),
        db.fetchEmployees(),
      ]);
      setCampaigns(campaignData);
      setCustomers(customerData);
      setEmployees(employeeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load broadcast campaigns');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getRecipients = (audience: 'customer' | 'editor'): { email: string; name: string | null }[] => {
    if (audience === 'customer') {
      return customers
        .filter((c) => c.email)
        .map((c) => ({ email: c.email!, name: c.company }));
    }
    return employees
      .filter((e) => e.email)
      .map((e) => ({ email: e.email!, name: e.name }));
  };

  const recipientPreview = getRecipients(form.audience);

  const handleSend = async () => {
    if (!form.subject.trim() || !form.bodyContent.trim()) {
      setError('Subject and body are required.');
      return;
    }
    const recipients = getRecipients(form.audience);
    if (recipients.length === 0) {
      setError(`No ${form.audience === 'customer' ? 'customers' : 'editors'} with email addresses found.`);
      return;
    }
    setError(null);
    setSending(true);
    setSendResult(null);
    try {
      const campaign = await db.createBroadcastCampaign({
        subject: form.subject,
        body_content: form.bodyContent,
        audience: form.audience,
        created_by: user?.email || null,
      });
      if (!campaign) throw new Error('Failed to create campaign record');
      const result = await db.sendBroadcastEmail(
        campaign.id,
        form.subject,
        form.bodyContent,
        recipients,
      );
      setSendResult(result);
      setShowCompose(false);
      setForm({ subject: '', bodyContent: '', audience: 'customer' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast email');
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteBroadcastCampaign(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const columns: Column<BroadcastCampaign>[] = [
    { key: 'subject', label: 'Subject', sortable: true, render: (r) => (
      <div className="min-w-0">
        <p className="font-semibold text-ink-800 dark:text-ink-100 truncate">{r.subject}</p>
        <p className="text-xs text-ink-400 truncate max-w-xs">{r.body_content.slice(0, 80)}{r.body_content.length > 80 ? '...' : ''}</p>
      </div>
    ) },
    { key: 'audience', label: 'Audience', sortable: true, render: (r) => (
      <Badge status={r.audience === 'customer' ? 'processing' : 'review'}>
        <span className="flex items-center gap-1">
          {r.audience === 'customer' ? <Users className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
          {r.audience === 'customer' ? 'Customers' : 'Editors'}
        </span>
      </Badge>
    ) },
    { key: 'recipient_count', label: 'Recipients', sortable: true, render: (r) => (
      <span className="font-semibold text-ink-700 dark:text-ink-200">{r.recipient_count}</span>
    ) },
    { key: 'status', label: 'Status', sortable: true, render: (r) => (
      <Badge status={r.status === 'sent' ? 'completed' : r.status === 'sending' ? 'processing' : r.status === 'failed' ? 'review' : 'pending'}>
        {r.status === 'sending' ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Sending</span> : r.status}
      </Badge>
    ) },
    { key: 'sent_at', label: 'Sent Date', sortable: true, render: (r) => (
      <span className="text-sm text-ink-600 dark:text-ink-300">{formatDate(r.sent_at)}</span>
    ) },
  ];

  const actions = (row: BroadcastCampaign) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewing(row)}>View</Button>
      <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(row.id)}>Delete</Button>
    </div>
  );

  if (loading) return <FullPageSpinner />;

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipient_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">Broadcast Emails</h2>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Send a customized email to all customers or editors at once</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowCompose(true); setSendResult(null); setError(null); }}>New Broadcast</Button>
      </div>

      {sendResult && (
        <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30 flex items-start gap-3 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-success-700 dark:text-success-400">Broadcast sent successfully</p>
            <p className="text-xs text-success-600 dark:text-success-500 mt-0.5">
              {sendResult.sentCount} of {sendResult.total} emails delivered
              {sendResult.failedCount > 0 ? `, ${sendResult.failedCount} failed` : ''}.
            </p>
          </div>
        </div>
      )}

      {error && !showCompose && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <StatCard label="Total Campaigns" value={campaigns.length} icon={<Mail className="w-5 h-5" />} color="primary" />
        <StatCard label="Emails Sent" value={totalSent} icon={<Send className="w-5 h-5" />} color="success" />
        <StatCard label="Total Recipients" value={totalRecipients} icon={<Users className="w-5 h-5" />} color="warning" />
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">Campaign History</h3>
        </div>
        <div className="px-5 pb-5">
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-3" />
              <p className="text-sm text-ink-400">No broadcast emails yet. Click "New Broadcast" to send your first one.</p>
            </div>
          ) : (
            <DataTable columns={columns} data={campaigns} actions={actions} pageSize={8} />
          )}
        </div>
      </Card>

      <Modal open={showCompose} onClose={() => { setShowCompose(false); setSending(false); }} title="New Broadcast Email" size="lg">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400 flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Audience *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setForm({ ...form, audience: 'customer' })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.audience === 'customer' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700'}`}
              >
                <Users className={`w-5 h-5 ${form.audience === 'customer' ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">All Customers</p>
                  <p className="text-xs text-ink-400">{customers.filter((c) => c.email).length} recipients</p>
                </div>
              </button>
              <button
                onClick={() => setForm({ ...form, audience: 'editor' })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.audience === 'editor' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-ink-100 dark:border-ink-800 hover:border-ink-200 dark:hover:border-ink-700'}`}
              >
                <UserCog className={`w-5 h-5 ${form.audience === 'editor' ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">All Editors</p>
                  <p className="text-xs text-ink-400">{employees.filter((e) => e.email).length} recipients</p>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Subject *</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Holiday Schedule Update" />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email Body *</label>
            <textarea className="input font-mono text-sm" rows={10} value={form.bodyContent} onChange={(e) => setForm({ ...form, bodyContent: e.target.value })} placeholder="Type your message here. Use {{name}} to personalize with each recipient's name and {{email}} for their email address." />
            <p className="text-xs text-ink-400 mt-1.5">Use <code className="px-1 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-primary-600 dark:text-primary-400 text-[11px]">{'{{name}}'}</code> and <code className="px-1 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-primary-600 dark:text-primary-400 text-[11px]">{'{{email}}'}</code> to personalize each email with the recipient's name and email.</p>
          </div>

          <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-3.5 h-3.5 text-primary-500" />
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">Preview</p>
            </div>
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{form.subject || '(no subject)'}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 whitespace-pre-wrap line-clamp-4">{form.bodyContent || '(email body will appear here)'}</p>
            <p className="text-xs text-ink-400 mt-2">Will be sent to <span className="font-semibold text-primary-600 dark:text-primary-400">{recipientPreview.length} {form.audience === 'customer' ? 'customers' : 'editors'}</span></p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCompose(false); setSending(false); }} disabled={sending}>Cancel</Button>
            <Button variant="primary" size="sm" icon={sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} onClick={handleSend} disabled={sending || !form.subject.trim() || !form.bodyContent.trim()}>
              {sending ? 'Sending...' : `Send to ${recipientPreview.length} ${form.audience === 'customer' ? 'Customers' : 'Editors'}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Broadcast Details" size="md">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge status={viewing.audience === 'customer' ? 'processing' : 'review'}>
                <span className="flex items-center gap-1">
                  {viewing.audience === 'customer' ? <Users className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                  {viewing.audience === 'customer' ? 'Customers' : 'Editors'}
                </span>
              </Badge>
              <Badge status={viewing.status === 'sent' ? 'completed' : viewing.status === 'sending' ? 'processing' : viewing.status === 'failed' ? 'review' : 'pending'}>
                {viewing.status}
              </Badge>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1 block">Subject</label>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{viewing.subject}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1 block">Body</label>
              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-800 text-sm text-ink-700 dark:text-ink-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{viewing.body_content}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
                <p className="text-xs text-ink-400">Recipients</p>
                <p className="text-lg font-bold text-ink-800 dark:text-ink-100">{viewing.recipient_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-center">
                <p className="text-xs text-success-600 dark:text-success-400">Sent</p>
                <p className="text-lg font-bold text-success-700 dark:text-success-300">{viewing.sent_count}</p>
              </div>
              <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-center">
                <p className="text-xs text-error-600 dark:text-error-400">Failed</p>
                <p className="text-lg font-bold text-error-700 dark:text-error-300">{viewing.failed_count}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1 block">Sent At</label>
              <p className="text-sm text-ink-700 dark:text-ink-300">{formatDate(viewing.sent_at)}</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
