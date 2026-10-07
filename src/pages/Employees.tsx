import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { UserCog, Star, Plus, Pencil, Eye, Mail, Phone, UserX, UserCheck, BarChart3, RefreshCw } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import type { Employee } from '../data/db';

export default function Employees({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', skills: '', applications: '', experience: '', password: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', skills: '', applications: '', experience: '', status: 'available' });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await db.fetchEmployees();
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name) { setError('Name is required'); return; }
    if (!form.email) { setError('Email is required so the employee can log in'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    try {
      const existingEmployee = employees.find((e) => (e.email || '').toLowerCase() === form.email.toLowerCase());
      if (existingEmployee) { setError('An employee with this email already exists.'); return; }
      await db.adminCreateUser({ email: form.email, password: form.password, fullName: form.name, role: 'editor' });
      await db.createEmployee({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        skills: form.skills ? form.skills.split(',').map((s) => s.trim()) : [],
        applications: form.applications ? form.applications.split(',').map((a) => a.trim()) : [],
        experience: form.experience || null,
        rating: 5.0,
        projects: 0,
        status: 'available',
        joined: new Date().toISOString().split('T')[0],
      });
      await db.sendStatusEmail({
        templateName: 'editor_welcome',
        recipient: form.email,
        recipientName: form.name,
        variables: {
          editor_name: form.name,
          editor_email: form.email,
          editor_password: form.password,
          login_link: `${window.location.origin}/`,
        },
      });
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', skills: '', applications: '', experience: '', password: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee');
    }
  };

  const openEdit = (e: Employee) => {
    setEditForm({
      name: e.name,
      email: e.email || '',
      phone: e.phone || '',
      skills: e.skills.join(', '),
      applications: e.applications.join(', '),
      experience: e.experience || '',
      status: e.status,
    });
    setShowEdit(e);
  };

  const handleEdit = async () => {
    if (!showEdit) return;
    setError(null);
    try {
      await db.updateEmployee(showEdit.id, {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        skills: editForm.skills ? editForm.skills.split(',').map((s) => s.trim()) : [],
        applications: editForm.applications ? editForm.applications.split(',').map((a) => a.trim()) : [],
        experience: editForm.experience || null,
        status: editForm.status,
      });
      setShowEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    }
  };

  const toggleStatus = async (e: Employee) => {
    const newStatus = e.status === 'leave' ? 'available' : 'leave';
    try {
      await db.updateEmployee(e.id, { status: newStatus });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee status');
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
          {r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p className="font-semibold text-ink-800 dark:text-ink-100">{r.name}</p>
          <p className="text-xs text-ink-400">{r.email || '—'}</p>
        </div>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (r) => (
      <span className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300">
        <Phone className="w-3.5 h-3.5 text-ink-400" />
        {r.phone || '—'}
      </span>
    ) },
    { key: 'skills', label: 'Skills', render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.skills.slice(0, 3).map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400">{s}</span>)}
        {r.skills.length > 3 && <span className="text-xs text-ink-400">+{r.skills.length - 3}</span>}
      </div>
    ) },
    { key: 'experience', label: 'Experience', render: (r) => <span className="text-ink-600 dark:text-ink-300">{r.experience || '—'}</span> },
    { key: 'rating', label: 'Rating', sortable: true, render: (r) => (
      <div className="flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-warning-400 fill-warning-400" />
        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{r.rating.toFixed(1)}</span>
      </div>
    ) },
    { key: 'projects', label: 'Projects', sortable: true, render: (r) => <span className="font-semibold text-ink-700 dark:text-ink-200">{r.projects}</span> },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const actions = (row: Employee) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" icon={<BarChart3 className="w-3.5 h-3.5" />} onClick={() => onNavigate('employee-detail', { id: row.id })}>Stats</Button>
      <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('employee-profile', { id: row.id })}>Profile</Button>
      <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => openEdit(row)}>Edit</Button>
      <Button
        variant={row.status === 'leave' ? 'success' : 'danger'}
        size="sm"
        icon={row.status === 'leave' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
        onClick={() => toggleStatus(row)}
      >
        {row.status === 'leave' ? 'Activate' : 'Deactivate'}
      </Button>
    </div>
  );

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-ink-900 dark:text-white">Employees</h2>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>Add Employee</Button>
      </div>

      {error && !showAdd && !showEdit && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total" value={employees.length} icon={<UserCog className="w-5 h-5" />} color="primary" />
        <StatCard label="Available" value={employees.filter(e => e.status === 'available').length} icon={<UserCog className="w-5 h-5" />} color="success" />
        <StatCard label="Working" value={employees.filter(e => e.status === 'working').length} icon={<UserCog className="w-5 h-5" />} color="warning" />
        <StatCard label="On Leave" value={employees.filter(e => e.status === 'leave').length} icon={<UserCog className="w-5 h-5" />} color="error" />
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">All Employees</h3>
        </div>
        <div className="px-5 pb-5">
          <DataTable columns={columns} data={employees} actions={actions} pageSize={8} />
        </div>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Employee" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name *</label>
            <input className="input" name="employee-full-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" type="email" name="employee-email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rahul@editok.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="employee-phone" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 90000 11111" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Skills (comma-separated)</label>
            <input className="input" name="employee-skills" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Color Correction, Retouching, Album Design" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Applications (comma-separated)</label>
            <input className="input" name="employee-applications" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.applications} onChange={(e) => setForm({ ...form, applications: e.target.value })} placeholder="Lightroom, Photoshop, Luminar" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Experience</label>
            <input className="input" name="employee-experience" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="e.g. 5 years" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Login Password *</label>
            <div className="flex gap-2">
              <input type="password" name="employee-password" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} className="input flex-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" />
              <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => setForm({ ...form, password: Math.random().toString(36).slice(2, 10) })}>Auto</Button>
            </div>
            <p className="text-xs text-ink-400 mt-1">The employee will use this with their email to sign in.</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAdd}>Add Employee</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Employee" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name *</label>
            <input className="input" name="employee-edit-full-name" autoComplete="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" type="email" name="employee-edit-email" autoComplete="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="employee-edit-phone" autoComplete="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Skills (comma-separated)</label>
            <input className="input" name="employee-edit-skills" autoComplete="off" value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Applications (comma-separated)</label>
            <input className="input" name="employee-edit-applications" autoComplete="off" value={editForm.applications} onChange={(e) => setEditForm({ ...editForm, applications: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Experience</label>
            <input className="input" name="employee-edit-experience" autoComplete="off" value={editForm.experience} onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="available">Available</option>
              <option value="working">Working</option>
              <option value="leave">On Leave</option>
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
