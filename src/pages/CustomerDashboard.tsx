import { useState, useEffect, useRef } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { StatCard, Card } from '../components/ui/Card';
import DataTable, { Column } from '../components/ui/DataTable';
import StatusProgress from '../components/ui/StatusProgress';
import Button from '../components/ui/Button';
import { HorizontalTimeline } from '../components/ui/Timeline';
import { ShoppingBag, FolderKanban, Eye, CheckCircle2, Download, MessageSquare, ChevronDown, ChevronUp, Sparkles, Clock, Star, DollarSign, AlertCircle, Upload, Image as ImageIcon, X, Landmark } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, Task, ProjectRatingRequest, ReviewFile, ProjectMessage, Invoice, ProjectPayment, BankDetails } from '../data/db';
import { useProjects } from '../hooks/useProjects';
import { computeProgressFromTasks, getDeadlineInfo, getStagesFromProgress } from '../utils/projectUtils';
import { sumVerifiedPaid, calcBalance, getPaymentStatus, paymentStatusBadgeColor } from '../utils/billing';
import ProjectChat from '../components/ui/ProjectChat';
import Modal from '../components/ui/Modal';
import { countUnreadMessages, markChatRead } from '../utils/chatReadState';

export default function CustomerDashboard({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const { projects, loading } = useProjects(user?.email);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>({});
  const [chatProject, setChatProject] = useState<Project | null>(null);
  const [pendingReviews, setPendingReviews] = useState<ProjectRatingRequest[]>([]);
  const [reviewFileMap, setReviewFileMap] = useState<Record<string, ReviewFile[]>>({});
  const [unreadChat, setUnreadChat] = useState<Record<string, number>>({});
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [projectPayments, setProjectPayments] = useState<Record<string, ProjectPayment[]>>({});
  const [paymentProjectId, setPaymentProjectId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.fetchBankDetails().then((details) => { if (details) setBankDetails(details); });
  }, []);

  useEffect(() => {
    if (!user?.email || projects.length === 0) return;
    let active = true;
    Promise.all(projects.map((p) => db.fetchInvoice(p.id).then((inv) => ({ pid: p.id, inv })).catch(() => ({ pid: p.id, inv: null })))).then((results) => {
      if (!active) return;
      const invMap: Record<string, Invoice> = {};
      results.forEach((r) => { if (r.inv) invMap[r.pid] = r.inv; });
      setInvoices(invMap);
    });
    Promise.all(projects.map((p) => db.fetchProjectPayments(p.id).then((pp) => ({ pid: p.id, pp })).catch(() => ({ pid: p.id, pp: [] })))).then((results) => {
      if (!active) return;
      const payMap: Record<string, ProjectPayment[]> = {};
      results.forEach((r) => { if (r.pp.length > 0) payMap[r.pid] = r.pp; });
      setProjectPayments(payMap);
    });
    return () => { active = false; };
  }, [projects, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    let active = true;
    db.fetchRatingRequestsByCustomer(user.email).then((rows) => {
      if (!active) return;
      setPendingReviews(rows.filter((r) => r.status === 'pending'));
    });
    return () => { active = false; };
  }, [user?.email]);

  useEffect(() => {
    let active = true;
    if (projects.length === 0) return;
    db.fetchTasksByProjectIds(projects.map((p) => p.id)).then((allTasks) => {
      if (!active) return;
      const tMap: Record<string, Task[]> = {};
      allTasks.forEach((t) => { (tMap[t.project_id] ||= []).push(t); });
      setTaskMap(tMap);
    });
    return () => { active = false; };
  }, [projects]);

  useEffect(() => {
    if (!user || projects.length === 0) return;
    let active = true;
    db.fetchReviewFilesByProjectIds(projects.map((p) => p.id)).then((rfMap) => {
      if (!active) return;
      setReviewFileMap(rfMap);
    });
    return () => { active = false; };
  }, [projects, user]);

  useEffect(() => {
    if (!user || projects.length === 0) return;
    let active = true;
    db.fetchProjectMessagesByProjectIds(projects.map((p) => p.id)).then((msgMap) => {
      if (!active) return;
      const uMap: Record<string, number> = {};
      projects.forEach((p) => {
        uMap[p.id] = countUnreadMessages(msgMap[p.id] || [], user?.id, p.id);
      });
      setUnreadChat(uMap);
    });
    return () => { active = false; };
  }, [projects, user]);

  const handleSubmitPayment = async () => {
    if (!paymentProjectId) return;
    const project = projects.find((p) => p.id === paymentProjectId);
    const invoice = invoices[paymentProjectId];
    if (!project || !invoice) return;
    const amount = parseFloat(paymentForm.amount);
    const paid = sumVerifiedPaid(projectPayments[paymentProjectId] || []);
    const balance = calcBalance(invoice.current_amount, paid);
    if (isNaN(amount) || amount <= 0 || amount > balance) {
      setPaymentError(`Enter an amount between ₹1 and ₹${balance.toLocaleString()}.`);
      return;
    }
    setUploadingPayment(true);
    setPaymentError(null);
    try {
      const proofUrl = proofFile ? await db.uploadPaymentProof(paymentProjectId, proofFile) : null;
      await db.createProjectPayment({
        project_id: paymentProjectId,
        invoice_id: invoice.id,
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
        project_id: paymentProjectId,
      });
      const updatedPayments = await db.fetchProjectPayments(paymentProjectId);
      setProjectPayments((prev) => ({ ...prev, [paymentProjectId]: updatedPayments }));
      setPaymentProjectId(null);
      setProofFile(null);
      setPaymentForm({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Could not submit payment. Please try again.');
    } finally {
      setUploadingPayment(false);
    }
  };

  const openPayment = (project: Project) => {
    const invoice = invoices[project.id];
    if (!invoice) return;
    const paid = sumVerifiedPaid(projectPayments[project.id] || []);
    setPaymentProjectId(project.id);
    setPaymentForm({ amount: String(calcBalance(invoice.current_amount, paid)), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
    setProofFile(null);
    setPaymentError(null);
  };

  const totalOrders = projects.length;
  const inProgress = projects.filter((p) => p.status === 'in-progress' || p.status === 'assigned').length;
  const reviewPending = projects.filter((p) => p.status === 'review').length;
  const completed = projects.filter((p) => p.status === 'completed').length;
  const activeProjects = projects.filter((p) => p.status !== 'completed');

  const columns: Column<Project>[] = [
    { key: 'order_number', label: 'Order #', sortable: true, render: (r) => <span className="font-semibold text-primary-600">{r.order_number}</span> },
    { key: 'event_name', label: 'Event Name', sortable: true },
    { key: 'category', label: 'Category' },
    { key: 'deadline', label: 'Deadline', sortable: true, render: (r) => { const d = getDeadlineInfo(r.deadline, r.status); return d.frozen ? <span className={d.pillClass}>{d.label}</span> : <span className={d.color}>{d.label}</span>; } },
    { key: 'status', label: 'Progress', sortable: true, render: (r) => <StatusProgress status={r.status} tasks={taskMap[r.id] || []} /> },
  ];

  const actions = (row: Project) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={() => {
        markChatRead(row.id);
        setUnreadChat((prev) => ({ ...prev, [row.id]: 0 }));
        setChatProject(row);
      }}>
        Chat
        {unreadChat[row.id] > 0 && <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{unreadChat[row.id]}</span>}
      </Button>
      {(reviewFileMap[row.id] && reviewFileMap[row.id].length > 0) && (
        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('review-screen', { id: row.id })}>Review</Button>
      )}
      {invoices[row.id] && calcBalance(invoices[row.id].current_amount, sumVerifiedPaid(projectPayments[row.id] || [])) > 0 && (
        <Button variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => openPayment(row)}>Pay</Button>
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

  const getStages = (project: Project, tasks: Task[]) =>
    getStagesFromProgress(computeProgressFromTasks(tasks, project.status), project.started_date);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden shimmer-sweep animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-violet-500 to-pink-500" />
        <div className="absolute inset-0 aurora-bg opacity-60" />
        <div className="absolute inset-0 bg-dot-grid opacity-20" />
        <svg className="absolute top-4 right-8 w-24 h-24 opacity-20 animate-float-shape" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" fill="none" /><circle cx="50" cy="50" r="25" stroke="white" strokeWidth="2" fill="none" /></svg>
        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Welcome back</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">{user?.user_metadata?.full_name || 'Customer'}</h2>
            <p className="text-sm text-white/80 max-w-lg">You have {inProgress} projects in working and {reviewPending} pending review.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => onNavigate('new-project')} className="px-4 py-2 rounded-xl bg-white text-primary-600 text-sm font-semibold hover:scale-105 transition-all flex items-center gap-2 shadow-lg">
                <ShoppingBag className="w-4 h-4" /> New Project
              </button>
              <button onClick={() => onNavigate('corrections')} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md text-white text-sm font-semibold border border-white/30 hover:bg-white/30 transition-all hover:scale-105 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Request Correction
              </button>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Orders', value: totalOrders, icon: <ShoppingBag className="w-4 h-4" /> },
              { label: 'Active', value: inProgress, icon: <FolderKanban className="w-4 h-4" /> },
              { label: 'Done', value: completed, icon: <CheckCircle2 className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 min-w-[80px]">
                <div className="text-white/70">{stat.icon}</div>
                <span className="text-xl font-bold text-white">{stat.value}</span>
                <span className="text-[10px] text-white/60 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Orders" value={totalOrders} icon={<ShoppingBag className="w-5 h-5" />} color="primary" />
        <StatCard label="Working" value={inProgress} icon={<FolderKanban className="w-5 h-5" />} color="warning" />
        <StatCard label="Review Pending" value={reviewPending} icon={<Eye className="w-5 h-5" />} color="purple" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="w-5 h-5" />} color="success" />
      </div>

      {pendingReviews.length > 0 && (
        <Card className="animate-slide-up border-primary-200 dark:border-primary-700">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-ink-800 dark:text-ink-100">We’d love your feedback</p>
                <p className="text-xs text-ink-400">{pendingReviews.length} completed project{pendingReviews.length > 1 ? 's' : ''} awaiting your review.</p>
              </div>
            </div>
            <Button variant="primary" size="sm" icon={<Star className="w-4 h-4" />} onClick={() => onNavigate('customer-feedback', { requestId: pendingReviews[0].id })}>Give Feedback</Button>
          </div>
        </Card>
      )}

      {/* Unpaid projects with Pay button */}
      {(() => {
        const getInvoiceAmount = (p: Project) => invoices[p.id]?.current_amount ?? p.amount ?? 0;
        const getVerifiedPaid = (p: Project) => sumVerifiedPaid(projectPayments[p.id] || []);
        const getBalance = (p: Project) => calcBalance(getInvoiceAmount(p), getVerifiedPaid(p));
        const unpaidProjects = projects.filter((p) => invoices[p.id] && getBalance(p) > 0);
        if (unpaidProjects.length === 0) return null;
        return (
          <Card padding={false} className="animate-slide-up border-warning-200 dark:border-warning-700/50">
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-600 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900 dark:text-white">Pending Payments</h3>
                <p className="text-xs text-ink-400 mt-0.5">{unpaidProjects.length} project{unpaidProjects.length > 1 ? 's' : ''} with outstanding balance — review and pay to keep your project on track</p>
              </div>
            </div>
            <div className="px-5 pb-5 space-y-3">
              {unpaidProjects.map((p) => {
                const inv = invoices[p.id];
                const balance = getBalance(p);
                const paid = getVerifiedPaid(p);
                const invAmt = getInvoiceAmount(p);
                const status = getPaymentStatus(invAmt, paid);
                const isEstimate = inv?.invoice_type === 'estimate';
                return (
                  <div key={p.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-800/30 hover:border-warning-300 dark:hover:border-warning-700 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink-800 dark:text-ink-100 text-sm truncate">{p.event_name}</p>
                        <span className="text-xs text-ink-400">{p.order_number}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>
                        {isEstimate && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400">Estimate</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs">
                        <span className="text-ink-400">Total: <span className="font-semibold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</span></span>
                        {paid > 0 && <span className="text-success-600 dark:text-success-400">Paid: ₹{paid.toLocaleString()}</span>}
                        <span className="text-error-600 dark:text-error-400 font-semibold">Balance: ₹{balance.toLocaleString()}</span>
                      </div>
                    </div>
                    <Button variant="primary" size="sm" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => openPayment(p)}>Pay Now</Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {projects[0] && (
        <Card className="animate-slide-up">
          <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Order Tracking · {projects[0].order_number}</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500 mb-6">Track the progress of your latest order</p>
          <HorizontalTimeline stages={getStages(projects[0], taskMap[projects[0].id] || [])} />
        </Card>
      )}

      <Card padding={false} className="animate-slide-up">
        <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-ink-900 dark:text-white">My Orders</h3>
          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Showing all active orders</span>
          </div>
        </div>
        <div className="px-5 pb-5">
          {activeProjects.length === 0 ? (
            <div className="text-center py-10 text-ink-400 dark:text-ink-500">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active projects right now.</p>
              <Button variant="primary" size="sm" className="mt-3" onClick={() => onNavigate('new-project')}>New Project</Button>
            </div>
          ) : (
            <DataTable columns={columns} data={activeProjects} actions={actions} pageSize={6} expandedRow={(row) => expandedId === row.id ? (
              <div className="p-2.5 sm:p-3 bg-primary-50/30 dark:bg-primary-500/5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-[10px]">
                      {(row.order_number || '').slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{row.event_name}</p>
                      <p className="text-[11px] text-ink-400 dark:text-ink-500">{row.order_number} · {row.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" icon={<ChevronUp className="w-3.5 h-3.5" />} onClick={() => setExpandedId(null)}>Close</Button>
                  </div>
                </div>
                <HorizontalTimeline stages={getStages(row, taskMap[row.id] || [])} />
              </div>
            ) : null} />
          )}
        </div>
      </Card>

      <Modal open={!!paymentProjectId} onClose={() => { setPaymentProjectId(null); setProofFile(null); setPaymentError(null); }} title="Submit Payment" size="md">
        {paymentProjectId && (() => {
          const project = projects.find((p) => p.id === paymentProjectId);
          const invoice = invoices[paymentProjectId];
          if (!project || !invoice) return null;
          const paid = sumVerifiedPaid(projectPayments[paymentProjectId] || []);
          const balance = calcBalance(invoice.current_amount, paid);
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <p className="text-sm font-medium text-ink-500 dark:text-ink-400 truncate">{project.event_name}</p>
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
              <p className="text-sm text-ink-500 dark:text-ink-400">After making your payment via bank transfer or UPI, enter the payment details below and upload a screenshot or receipt as evidence. The finance team will verify your payment.</p>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Amount Paid (₹) *</label>
                <input type="number" min="1" max={balance} className="input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: String(balance) })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300">Full ₹{balance.toLocaleString()}</button>
                  {[1000, 2000, 3000, 5000].filter((value) => value < balance).map((value) => <button key={value} type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: String(value) })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink-50 dark:bg-ink-800 text-ink-600 dark:text-ink-300">₹{value.toLocaleString()}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Date</label>
                  <input type="date" className="input" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Method</label>
                  <select className="input" value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}><option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option><option>Other</option></select>
                </div>
              </div>
              <input className="input" placeholder="Transaction / reference number" value={paymentForm.transactionRef} onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })} />
              <textarea className="input" rows={2} placeholder="Notes (optional)" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              {proofFile ? <div className="flex items-center gap-2 p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-sm text-success-700 dark:text-success-400"><ImageIcon className="w-4 h-4" />{proofFile.name}<button className="ml-auto" onClick={() => setProofFile(null)}><X className="w-4 h-4" /></button></div> : <button onClick={() => fileInputRef.current?.click()} className="w-full p-4 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 text-sm text-ink-400 flex items-center justify-center gap-2 hover:border-primary-400"><Upload className="w-4 h-4" />Upload payment receipt</button>}
              {paymentError && <p className="text-sm text-error-600 dark:text-error-400">{paymentError}</p>}
              <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setPaymentProjectId(null)}>Cancel</Button><Button variant="success" size="sm" onClick={handleSubmitPayment} disabled={uploadingPayment}>{uploadingPayment ? 'Submitting...' : 'Submit Payment'}</Button></div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!chatProject} onClose={() => setChatProject(null)} title={chatProject ? `Chat · ${chatProject.order_number}` : 'Chat'} size="md">
        {chatProject && <ProjectChat projectId={chatProject.id} canUseInternal={false} />}
      </Modal>
    </div>
  );
}
