import { useState, useEffect } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Modal from '../components/ui/Modal';
import { HorizontalTimeline } from '../components/ui/Timeline';
import Progress from '../components/ui/Progress';
import { FileText, DollarSign, Eye, Upload, Lock, CheckCircle2, Package } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, Task, Invoice, ProjectPayment, PaymentSplit } from '../data/db';
import { computeProgressFromTasks, getStagesFromProgress } from '../utils/projectUtils';
import { sumVerifiedPaid, calcBalance, getPaymentStatus } from '../utils/billing';

export default function OrderTracking({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [projectPayments, setProjectPayments] = useState<Record<string, ProjectPayment[]>>({});
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [payForm, setPayForm] = useState({ transactionId: '', paymentMethod: 'UPI', paymentType: 'Full', paymentAmount: '', paymentNotes: '' });
  const [splits, setSplits] = useState<Record<string, PaymentSplit[]>>({});

  const loadProjects = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [all, allInvoices, allProjectPayments, allSplits, tasks] = await Promise.all([
        db.fetchProjects(),
        db.fetchAllInvoices(),
        db.fetchAllProjectPayments(),
        db.fetchAllPaymentSplits(),
        db.fetchAllTasks(),
      ]);
      if (all.length === 0) { setProjects([]); return; }
      const invMap: Record<string, Invoice> = {};
      for (const inv of allInvoices) invMap[inv.project_id] = inv;
      const payMap: Record<string, ProjectPayment[]> = {};
      for (const pp of allProjectPayments) { (payMap[pp.project_id] ||= []).push(pp); }
      const splitMap: Record<string, PaymentSplit[]> = {};
      for (const sp of allSplits) { (splitMap[sp.project_id] ||= []).push(sp); }
      setProjects(all);
      setInvoices(invMap);
      setProjectPayments(payMap);
      setSplits(splitMap);
      setAllTasks(tasks || []);
    } catch (err) {
      console.error('OrderTracking load failed:', err);
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
      .channel('order-tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_payments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
  }, []);

  const getInvoiceAmount = (projectId: string) => invoices[projectId]?.current_amount ?? projects.find(p => p.id === projectId)?.amount ?? 0;
  const getTotalPaid = (projectId: string) => sumVerifiedPaid(projectPayments[projectId] || []);
  const getBalance = (projectId: string) => calcBalance(getInvoiceAmount(projectId), getTotalPaid(projectId));
  const getPaymentStatusFor = (projectId: string) => getPaymentStatus(getInvoiceAmount(projectId), getTotalPaid(projectId));

  const handleConfirmPayment = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const inv = invoices[projectId];
    const amt = getInvoiceAmount(projectId);
    const paymentAmount = parseFloat(payForm.paymentAmount) || getBalance(projectId);

    try {
    await db.createProjectPayment({
      project_id: projectId,
      invoice_id: inv?.id,
      amount: paymentAmount,
      payment_date: new Date().toISOString(),
      payment_method: payForm.paymentMethod || 'UPI',
      payment_type: payForm.paymentType || 'Full',
      transaction_reference: payForm.transactionId || undefined,
      notes: payForm.paymentNotes || undefined,
      created_by: 'admin',
      status: 'verified',
      verified_by: 'admin',
      verified_at: new Date().toISOString(),
    });

    await db.transitionProjectStatus(projectId, 'completed');

    if (project?.customer_email) {
      await db.ensureRatingRequestForProject(projectId, project.customer_email, project.customer_id || null);
    }
    await db.createNotification({
      type: 'payment',
      title: 'Payment confirmed & project closed',
      description: `Payment of ₹${amt.toLocaleString()} confirmed${payForm.transactionId ? ` (Txn: ${payForm.transactionId})` : ''}. Project has been closed. We'd love your feedback — tap "Give Feedback" to share your experience.`,
      target_role: 'customer',
      target_email: project?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.sendStatusEmail({
      templateName: 'payment_confirmation',
      recipient: project?.customer_email,
      recipientName: project?.customer_name,
      variables: {
        customer_name: project?.customer_name || 'there',
        project_name: project?.event_name || '',
        order_number: project?.order_number || '',
        amount: String(amt),
      },
    });
    await db.createNotification({
      type: 'rating',
      title: "Your project is complete — we'd love your feedback",
      description: `Your project "${project?.event_name}" (${project?.order_number}) has been completed. Please take a moment to rate your experience.`,
      target_role: 'customer',
      target_email: project?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.sendStatusEmail({
      templateName: 'rating_request',
      recipient: project?.customer_email,
      recipientName: project?.customer_name,
      variables: {
        customer_name: project?.customer_name || 'there',
        project_name: project?.event_name || '',
        rating_link: `${window.location.origin}/#review/${projectId}`,
      },
    });
    await db.createNotification({
      type: 'project',
      title: 'Project status changed to completed',
      description: `${project?.event_name} (${project?.order_number}) status changed to completed after payment confirmation.`,
      target_role: 'admin',
      read: false,
      project_id: projectId,
    });
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: 'completed', progress: 100 } : p));
    setShowPayment(null);
    setPayForm({ transactionId: '', paymentMethod: 'UPI', paymentType: 'Full', paymentAmount: '', paymentNotes: '' });
    loadProjects();
    } catch (err) {
      console.error('Confirm payment failed:', err);
      alert('Failed to confirm payment. Please try again.');
    }
  };

  const handleCloseProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const downloadLinks = project?.download_links || '';
    try {
    await db.transitionProjectStatus(projectId, 'completed');
    if (project?.customer_email) {
      await db.ensureRatingRequestForProject(projectId, project.customer_email, project.customer_id || null);
    }
    const fileLinksText = downloadLinks.trim()
      ? ` Your original files are ready for download: ${downloadLinks.trim()}`
      : '';
    await db.createNotification({
      type: 'project',
      title: 'Project completed — original files ready',
      description: `Project has been marked as completed.${fileLinksText} We'd love your feedback — tap "Give Feedback" to share your experience.`,
      target_role: 'customer',
      target_email: project?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.createNotification({
      type: 'rating',
      title: "Your project is complete — we'd love your feedback",
      description: `Your project "${project?.event_name}" (${project?.order_number}) has been completed. Please take a moment to rate your experience.`,
      target_role: 'customer',
      target_email: project?.customer_email || null,
      read: false,
      project_id: projectId,
    });
    await db.sendStatusEmail({
      templateName: 'project_approved',
      recipient: project?.customer_email,
      recipientName: project?.customer_name,
      variables: {
        customer_name: project?.customer_name || 'there',
        project_name: project?.event_name || '',
        order_number: project?.order_number || '',
      },
    });
    await db.sendStatusEmail({
      templateName: 'rating_request',
      recipient: project?.customer_email,
      recipientName: project?.customer_name,
      variables: {
        customer_name: project?.customer_name || 'there',
        project_name: project?.event_name || '',
        rating_link: `${window.location.origin}/#review/${projectId}`,
      },
    });
    await db.createNotification({
      type: 'project',
      title: 'Project status changed to completed',
      description: `${project?.event_name} (${project?.order_number}) was closed.`,
      target_role: 'admin',
      read: false,
      project_id: projectId,
    });
    setProjects(projects.map(p => p.id === projectId ? { ...p, status: 'completed', progress: 100 } : p));
    loadProjects();
    } catch (err) {
      console.error('Close project failed:', err);
      alert('Failed to close project. Please try again.');
    }
  };

  const getStagesForProject = (project: Project, tasks: Task[]) =>
    getStagesFromProgress(computeProgressFromTasks(tasks, project.status), project.started_date);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate('admin-dashboard') }, { label: 'Order Tracking' }]} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" /> Order Tracking
          </h2>
          <p className="text-sm text-ink-400 dark:text-ink-500 mt-0.5">Track every project through its workflow stages</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => { const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'; const h = ['Order Number,Event Name,Customer,Editor,Status,Progress']; const rows = projects.map((p) => [esc(p.order_number), esc(p.event_name), esc(p.customer_name), esc(p.editor_name), esc(p.status), p.progress].join(',')); const blob = new Blob([...h, ...rows].join('\n'), { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'order-tracking.csv'; a.click(); URL.revokeObjectURL(url); }}>Export CSV</Button>
        </div>
      </div>

      <div className="space-y-4">
        {projects.length === 0 ? (
          <Card><p className="text-sm text-ink-400 text-center py-8">No projects yet. Create a new project to get started!</p></Card>
        ) : (
          projects.map((project) => (
            <ProjectTrackingCard
              key={project.id}
              project={project}
              tasks={allTasks.filter((t) => t.project_id === project.id)}
              invoice={invoices[project.id]}
              projectPayments={projectPayments[project.id] || []}
              splits={splits[project.id] || []}
              onNavigate={onNavigate}
              onConfirmPayment={() => setShowPayment(project.id)}
              onCloseProject={() => handleCloseProject(project.id)}
              getStages={getStagesForProject}
              getInvoiceAmount={() => getInvoiceAmount(project.id)}
              getTotalPaid={() => getTotalPaid(project.id)}
              getBalance={() => getBalance(project.id)}
              getPaymentStatus={() => getPaymentStatusFor(project.id)}
            />
          ))
        )}
      </div>

      <Modal open={!!showPayment} onClose={() => setShowPayment(null)} title="Confirm Payment" size="md">
        {showPayment && (() => {
          const project = projects.find((p) => p.id === showPayment);
          const inv = invoices[showPayment];
          const invAmt = getInvoiceAmount(showPayment);
          const totalPaid = getTotalPaid(showPayment);
          const balance = getBalance(showPayment);
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                <p className="font-semibold text-ink-800 dark:text-ink-100">{project?.event_name}</p>
                <p className="text-xs text-ink-400 mt-1">{project?.order_number} · Editor: {project?.editor_name || 'Unassigned'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
                  <p className="text-xs text-ink-400">Invoice</p>
                  <p className="text-lg font-bold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-center">
                  <p className="text-xs text-success-600">Paid</p>
                  <p className="text-lg font-bold text-success-600 dark:text-success-400">₹{totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-center">
                  <p className="text-xs text-error-600">Balance</p>
                  <p className="text-lg font-bold text-error-600 dark:text-error-400">₹{balance.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Amount (₹) *</label>
                  <input type="number" className="input" placeholder={String(balance)} value={payForm.paymentAmount === '' ? '' : payForm.paymentAmount} onChange={(e) => setPayForm({ ...payForm, paymentAmount: e.target.value })} />
                  <p className="text-xs text-ink-400 mt-1">Defaults to balance amount</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Type</label>
                  <select className="input" value={payForm.paymentType} onChange={(e) => setPayForm({ ...payForm, paymentType: e.target.value })}>
                    <option>Advance</option><option>Partial</option><option>Final</option><option>Full</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Transaction ID / Reference *</label>
                  <input className="input" placeholder="e.g. UPI123456789" value={payForm.transactionId} onChange={(e) => setPayForm({ ...payForm, transactionId: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Method</label>
                  <select className="input" value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                    <option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Notes (optional)</label>
                <textarea className="input" rows={2} placeholder="Any notes about this payment..." value={payForm.paymentNotes} onChange={(e) => setPayForm({ ...payForm, paymentNotes: e.target.value })} />
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300">Confirming payment will close this project, notify the customer, and record the payment in the finance system.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPayment(null)}>Cancel</Button>
                <Button variant="success" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => handleConfirmPayment(showPayment)} disabled={!payForm.transactionId}>Confirm Payment & Close</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function ProjectTrackingCard({ project, tasks, invoice, projectPayments, splits, onNavigate, onConfirmPayment, onCloseProject, getStages, getInvoiceAmount, getTotalPaid, getBalance, getPaymentStatus }: {
  project: Project;
  tasks: Task[];
  invoice?: Invoice;
  projectPayments: ProjectPayment[];
  splits: PaymentSplit[];
  onNavigate: (p: PageKey, params?: Record<string, unknown>) => void;
  onConfirmPayment: () => void;
  onCloseProject: () => void;
  getStages: (project: Project, tasks: Task[]) => { label: string; status: 'completed' | 'current' | 'pending'; date?: string }[];
  getInvoiceAmount: () => number;
  getTotalPaid: () => number;
  getBalance: () => number;
  getPaymentStatus: () => string;
}) {
  const stages = getStages(project, tasks);
  const isCompleted = project.status === 'completed';
  const isReview = project.status === 'review' || project.status === 'correction' || project.status === 'correction_approved';
  const payStatus = getPaymentStatus();
  const hasBalance = getBalance() > 0;
  const totalPaid = getTotalPaid();

  return (
    <Card hover className="animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 font-bold text-xs">
            {(project.order_number || '').slice(-2)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink-800 dark:text-ink-100 truncate">{project.event_name}</p>
            <p className="text-xs text-ink-400 dark:text-ink-500 truncate">{project.order_number} · {project.customer_name} · {project.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice && (
            <Badge status={payStatus === 'Fully Paid' ? 'completed' : totalPaid > 0 ? 'in-progress' : 'pending'}>
              {payStatus}
            </Badge>
          )}
          {projectPayments.length > 0 && projectPayments[0].transaction_reference && (
            <span className="text-xs text-ink-400 dark:text-ink-500 font-mono">Txn: {projectPayments[0].transaction_reference}</span>
          )}
          {invoice && (
            <span className="text-xs text-ink-400 dark:text-ink-500">₹{getInvoiceAmount().toLocaleString()}</span>
          )}
          {splits.length > 0 && (
            <span className="text-xs text-ink-400 dark:text-ink-500">Splits: {splits.length}</span>
          )}
          <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: project.id })}>View</Button>
          {!isCompleted && isReview && (
            <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: project.id })}>Manage</Button>
          )}
          {!isCompleted && isReview && (hasBalance || !invoice) && (
            <Button variant="success" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={onConfirmPayment}>Confirm Payment</Button>
          )}
          {!isCompleted && !isReview && computeProgressFromTasks(tasks, project.status) === 100 && !invoice && (
            <Button variant="success" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={onConfirmPayment}>Confirm Payment</Button>
          )}
          {!isCompleted && payStatus === 'Fully Paid' && (
            <Button variant="success" size="sm" icon={<Lock className="w-3.5 h-3.5" />} onClick={onCloseProject}>Close Project</Button>
          )}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-success-500" />}
        </div>
      </div>
      <div className="mb-4">
        {(() => { const progress = computeProgressFromTasks(tasks, project.status); return (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-400 dark:text-ink-500">Progress: {progress}%</span>
            <span className="text-xs text-ink-400 dark:text-ink-500">{tasks.filter(t => t.status === 'approved').length}/{tasks.length} tasks approved</span>
          </div>
          <Progress value={progress} size="md" color={progress === 100 ? 'success' : progress > 50 ? 'primary' : 'warning'} />
        </>
        ); })()}
      </div>
      <HorizontalTimeline stages={stages} />
    </Card>
  );
}
