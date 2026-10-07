import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Building2, Phone, Mail, Plus, Pencil, UserX, UserCheck, RefreshCw, Eye } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import type { Customer, Project } from '../data/db';

export default function Customers({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState({ company: '', email: '', phone: '', gst: '', address: '', password: '' });
  const [editForm, setEditForm] = useState({ company: '', email: '', phone: '', gst: '', address: '', status: 'active' });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [data, projects] = await Promise.all([db.fetchCustomers(), db.fetchProjects()]);
    setCustomers(data);
    const counts: Record<string, number> = {};
    for (const c of data) {
      if (c.email) {
        counts[c.id] = projects.filter((p: Project) => p.customer_email === c.email).length;
      } else {
        counts[c.id] = 0;
      }
    }
    setProjectCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.company) { setError('Company name is required'); return; }
    if (!form.email) { setError('Email is required so the customer can log in'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    try {
      const existingCustomer = customers.find((c) => (c.email || '').toLowerCase() === form.email.toLowerCase());
      if (existingCustomer) { setError('A customer with this email already exists.'); return; }
      await db.adminCreateUser({ email: form.email, password: form.password, fullName: form.company, role: 'customer' });
      await db.createCustomer({
        company: form.company,
        email: form.email || null,
        phone: form.phone || null,
        gst: form.gst || null,
        address: form.address || null,
        projects: 0,
        status: 'active',
      });
      await db.sendStatusEmail({
        templateName: 'customer_welcome',
        recipient: form.email,
        recipientName: form.company,
        variables: {
          customer_name: form.company,
          customer_email: form.email,
          login_link: `${window.location.origin}/`,
        },
      });
      setShowAdd(false);
      setForm({ company: '', email: '', phone: '', gst: '', address: '', password: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer');
    }
  };

  const openEdit = (c: Customer) => {
    setEditForm({
      company: c.company,
      email: c.email || '',
      phone: c.phone || '',
      gst: c.gst || '',
      address: c.address || '',
      status: c.status,
    });
    setShowEdit(c);
  };

  const handleEdit = async () => {
    if (!showEdit) return;
    setError(null);
    try {
      await db.updateCustomer(showEdit.id, {
        company: editForm.company,
        email: editForm.email || null,
        phone: editForm.phone || null,
        gst: editForm.gst || null,
        address: editForm.address || null,
        status: editForm.status,
      });
      setShowEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    }
  };

  const toggleStatus = async (c: Customer) => {
    const newStatus = c.status === 'active' ? 'inactive' : 'active';
    try {
      await db.updateCustomer(c.id, { status: newStatus });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const columns: Column<Customer>[] = [
    { key: 'company', label: 'Company', sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
          <Building2 className="w-4 h-4" />
        </div>
        <span className="font-semibold text-ink-800 dark:text-ink-100">{r.company}</span>
      </div>
    ) },
    { key: 'email', label: 'Email', render: (r) => <span className="text-ink-600 dark:text-ink-300">{r.email || '—'}</span> },
    { key: 'phone', label: 'Phone', render: (r) => <span className="text-ink-600 dark:text-ink-300">{r.phone || '—'}</span> },
    { key: 'projects', label: 'Projects', sortable: true, render: (r) => <span className="font-semibold text-ink-700 dark:text-ink-200">{projectCounts[r.id] ?? 0}</span> },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const actions = (row: Customer) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('customer-detail', { id: row.id })}>View</Button>
      <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(row)}>Edit</Button>
      <Button
        variant={row.status === 'active' ? 'danger' : 'success'}
        size="sm"
        icon={row.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
        onClick={() => toggleStatus(row)}
      >
        {row.status === 'active' ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  );

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-ink-900 dark:text-white">Customers</h2>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>New Customer</Button>
      </div>

      {error && !showAdd && !showEdit && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Customers" value={customers.length} icon={<Building2 className="w-5 h-5" />} color="primary" />
        <StatCard label="Active" value={customers.filter(c => c.status === 'active').length} icon={<Building2 className="w-5 h-5" />} color="success" />
        <StatCard label="Inactive" value={customers.filter(c => c.status === 'inactive').length} icon={<Building2 className="w-5 h-5" />} color="warning" />
        <StatCard label="New This Month" value={customers.filter(c => new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length} icon={<Plus className="w-5 h-5" />} color="purple" />
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">All Customers</h3>
        </div>
        <div className="px-5 pb-5">
          <DataTable columns={columns} data={customers} actions={actions} pageSize={8} />
        </div>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Customer" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Company Name *</label>
            <input className="input" name="customer-company" autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Lens & Light Studios" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" type="email" name="customer-email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@company.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="customer-phone" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">GST Number</label>
            <input className="input" name="customer-gst" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Address</label>
            <textarea className="input" name="customer-address" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Login Password *</label>
            <div className="flex gap-2">
              <input type="password" name="customer-password" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} className="input flex-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" />
              <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => setForm({ ...form, password: Math.random().toString(36).slice(2, 10) })}>Auto</Button>
            </div>
            <p className="text-xs text-ink-400 mt-1">The customer will use this with their email to sign in.</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAdd}>Add Customer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Customer" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Company Name *</label>
            <input className="input" name="customer-edit-company" autoComplete="organization" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" type="email" name="customer-edit-email" autoComplete="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="customer-edit-phone" autoComplete="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">GST Number</label>
            <input className="input" name="customer-edit-gst" autoComplete="off" value={editForm.gst} onChange={(e) => setEditForm({ ...editForm, gst: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Address</label>
            <textarea className="input" name="customer-edit-address" autoComplete="street-address" rows={2} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(null)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={handleEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
