import { useState, useEffect } from 'react';
import { Card, StatCard } from '../components/ui/Card';
import { BarChart, LineChart, DonutChart } from '../components/ui/Charts';
import { VerticalTimeline } from '../components/ui/Timeline';
import DataTable, { Column } from '../components/ui/DataTable';
import StatusProgress from '../components/ui/StatusProgress';
import Button from '../components/ui/Button';
import { AbstractBackground } from '../components/ui/AbstractBackground';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import {
  ShoppingBag, FolderKanban, CheckCircle2, Eye, AlertCircle,
  Users, UserCog, IndianRupee, Plus, UserPlus, Briefcase, ArrowRight,
  PackageOpen, ClipboardCheck, Wrench, ChevronDown,
  TrendingUp, Sparkles, Zap, Clock,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import type { PageKey } from '../components/Layout';
import * as db from '../data/db';
import type { Project } from '../data/db';
import { getDeadlineInfo, computeProgressFromTasks, getWorkflowStage } from '../utils/projectUtils';

export default function AdminDashboard({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { pendingCounts, notifications } = useNotifications();
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<db.Employee[]>([]);
  const [allTasks, setAllTasks] = useState<db.Task[]>([]);
  const [allCorrections, setAllCorrections] = useState<db.Correction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, review: 0, correction: 0, reviewApproved: 0, revenue: 0 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.allSettled([db.fetchProjects(), db.fetchEmployees(), db.fetchAllTasks(), db.fetchCorrections()]).then(([projectsResult, employeesResult, tasksResult, correctionsResult]) => {
      if (!active) return;
      setLoading(false);
      if (projectsResult.status === 'fulfilled') {
        const allProjects = projectsResult.value;
        setProjects(allProjects);
        const revenue = allProjects.reduce((sum, p) => sum + (p.amount || 0), 0);
        setStats({
          total: allProjects.length,
          active: allProjects.filter(p => p.status === 'in-progress' || p.status === 'assigned').length,
          completed: allProjects.filter(p => p.status === 'completed').length,
          review: allProjects.filter(p => p.status === 'review').length,
          correction: allProjects.filter(p => p.status === 'correction').length,
          reviewApproved: allProjects.filter(p => p.status === 'correction_approved').length,
          revenue,
        });
      } else {
        console.error('Admin dashboard projects failed to load:', projectsResult.reason);
        setLoadError('Projects could not be loaded. Please refresh and try again.');
      }
      if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value);
      else console.error('Admin dashboard employees failed to load:', employeesResult.reason);
      if (tasksResult.status === 'fulfilled') setAllTasks(tasksResult.value);
      else console.error('Admin dashboard tasks failed to load:', tasksResult.reason);
      if (correctionsResult.status === 'fulfilled') setAllCorrections(correctionsResult.value);
      else console.error('Admin dashboard corrections failed to load:', correctionsResult.reason);
    });
    return () => { active = false; };
  }, []);

  const monthlyData = buildMonthlyData(projects);
  const categoryChartData = buildCategoryData(projects);
  const employeeChartData = employees
    .map((employee) => {
      const activeTasks = allTasks.filter((t) => t.assigned_to === employee.id && (t.status === 'in-progress' || t.status === 'assigned' || t.status === 'pending'));
      return { employee, activeCount: activeTasks.length };
    })
    .filter((entry) => entry.activeCount > 0)
    .sort((a, b) => b.activeCount - a.activeCount)
    .slice(0, 5)
    .map((entry, index) => ({
      label: entry.employee.name,
      value: entry.activeCount,
      color: employeeChartColors[index % employeeChartColors.length],
    }));
  const recentActivity = notifications.slice(0, 5).map((n) => ({
    title: n.title,
    description: n.description || '',
    time: n.time || '',
    status: 'completed' as const,
  }));

  const columns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event Name', sortable: true },
    { key: 'customer_name', label: 'Customer' },
    { key: 'category', label: 'Category' },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (r) => { const d = getDeadlineInfo(r.deadline, r.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; } },
    { key: 'status', label: 'Progress', sortable: true, render: (r) => <StatusProgress status={r.status} tasks={allTasks} /> },
  ];

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <HeroBanner onNavigate={onNavigate} pendingTotal={pendingCounts.total} pendingCounts={pendingCounts} isEmpty={projects.length === 0} />

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{loadError}</span></div>
          <button onClick={() => window.location.reload()} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">Refresh</button>
        </div>
      )}

      <PendingWorkSection onNavigate={onNavigate} projects={projects} corrections={allCorrections} />

      {projects.length === 0 && <WorkspaceStartCard onNavigate={onNavigate} employeeCount={employees.length} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Orders" value={stats.total} icon={<ShoppingBag className="w-5 h-5" />} color="primary" />
        <StatCard label="Active Projects" value={stats.active} icon={<FolderKanban className="w-5 h-5" />} color="warning" />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="w-5 h-5" />} color="success" />
        <StatCard label="In Review" value={stats.review} icon={<Eye className="w-5 h-5" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="lg:col-span-2 animate-slide-up relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                Orders This Month
              </h3>
              <p className="text-xs text-ink-400 mt-0.5 dark:text-ink-500">Monthly order volume over the year</p>
            </div>
          </div>
          <div className="relative">
            {monthlyData.some((month) => month.value > 0) ? (
              <LineChart data={monthlyData.map(({ label, value }) => ({ label, value }))} height={220} />
            ) : (
              <EmptyChartMessage message="No orders recorded yet" />
            )}
          </div>
        </Card>
        <Card className="animate-slide-up relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Projects by Category</h3>
            <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Distribution across categories</p>
            {categoryChartData.length > 0 ? <DonutChart data={categoryChartData} size={140} /> : <EmptyChartMessage message="No project categories yet" />}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="lg:col-span-2 animate-slide-up relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-success-500" />
                Revenue Overview
              </h3>
              <p className="text-xs text-ink-400 mt-0.5 dark:text-ink-500">Monthly revenue trend</p>
            </div>
            <span className="text-2xl font-bold text-ink-900 dark:text-white">₹{(stats.revenue / 1000).toFixed(0)}K</span>
          </div>
          <div className="relative">
            {monthlyData.some((month) => month.revenue > 0) ? (
              <LineChart data={monthlyData.map(({ label, revenue }) => ({ label, value: revenue }))} height={200} color="#22c55e" />
            ) : (
              <EmptyChartMessage message="No revenue recorded yet" />
            )}
          </div>
        </Card>
        <Card className="animate-slide-up relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Employee Workload</h3>
            <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Current tasks assigned to employees</p>
            {employeeChartData.length > 0 ? <BarChart data={employeeChartData} height={200} /> : <EmptyChartMessage message="No employee projects yet" />}
          </div>
        </Card>
      </div>

      <Card className="animate-slide-up relative overflow-hidden">
        <AbstractBackground variant="subtle" />
        <div className="relative">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning-500" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'New Project', icon: <Plus className="w-5 h-5" />, page: 'new-project' as PageKey, color: 'primary' },
              { label: 'Add Customer', icon: <UserPlus className="w-5 h-5" />, page: 'customers' as PageKey, color: 'success' },
              { label: 'Add Employee', icon: <Briefcase className="w-5 h-5" />, page: 'employees' as PageKey, color: 'warning' },
              { label: 'Add Admin', icon: <UserCog className="w-5 h-5" />, page: 'admins' as PageKey, color: 'error' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.page)}
                className="flex items-center gap-3 p-4 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 hover:bg-primary-50/50 transition-all group hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${action.color}-50 text-${action.color}-600 group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                  {action.icon}
                </div>
                <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="animate-slide-up relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-500" />
                Recent Activity
              </h3>
              <Button variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('notifications')}>View all</Button>
            </div>
            {recentActivity.length > 0 ? (
              <VerticalTimeline items={recentActivity} />
            ) : (
              <p className="text-sm text-ink-400 dark:text-ink-500 py-8 text-center">No project activity yet.</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 animate-slide-up" padding={false}>
          <div className="p-5 pb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-ink-900 dark:text-white">Recent Projects</h3>
            <Button variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('projects')}>View all</Button>
          </div>
          <div className="px-5 pb-5">
            {projects.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">No projects yet. Create a new project to get started!</p>
            ) : (
              <DataTable columns={columns} data={projects.slice(0, 5)} pageSize={5} searchable={false} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const employeeChartColors = [
  'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)',
  'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)',
  'linear-gradient(180deg, #fdba74 0%, #f97316 100%)',
  'linear-gradient(180deg, #c084fc 0%, #a855f7 100%)',
  'linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)',
];

const categoryColors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6'];

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center" style={{ height: 200 }}>
      <p className="text-sm text-ink-400 dark:text-ink-500">{message}</p>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildMonthlyData(projects: Project[]): { label: string; value: number; revenue: number }[] {
  const now = new Date();
  const months: { label: string; year: number; month: number; value: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), value: 0, revenue: 0 });
  }
  projects.forEach((project) => {
    const created = new Date(project.created_at);
    const month = months.find((m) => m.year === created.getFullYear() && m.month === created.getMonth());
    if (month) {
      month.value += 1;
      month.revenue += project.amount || 0;
    }
  });
  return months.map(({ label, value, revenue }) => ({ label, value, revenue }));
}

function buildCategoryData(projects: Project[]): { label: string; value: number; color: string }[] {
  const counts = new Map<string, number>();
  projects.forEach((project) => {
    const category = project.category || 'Uncategorized';
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: categoryColors[index % categoryColors.length] }));
}

function HeroBanner({ onNavigate, pendingTotal, pendingCounts, isEmpty }: { onNavigate: (p: PageKey) => void; pendingTotal: number; pendingCounts: { newOrders: number; paymentReminder: number; approvalPending: number; correctionPending: number }; isEmpty: boolean }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="relative rounded-2xl overflow-hidden shimmer-sweep animate-slide-up">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-violet-500 to-pink-500" />
      <div className="absolute inset-0 aurora-bg opacity-60" />
      <div className="absolute inset-0 bg-dot-grid opacity-20" />
      <svg className="absolute top-4 right-8 w-24 h-24 opacity-20 animate-float-shape" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" fill="none" /><circle cx="50" cy="50" r="25" stroke="white" strokeWidth="2" fill="none" /></svg>
      <svg className="absolute bottom-4 right-1/3 w-16 h-16 opacity-15 animate-float-shape" style={{ animationDelay: '2s' }} viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" stroke="white" strokeWidth="2" fill="none" /></svg>
      <svg className="absolute top-1/2 right-20 w-20 h-20 opacity-10 animate-float-shape" style={{ animationDelay: '4s' }} viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="12" stroke="white" strokeWidth="2" fill="none" transform="rotate(15 50 50)" /></svg>

      <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-white/80" />
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{greeting}, Admin</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            {isEmpty ? 'Your workspace is ready to launch' : `You have ${pendingTotal} pending items`}
          </h2>
          <p className="text-sm text-white/80 max-w-lg">
            {isEmpty
              ? 'Create your first project to start tracking orders, assignments, reviews, and revenue in one place.'
              : `${pendingCounts.newOrders} new orders to assign, ${pendingCounts.paymentReminder} payment reminders, ${pendingCounts.approvalPending} approvals awaiting, and ${pendingCounts.correctionPending} corrections pending.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => onNavigate('new-project')} className="px-4 py-2 rounded-xl bg-white text-primary-600 text-sm font-semibold hover:scale-105 transition-all flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
          {[
            { label: 'Orders', value: pendingCounts.newOrders, icon: <ShoppingBag className="w-4 h-4" /> },
            { label: 'Payment', value: pendingCounts.paymentReminder, icon: <IndianRupee className="w-4 h-4" /> },
            { label: 'Corrections', value: pendingCounts.correctionPending, icon: <AlertCircle className="w-4 h-4" /> },
          ].map((stat) => (
            <div key={stat.label} className="flex h-[92px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-white/15 px-3 py-3 text-center backdrop-blur-md border border-white/20">
              <div className="text-white/70">{stat.icon}</div>
              <span className="text-xl font-bold text-white">{stat.value}</span>
              <span className="whitespace-nowrap text-[10px] text-white/60 uppercase tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceStartCard({ onNavigate, employeeCount }: { onNavigate: (p: PageKey) => void; employeeCount: number }) {
  const steps = [
    { number: '01', title: 'Create a project', description: 'Add the customer, service, deadline, and budget.', action: 'New Project', page: 'new-project' as PageKey, icon: <Plus className="w-5 h-5" />, iconClass: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400' },
    { number: '02', title: 'Build your team', description: employeeCount > 0 ? `${employeeCount} team member${employeeCount === 1 ? '' : 's'} already added.` : 'Add editors so work can be assigned quickly.', action: employeeCount > 0 ? 'View Employees' : 'Add Employee', page: 'employees' as PageKey, icon: <UserCog className="w-5 h-5" />, iconClass: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400' },
    { number: '03', title: 'Track every milestone', description: 'Keep files, tasks, payments, and approvals together.', action: 'View workflow', page: 'reports' as PageKey, icon: <TrendingUp className="w-5 h-5" />, iconClass: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400' },
  ];

  return (
    <Card className="relative overflow-hidden border-primary-100 dark:border-primary-500/20 bg-gradient-to-br from-white via-primary-50/40 to-sky-50/70 dark:from-ink-900 dark:via-primary-500/5 dark:to-sky-500/5 animate-slide-up">
      <AbstractBackground variant="subtle" />
      <div className="relative">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">Getting started</span>
            </div>
            <h3 className="text-lg font-bold text-ink-900 dark:text-white">Turn this empty space into your operating hub</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Complete one step today and the rest of your dashboard will fill in automatically.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-white/80 dark:bg-ink-800 px-3 py-1 text-xs font-semibold text-ink-500 dark:text-ink-300 border border-ink-100 dark:border-ink-700">0 projects created</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {steps.map((step) => (
            <button key={step.number} onClick={() => onNavigate(step.page)} className="group text-left rounded-xl border border-ink-100 dark:border-ink-800 bg-white/80 dark:bg-ink-900/70 p-4 transition-all hover:-translate-y-1 hover:border-primary-200 dark:hover:border-primary-500/40 hover:shadow-float">
              <div className="flex items-start justify-between gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${step.iconClass}`}>{step.icon}</div>
                <span className="text-xs font-bold text-ink-300 dark:text-ink-600">{step.number}</span>
              </div>
              <h4 className="mt-4 text-sm font-bold text-ink-800 dark:text-ink-100">{step.title}</h4>
              <p className="mt-1 min-h-10 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{step.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400">{step.action}<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /></span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PendingWorkSection({ onNavigate, projects, corrections }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; projects: Project[]; corrections: db.Correction[] }) {
  const { pendingCounts, submittedTasks, paymentReminderProjects } = useNotifications();
  const [expandedPanel, setExpandedPanel] = useState<'newOrders' | 'paymentReminder' | 'approvalPending' | 'correctionPending' | null>(null);
  const newOrderProjects = projects.filter((project) => project.status === 'created');
  const pendingCorrections = corrections.filter((c) => c.status === 'pending' || c.status === 'in-progress');

  const items = [
    { key: 'newOrders' as const, label: 'New Orders', count: pendingCounts.newOrders, icon: <PackageOpen className="w-5 h-5" />, color: 'primary', page: null as PageKey | null, desc: 'Recently created orders to assign — click to expand' },
    { key: 'paymentReminder' as const, label: 'Payment Reminder', count: pendingCounts.paymentReminder, icon: <IndianRupee className="w-5 h-5" />, color: 'warning', page: null as PageKey | null, desc: '100% complete projects awaiting payment — click to expand' },
    { key: 'approvalPending' as const, label: 'Approval Alerts', count: pendingCounts.approvalPending, icon: <ClipboardCheck className="w-5 h-5" />, color: 'purple', page: null as PageKey | null, desc: 'Tasks submitted for review — click to expand' },
    { key: 'correctionPending' as const, label: 'Corrections Pending', count: pendingCounts.correctionPending, icon: <Wrench className="w-5 h-5" />, color: 'error', page: null as PageKey | null, desc: 'Unresolved customer corrections — click to expand' },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
    primary: { bg: 'bg-primary-50 dark:bg-primary-500/15', text: 'text-primary-600 dark:text-primary-400', border: 'border-primary-100 dark:border-primary-500/30', ring: 'group-hover:shadow-glow' },
    warning: { bg: 'bg-warning-50 dark:bg-warning-500/15', text: 'text-warning-600 dark:text-warning-400', border: 'border-warning-100 dark:border-warning-500/30', ring: '' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-500/30', ring: '' },
    error: { bg: 'bg-error-50 dark:bg-error-500/15', text: 'text-error-600 dark:text-error-400', border: 'border-error-100 dark:border-error-500/30', ring: 'group-hover:shadow-glow-error' },
  };

  const handleClick = (item: typeof items[number]) => {
    setExpandedPanel((current) => current === item.key ? null : item.key);
  };

  return (
    <Card className="animate-slide-up relative overflow-hidden">
      <AbstractBackground variant="subtle" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-error-500" />
              Pending Work
            </h3>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{pendingCounts.total} total pending items need attention</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-100 dark:border-error-500/30">
            <span className="text-2xl font-bold text-error-600 dark:text-error-400">{pendingCounts.total}</span>
            <span className="text-xs text-error-600 dark:text-error-400 font-medium">Total</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          {items.map((item) => {
            const c = colorMap[item.color];
            const isActive = expandedPanel === item.key;
            const activeRing = item.key === 'paymentReminder' ? 'ring-warning-400' : item.key === 'correctionPending' ? 'ring-error-400' : item.key === 'newOrders' ? 'ring-primary-400' : 'ring-purple-400';
            return (
              <button
                key={item.key}
                onClick={() => handleClick(item)}
                className={`group text-left p-4 rounded-xl border-2 ${c.border} ${c.bg} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float ${c.ring} ${isActive ? 'ring-2 ring-offset-1 ' + activeRing + ' shadow-float' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center transition-transform group-hover:scale-125 group-hover:rotate-6`}>
                    {item.icon}
                  </div>
                  {item.count > 0 && (
                    <span className={`flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white rounded-full animate-bounce-in ${
                      item.color === 'primary' ? 'bg-primary-500' : item.color === 'warning' ? 'bg-warning-500' : item.color === 'purple' ? 'bg-purple-500' : 'bg-error-500'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-1">
                  {item.label}
                  {item.key === 'newOrders' && pendingCounts.newOrders > 0 && (
                    <ChevronDown className={`w-3.5 h-3.5 text-primary-500 transition-transform ${expandedPanel === 'newOrders' ? 'rotate-180' : ''}`} />
                  )}
                  {item.key === 'approvalPending' && pendingCounts.approvalPending > 0 && (
                    <ChevronDown className={`w-3.5 h-3.5 text-purple-500 transition-transform ${expandedPanel === 'approvalPending' ? 'rotate-180' : ''}`} />
                  )}
                  {item.key === 'paymentReminder' && pendingCounts.paymentReminder > 0 && (
                    <ChevronDown className={`w-3.5 h-3.5 text-warning-500 transition-transform ${expandedPanel === 'paymentReminder' ? 'rotate-180' : ''}`} />
                  )}
                  {item.key === 'correctionPending' && pendingCounts.correctionPending > 0 && (
                    <ChevronDown className={`w-3.5 h-3.5 text-error-500 transition-transform ${expandedPanel === 'correctionPending' ? 'rotate-180' : ''}`} />
                  )}
                </p>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {expandedPanel === 'newOrders' && (
          <div className="mt-4 rounded-xl border-2 border-primary-100 dark:border-primary-500/30 bg-primary-50/50 dark:bg-primary-500/10 p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 flex items-center gap-2">
                <PackageOpen className="w-4 h-4" />
                New Orders ({newOrderProjects.length})
              </p>
              <button onClick={() => setExpandedPanel(null)} className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">Collapse</button>
            </div>
            {newOrderProjects.length === 0 ? (
              <p className="text-xs text-ink-400 dark:text-ink-500 py-3 text-center">No new orders waiting for assignment right now.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {newOrderProjects.map((project) => (
                  <div key={project.id} className="flex flex-col gap-3 rounded-lg bg-white p-3 dark:bg-ink-800/60 border border-primary-100 dark:border-primary-500/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{project.event_name}</p>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{project.order_number} · {project.customer_name || project.customer_email || 'Unknown customer'}</p>
                      {project.category && <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{project.category}</p>}
                    </div>
                    <div className="flex w-full flex-shrink-0 justify-end sm:w-auto">
                      <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: project.id })}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedPanel === 'paymentReminder' && (
          <div className="mt-4 rounded-xl border-2 border-warning-100 dark:border-warning-500/30 bg-warning-50/50 dark:bg-warning-500/10 p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-warning-700 dark:text-warning-300 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Projects Awaiting Payment ({paymentReminderProjects.length})
              </p>
              <button onClick={() => setExpandedPanel(null)} className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">Collapse</button>
            </div>
            {paymentReminderProjects.length === 0 ? (
              <p className="text-xs text-ink-400 dark:text-ink-500 py-3 text-center">No projects waiting for payment right now.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {paymentReminderProjects.map((project) => (
                  <div key={project.id} className="flex flex-col gap-3 rounded-lg bg-white p-3 dark:bg-ink-800/60 border border-warning-100 dark:border-warning-500/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{project.event_name}</p>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                        {project.order_number} · {project.customer_name || project.customer_email || 'Unknown customer'}
                        {project.editor_name && ` · Editor: ${project.editor_name}`}
                      </p>
                      {(project.amount || 0) > 0 && (
                        <p className="text-xs font-semibold text-warning-600 dark:text-warning-400 mt-0.5">Amount: ₹{(project.amount || 0).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex w-full flex-shrink-0 justify-end gap-2 sm:w-auto">
                      <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: project.id })}>
                        View
                      </Button>
                      <Button variant="success" size="sm" icon={<IndianRupee className="w-3.5 h-3.5" />} onClick={() => onNavigate('order-tracking', { id: project.id })}>
                        Payment
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedPanel === 'approvalPending' && (
          <div className="mt-4 rounded-xl border-2 border-purple-100 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/10 p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Tasks Submitted for Review ({submittedTasks.length})
              </p>
              <button onClick={() => setExpandedPanel(null)} className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">Collapse</button>
            </div>
            {submittedTasks.length === 0 ? (
              <p className="text-xs text-ink-400 dark:text-ink-500 py-3 text-center">No tasks submitted for review right now.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {submittedTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-ink-800/60 border border-purple-100 dark:border-purple-500/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{task.task_name}</p>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                        {task.assigned_to_name ? `Editor: ${task.assigned_to_name}` : 'Unassigned'}
                        {task.submitted_at && ` · Submitted ${new Date(task.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: task.project_id })}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedPanel === 'correctionPending' && (
          <div className="mt-4 rounded-xl border-2 border-error-100 dark:border-error-500/30 bg-error-50/50 dark:bg-error-500/10 p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-error-700 dark:text-error-300 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Unresolved Corrections ({pendingCorrections.length})
              </p>
              <button onClick={() => setExpandedPanel(null)} className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">Collapse</button>
            </div>
            {pendingCorrections.length === 0 ? (
              <p className="text-xs text-ink-400 dark:text-ink-500 py-3 text-center">No unresolved corrections right now.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {pendingCorrections.map((correction) => (
                  <div key={correction.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-ink-800/60 border border-error-100 dark:border-error-500/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">
                        {correction.event_name || correction.order_id || 'Correction'}
                        {correction.number && <span className="text-xs text-ink-400 ml-1.5">#{correction.number}</span>}
                      </p>
                      <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                        {correction.customer}
                        {correction.editor && ` · Editor: ${correction.editor}`}
                        {correction.due_date && ` · Due ${new Date(correction.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${correction.priority === 'high' ? 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300' : correction.priority === 'medium' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400'}`}>
                        {correction.priority}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('corrections', { id: correction.project_id })}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
