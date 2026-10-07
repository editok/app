import { useState, useEffect, useRef } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import StatusProgress from '../components/ui/StatusProgress';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ProjectChat from '../components/ui/ProjectChat';
import { ShoppingBag, FolderKanban, Eye, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, Sparkles, DollarSign, Receipt, FileText, Upload, Check, X, Download, Image as ImageIcon, Clock, Landmark, Smartphone, Copy, AlertCircle } from 'lucide-react';
import type { ReviewFile, ProjectMessage } from '../data/db';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, Task, Invoice, ProjectPayment, BankDetails } from '../data/db';
import { useProjects } from '../hooks/useProjects';
import { computeProgressFromTasks, getDeadlineInfo, getStagesFromProgress } from '../utils/projectUtils';
import { sumVerifiedPaid, calcBalance, getPaymentStatus, paymentStatusBadgeColor } from '../utils/billing';
import { HorizontalTimeline } from '../components/ui/Timeline';
import { countUnreadMessages, markChatRead } from '../utils/chatReadState';

export default function MyOrders({ onNavigate, params }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; params?: Record<string, unknown> }) {
  const { user } = useAuth();
  const { projects, loading } = useProjects(user?.email);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>({});
  const [chatProject, setChatProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [projectPayments, setProjectPayments] = useState<Record<string, ProjectPayment[]>>({});
  const [showBilling, setShowBilling] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofProjectId, setProofProjectId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [reviewFileMap, setReviewFileMap] = useState<Record<string, ReviewFile[]>>({});
  const [unreadChat, setUnreadChat] = useState<Record<string, number>>({});

  useEffect(() => {
    db.fetchBankDetails().then((bd) => { if (bd) setBankDetails(bd); });
  }, []);

  useEffect(() => {
    let active = true;
    if (projects.length === 0) return;
    Promise.all(projects.map((p) => db.fetchTasks(p.id))).then((results) => {
      if (!active) return;
      const tMap: Record<string, Task[]> = {};
      projects.forEach((p, i) => { tMap[p.id] = results[i]; });
      setTaskMap(tMap);
    });
    Promise.all(projects.map(async (p) => {
      const inv = await db.fetchInvoice(p.id);
      const pp = await db.fetchProjectPayments(p.id);
      return { id: p.id, inv, pp };
    })).then((results) => {
      if (!active) return;
      const invMap: Record<string, Invoice> = {};
      const payMap: Record<string, ProjectPayment[]> = {};
      results.forEach(r => {
        if (r.inv) invMap[r.id] = r.inv;
        if (r.pp.length > 0) payMap[r.id] = r.pp;
      });
      setInvoices(invMap);
      setProjectPayments(payMap);
    });
    return () => { active = false; };
  }, [projects]);

  useEffect(() => {
    if (!user || projects.length === 0) return;
    let active = true;
    Promise.all(projects.map((p) => db.fetchReviewFiles(p.id))).then((results) => {
      if (!active) return;
      const rfMap: Record<string, ReviewFile[]> = {};
      projects.forEach((p, i) => { rfMap[p.id] = results[i]; });
      setReviewFileMap(rfMap);
    });
    return () => { active = false; };
  }, [projects, user]);

  useEffect(() => {
    if (!user || projects.length === 0) return;
    let active = true;
    Promise.all(projects.map((p) => db.fetchProjectMessages(p.id))).then((results) => {
      if (!active) return;
      const uMap: Record<string, number> = {};
      projects.forEach((p, i) => {
        uMap[p.id] = countUnreadMessages(results[i], user?.id, p.id);
      });
      setUnreadChat(uMap);
    });
    return () => { active = false; };
  }, [projects, user]);

  useEffect(() => {
    const projectId = typeof params?.projectId === 'string' ? params.projectId : null;
    if (projectId && invoices[projectId]) setShowBilling(projectId);
  }, [params?.projectId, invoices]);

  const reloadBilling = async (projectId: string) => {
    const inv = await db.fetchInvoice(projectId);
    const pp = await db.fetchProjectPayments(projectId);
    setInvoices(prev => { const next = { ...prev }; if (inv) next[projectId] = inv; else delete next[projectId]; return next; });
    setProjectPayments(prev => { const next = { ...prev }; if (pp.length > 0) next[projectId] = pp; else delete next[projectId]; return next; });
  };

  const getInvoiceAmount = (p: Project) => invoices[p.id]?.current_amount ?? p.amount ?? 0;
  const getVerifiedPaid = (p: Project) => sumVerifiedPaid(projectPayments[p.id] || []);
  const getBalance = (p: Project) => calcBalance(getInvoiceAmount(p), getVerifiedPaid(p));
  const getPayStatus = (p: Project) => getPaymentStatus(getInvoiceAmount(p), getVerifiedPaid(p));

  const openPayment = (project: Project) => {
    const invoice = invoices[project.id];
    const balance = getBalance(project);
    if (!invoice || balance <= 0) return;
    setProofProjectId(project.id);
    setPaymentForm({ amount: String(balance), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
    setProofFile(null);
    setActionError(null);
  };

  const invoiceTypeBadge: Record<string, { label: string; cls: string }> = {
    estimate: { label: 'Estimate', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400' },
    final: { label: 'Final Invoice', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
  };
  const invoiceStatusBadge: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300' },
    sent: { label: 'Awaiting Your Review', cls: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' },
    approved: { label: 'Approved', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
    rejected: { label: 'Rejected', cls: 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' },
    revised: { label: 'Revised', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400' },
  };

  const totalOrders = projects.length;
  const inProgress = projects.filter((p) => p.status === 'in-progress' || p.status === 'assigned').length;
  const reviewPending = projects.filter((p) => p.status === 'review').length;
  const completed = projects.filter((p) => p.status === 'completed').length;
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  const columns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event Name', sortable: true },
    { key: 'category', label: 'Category' },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (r) => { const d = getDeadlineInfo(r.deadline, r.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; } },
    { key: 'status', label: 'Progress', sortable: true, render: (r) => <StatusProgress status={r.status} tasks={taskMap[r.id] || []} /> },
    { key: 'billing', label: 'Billing', render: (r) => {
      const inv = invoices[r.id];
      if (!inv) return <span className="text-xs text-ink-400">No invoice</span>;
      const status = getPayStatus(r);
      return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>;
    } },
  ];

  const handleUploadProof = async () => {
    if (!proofProjectId) return;
    const inv = invoices[proofProjectId];
    const project = projects.find(p => p.id === proofProjectId);
    if (!inv || !project) return;
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    setUploading(true);
    try {
      let proofUrl: string | null = null;
      if (proofFile) proofUrl = await db.uploadPaymentProof(proofProjectId, proofFile);
      const balance = getBalance(project);
      await db.createProjectPayment({
        project_id: proofProjectId,
        invoice_id: inv.id,
        amount,
        payment_date: new Date(paymentForm.paymentDate).toISOString(),
        payment_method: paymentForm.paymentMethod,
        payment_type: amount >= balance ? 'Full' : 'Partial',
        transaction_reference: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
        payment_proof: proofUrl || undefined,
        status: 'pending_verification',
        created_by: user?.email || 'customer',
      });
      await db.createNotification({
        type: 'payment',
        title: 'Customer submitted payment',
        description: `Customer has submitted a payment of ₹${amount.toLocaleString()} for ${project.order_number}. Please verify.`,
        target_role: 'admin',
        read: false,
        project_id: proofProjectId,
      });
      await reloadBilling(proofProjectId);
      setProofProjectId(null);
      setProofFile(null);
      setPaymentForm({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to upload payment proof. Please try again.'); } finally { setUploading(false); }
  };

  const actions = (row: Project) => {
    const inv = invoices[row.id];
    const billRaised = !!inv && inv.status !== 'draft';
    const balance = getBalance(row);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {(reviewFileMap[row.id] && reviewFileMap[row.id].length > 0) && (
          <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('review-screen', { id: row.id })}>Review</Button>
        )}
        <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => {
          markChatRead(row.id);
          setUnreadChat((prev) => ({ ...prev, [row.id]: 0 }));
          setChatProject(row);
        }}>
          Chat
          {unreadChat[row.id] > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{unreadChat[row.id]}</span>}
        </Button>
        {billRaised && balance > 0 && (
          <Button variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => openPayment(row)}>Pay</Button>
        )}
        {inv && balance <= 0 && (
          <Button variant="ghost" size="sm" icon={<Receipt className="w-3.5 h-3.5" />} onClick={() => setShowBilling(row.id)}>Billing</Button>
        )}
        {row.status === 'completed' && row.output_link && (
          <a href={row.output_link} target="_blank" rel="noopener noreferrer">
            <Button variant="success" size="sm" icon={<Download className="w-3.5 h-3.5" />}>Output</Button>
          </a>
        )}
        <Button
          variant="outline"
          size="sm"
          icon={expandedId === row.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
        >
          Track
        </Button>
      </div>
    );
  };

  const getStages = (project: Project, tasks: Task[]) =>
    getStagesFromProgress(computeProgressFromTasks(tasks, project.status), project.started_date);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 border border-error-200 dark:border-error-500/30 text-sm text-error-700 dark:text-error-400 flex items-start justify-between gap-3 animate-slide-up">
          <span className="min-w-0 break-words">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-error-400 hover:text-error-600 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 stagger">
        <Card className="p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">{totalOrders}</p><p className="text-[10px] sm:text-xs text-ink-400">Total Orders</p></div></div></Card>
        <Card className="p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 text-warning-600 flex items-center justify-center flex-shrink-0"><FolderKanban className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">{inProgress}</p><p className="text-[10px] sm:text-xs text-ink-400">Working</p></div></div></Card>
        <Card className="p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 flex items-center justify-center flex-shrink-0"><Eye className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">{reviewPending}</p><p className="text-[10px] sm:text-xs text-ink-400">Review Pending</p></div></div></Card>
        <Card className="p-3 sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-50 dark:bg-success-500/15 text-success-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">{completed}</p><p className="text-[10px] sm:text-xs text-ink-400">Completed</p></div></div></Card>
      </div>

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="font-semibold text-ink-900 dark:text-white">My Orders</h3>
            {activeProjects.some((p) => getBalance(p) > 0) && (
              <Button variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => onNavigate('pending-payments')}>
                Pay All
              </Button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
            <Sparkles className="w-3.5 h-3.5" />
            <span>View estimates, submit payments & track progress</span>
          </div>
        </div>
        <div className="px-5 pb-5">
          {activeProjects.length === 0 ? (
            <div className="text-center py-10 text-ink-400 dark:text-ink-500">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active orders right now. Completed orders are listed below.</p>
              <Button variant="primary" size="sm" className="mt-3" onClick={() => onNavigate('new-project')}>New Project</Button>
            </div>
          ) : (
            <DataTable columns={columns} data={activeProjects} actions={actions} pageSize={10} expandedRow={(row) => expandedId === row.id ? (
              <div className="p-2.5 sm:p-3 bg-primary-50/30 dark:bg-primary-500/5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-[10px] flex-shrink-0">
                      {(row.order_number || '').slice(-2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{row.event_name}</p>
                      <p className="text-[11px] text-ink-400 dark:text-ink-500 truncate">{row.order_number} · {row.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {invoices[row.id] && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadgeColor[getPayStatus(row)]}`}>{getPayStatus(row)}</span>}
                    <Button variant="ghost" size="sm" icon={<ChevronUp className="w-3.5 h-3.5" />} onClick={() => setExpandedId(null)}>Close</Button>
                  </div>
                </div>
                <HorizontalTimeline stages={getStages(row, taskMap[row.id] || [])} />
              </div>
            ) : null} />
          )}
        </div>
      </Card>

      {completedProjects.length > 0 && (
        <Card padding={false} className="animate-slide-up border-success-200 dark:border-success-700/40">
          <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success-600" />
              <h3 className="font-semibold text-ink-900 dark:text-white">Completed Orders</h3>
              <span className="text-xs text-ink-400">({completedProjects.length})</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Delivered projects available for download</span>
            </div>
          </div>
          <div className="px-5 pb-5">
            <DataTable columns={columns} data={completedProjects} actions={actions} pageSize={10} expandedRow={(row) => expandedId === row.id ? (
              <div className="p-2.5 sm:p-3 bg-success-50/30 dark:bg-success-500/5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center text-success-600 font-bold text-[10px] flex-shrink-0">
                      {(row.order_number || '').slice(-2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{row.event_name}</p>
                      <p className="text-[11px] text-ink-400 dark:text-ink-500 truncate">{row.order_number} · {row.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {invoices[row.id] && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadgeColor[getPayStatus(row)]}`}>{getPayStatus(row)}</span>}
                    <Button variant="ghost" size="sm" icon={<ChevronUp className="w-3.5 h-3.5" />} onClick={() => setExpandedId(null)}>Close</Button>
                  </div>
                </div>
                <HorizontalTimeline stages={getStages(row, taskMap[row.id] || [])} />
              </div>
            ) : null} />
          </div>
        </Card>
      )}

      <Modal open={!!chatProject} onClose={() => setChatProject(null)} title={chatProject ? `Chat · ${chatProject.order_number}` : 'Chat'} size="md">
        {chatProject && <ProjectChat projectId={chatProject.id} canUseInternal={false} />}
      </Modal>


      {/* Billing Details Modal */}
      <Modal open={!!showBilling} onClose={() => setShowBilling(null)} title="Billing Details" size="md">
        {showBilling && (() => {
          const project = projects.find((p) => p.id === showBilling);
          if (!project) return null;
          const inv = invoices[showBilling];
          const pays = projectPayments[showBilling] || [];
          const invAmt = getInvoiceAmount(project);
          const paid = getVerifiedPaid(project);
          const balance = getBalance(project);
          const status = getPayStatus(project);
          const isEstimate = inv?.invoice_type === 'estimate';
          const isFinal = inv?.invoice_type === 'final';
          const pendingVerification = (projectPayments[showBilling] || []).filter(pp => pp.status === 'pending_verification').reduce((s, pp) => s + pp.amount, 0);
          const paymentStatusBadge: Record<string, { label: string; cls: string }> = {
            pending_verification: { label: 'Pending Verification', cls: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' },
            verified: { label: 'Verified', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
            rejected: { label: 'Rejected', cls: 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' },
          };
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                    <p className="font-semibold text-ink-800 dark:text-ink-100">{project.event_name}</p>
                    <p className="text-xs text-ink-400 mt-1">{project.order_number}</p>
                  </div>
                  {inv && (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${invoiceTypeBadge[inv.invoice_type]?.cls}`}>{invoiceTypeBadge[inv.invoice_type]?.label}</span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${invoiceStatusBadge[inv.status]?.cls}`}>{invoiceStatusBadge[inv.status]?.label}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
                  <p className="text-[10px] sm:text-xs text-ink-400">{isEstimate ? 'Estimated' : 'Invoice'} Total</p>
                  <p className="text-sm sm:text-lg font-bold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-center">
                  <p className="text-[10px] sm:text-xs text-success-600">Verified Paid</p>
                  <p className="text-sm sm:text-lg font-bold text-success-600 dark:text-success-400">₹{paid.toLocaleString()}</p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-center">
                  <p className="text-[10px] sm:text-xs text-error-600">Balance Due</p>
                  <p className="text-sm sm:text-lg font-bold text-error-600 dark:text-error-400">₹{balance.toLocaleString()}</p>
                </div>
              </div>
              {pendingVerification > 0 && (
                <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30">
                  <p className="text-sm text-warning-700 dark:text-warning-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ₹{pendingVerification.toLocaleString()} pending verification by the finance team.
                  </p>
                </div>
              )}
              {inv && (
                <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-ink-400">Invoice Number</span><span className="font-medium text-ink-700 dark:text-ink-200">{inv.invoice_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Invoice Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(inv.invoice_date).toLocaleDateString()}</span></div>
                  {inv.sent_at && <div className="flex justify-between"><span className="text-ink-400">Sent Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(inv.sent_at).toLocaleDateString()}</span></div>}
                  {inv.approved_at && <div className="flex justify-between"><span className="text-ink-400">Approved Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(inv.approved_at).toLocaleDateString()}</span></div>}
                  {inv.rejected_reason && <div className="flex justify-between"><span className="text-ink-400">Rejection Reason</span><span className="font-medium text-error-600">{inv.rejected_reason}</span></div>}
                  {inv.advance_amount ? (
                    <div className="flex justify-between"><span className="text-ink-400">Advance Due</span><span className="font-medium text-warning-600 dark:text-warning-400">₹{inv.advance_amount.toLocaleString()}</span></div>
                  ) : null}
                  {inv.notes && <div className="flex justify-between"><span className="text-ink-400">Notes</span><span className="font-medium text-ink-700 dark:text-ink-200">{inv.notes}</span></div>}
                </div>
              )}
              {inv && (
                <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} className="w-full" onClick={() => window.print()}>Download {isEstimate ? 'Estimate' : 'Invoice'}</Button>
              )}
              {/* Submit payment only after an invoice has been raised */}
              {inv && balance > 0 && (
                <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} className="w-full" onClick={() => {
                  setProofProjectId(project.id);
                  setPaymentForm({ amount: String(balance), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
                  setProofFile(null);
                }}>Submit Payment</Button>
              )}
              {/* Bank & UPI Details only when an invoice exists with balance */}
              {inv && balance > 0 && bankDetails && (bankDetails.accountNumber || bankDetails.upiId) && (
                <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-primary-500" />
                    <h4 className="text-sm font-bold text-ink-700 dark:text-ink-200">Scan / Account Details</h4>
                  </div>
                  {bankDetails.accountNumber && (
                    <div className="space-y-1.5 text-sm">
                      {bankDetails.bankName && <div className="flex justify-between"><span className="text-ink-400">Bank</span><span className="font-medium text-ink-700 dark:text-ink-200">{bankDetails.bankName}</span></div>}
                      {bankDetails.branchName && <div className="flex justify-between"><span className="text-ink-400">Branch</span><span className="font-medium text-ink-700 dark:text-ink-200">{bankDetails.branchName}</span></div>}
                      {bankDetails.accountHolder && <div className="flex justify-between"><span className="text-ink-400">Account Holder</span><span className="font-medium text-ink-700 dark:text-ink-200">{bankDetails.accountHolder}</span></div>}
                      <div className="flex justify-between items-center">
                        <span className="text-ink-400">Account Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-700 dark:text-ink-200 font-mono">{bankDetails.accountNumber}</span>
                          <button onClick={() => navigator.clipboard.writeText(bankDetails.accountNumber)} className="text-ink-400 hover:text-primary-600"><Copy className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {bankDetails.ifscCode && (
                        <div className="flex justify-between items-center">
                          <span className="text-ink-400">IFSC Code</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink-700 dark:text-ink-200 font-mono">{bankDetails.ifscCode}</span>
                            <button onClick={() => navigator.clipboard.writeText(bankDetails.ifscCode)} className="text-ink-400 hover:text-primary-600"><Copy className="w-3 h-3" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {bankDetails.upiId && (
                    <div className="pt-3 border-t border-ink-100 dark:border-ink-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Pay via UPI</span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex-1 space-y-1 text-sm w-full">
                          <div className="flex justify-between items-center">
                            <span className="text-ink-400">UPI ID</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink-700 dark:text-ink-200 font-mono">{bankDetails.upiId}</span>
                              <button onClick={() => navigator.clipboard.writeText(bankDetails.upiId)} className="text-ink-400 hover:text-primary-600"><Copy className="w-3 h-3" /></button>
                            </div>
                          </div>
                          {bankDetails.upiName && <div className="flex justify-between"><span className="text-ink-400">UPI Name</span><span className="font-medium text-ink-700 dark:text-ink-200">{bankDetails.upiName}</span></div>}
                          {bankDetails.upiMobile && <div className="flex justify-between"><span className="text-ink-400">UPI Mobile</span><span className="font-medium text-ink-700 dark:text-ink-200">{bankDetails.upiMobile}</span></div>}
                        </div>
                        <div className="flex justify-center w-full sm:w-auto">
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=upi://pay?pa=${encodeURIComponent(bankDetails.upiId)}&pn=${encodeURIComponent(bankDetails.upiName || bankDetails.accountHolder || '')}&am=0&cu=INR`} alt="UPI QR Code" className="w-28 h-28 rounded-xl border border-ink-100 dark:border-ink-700 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Payment history */}
              <div>
                <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Payment History ({pays.length})</h4>
                {pays.length === 0 ? (
                  <p className="text-sm text-ink-400 py-3">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pays.map((pp) => (
                      <div key={pp.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-ink-700 dark:text-ink-200">₹{pp.amount.toLocaleString()}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadge[pp.status]?.cls}`}>{paymentStatusBadge[pp.status]?.label}</span>
                            <span className="text-xs text-ink-400">{new Date(pp.payment_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                          <span>{pp.payment_type}</span>
                          <span>· {pp.payment_method}</span>
                          {pp.transaction_reference && <span>· Ref: {pp.transaction_reference}</span>}
                        </div>
                        {pp.payment_proof && (
                          <a href={pp.payment_proof} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1">
                            <ImageIcon className="w-3 h-3" /> View payment proof
                          </a>
                        )}
                        {pp.status === 'rejected' && pp.rejection_reason && (
                          <div className="mt-2 p-2 rounded-lg bg-error-50 dark:bg-error-500/15 text-xs text-error-700 dark:text-error-400">
                            <strong>Rejected:</strong> {pp.rejection_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {inv && balance > 0 && (
                <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30">
                  <p className="text-sm text-warning-700 dark:text-warning-400 flex items-start gap-2">
                    <Receipt className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Outstanding balance of ₹{balance.toLocaleString()} pending. Submit your payment to notify the team.
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Submit Payment Modal */}
      <Modal open={!!proofProjectId} onClose={() => { setProofProjectId(null); setProofFile(null); }} title="Submit Payment" size="md">
        {proofProjectId && (() => {
          const project = projects.find(p => p.id === proofProjectId);
          const balance = project ? getBalance(project) : 0;
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                {project && <p className="text-sm font-medium text-ink-500 dark:text-ink-400 truncate">{project.event_name}</p>}
                <p className="text-sm text-ink-400 dark:text-ink-500 mt-3">Outstanding Balance</p>
                <p className="text-3xl font-bold text-error-600 dark:text-error-400 mt-1">₹{balance.toLocaleString()}</p>
              </div>
              {bankDetails && (bankDetails.accountNumber || bankDetails.upiId) && (
                <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 space-y-2">
                  <div className="flex items-center gap-2"><Landmark className="w-4 h-4 text-primary-500" /><p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Scan / Account Details</p></div>
                  {bankDetails.accountNumber && <p className="text-xs text-ink-500 dark:text-ink-400">Account: <span className="font-mono font-medium text-ink-700 dark:text-ink-200">{bankDetails.accountNumber}</span>{bankDetails.ifscCode ? ` · IFSC ${bankDetails.ifscCode}` : ''}</p>}
                  {bankDetails.upiId && <p className="text-xs text-ink-500 dark:text-ink-400">UPI: <span className="font-mono font-medium text-ink-700 dark:text-ink-200">{bankDetails.upiId}</span></p>}
                  {bankDetails.upiId && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=upi://pay?pa=${encodeURIComponent(bankDetails.upiId)}&pn=${encodeURIComponent(bankDetails.upiName || bankDetails.accountHolder || '')}&am=0&cu=INR`} alt="UPI QR Code" className="w-24 h-24 rounded-lg border border-ink-100 dark:border-ink-700" />}
                </div>
              )}
              <p className="text-sm text-ink-500 dark:text-ink-400">After making your payment via bank transfer or UPI, enter the payment details below and upload a screenshot/receipt as evidence. The finance team will verify your payment.</p>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Amount Paid (₹) *</label>
                <input type="number" className="input" placeholder="e.g. 2000" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: String(balance) })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-500/25 transition-colors">Full ₹{balance.toLocaleString()}</button>
                  {balance > 0 && [1000, 2000, 3000, 5000].filter((v) => v < balance).map((v) => (
                    <button key={v} type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: String(v) })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink-50 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">₹{v.toLocaleString()}</button>
                  ))}
                </div>
                {paymentForm.amount && parseFloat(paymentForm.amount) > 0 && parseFloat(paymentForm.amount) < balance && (
                  <p className="text-xs text-warning-600 dark:text-warning-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Partial payment: ₹{parseFloat(paymentForm.amount).toLocaleString()} of ₹{balance.toLocaleString()} · Remaining ₹{(balance - parseFloat(paymentForm.amount)).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Date</label>
                  <input type="date" className="input" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Method</label>
                  <select className="input" value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}>
                    <option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Transaction / Reference No.</label>
                  <input className="input" placeholder="e.g. UPI123456789" value={paymentForm.transactionRef} onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Notes (optional)</label>
                <textarea className="input" rows={2} placeholder="Any additional notes about this payment..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Screenshot / Receipt</label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setProofFile(f); }} />
                {proofFile ? (
                  <div className="p-3 rounded-xl border-2 border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/15">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-success-600" />
                      <span className="text-sm font-medium text-success-700 dark:text-success-400 truncate min-w-0">{proofFile.name}</span>
                      <button onClick={() => setProofFile(null)} className="ml-auto text-error-600 text-xs hover:underline">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full p-6 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 hover:border-primary-400 transition-colors flex flex-col items-center gap-2 text-ink-400">
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">Click to select a screenshot</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-ink-400">Your payment will be marked as "Pending Verification" until the finance team confirms it. Only verified payments reduce your balance.</p>
              {actionError && <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-sm text-error-700 dark:text-error-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{actionError}</div>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setProofProjectId(null); setProofFile(null); }}>Cancel</Button>
                <Button variant="success" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={handleUploadProof} disabled={!paymentForm.amount || uploading}>{uploading ? 'Submitting...' : 'Submit Payment'}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
