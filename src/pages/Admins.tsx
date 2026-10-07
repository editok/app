import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { ShieldCheck, Plus, Pencil, Mail, ShieldAlert, Lock, UserX, UserCheck, Phone, RefreshCw } from 'lucide-react';
import * as db from '../data/db';
import type { Admin, AdminRole } from '../data/db';
import { adminMenuKeys } from '../components/Layout';
import { getDefaultAllowedMenus, roleDescriptions } from '../utils/adminPermissions';

const adminRoleLabels: Record<AdminRole, string> = {
  main: 'Main Admin',
  sub_admin: 'Sub Admin',
  manager: 'Manager',
  project_manager: 'Project Manager',
  finance: 'Finance Manager',
  sales_manager: 'Sales Manager',
  relationship_manager: 'Relationship Manager',
  custom: 'Custom Role',
};

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Admin | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', adminRole: 'sub_admin' as AdminRole, customRoleName: '', restrictMenus: true, allowedMenus: getDefaultAllowedMenus('sub_admin') || [] });
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', adminRole: 'sub_admin' as AdminRole, customRoleName: '', status: 'active', restrictMenus: false, allowedMenus: [] as string[] });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await db.fetchAdmins();
      setAdmins(data);
    } catch {
      setAdmins([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name) { setError('Name is required'); return; }
    if (!form.email) { setError('Email is required so the admin can log in'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    try {
      const existingAdmin = admins.find((a) => (a.email || '').toLowerCase() === form.email.toLowerCase());
      if (existingAdmin) { setError('An admin with this email already exists.'); return; }
      const createdUser = await db.adminCreateUser({
        email: form.email,
        password: form.password,
        fullName: form.name,
        role: 'admin',
        adminRole: form.adminRole,
      });
      if (!createdUser) throw new Error('Could not create the admin account.');
      const allowedMenus = form.adminRole === 'main' ? null : form.allowedMenus;
      await db.upsertProfile({
        id: createdUser.id,
        full_name: form.name,
        email: form.email,
        role: 'admin',
        admin_role: form.adminRole,
        allowed_menus: allowedMenus,
      });
      await db.createAdmin({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        admin_role: form.adminRole,
        status: 'active',
        allowed_menus: allowedMenus,
      } as Record<string, unknown>);
      await db.sendStatusEmail({
        templateName: 'admin_welcome',
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
      setForm({ name: '', email: '', phone: '', password: '', adminRole: 'sub_admin', customRoleName: '', restrictMenus: true, allowedMenus: getDefaultAllowedMenus('sub_admin') || [] });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin');
    }
  };

  const openEdit = (a: Admin) => {
    setEditForm({
      name: a.name,
      email: a.email || '',
      phone: a.phone || '',
      adminRole: a.admin_role,
      customRoleName: '',
      status: a.status,
      restrictMenus: a.admin_role !== 'main',
      allowedMenus: a.allowed_menus || getDefaultAllowedMenus(a.admin_role) || [],
    });
    setShowEdit(a);
  };

  const handleEdit = async () => {
    if (!showEdit) return;
    setError(null);
    try {
      const menus = editForm.adminRole === 'main'
        ? null
        : editForm.restrictMenus
          ? editForm.allowedMenus
          : getDefaultAllowedMenus(editForm.adminRole);
      await db.updateAdmin(showEdit.id, {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        admin_role: editForm.adminRole,
        status: editForm.status,
        allowed_menus: menus,
      });
      const profiles = await db.fetchProfilesByRole('admin');
      const profile = profiles.find((p) => p.email?.toLowerCase() === (showEdit.email || '').toLowerCase());
      if (profile) {
        await db.upsertProfile({
          id: profile.id,
          full_name: editForm.name,
          email: editForm.email,
          role: 'admin',
          admin_role: editForm.adminRole,
          allowed_menus: menus,
          phone: editForm.phone || null,
        });
      }
      setShowEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin');
    }
  };

  const toggleStatus = async (a: Admin) => {
    const newStatus = a.status === 'active' ? 'inactive' : 'active';
    try {
      await db.updateAdmin(a.id, { status: newStatus });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin status');
    }
  };

  const columns: Column<Admin>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
          {(r.name || r.email || 'A').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-ink-800 dark:text-ink-100">{r.name || '—'}</p>
          <p className="text-xs text-ink-400">{r.email || '—'}</p>
        </div>
      </div>
    ) },
    { key: 'admin_role', label: 'Admin Role', sortable: true, render: (r) => (
      <Badge status={r.admin_role === 'main' ? 'completed' : r.admin_role === 'finance' ? 'review' : r.admin_role === 'sub_admin' ? 'processing' : 'pending'}>
        {adminRoleLabels[r.admin_role] || r.admin_role}
      </Badge>
    ) },
    { key: 'phone', label: 'Phone', render: (r) => (
      <span className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300">
        <Phone className="w-3.5 h-3.5 text-ink-400" />
        {r.phone || '—'}
      </span>
    ) },
    { key: 'status', label: 'Status', sortable: true, render: (r) => (
      <Badge status={r.status === 'active' ? 'completed' : 'review'}>{r.status}</Badge>
    ) },
    { key: 'allowed_menus', label: 'Menu Access', render: (r) => (
      r.allowed_menus && r.allowed_menus.length > 0
        ? <Badge status="processing">{r.allowed_menus.length} menus</Badge>
        : <Badge status="completed">Full access</Badge>
    ) },
  ];

  const actions = (row: Admin) => (
    <div className="flex items-center gap-1">
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
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">Admin Users</h2>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Create and manage admin accounts</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>Add Admin</Button>
      </div>

      {error && !showAdd && !showEdit && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <StatCard label="Total Admins" value={admins.length} icon={<ShieldCheck className="w-5 h-5" />} color="primary" />
        <StatCard label="Main Admins" value={admins.filter((a) => a.admin_role === 'main').length} icon={<ShieldCheck className="w-5 h-5" />} color="success" />
        <StatCard label="Sub Admins" value={admins.filter((a) => a.admin_role === 'sub_admin').length} icon={<ShieldCheck className="w-5 h-5" />} color="warning" />
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-semibold text-ink-900 dark:text-white">All Admin Users</h3>
        </div>
        <div className="px-5 pb-5">
          <DataTable columns={columns} data={admins} actions={actions} pageSize={8} />
        </div>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Admin User" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink-600 dark:text-ink-300 leading-relaxed">
              New admins are created with the role you choose below. A user cannot assign the admin role to themselves — only an existing admin can create another admin.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name *</label>
            <input className="input" name="admin-full-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Nair" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email *</label>
              <input className="input" type="email" name="admin-email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@editok.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="admin-phone" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Admin Role</label>
            <select className="input" value={form.adminRole} onChange={(e) => {
              const adminRole = e.target.value as AdminRole;
              setForm({ ...form, adminRole, restrictMenus: adminRole !== 'main', allowedMenus: getDefaultAllowedMenus(adminRole) || [] });
            }}>
              <option value="main">Main Admin — Full Access</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="project_manager">Project Manager</option>
              <option value="finance">Finance Manager</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="relationship_manager">Relationship Manager</option>
              <option value="custom">Custom Role</option>
            </select>
            {form.adminRole === 'custom' && (
              <input className="input mt-2" value={form.customRoleName} onChange={(e) => setForm({ ...form, customRoleName: e.target.value })} placeholder="Enter custom role name" />
            )}
            <p className="text-xs text-ink-400 mt-1">{roleDescriptions[form.adminRole]}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Login Password *</label>
            <div className="flex gap-2">
              <input type="password" name="admin-password" autoComplete="off" readOnly onFocus={(e) => { e.currentTarget.readOnly = false; }} className="input flex-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" />
              <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => setForm({ ...form, password: Math.random().toString(36).slice(2, 10) })}>Auto</Button>
            </div>
            <p className="text-xs text-ink-400 mt-1">The admin will use this with their email to sign in.</p>
          </div>
          <div className="rounded-xl border border-ink-100 dark:border-ink-700 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.restrictMenus} onChange={(e) => setForm({ ...form, restrictMenus: e.target.checked, allowedMenus: e.target.checked ? form.allowedMenus : [] })} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-400" />
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary-500" /> Restrict sidebar menu access</span>
            </label>
            {form.restrictMenus && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {adminMenuKeys.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer text-sm text-ink-600 dark:text-ink-300">
                    <input type="checkbox" checked={form.allowedMenus.includes(m.key)} onChange={(e) => setForm({ ...form, allowedMenus: e.target.checked ? [...form.allowedMenus, m.key] : form.allowedMenus.filter((k) => k !== m.key) })} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-400" />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-400 mt-2">If unchecked, this admin can see all sidebar menus.</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAdd}>Add Admin</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Admin User" size="md">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">{error}</div>}
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Full Name *</label>
            <input className="input" name="admin-edit-full-name" autoComplete="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Email</label>
              <input className="input" type="email" name="admin-edit-email" autoComplete="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Phone</label>
              <input className="input" type="tel" name="admin-edit-phone" autoComplete="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Admin Role</label>
            <select className="input" value={editForm.adminRole} onChange={(e) => {
              const adminRole = e.target.value as AdminRole;
              setEditForm({ ...editForm, adminRole, restrictMenus: adminRole !== 'main', allowedMenus: getDefaultAllowedMenus(adminRole) || [] });
            }}>
              <option value="main">Main Admin — Full Access</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="project_manager">Project Manager</option>
              <option value="finance">Finance Manager</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="relationship_manager">Relationship Manager</option>
              <option value="custom">Custom Role</option>
            </select>
            {editForm.adminRole === 'custom' && (
              <input className="input mt-2" value={editForm.customRoleName} onChange={(e) => setEditForm({ ...editForm, customRoleName: e.target.value })} placeholder="Enter custom role name" />
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Status</label>
            <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="rounded-xl border border-ink-100 dark:border-ink-700 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.restrictMenus} onChange={(e) => setEditForm({ ...editForm, restrictMenus: e.target.checked, allowedMenus: e.target.checked ? editForm.allowedMenus : [] })} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-400" />
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary-500" /> Restrict sidebar menu access</span>
            </label>
            {editForm.restrictMenus && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {adminMenuKeys.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer text-sm text-ink-600 dark:text-ink-300">
                    <input type="checkbox" checked={editForm.allowedMenus.includes(m.key)} onChange={(e) => setEditForm({ ...editForm, allowedMenus: e.target.checked ? [...editForm.allowedMenus, m.key] : editForm.allowedMenus.filter((k) => k !== m.key) })} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-400" />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-400 mt-2">If unchecked, this admin can see all sidebar menus.</p>
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
