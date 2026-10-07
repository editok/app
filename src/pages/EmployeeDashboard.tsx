import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { StatCard, Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Progress from '../components/ui/Progress';
import Button from '../components/ui/Button';
import { BarChart } from '../components/ui/Charts';
import { AbstractBackground } from '../components/ui/AbstractBackground';
import { Briefcase, CheckCircle2, Clock, TrendingUp, Trophy, ArrowRight, FileText, Sparkles, Zap, Send, Wallet, Receipt, MessageSquarePlus } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import { getDeadlineInfo } from '../utils/projectUtils';
import type { Task, Project, Employee, Payment, TaskUpdate } from '../data/db';
import DailyUpdateModal from '../components/ui/DailyUpdateModal';

interface TaskWithProject extends Task {
  project?: Project;
}

interface DashboardUpdate extends TaskUpdate {
  taskName: string;
}

export default function EmployeeDashboard({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaderboard, setLeaderboard] = useState<Employee[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [dailyUpdates, setDailyUpdates] = useState<DashboardUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateModalTask, setUpdateModalTask] = useState<TaskWithProject | null>(null);

  useEffect(() => {
    if (!user?.email || !user?.id) return;
    let active = true;
    (async () => {
      try {
        const profile = await db.fetchProfile(user.id);
        if (!active || !profile) return;
        const [allTasks, allProjects] = await Promise.all([
          db.fetchTasksByEmployee(profile.id),
          db.fetchProjects(),
        ]);
        if (!active) return;
        const activeTasks = allTasks.filter((t) => t.status !== 'approved');
        const allUpdates = await db.fetchTaskUpdatesByTaskIds(allTasks.map((t) => t.id));
        const taskNameMap: Record<string, string> = {};
        allTasks.forEach((t) => { taskNameMap[t.id] = t.task_name; });
        const flatUpdates = allUpdates.map((u) => ({ ...u, taskName: taskNameMap[u.task_id] || '' }));
        setTasks(activeTasks);
        setDailyUpdates(flatUpdates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6));
        setEmployee({ id: profile.id, name: profile.full_name || '', email: profile.email || '', phone: null, skills: null, applications: null, experience: null, rating: null, projects: 0, status: 'active', joined: null, created_at: profile.created_at });
        const candidateProjects = allProjects.filter((p) => p.status === 'approved' || p.status === 'assigned' || p.status === 'in-progress');
        const tasksPerProject = await db.fetchTasksByProjectIds(candidateProjects.map((p) => p.id));
        const tasksByProj: Record<string, Task[]> = {};
        tasksPerProject.forEach((t) => { (tasksByProj[t.project_id] ||= []).push(t); });
        const pickable: Project[] = [];
        candidateProjects.forEach((proj) => {
          const projTasks = tasksByProj[proj.id] || [];
          const hasMyTask = projTasks.some((t) => t.assigned_to === profile.id);
          const sorted = [...projTasks].sort((a, b) => a.sequence - b.sequence);
          const hasPickable = sorted.some((t, idx) => {
            if (t.assigned_to || t.status !== 'pending') return false;
            return sorted.slice(0, idx).every((prev) => prev.status === 'approved');
          });
          if (hasPickable || hasMyTask) pickable.push(proj);
        });
        if (active) setAvailableProjects(pickable.slice(0, 4));
      } catch {
        // ignore
      }
      if (active) setLoading(false);
      // Leaderboard is non-critical — fetch in background
      db.fetchEmployees().then((emps) => {
        if (!active) return;
        setLeaderboard(emps.filter((e) => e.projects > 0).sort((a, b) => b.projects - a.projects).slice(0, 5));
      }).catch(() => {});
    })();
    return () => { active = false; };
  }, [user?.email, user?.id]);

  if (loading) return <FullPageSpinner />;

  const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length;
  const submittedCount = tasks.filter((t) => t.status === 'submitted').length;
  const taskStatusData = [
    { label: 'Pending', value: pendingCount, color: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)' },
    { label: 'Working', value: inProgressCount, color: 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)' },
    { label: 'Submitted', value: submittedCount, color: 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)' },
  ].filter((item) => item.value > 0);
  const leaderboardData = leaderboard
    .filter((entry) => entry.projects > 0)
    .sort((a, b) => b.projects - a.projects)
    .slice(0, 5);
  const taskActivity = tasks
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden shimmer-sweep animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-success-500 via-primary-500 to-violet-500" />
        <div className="absolute inset-0 aurora-bg opacity-60" />
        <div className="absolute inset-0 bg-dot-grid opacity-20" />
        <svg className="absolute top-4 right-8 w-24 h-24 opacity-20 animate-float-shape" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" fill="none" /><circle cx="50" cy="50" r="25" stroke="white" strokeWidth="2" fill="none" /></svg>
        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Welcome back, Editor</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">You have {tasks.length} active tasks</h2>
            <p className="text-sm text-white/80 max-w-lg">{inProgressCount} working, {pendingCount} pending, {submittedCount} awaiting approval.{employee?.rating ? ` Your current rating is ${employee.rating.toFixed(1)}.` : ''}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => onNavigate('my-works')} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md text-white text-sm font-semibold border border-white/30 hover:bg-white/30 transition-all hover:scale-105 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> My Works
              </button>
              <button onClick={() => onNavigate('available-works')} className="px-4 py-2 rounded-xl bg-white text-primary-600 text-sm font-semibold hover:scale-105 transition-all flex items-center gap-2 shadow-lg">
                <Zap className="w-4 h-4" /> Available Works
              </button>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Completed', value: employee?.projects || 0, icon: <CheckCircle2 className="w-4 h-4" /> },
              { label: 'Pending', value: tasks.length, icon: <Clock className="w-4 h-4" /> },
              { label: 'Rating', value: employee?.rating ? employee.rating.toFixed(1) : '—', icon: <TrendingUp className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 min-w-[64px] sm:min-w-[80px]">
                <div className="text-white/70">{stat.icon}</div>
                <span className="text-xl font-bold text-white">{stat.value}</span>
                <span className="text-[10px] text-white/60 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger">
        <StatCard label="Active" value={tasks.length} icon={<Briefcase className="w-5 h-5" />} color="primary" />
        <StatCard label="Completed" value={employee?.projects || 0} icon={<CheckCircle2 className="w-5 h-5" />} color="success" />
        <StatCard label="Pending" value={pendingCount} icon={<Clock className="w-5 h-5" />} color="warning" />
        <StatCard label="Working" value={inProgressCount} icon={<FileText className="w-5 h-5" />} color="purple" />
        <StatCard label="Submitted" value={submittedCount} icon={<Send className="w-5 h-5" />} color="primary" />
        <StatCard label="Rating" value={employee?.rating ? employee.rating.toFixed(1) : '—'} icon={<TrendingUp className="w-5 h-5" />} color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
        <Card className="animate-slide-up hover:-translate-y-0.5" padding={false}>
          <div className="p-5 pb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink-900 dark:text-white">Available Works</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('available-works')}>Browse</Button>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {availableProjects.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">No projects available right now</p>
            ) : (
              availableProjects.map((p) => (
                <div key={p.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 min-w-0 truncate">{p.event_name}</p>
                    <Badge status={p.category.includes('Video') ? 'in-progress' : 'assigned'}>{p.category.includes('Video') ? 'Video' : 'Photo'}</Badge>
                  </div>
                  <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">{(() => { const d = getDeadlineInfo(p.deadline || null, p.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; })()}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="animate-slide-up hover:-translate-y-0.5" padding={false}>
          <div className="p-5 pb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink-900 dark:text-white">My Works</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('my-works')}>View All</Button>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-ink-400 dark:text-ink-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No active tasks. Pick a project from Available Works!</p>
                <Button variant="primary" size="sm" className="mt-3" onClick={() => onNavigate('available-works')}>Browse Available Works</Button>
              </div>
            ) : (
              tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 hover:bg-primary-50/30 transition-all cursor-pointer" onClick={() => onNavigate('working-screen', { id: t.project_id, taskId: t.id })}>
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-xs">
                    {t.project?.order_number?.slice(-2) || '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{t.task_name}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">{t.project?.event_name || ''} · {(() => { const d = getDeadlineInfo(t.project?.deadline || null, t.project?.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; })()}</p>
                  </div>
                  <Badge status={t.status === 'in-progress' ? 'in-progress' : t.status === 'submitted' ? 'review' : 'pending'} />
                  {(t.status === 'in-progress' || t.status === 'partial-completed' || t.status === 'fully-completed') && (
                    <Button variant="ghost" size="sm" icon={<MessageSquarePlus className="w-3.5 h-3.5" />} onClick={(e) => { e.stopPropagation(); setUpdateModalTask(t); }}>Update</Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="lg:col-span-3 animate-slide-up hover:-translate-y-0.5" padding={false}>
          <div className="p-5 pb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-success-500" />
              Recent Earnings
            </h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNavigate('earnings')}>View All</Button>
          </div>
          <div className="px-5 pb-5">
            <CompletedEarningsSection employeeId={employee?.id} employeeName={employee?.name} onNavigate={onNavigate} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        <Card className="lg:col-span-2 animate-slide-up hover:-translate-y-0.5 relative overflow-hidden">
          <AbstractBackground variant="subtle" />
          <div className="relative">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              My Performance
            </h3>
            <p className="text-xs text-ink-400 dark:text-ink-500 mb-4">Current task status</p>
            {taskStatusData.length > 0 ? (
              <BarChart data={taskStatusData} height={200} />
            ) : (
              <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-20">No task data yet.</p>
            )}
          </div>
        </Card>

        <Card className="animate-slide-up hover:-translate-y-0.5" padding={false}>
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-warning-500" />
              Leaderboard
            </h3>
          </div>
          <div className="px-3 pb-3">
            {leaderboardData.length > 0 ? leaderboardData.map((entry, index) => (
              <div key={entry.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${index < 3 ? 'bg-warning-50/50' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-warning-500 text-white' : index === 1 ? 'bg-ink-300 text-white' : index === 2 ? 'bg-orange-400 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'}`}>
                  {index + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                  {entry.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{entry.name}</p>
                  <p className="text-xs text-ink-400 dark:text-ink-500">{entry.projects} projects</p>
                </div>
                <span className="text-sm font-bold text-ink-700 dark:text-ink-200">{entry.rating ? entry.rating.toFixed(1) : '—'}</span>
              </div>
            )) : (
              <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-8">No employee project data yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger">
        <Card className="animate-slide-up hover:-translate-y-0.5">
          <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            Recent Work Activity
          </h3>
          <div className="space-y-3">
            {taskActivity.length > 0 ? taskActivity.map((task) => (
              <div key={task.id} className="p-3 rounded-xl bg-ink-50/70 dark:bg-ink-800/50 border border-ink-100 dark:border-ink-800">
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{task.task_name}</p>
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{task.project?.event_name || 'Project'} · {task.status}</p>
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-1.5">{new Date(task.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            )) : (
              <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-8">No work activity yet.</p>
            )}
          </div>
        </Card>

        <Card className="animate-slide-up hover:-translate-y-0.5">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Daily Updates</h3>
          <div className="space-y-3">
            {dailyUpdates.length > 0 ? dailyUpdates.map((update) => (
              <div key={update.id} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-ink-700 dark:text-ink-200 truncate">{update.taskName}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500 whitespace-nowrap">{new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <p className="text-sm text-ink-600 dark:text-ink-300 mt-0.5 whitespace-pre-wrap">{update.update_text}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-8">No daily updates yet.</p>
            )}
          </div>
        </Card>
      </div>
      {updateModalTask && (
        <DailyUpdateModal
          open={!!updateModalTask}
          onClose={() => setUpdateModalTask(null)}
          taskId={updateModalTask.id}
          taskName={updateModalTask.task_name}
          projectId={updateModalTask.project_id}
          employeeEmail={user?.email || null}
          onSubmitted={() => setUpdateModalTask(null)}
        />
      )}
    </div>
  );
}

function CompletedEarningsSection({ employeeId, employeeName, onNavigate }: {
  employeeId?: string;
  employeeName?: string;
  onNavigate: (p: PageKey, params?: Record<string, unknown>) => void;
}) {
  const [records, setRecords] = useState<{ project: Project; payment: Payment }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        if (!employeeId) { if (active) setLoading(false); return; }
        const splits = await db.fetchPaymentSplitsByEmployee(employeeId);
        const paidSplits = splits.filter((s) => s.status === 'paid');
        if (paidSplits.length === 0) { if (active) { setRecords([]); setLoading(false); } return; }
        const recs: { project: Project; payment: Payment }[] = [];
        for (const split of paidSplits) {
          const project = split.project;
          if (project) recs.push({ project, payment: { id: split.payment_id || '', project_id: split.project_id, amount: split.amount, status: 'paid', paid_at: split.paid_at, created_at: split.created_at } as Payment });
        }
        recs.sort((a, b) => {
          const aDate = a.payment.paid_at ? new Date(a.payment.paid_at).getTime() : 0;
          const bDate = b.payment.paid_at ? new Date(b.payment.paid_at).getTime() : 0;
          return bDate - aDate;
        });
        if (active) setRecords(recs.slice(0, 4));
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [employeeId, employeeName]);

  if (loading) return <div className="text-sm text-ink-400 py-4">Loading earnings...</div>;
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-ink-400 dark:text-ink-500">
        <Wallet className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No earnings yet. Completed projects with confirmed payments will appear here.</p>
        <Button variant="primary" size="sm" className="mt-3" onClick={() => onNavigate('available-works')}>Browse Available Works</Button>
      </div>
    );
  }

  const totalPaid = records.filter((r) => r.payment.status === 'paid').reduce((sum, r) => sum + r.payment.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-success-600 dark:text-success-400" />
          <span className="text-sm font-semibold text-success-700 dark:text-success-400">Total Received</span>
        </div>
        <span className="text-lg font-bold text-success-700 dark:text-success-400">₹{totalPaid.toLocaleString()}</span>
      </div>
      {records.map(({ project, payment }) => {
        const isPaid = payment.status === 'paid';
        return (
          <div key={project.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 hover:border-primary-200 hover:bg-primary-50/30 transition-all">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 font-bold text-xs">
                  {(project.order_number || '').slice(-2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{project.event_name}</p>
                  <p className="text-xs text-ink-400 dark:text-ink-500">{project.order_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink-800 dark:text-ink-100">₹{payment.amount.toLocaleString()}</span>
                <Badge status={isPaid ? 'completed' : 'pending'}>{isPaid ? 'Paid' : 'Pending'}</Badge>
              </div>
            </div>
            {isPaid && (
              <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-ink-500 dark:text-ink-400">
                <Receipt className="w-3 h-3 text-success-500" />
                <span>Txn: <span className="font-mono font-semibold">{payment.transaction_id || '—'}</span></span>
                <span className="text-ink-300">·</span>
                <span>{payment.payment_method || '—'}</span>
                {payment.paid_at && (
                  <>
                    <span className="text-ink-300">·</span>
                    <span>{new Date(payment.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
