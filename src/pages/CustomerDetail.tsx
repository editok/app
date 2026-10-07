import { useState, useEffect, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import DataTable, { Column } from '../components/ui/DataTable';
import StatusProgress from '../components/ui/StatusProgress';
import { Building2, Mail, Phone, MapPin, FileText, ShoppingBag, Clock, DollarSign, Star, Calendar, TrendingUp, AlertCircle, CheckCircle2, FolderKanban } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import type { Customer, Project, Task, Invoice, ProjectPayment, ProjectRating } from '../data/db';
import { sumVerifiedPaid, calcBalance, getPaymentStatus, paymentStatusBadgeColor } from '../utils/billing';
import { getDeadlineInfo } from '../utils/projectUtils';

export default function CustomerDetail({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>({});
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [projectPayments, setProjectPayments] = useState<Record<string, ProjectPayment[]>>({});
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const customers = await db.fetchCustomers();
        const cust = customers.find((c) => c.id === id);
        if (!active || !cust) { setLoading(false); return; }
        setCustomer(cust);
        const allProjects = await db.fetchProjects();
        const custProjects = cust.email ? allProjects.filter((p) => p.customer_email === cust.email) : [];
        setProjects(custProjects);
        if (custProjects.length > 0) {
          const allTasks = await db.fetchTasksByProjectIds(custProjects.map((p) => p.id));
          const tMap: Record<string, Task[]> = {};
          allTasks.forEach((t) => { (tMap[t.project_id] ||= []).push(t); });
          setTaskMap(tMap);
          const invResults = await Promise.all(custProjects.map((p) => db.fetchInvoice(p.id).then((inv) => ({ pid: p.id, inv })).catch(() => ({ pid: p.id, inv: null }))));
          const invMap: Record<string, Invoice> = {};
          invResults.forEach((r) => { if (r.inv) invMap[r.pid] = r.inv; });
          setInvoices(invMap);
          const payResults = await Promise.all(custProjects.map((p) => db.fetchProjectPayments(p.id).then((pp) => ({ pid: p.id, pp })).catch(() => ({ pid: p.id, pp: [] }))));
          const payMap: Record<string, ProjectPayment[]> = {};
          payResults.forEach((r) => { if (r.pp.length > 0) payMap[r.pid] = r.pp; });
          setProjectPayments(payMap);
        }
        if (cust.email) {
          const allRatings = await db.fetchAllRatings();
          setRatings(allRatings.filter((r) => r.customer_email === cust.email));
        }
      } catch (err) {
        console.error('CustomerDetail load error:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params.id]);

  const getInvoiceAmount = (p: Project) => invoices[p.id]?.current_amount ?? p.amount ?? 0;
  const getVerifiedPaid = (p: Project) => sumVerifiedPaid(projectPayments[p.id] || []);
  const getBalance = (p: Project) => calcBalance(getInvoiceAmount(p), getVerifiedPaid(p));

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;
    const pendingProjects = projects.filter((p) => p.status !== 'completed' && p.status !== 'rejected').length;
    const totalOutstanding = projects.filter((p) => invoices[p.id]).reduce((sum, p) => sum + Math.max(0, getBalance(p)), 0);
    const totalPaid = projects.reduce((sum, p) => sum + getVerifiedPaid(p), 0);
    const totalInvoiced = projects.reduce((sum, p) => sum + getInvoiceAmount(p), 0);
    const lastProjectDate = projects.length > 0 ? projects.map((p) => p.created_at).sort().reverse()[0] : null;
    const avgProjectValue = totalProjects > 0 ? totalInvoiced / totalProjects : 0;
    const customerRatings = ratings.filter((r) => r.target_type === 'customer' || r.target_type === 'system');
    const avgRating = customerRatings.length > 0 ? customerRatings.reduce((s, r) => s + r.rating, 0) / customerRatings.length : 0;
    return { totalProjects, completedProjects, pendingProjects, totalOutstanding, totalPaid, totalInvoiced, lastProjectDate, avgProjectValue, avgRating };
  }, [projects, invoices, projectPayments, ratings]);

  const unpaidProjects = useMemo(() => projects.filter((p) => invoices[p.id] && getBalance(p) > 0), [projects, invoices, projectPayments]);

  const projectColumns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event', sortable: true },
    { key: 'category', label: 'Category' },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (r) => { const d = getDeadlineInfo(r.deadline, r.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; } },
    { key: 'status', label: 'Progress', sortable: true, render: (r) => <StatusProgress status={r.status} tasks={taskMap[r.id] || []} /> },
    { key: 'billing', label: 'Payment', sortable: true, render: (r) => {
      if (!invoices[r.id]) return <span className="text-xs text-ink-400">No invoice</span>;
      const status = getPaymentStatus(getInvoiceAmount(r), getVerifiedPaid(r));
      return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>;
    } },
  ];

  const projectActions = (row: Project) => (
    <Button variant="ghost" size="sm" onClick={() => onNavigate('project-details', { id: row.id })}>View</Button>
  );

  if (loading) return <FullPageSpinner />;
  if (!customer) return <div className="text-center py-20 text-ink-400">Customer not found</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Customers', onClick: () => onNavigate('customers') }, { label: customer.company }]} />

      {/* Header */}
      <Card className="animate-slide-up relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-blue-500/10" />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white shadow-lg">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{customer.company}</h2>
              <Badge status={customer.status === 'active' ? 'completed' : 'pending'}>{customer.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-ink-500 dark:text-ink-400 flex-wrap">
              {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>}
              {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>}
              {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {customer.address}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
            {customer.gst && <p className="text-xs text-ink-400 mt-1">GST: {customer.gst}</p>}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Projects" value={stats.totalProjects} icon={<ShoppingBag className="w-5 h-5" />} color="primary" />
        <StatCard label="Completed" value={stats.completedProjects} icon={<CheckCircle2 className="w-5 h-5" />} color="success" />
        <StatCard label="Pending" value={stats.pendingProjects} icon={<Clock className="w-5 h-5" />} color="warning" />
        <StatCard label="Avg Project Value" value={`₹${Math.round(stats.avgProjectValue).toLocaleString()}`} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <StatCard label="Total Invoiced" value={`₹${stats.totalInvoiced.toLocaleString()}`} icon={<FileText className="w-5 h-5" />} color="primary" />
        <StatCard label="Total Paid" value={`₹${stats.totalPaid.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="success" />
        <StatCard label="Outstanding" value={`₹${stats.totalOutstanding.toLocaleString()}`} icon={<AlertCircle className="w-5 h-5" />} color={stats.totalOutstanding > 0 ? 'error' : 'success'} />
      </div>

      {/* Last project date + rating */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        <Card className="animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-ink-400">Last Project Given</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{stats.lastProjectDate ? new Date(stats.lastProjectDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No projects yet'}</p>
            </div>
          </div>
        </Card>
        <Card className="animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-500">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-ink-400">Average Customer Rating</p>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-ink-800 dark:text-ink-100">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}</span>
                {stats.avgRating > 0 && <Star className="w-3.5 h-3.5 text-warning-400 fill-warning-400" />}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending payments */}
      {unpaidProjects.length > 0 && (
        <Card padding={false} className="animate-slide-up border-warning-200 dark:border-warning-700/50">
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white">Pending Payments</h3>
              <p className="text-xs text-ink-400 mt-0.5">{unpaidProjects.length} project{unpaidProjects.length > 1 ? 's' : ''} with outstanding balance</p>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {unpaidProjects.map((p) => {
              const inv = invoices[p.id];
              const balance = getBalance(p);
              const paid = getVerifiedPaid(p);
              const invAmt = getInvoiceAmount(p);
              const status = getPaymentStatus(invAmt, paid);
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm truncate">{p.event_name}</p>
                      <span className="text-xs text-ink-400">{p.order_number}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>
                      {inv?.invoice_type === 'estimate' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400">Estimate</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs">
                      <span className="text-ink-400">Total: <span className="font-semibold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</span></span>
                      {paid > 0 && <span className="text-success-600 dark:text-success-400">Paid: ₹{paid.toLocaleString()}</span>}
                      <span className="text-error-600 dark:text-error-400 font-semibold">Balance: ₹{balance.toLocaleString()}</span>
                    </div>
                  </div>
                  <Button variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: p.id })}>View</Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* All projects */}
      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <FolderKanban className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-ink-900 dark:text-white">All Projects ({projects.length})</h3>
        </div>
        <div className="px-5 pb-5">
          {projects.length === 0 ? (
            <div className="text-center py-10 text-ink-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects yet for this customer.</p>
            </div>
          ) : (
            <DataTable columns={projectColumns} data={projects} actions={projectActions} pageSize={8} />
          )}
        </div>
      </Card>

      {/* Feedback / Ratings */}
      {ratings.length > 0 && (
        <Card padding={false} className="animate-slide-up">
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <Star className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-ink-900 dark:text-white">Feedback Received ({ratings.length})</h3>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {ratings.slice(0, 10).map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'text-warning-400 fill-warning-400' : 'text-ink-200 dark:text-ink-700'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-ink-400 capitalize">{r.target_type}</span>
                  </div>
                  <span className="text-xs text-ink-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {r.comment && <p className="text-sm text-ink-600 dark:text-ink-300 mt-2">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
