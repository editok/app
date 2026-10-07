import { useState, useEffect, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import DataTable, { Column } from '../components/ui/DataTable';
import { Mail, Phone, Star, Award, TrendingUp, Briefcase, Calendar, CheckCircle2, Clock, DollarSign, Wallet, AlertCircle, ListChecks, MessageSquare } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import type { Employee, Task, Project, PaymentSplit, ProjectRating, PayoutRequest } from '../data/db';

export default function EmployeeDetail({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params: Record<string, unknown> }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<(Task & { project?: Project })[]>([]);
  const [splits, setSplits] = useState<(PaymentSplit & { project?: Project })[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const employees = await db.fetchEmployees();
        const emp = employees.find((e) => e.id === id);
        if (!active || !emp) { setLoading(false); return; }
        setEmployee(emp);
        const [empTasks, empSplits, empPayouts, empRatings] = await Promise.all([
          db.fetchTasksByEmployee(emp.id),
          db.fetchPaymentSplitsByEmployee(emp.id),
          db.fetchPayoutRequestsByEmployee(emp.id),
          db.fetchRatingsByEmployee(emp.id),
        ]);
        if (!active) return;
        setTasks(empTasks);
        setSplits(empSplits);
        setPayoutRequests(empPayouts);
        setRatings(empRatings);
      } catch (err) {
        console.error('EmployeeDetail load error:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params.id]);

  const stats = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.status === 'approved' || t.status === 'completed');
    const pendingTasks = tasks.filter((t) => t.status !== 'approved' && t.status !== 'completed');
    const totalTasks = tasks.length;
    const lastTaskDate = completedTasks.length > 0 ? completedTasks.map((t) => t.approved_at || t.updated_at).filter(Boolean).sort().reverse()[0] : null;
    const paidSplits = splits.filter((s) => s.status === 'paid');
    const pendingSplits = splits.filter((s) => s.status !== 'paid');
    const totalEarned = paidSplits.reduce((sum, s) => sum + s.amount, 0);
    const pendingEarnings = pendingSplits.reduce((sum, s) => sum + s.amount, 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
    const avgTaskValue = totalTasks > 0 ? splits.reduce((sum, s) => sum + s.amount, 0) / totalTasks : 0;
    return { completedTasks: completedTasks.length, pendingTasks: pendingTasks.length, totalTasks, lastTaskDate, totalEarned, pendingEarnings, avgRating, avgTaskValue };
  }, [tasks, splits, ratings]);

  const pendingTaskColumns: Column<Task & { project?: Project }>[] = [
    { key: 'task_name', label: 'Task', sortable: true, render: (r) => (
      <div>
        <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">{r.task_name}</p>
        <p className="text-xs text-ink-400">{r.project?.order_number || ''}</p>
      </div>
    ) },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge status={r.status === 'approved' ? 'completed' : 'pending'}>{r.status}</Badge> },
    { key: 'priority', label: 'Priority', sortable: true },
  ];

  const earningColumns: Column<PaymentSplit & { project?: Project }>[] = [
    { key: 'task_name', label: 'Task', sortable: true, render: (r) => (
      <div>
        <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm">{r.task_name || '—'}</p>
        <p className="text-xs text-ink-400">{r.project?.event_name || ''}</p>
      </div>
    ) },
    { key: 'amount', label: 'Amount', sortable: true, render: (r) => <span className="font-bold text-success-600 dark:text-success-400">₹{r.amount.toLocaleString()}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge status={r.status === 'paid' ? 'completed' : 'pending'}>{r.status === 'paid' ? 'Paid' : 'Pending'}</Badge> },
    { key: 'paid_at', label: 'Date', sortable: true, render: (r) => r.paid_at ? <span className="text-ink-600 dark:text-ink-300">{new Date(r.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : <span className="text-ink-400">—</span> },
  ];

  if (loading) return <FullPageSpinner />;
  if (!employee) return <div className="text-center py-20 text-ink-400">Employee not found</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Employees', onClick: () => onNavigate('employees') }, { label: employee.name }]} />

      {/* Header */}
      <Card className="animate-slide-up relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-teal-500/10" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="w-full min-w-0 text-center sm:flex-1 sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{employee.name}</h2>
              <Badge status={employee.status === 'available' ? 'completed' : employee.status === 'working' ? 'pending' : 'rejected'}>{employee.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-500 dark:text-ink-400 sm:justify-start">
              {employee.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {employee.email}</span>}
              {employee.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {employee.phone}</span>}
              {employee.experience && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {employee.experience}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(employee.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 sm:justify-start">
              <Star className="w-4 h-4 text-warning-400 fill-warning-400" />
              <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{(employee.rating ?? 0).toFixed(1)}</span>
              <span className="text-xs text-ink-400">· {employee.projects} projects</span>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto" variant="primary" size="sm" icon={<Briefcase className="w-3.5 h-3.5" />} onClick={() => onNavigate('available-works')}>Assign Work</Button>
          </div>
        </div>
        {/* Skills */}
        <div className="relative mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
          <div className="flex flex-wrap gap-2">
            {employee.skills.map((s) => <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 font-medium">{s}</span>)}
            {employee.applications.map((a) => <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-success-50 dark:bg-success-500/15 text-success-600 dark:text-success-400 font-medium">{a}</span>)}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Tasks" value={stats.totalTasks} icon={<ListChecks className="w-5 h-5" />} color="primary" />
        <StatCard label="Completed" value={stats.completedTasks} icon={<CheckCircle2 className="w-5 h-5" />} color="success" />
        <StatCard label="Pending" value={stats.pendingTasks} icon={<Clock className="w-5 h-5" />} color="warning" />
        <StatCard label="Avg Task Value" value={`₹${Math.round(stats.avgTaskValue).toLocaleString()}`} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <StatCard label="Total Earned (Paid)" value={`₹${stats.totalEarned.toLocaleString()}`} icon={<Wallet className="w-5 h-5" />} color="success" />
        <StatCard label="Pending Earnings" value={`₹${stats.pendingEarnings.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="warning" />
        <StatCard label="Avg Rating" value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'} icon={<Star className="w-5 h-5" />} color="primary" />
      </div>

      {/* Last task + payout requests */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        <Card className="animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-ink-400">Last Task Completed</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{stats.lastTaskDate ? new Date(stats.lastTaskDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No tasks completed yet'}</p>
            </div>
          </div>
        </Card>
        <Card className="animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-ink-400">Payout Requests</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{payoutRequests.length} total · {payoutRequests.filter((r) => r.status === 'requested').length} pending</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending tasks */}
      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-warning-500" />
          <h3 className="font-semibold text-ink-900 dark:text-white">Pending Tasks ({stats.pendingTasks})</h3>
        </div>
        <div className="px-5 pb-5">
          {stats.pendingTasks === 0 ? (
            <div className="text-center py-8 text-ink-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending tasks. All caught up!</p>
            </div>
          ) : (
            <DataTable columns={pendingTaskColumns} data={tasks.filter((t) => t.status !== 'approved' && t.status !== 'completed')} pageSize={6} />
          )}
        </div>
      </Card>

      {/* Earnings history */}
      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-success-500" />
          <h3 className="font-semibold text-ink-900 dark:text-white">Earnings History ({splits.length})</h3>
        </div>
        <div className="px-5 pb-5">
          {splits.length === 0 ? (
            <div className="text-center py-8 text-ink-400">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No earnings recorded yet.</p>
            </div>
          ) : (
            <DataTable columns={earningColumns} data={splits} pageSize={8} />
          )}
        </div>
      </Card>

      {/* Payout requests */}
      {payoutRequests.length > 0 && (
        <Card padding={false} className="animate-slide-up">
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-ink-900 dark:text-white">Payout Requests ({payoutRequests.length})</h3>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {payoutRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-800 dark:text-ink-100 text-sm">₹{req.total_amount.toLocaleString()}</span>
                    <Badge status={req.status === 'requested' ? 'pending' : req.status === 'processed' ? 'completed' : 'rejected'}>
                      {req.status === 'requested' ? 'Requested' : req.status === 'processed' ? 'Processed' : 'Rejected'}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    {req.split_ids.length} task{req.split_ids.length !== 1 ? 's' : ''} · {new Date(req.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {req.processed_at && ` · Processed ${new Date(req.processed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                  {req.notes && <p className="text-xs text-ink-500 mt-1">{req.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ratings / Feedback */}
      {ratings.length > 0 && (
        <Card padding={false} className="animate-slide-up">
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <Star className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-ink-900 dark:text-white">Ratings & Feedback ({ratings.length})</h3>
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
                    {r.target_task_name && <span className="text-xs text-ink-400">{r.target_task_name}</span>}
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
