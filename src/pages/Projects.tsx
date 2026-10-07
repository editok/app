import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import DataTable, { Column } from '../components/ui/DataTable';
import StatusProgress from '../components/ui/StatusProgress';
import { DollarSign, Eye, Lock, CheckCircle2, FolderKanban, MessageSquare } from 'lucide-react';
import Tabs from '../components/ui/Tabs';
import type { PageKey } from '../components/Layout';
import { supabase, useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, Payment, Task } from '../data/db';
import { getDeadlineInfo, computeProgressFromTasks } from '../utils/projectUtils';
import { countUnreadMessages, markChatRead } from '../utils/chatReadState';
import ProjectChat from '../components/ui/ProjectChat';

export default function Projects({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user, role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [payForm, setPayForm] = useState({ transactionId: '', paymentMethod: 'UPI', employeeAmount: '', paymentNotes: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chatProject, setChatProject] = useState<Project | null>(null);
  const [unreadChat, setUnreadChat] = useState<Record<string, number>>({});

  const loadProjects = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const all = await db.fetchProjects();
      const [tasks, payMap] = await Promise.all([
        db.fetchAllTasks(),
        db.fetchPaymentsByProjectIds(all.map((p) => p.id)),
      ]);
      setProjects(all);
      setAllTasks(tasks || []);
      setPayments(payMap);
      const msgMap = await db.fetchProjectMessagesByProjectIds(all.map((p) => p.id));
      const uMap: Record<string, number> = {};
      all.forEach((p) => { uMap[p.id] = countUnreadMessages(msgMap[p.id] || [], user?.id, p.id); });
      setUnreadChat(uMap);
    } catch (err) {
      console.error('Projects load failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    if (!supabase) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedLoad = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => loadProjects(true), 500); };
    const channel = supabase
      .channel('projects-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
  }, []);

  const handleConfirmPayment = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const empAmount = parseFloat(payForm.employeeAmount) || 0;
    const pay = payments[projectId];
    const paymentData = {
      status: 'paid' as const,
      paid_at: new Date().toISOString(),
      transaction_id: payForm.transactionId || null,
      payment_method: payForm.paymentMethod || null,
      payment_notes: payForm.paymentNotes || null,
      employee_amount: empAmount,
    };
    if (pay) {
      await db.updatePayment(pay.id, paymentData);
      setPayments({ ...payments, [projectId]: { ...pay, ...paymentData } });
    } else {
      const newPay = await db.createPayment({ project_id: projectId, amount: project?.amount || 0, ...paymentData });
      if (newPay) setPayments({ ...payments, [projectId]: newPay });
    }
    await db.transitionProjectStatus(projectId, 'completed');
    await db.createNotification({
      type: 'payment',
      title: 'Payment confirmed & project closed',
      description: `Payment of ₹${(project?.amount || 0).toLocaleString()} confirmed${payForm.transactionId ? ` (Txn: ${payForm.transactionId})` : ''}. Project has been closed.`,
      target_role: 'customer',
      target_email: project?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.createNotification({
      type: 'project',
      title: 'Project status changed to completed',
      description: `${project?.event_name} (${project?.order_number}) status changed to completed after payment confirmation.`,
      target_role: 'admin',
      read: false,
      project_id: projectId,
    });
    if (project?.editor_name && empAmount > 0) {
      await db.createNotification({
        type: 'payment',
        title: 'Payment received for completed project',
        description: `Your earning of ₹${empAmount.toLocaleString()} for "${project.event_name}" (${project.order_number}) has been confirmed${payForm.transactionId ? `. Customer txn ref: ${payForm.transactionId}` : ''}.`,
        target_role: 'editor',
        target_email: project?.editor_email || null,
        read: false,
        project_id: projectId,
      });
    }
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: 'completed', progress: 100 } : p));
    setShowPayment(null);
    setPayForm({ transactionId: '', paymentMethod: 'UPI', employeeAmount: '', paymentNotes: '' });
  };

  const handleCloseProject = async (projectId: string) => {
    await db.transitionProjectStatus(projectId, 'completed');
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: 'completed', progress: 100 } : p));
    await db.createNotification({
      type: 'project',
      title: 'Project completed',
      description: `Project has been marked as completed.`,
      target_role: 'customer',
      target_email: projects.find((p) => p.id === projectId)?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.createNotification({
      type: 'project',
      title: 'Project status changed to completed',
      description: `${projects.find((p) => p.id === projectId)?.event_name} (${projects.find((p) => p.id === projectId)?.order_number}) was closed.`,
      target_role: 'admin',
      read: false,
      project_id: projectId,
    });
  };

  const statusOrder = ['created', 'approved', 'assigned', 'completed', 'in-progress', 'finished', 'review', 'correction', 'correction_approved', 'invoiced'];
  const statusLabels: Record<string, string> = {
    all: 'All Active',
    created: 'New Orders',
    approved: 'Approved',
    assigned: 'Assigned',
    completed: 'Completed',
    'in-progress': 'Working',
    finished: 'Finished',
    review: 'Review',
    correction_approved: 'Correction Approved',
    invoiced: 'Invoiced',
    correction: 'Correction',
  };
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const statusCounts: Record<string, number> = { all: activeProjects.length, completed: completedProjects.length };
  statusOrder.forEach((s) => {
    if (s !== 'completed') statusCounts[s] = activeProjects.filter((p) => p.status === s).length;
  });
  const visibleStatuses = ['all', ...statusOrder.filter((s) => statusCounts[s] > 0)];
  const filteredProjects = statusFilter === 'all'
    ? activeProjects
    : statusFilter === 'completed'
      ? completedProjects
      : activeProjects.filter((p) => p.status === statusFilter);
  const taskMap: Record<string, Task[]> = {};
  allTasks.forEach((t) => { (taskMap[t.project_id] ||= []).push(t); });

  const columns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event Name', sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-ink-800 dark:text-ink-100">{r.event_name}</p>
        <p className="text-xs text-ink-400">{r.customer_name}</p>
      </div>
    ) },
    { key: 'category', label: 'Category', sortable: true, hideOnMobile: true },
    { key: 'editor_name', label: 'Editor', hideOnMobile: true, render: (r) => <span className="text-ink-600 dark:text-ink-300">{r.editor_name || 'Unassigned'}</span> },
    { key: 'deadline', label: 'Deadline', sortable: true, hideOnMobile: true, render: (r) => { const d = getDeadlineInfo(r.deadline, r.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; } },
    { key: 'status', label: 'Progress', sortable: true, render: (r) => <StatusProgress status={r.status} tasks={taskMap[r.id] || []} /> },
  ];

  const rowActions = (project: Project) => {
    const pay = payments[project.id];
    const isCompleted = project.status === 'completed';
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => {
          markChatRead(project.id);
          setUnreadChat((prev) => ({ ...prev, [project.id]: 0 }));
          setChatProject(project);
        }}>
          Chat
          {unreadChat[project.id] > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{unreadChat[project.id]}</span>}
        </Button>
        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: project.id })}>View</Button>
        {!isCompleted && computeProgressFromTasks(taskMap[project.id] || [], project.status) === 100 && !pay && (
          <Button variant="success" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => setShowPayment(project.id)}>Pay</Button>
        )}
        {!isCompleted && pay?.status === 'paid' && (
          <Button variant="outline" size="sm" icon={<Lock className="w-3.5 h-3.5" />} onClick={() => handleCloseProject(project.id)}>Close</Button>
        )}
        {isCompleted && <CheckCircle2 className="w-4 h-4 text-success-500" />}
      </div>
    );
  };

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate('admin-dashboard') }, { label: 'Projects' }]} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary-500" /> Projects
          </h2>
          <p className="text-sm text-ink-400 dark:text-ink-500 mt-0.5">{activeProjects.length} active · {completedProjects.length} completed · {statusCounts.created || 0} new order{(statusCounts.created || 0) !== 1 ? 's' : ''} awaiting approval</p>
        </div>

      </div>

      <Tabs
        tabs={visibleStatuses.map((s) => ({ key: s, label: statusLabels[s], count: statusCounts[s] }))}
        active={statusFilter}
        onChange={(k) => setStatusFilter(k)}
      />

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-0">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-4">{statusFilter === 'all' ? 'All Active' : statusLabels[statusFilter]} Projects</h3>
        </div>
        <div className="px-5 pb-5">
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-8">No projects in this status.</p>
          ) : (
            <DataTable
              columns={columns}
              data={filteredProjects}
              actions={rowActions}
              pageSize={10}
              searchPlaceholder="Search projects..."
            />
          )}
        </div>
      </Card>



      <Modal open={!!showPayment} onClose={() => setShowPayment(null)} title="Confirm Payment" size="md">
        {showPayment && (() => {
          const project = projects.find((p) => p.id === showPayment);
          const pay = payments[showPayment];
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                <p className="font-semibold text-ink-800 dark:text-ink-100">{project?.event_name}</p>
                <p className="text-xs text-ink-400 mt-1">{project?.order_number} · {project?.category}</p>
              </div>
              <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-success-700 dark:text-success-400">Customer Amount</span>
                  <span className="text-2xl font-bold text-success-700 dark:text-success-400">₹{(project?.amount || 0).toLocaleString()}</span>
                </div>
                <p className="text-xs text-ink-400 mt-1">Payment status: {pay?.status || 'pending'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Transaction ID / Reference *</label>
                  <input className="input" placeholder="e.g. UPI123456789" value={payForm.transactionId} onChange={(e) => setPayForm({ ...payForm, transactionId: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Method</label>
                  <select className="input" value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Cheque</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Employee Earning Amount (₹)</label>
                <input type="number" className="input" placeholder="e.g. 5000" value={payForm.employeeAmount} onChange={(e) => setPayForm({ ...payForm, employeeAmount: e.target.value })} />
                <p className="text-xs text-ink-400 mt-1">This is the amount the assigned employee will see in their Earnings page.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Notes (optional)</label>
                <textarea className="input" rows={2} placeholder="Any notes about this payment..." value={payForm.paymentNotes} onChange={(e) => setPayForm({ ...payForm, paymentNotes: e.target.value })} />
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300">Confirming payment will close this project, notify the customer, and inform the employee of their earnings.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPayment(null)}>Cancel</Button>
                <Button variant="success" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => handleConfirmPayment(showPayment)} disabled={!payForm.transactionId}>Confirm Payment & Close</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!chatProject} onClose={() => setChatProject(null)} title={chatProject ? `Chat · ${chatProject.order_number}` : 'Chat'} size="md">
        {chatProject && <ProjectChat projectId={chatProject.id} canUseInternal={role === 'admin' || role === 'editor'} />}
      </Modal>
    </div>
  );
}
