import { useState, useEffect, useCallback, type WheelEvent } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { DollarSign, FileText, Clock, CheckCircle2, AlertCircle, IndianRupee, Users, Receipt, Wallet, Plus, History, Pencil, Eye, FileCheck2, XCircle, Image as ImageIcon, ShieldCheck, Lock, Bell, ChevronDown, ChevronUp, HandCoins } from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { Project, Payment, PaymentSplit, Task, Invoice, ProjectPayment, InvoiceRevision, InvoiceType, PayoutRequest } from '../data/db';
import { sumVerifiedPaid, sumPendingVerification, calcBalance, getPaymentStatus, paymentStatusBadgeColor } from '../utils/billing';

const FINANCE_WORKFLOW_START_DATE = '2026-09-09T00:00:00.000Z';

interface FinanceProject {
  project: Project;
  payment: Payment | null;
  invoice: Invoice | null;
  projectPayments: ProjectPayment[];
  revisions: InvoiceRevision[];
  splits: PaymentSplit[];
  tasks: Task[];
}

export default function Finance({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [tab, setTab] = useState<'invoice' | 'estimate' | 'final' | 'pending' | 'verification' | 'splits' | 'payouts' | 'completed' | 'all' | 'projects'>('invoice');
  const [invoiceProject, setInvoiceProject] = useState<FinanceProject | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', notes: '', invoiceType: 'estimate' as InvoiceType });
  const [editInvoiceProject, setEditInvoiceProject] = useState<FinanceProject | null>(null);
  const [editInvoiceForm, setEditInvoiceForm] = useState({ amount: '', reason: '' });
  const [paymentProject, setPaymentProject] = useState<FinanceProject | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'UPI', paymentType: 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
  const [historyProject, setHistoryProject] = useState<FinanceProject | null>(null);
  const [splitProject, setSplitProject] = useState<FinanceProject | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [rejectPayment, setRejectPayment] = useState<{ id: string; projectName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [markPaidProject, setMarkPaidProject] = useState<FinanceProject | null>(null);
  const [markPaidProof, setMarkPaidProof] = useState<File | null>(null);
  const [markPaidUploading, setMarkPaidUploading] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [rejectPayout, setRejectPayout] = useState<PayoutRequest | null>(null);
  const [rejectPayoutReason, setRejectPayoutReason] = useState('');
  const [closeProjectFp, setCloseProjectFp] = useState<FinanceProject | null>(null);
  const [closeOutputLink, setCloseOutputLink] = useState('');


  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [allProjects, allInvoices, allProjectPayments, allSplits, allTasks, allPayments, allPayoutReqs] = await Promise.all([
        db.fetchProjects(),
        db.fetchAllInvoices(),
        db.fetchAllProjectPayments(),
        db.fetchAllPaymentSplits(),
        db.fetchAllTasks(),
        db.fetchAllPayments(),
        db.fetchAllPayoutRequests(),
      ]);
      if (allProjects.length === 0) { setProjects([]); return; }
      const projectIds = allProjects.map(p => p.id);

      const invoiceMap = new Map(allInvoices.map(i => [i.project_id, i]));
      const paymentMap = new Map(allPayments.map(p => [p.project_id, p]));
      const tasksByProject: Record<string, Task[]> = {};
      for (const t of allTasks) { (tasksByProject[t.project_id] ||= []).push(t); }
      const paysByProject: Record<string, ProjectPayment[]> = {};
      for (const pp of allProjectPayments) { (paysByProject[pp.project_id] ||= []).push(pp); }
      const splitsByProject: Record<string, PaymentSplit[]> = {};
      for (const sp of allSplits) { (splitsByProject[sp.project_id] ||= []).push(sp); }

      const invoiceIds = allInvoices.map(i => i.id);
      let revisionsMap: Record<string, InvoiceRevision[]> = {};
      if (invoiceIds.length > 0) {
        const { data: revData } = await supabase!.from('invoice_revisions').select('id, invoice_id, previous_amount, new_amount, reason, changed_by, changed_at').in('invoice_id', invoiceIds).order('changed_at', { ascending: false }).limit(200);
        for (const r of (revData || []) as InvoiceRevision[]) { (revisionsMap[r.invoice_id] ||= []).push(r); }
      }

      const items: FinanceProject[] = allProjects.map(p => ({
        project: p,
        payment: paymentMap.get(p.id) || null,
        splits: splitsByProject[p.id] || [],
        tasks: tasksByProject[p.id] || [],
        invoice: invoiceMap.get(p.id) || null,
        projectPayments: paysByProject[p.id] || [],
        revisions: invoiceMap.get(p.id) ? revisionsMap[invoiceMap.get(p.id)!.id] || [] : [],
      }));
      setProjects(items);
      setPayoutRequests(allPayoutReqs);
    } catch (err) {
      console.error('Finance load failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedLoad = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => load(true), 500); };
    const channel = supabase!.channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_payments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_splits' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
  }, [load]);

  const getInvoiceAmount = (fp: FinanceProject) => fp.invoice?.current_amount ?? fp.project.amount ?? 0;
  const getVerifiedPaid = (fp: FinanceProject) => {
    const verified = sumVerifiedPaid(fp.projectPayments);
    if (verified > 0) return verified;
    if (fp.payment?.status === 'paid') return fp.payment.amount;
    return 0;
  };
  const getPendingVerification = (fp: FinanceProject) => sumPendingVerification(fp.projectPayments);
  const getBalance = (fp: FinanceProject) => calcBalance(getInvoiceAmount(fp), getVerifiedPaid(fp));
  const getStatus = (fp: FinanceProject) => getPaymentStatus(getInvoiceAmount(fp), getVerifiedPaid(fp));

  const excludedStatuses = ['created', 'rejected'];
  const workflowProjects = projects.filter(p => p.project.created_at >= FINANCE_WORKFLOW_START_DATE && !excludedStatuses.includes(p.project.status));
  const needsInvoice = workflowProjects.filter(p => !p.invoice);
  const hasInvoice = workflowProjects.filter(p => p.invoice);
  const estimateInvoices = hasInvoice.filter(p => p.invoice?.invoice_type === 'estimate');
  const pendingEstimatePayment = estimateInvoices.filter(p => getBalance(p) > 0);
  const pendingPayment = hasInvoice.filter(p => getBalance(p) > 0);
  const pendingVerification = workflowProjects.filter(p => p.projectPayments.some(pp => pp.status === 'pending_verification'));
  const fullyPaid = hasInvoice.filter(p => getBalance(p) <= 0 && getVerifiedPaid(p) > 0);
  const hasSplits = workflowProjects.filter(p => p.splits.length > 0 || p.tasks.some(t => t.status === 'approved' || t.status === 'completed'));
  const allActiveProjects = projects.filter(p => !excludedStatuses.includes(p.project.status));

  const totalCollected = workflowProjects.reduce((sum, p) => sum + getVerifiedPaid(p), 0);
  const totalRevenue = totalCollected;
  const totalOutstanding = pendingPayment.reduce((sum, p) => sum + getBalance(p), 0);
  const totalInvoiceAmount = hasInvoice.reduce((sum, p) => sum + getInvoiceAmount(p), 0);
  const totalPendingVerification = pendingVerification.reduce((sum, p) => sum + getPendingVerification(p), 0);

  const handleCreateInvoice = async () => {
    if (!invoiceProject || !invoiceForm.amount) return;
    const amount = parseFloat(invoiceForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await db.createInvoice({
        project_id: invoiceProject.project.id,
        amount,
        notes: invoiceForm.notes || undefined,
        invoice_type: invoiceForm.invoiceType,
      });
      await db.createNotification({
        type: 'invoice',
        title: invoiceForm.invoiceType === 'estimate' ? 'Estimate created' : 'Final invoice created',
        description: `${invoiceForm.invoiceType === 'estimate' ? 'Estimate' : 'Final invoice'} of ₹${amount.toLocaleString()} created for ${invoiceProject.project.event_name}. You can view it in your orders.`,
        target_role: 'admin',
        read: false,
        project_id: invoiceProject.project.id,
      });
      if (invoiceProject.project.customer_email) {
        await db.createNotification({
          type: 'invoice',
          title: invoiceForm.invoiceType === 'estimate' ? 'New estimate received' : 'Final invoice received',
          description: `${invoiceForm.invoiceType === 'estimate' ? 'An estimate' : 'A final invoice'} of ₹${amount.toLocaleString()} has been created for ${invoiceProject.project.event_name}. You can view it and make payments anytime.`,
          target_role: 'customer',
          target_email: invoiceProject.project.customer_email,
          read: false,
          project_id: invoiceProject.project.id,
        });
      }
      setInvoiceProject(null);
      setInvoiceForm({ amount: '', notes: '', invoiceType: 'estimate' });
      setSaving(false);
      load();
    } catch (e) {
      console.error('Create invoice failed:', e);
      setSaving(false);
    }
  };

  const handleRaiseFinalInvoice = async (fp: FinanceProject) => {
    if (!fp.invoice) return;
    setSaving(true);
    try {
      await db.transitionInvoiceStatus(fp.invoice.id, 'sent');
      await db.updateInvoice(fp.invoice.id, {
        invoice_type: 'final',
        sent_at: new Date().toISOString(),
      });
      if (fp.project.status !== 'completed') {
        await db.transitionProjectStatus(fp.project.id, 'invoiced');
      }
      if (fp.project.customer_email) {
        await db.createNotification({
          type: 'invoice',
          title: 'Final invoice received',
          description: `A final invoice of ₹${fp.invoice.current_amount.toLocaleString()} for ${fp.project.event_name} is now ready. Previous payments are automatically deducted. Please pay the remaining balance.`,
          target_role: 'customer',
          target_email: fp.project.customer_email,
          read: false,
          project_id: fp.project.id,
        });
      }
      await load();
      setSaving(false);
    } catch {
      setSaving(false);
    }
  };

  const handleEditInvoice = async () => {
    if (!editInvoiceProject || !editInvoiceProject.invoice || !editInvoiceForm.amount) return;
    const newAmount = parseFloat(editInvoiceForm.amount);
    if (isNaN(newAmount) || newAmount <= 0) return;
    if (!editInvoiceForm.reason.trim()) return;
    setSaving(true);
    try {
      await db.updateInvoiceAmount(
        editInvoiceProject.invoice.id,
        newAmount,
        editInvoiceForm.reason,
        user?.email || 'admin'
      );
      await db.createNotification({
        type: 'invoice',
        title: 'Estimate revised',
        description: `Estimate for ${editInvoiceProject.project.order_number} updated from ₹${editInvoiceProject.invoice.current_amount.toLocaleString()} to ₹${newAmount.toLocaleString()}. Reason: ${editInvoiceForm.reason}`,
        target_role: 'admin',
        read: false,
        project_id: editInvoiceProject.project.id,
      });
      if (editInvoiceProject.project.customer_email) {
        await db.createNotification({
          type: 'invoice',
          title: 'Estimate updated',
          description: `The estimate for ${editInvoiceProject.project.event_name} has been updated to ₹${newAmount.toLocaleString()}. Previous payments remain unchanged.`,
          target_role: 'customer',
          target_email: editInvoiceProject.project.customer_email,
          read: false,
          project_id: editInvoiceProject.project.id,
        });
      }
      setEditInvoiceProject(null);
      setEditInvoiceForm({ amount: '', reason: '' });
      setSaving(false);
      load();
    } catch (e) {
      console.error('Edit invoice failed:', e);
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentProject || !paymentForm.amount) return;
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await db.createProjectPayment({
        project_id: paymentProject.project.id,
        invoice_id: paymentProject.invoice?.id,
        amount,
        payment_date: new Date(paymentForm.paymentDate).toISOString(),
        payment_method: paymentForm.paymentMethod,
        payment_type: paymentForm.paymentType,
        transaction_reference: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
        status: 'verified',
        created_by: user?.email || 'admin',
      });
      const newTotal = getVerifiedPaid(paymentProject) + amount;
      const invAmt = getInvoiceAmount(paymentProject);
      const statusText = newTotal >= invAmt ? 'fully paid' : 'partially paid';
      await db.createNotification({
        type: 'payment',
        title: 'Payment recorded',
        description: `₹${amount.toLocaleString()} (${paymentForm.paymentType}) recorded for ${paymentProject.project.order_number}. Project is now ${statusText}.`,
        target_role: 'admin',
        read: false,
        project_id: paymentProject.project.id,
      });

      setPaymentProject(null);
      setPaymentForm({ amount: '', paymentMethod: 'UPI', paymentType: 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
      setSaving(false);
      load();
    } catch (e) {
      console.error('Add payment failed:', e);
      setSaving(false);
    }
  };

  const handleVerifyPayment = async (pp: ProjectPayment, fp: FinanceProject) => {
    setSaving(true);
    try {
      await db.verifyProjectPayment(pp.id, user?.email || 'admin');
      await db.createNotification({
        type: 'payment',
        title: 'Payment verified',
        description: `Payment of ₹${pp.amount.toLocaleString()} for ${fp.project.order_number} has been verified.`,
        target_role: 'admin',
        read: false,
        project_id: fp.project.id,
      });
      if (fp.project.customer_email) {
        await db.createNotification({
          type: 'payment',
          title: 'Your payment has been verified',
          description: `Your payment of ₹${pp.amount.toLocaleString()} for ${fp.project.event_name} has been verified by the finance team.`,
          target_role: 'customer',
          target_email: fp.project.customer_email,
          read: false,
          project_id: fp.project.id,
        });
      }
      // No auto-complete: admin must manually close the project after the bill is fully paid
      setSaving(false);
      load();
    } catch (e) {
      console.error('Verify payment failed:', e);
      setSaving(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectPayment || !rejectReason.trim()) return;
    setSaving(true);
    try {
      await db.rejectProjectPayment(rejectPayment.id, rejectReason.trim(), user?.email || 'admin');
      const fp = projects.find(p => p.projectPayments.some(pp => pp.id === rejectPayment.id));
      if (fp) {
        if (fp.project.customer_email) {
          await db.createNotification({
            type: 'payment',
            title: 'Payment requires resubmission',
            description: `Your payment of ₹${fp.projectPayments.find(pp => pp.id === rejectPayment.id)?.amount.toLocaleString() || ''} for ${fp.project.event_name} could not be verified. Reason: ${rejectReason.trim()}. Please resubmit with correct details.`,
            target_role: 'customer',
            target_email: fp.project.customer_email,
            read: false,
            project_id: fp.project.id,
          });
        }
      }
      setRejectPayment(null);
      setRejectReason('');
      setSaving(false);
      load();
    } catch (e) {
      console.error('Reject payment failed:', e);
      setSaving(false);
    }
  };

  const handleMarkAllPaid = async () => {
    if (!markPaidProject) return;
    setMarkPaidUploading(true);
    try {
      let proofUrl: string | undefined;
      if (markPaidProof) {
        proofUrl = await db.uploadPaymentProof(markPaidProject.project.id, markPaidProof) || undefined;
      }
      await db.markSplitsPaidByProject(markPaidProject.project.id, proofUrl);
      await db.createNotification({
        type: 'payment',
        title: 'Employee splits marked as paid',
        description: `All pending splits for ${markPaidProject.project.order_number} have been marked as paid${proofUrl ? ' with payment proof' : ''}.`,
        target_role: 'admin',
        read: false,
        project_id: markPaidProject.project.id,
      });
      for (const split of markPaidProject.splits.filter(s => s.status !== 'paid')) {
        let editorEmail: string | undefined;
        if (split.employee_id) {
          const profile = await db.fetchProfile(split.employee_id);
          editorEmail = profile?.email || undefined;
        }
        await db.createNotification({
          type: 'payment-received',
          title: 'Earning marked as paid',
          description: `₹${split.amount.toLocaleString()} for task "${split.task_name}" on ${markPaidProject.project.order_number} has been marked as paid.`,
          target_role: 'editor',
          target_email: editorEmail || null,
          read: false,
          project_id: markPaidProject.project.id,
        });
      }
      setMarkPaidProject(null);
      setMarkPaidProof(null);
      load();
    } catch (e) {
      console.error('Mark all paid failed:', e);
    } finally {
      setMarkPaidUploading(false);
    }
  };

  const handleSaveSplits = async () => {
    if (!splitProject) return;
    const invAmt = getInvoiceAmount(splitProject);
    const splitTotal = Object.values(splitAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    if (invAmt > 0 && splitTotal > invAmt) {
      alert(`Total split amount (₹${splitTotal.toLocaleString()}) exceeds invoice amount (₹${invAmt.toLocaleString()}). Please adjust.`);
      return;
    }
    await db.deletePaymentSplits(splitProject.project.id);
    const splits: Partial<PaymentSplit>[] = [];
    for (const task of splitProject.tasks) {
      if (!task.assigned_to) continue;
      const amt = parseFloat(splitAmounts[task.id] || '0');
      if (amt > 0) {
        splits.push({
          project_id: splitProject.project.id,
          task_id: task.id,
          employee_id: task.assigned_to,
          employee_name: task.assigned_to_name || null,
          task_name: task.task_name,
          amount: amt,
          status: 'pending',
        });
      }
    }
    if (splits.length > 0) await db.createPaymentSplits(splits);
    setSplitProject(null);
    setSplitAmounts({});
    load();
  };

  const handleProcessPayout = async (req: PayoutRequest) => {
    setSaving(true);
    try {
      for (const splitId of req.split_ids) {
        await db.markSplitPaid(splitId);
      }
      await db.processPayoutRequest(req.id);
      let employeeEmail: string | undefined;
      if (req.employee_id) {
        const profile = await db.fetchProfile(req.employee_id);
        employeeEmail = profile?.email || undefined;
      }
      await db.createNotification({
        type: 'payment-received',
        title: 'Payout processed',
        description: `Your payout request of ₹${req.total_amount.toLocaleString()} for ${req.split_ids.length} task${req.split_ids.length !== 1 ? 's' : ''} has been processed and marked as paid.`,
        target_role: 'editor',
        target_email: employeeEmail || null,
        read: false,
      });
      setSaving(false);
      load();
    } catch (e) {
      console.error('Process payout failed:', e);
      setSaving(false);
    }
  };

  const handleRejectPayout = async () => {
    if (!rejectPayout || !rejectPayoutReason.trim()) return;
    setSaving(true);
    try {
      await db.rejectPayoutRequest(rejectPayout.id, rejectPayoutReason.trim());
      let employeeEmail: string | undefined;
      if (rejectPayout.employee_id) {
        const profile = await db.fetchProfile(rejectPayout.employee_id);
        employeeEmail = profile?.email || undefined;
      }
      await db.createNotification({
        type: 'payment',
        title: 'Payout request rejected',
        description: `Your payout request of ₹${rejectPayout.total_amount.toLocaleString()} was rejected. Reason: ${rejectPayoutReason.trim()}`,
        target_role: 'editor',
        target_email: employeeEmail || null,
        read: false,
      });
      setRejectPayout(null);
      setRejectPayoutReason('');
      setSaving(false);
      load();
    } catch (e) {
      console.error('Reject payout failed:', e);
      setSaving(false);
    }
  };

  const pendingPayoutRequests = payoutRequests.filter((r) => r.status === 'requested');

  const billingTabs = [
    { key: 'projects' as const, label: 'All Projects', count: allActiveProjects.length },
    { key: 'invoice' as const, label: 'Raise Bill', count: needsInvoice.length },
    { key: 'pending' as const, label: 'Pending Payment', count: pendingPayment.length },
    { key: 'verification' as const, label: 'Payment Verification', count: pendingVerification.length },
    { key: 'completed' as const, label: 'Completed', count: fullyPaid.length },
  ];
  const payoutTabs = [
    { key: 'splits' as const, label: 'Employee Splits', count: hasSplits.length },
    { key: 'payouts' as const, label: 'Payout Requests', count: pendingPayoutRequests.length },
  ];
  const handleTabWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY !== 0) event.currentTarget.scrollLeft += event.deltaY;
  };

  if (loading) return <FullPageSpinner />;

  const invoiceTypeBadge: Record<string, { label: string; cls: string }> = {
    estimate: { label: 'Estimate', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400' },
    final: { label: 'Final Invoice', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
  };

  const paymentStatusBadge: Record<string, { label: string; cls: string }> = {
    pending_verification: { label: 'Pending Verification', cls: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' },
    verified: { label: 'Verified', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
    rejected: { label: 'Rejected', cls: 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' },
  };

  const canRaiseFinalInvoice = (fp: FinanceProject) => {
    return fp.invoice?.invoice_type === 'estimate' && (fp.project.status === 'correction_approved' || fp.project.status === 'completed');
  };

  const canCloseProject = (fp: FinanceProject) => {
    if (!fp.invoice || getBalance(fp) > 0 || getVerifiedPaid(fp) <= 0) return false;
    if (fp.project.status !== 'correction_approved' && fp.project.status !== 'invoiced') return false;
    return fp.invoice.invoice_type === 'final' || fp.invoice.invoice_type === 'estimate';
  };

  const handleRequestPayment = async (fp: FinanceProject) => {
    const balance = getBalance(fp);
    if (balance <= 0 || !fp.invoice) return;
    setSaving(true);
    try {
      const invoiceLabel = fp.invoice.invoice_type === 'final' ? 'final invoice' : 'estimate';
      await db.createNotification({
        type: 'payment',
        title: 'Payment reminder',
        description: `This is a friendly reminder that your ${invoiceLabel} for ${fp.project.event_name} (${fp.project.order_number}) has an outstanding balance of ₹${balance.toLocaleString()}. Please make the payment at your earliest convenience. You can pay from your Orders page.`,
        target_role: 'customer',
        target_email: fp.project.customer_email || null,
        read: false,
        project_id: fp.project.id,
      });
      await db.createNotification({
        type: 'payment',
        title: 'Payment request sent',
        description: `Payment request sent to ${fp.project.customer_name} for ${fp.project.order_number}. Outstanding balance: ₹${balance.toLocaleString()}.`,
        target_role: 'admin',
        read: false,
        project_id: fp.project.id,
      });
      setSaving(false);
      load();
    } catch (e) {
      console.error('Request payment failed:', e);
      setSaving(false);
    }
  };

  const handleCloseProject = async () => {
    if (!closeProjectFp) return;
    const fp = closeProjectFp;
    setSaving(true);
    try {
      const updates: Partial<db.Project> = {};
      if (closeOutputLink.trim()) {
        updates.download_links = closeOutputLink.trim();
      }
      if (Object.keys(updates).length > 0) {
        await supabase!.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', fp.project.id);
      }
      await db.transitionProjectStatus(fp.project.id, 'completed');
      await db.ensureRatingRequestForProject(fp.project.id, fp.project.customer_email || '', fp.project.customer_id || null);
      const fileLinksText = closeOutputLink.trim()
        ? ` Your original files are ready for download: ${closeOutputLink.trim()}`
        : (fp.project.download_links?.trim() ? ` Your original files are ready for download: ${fp.project.download_links.trim()}` : '');
      await db.createNotification({
        type: 'project',
        title: 'Project completed — original files ready',
        description: `Project has been marked as completed.${fileLinksText} We'd love your feedback — tap "Give Feedback" to share your experience.`,
        target_role: 'customer',
        target_email: fp.project.customer_email || null,
        read: false,
        project_id: fp.project.id,
      });
      await db.sendStatusEmail({
        templateName: 'project_approved',
        recipient: fp.project.customer_email,
        recipientName: fp.project.customer_name,
        variables: {
          customer_name: fp.project.customer_name || 'there',
          project_name: fp.project.event_name || '',
          order_number: fp.project.order_number || '',
        },
      });
      await db.sendStatusEmail({
        templateName: 'rating_request',
        recipient: fp.project.customer_email,
        recipientName: fp.project.customer_name,
        variables: {
          customer_name: fp.project.customer_name || 'there',
          project_name: fp.project.event_name || '',
          rating_link: `${window.location.origin}/#review/${fp.project.id}`,
        },
      });
      await db.createNotification({
        type: 'project',
        title: 'Project status changed to completed',
        description: `${fp.project.event_name} (${fp.project.order_number}) marked as completed by ${user?.email || 'admin'}.`,
        target_role: 'admin',
        read: false,
        project_id: fp.project.id,
      });
      setCloseProjectFp(null);
      setCloseOutputLink('');
      setSaving(false);
      load();
    } catch (e) {
      console.error('Close project failed:', e);
      setSaving(false);
    }
  };

  const ProjectFinanceRow = ({ fp }: { fp: FinanceProject }) => {
    const [showHistory, setShowHistory] = useState(true);
    const invAmt = getInvoiceAmount(fp);
    const paid = getVerifiedPaid(fp);
    const pending = getPendingVerification(fp);
    const balance = getBalance(fp);
    const status = getStatus(fp);
    const inv = fp.invoice;
    const isEstimate = inv?.invoice_type === 'estimate';
    return (
      <Card className="animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
              <p className="text-xs text-ink-400">{fp.project.order_number} · {fp.project.customer_name}</p>
              {inv && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${invoiceTypeBadge[inv.invoice_type]?.cls}`}>{invoiceTypeBadge[inv.invoice_type]?.label}</span>
                  {inv.sent_at && <span className="text-[10px] text-ink-400">{new Date(inv.sent_at).toLocaleDateString()}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <p className="text-xs text-ink-400">{isEstimate ? 'Estimate' : 'Invoice'}</p>
              <p className="text-sm font-bold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400">Verified Paid</p>
              <p className="text-sm font-bold text-success-600 dark:text-success-400">₹{paid.toLocaleString()}</p>
            </div>
            {pending > 0 && (
              <div className="text-right">
                <p className="text-xs text-ink-400">Pending</p>
                <p className="text-sm font-bold text-warning-600 dark:text-warning-400">₹{pending.toLocaleString()}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs text-ink-400">Balance</p>
              <p className="text-sm font-bold text-error-600 dark:text-error-400">₹{balance.toLocaleString()}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>
            {inv && (
              <>
                {canRaiseFinalInvoice(fp) && (
                  <Button variant="success" size="sm" icon={<FileCheck2 className="w-3.5 h-3.5" />} onClick={() => handleRaiseFinalInvoice(fp)} disabled={saving}>Raise Final Invoice</Button>
                )}
                {canCloseProject(fp) && (
                  <Button variant="success" size="sm" icon={<Lock className="w-3.5 h-3.5" />} onClick={() => { setCloseProjectFp(fp); setCloseOutputLink(fp.project.download_links || ''); }} disabled={saving}>Close Project</Button>
                )}
                <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
                  setPaymentProject(fp);
                  setPaymentForm({ amount: '', paymentMethod: 'UPI', paymentType: balance > 0 ? 'Partial' : 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
                }}>Add Payment</Button>
                {balance > 0 && fp.project.customer_email && (
                  <Button variant="ghost" size="sm" icon={<Bell className="w-3.5 h-3.5" />} onClick={() => handleRequestPayment(fp)} disabled={saving}>Request Payment</Button>
                )}
                <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => {
                  setEditInvoiceProject(fp);
                  setEditInvoiceForm({ amount: String(inv.current_amount), reason: '' });
                }}>Edit</Button>
                <Button variant="ghost" size="sm" icon={<History className="w-3.5 h-3.5" />} onClick={() => setHistoryProject(fp)}>History</Button>
              </>
            )}
          </div>
        </div>
        {fp.projectPayments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs font-semibold text-ink-400 mb-2 flex items-center gap-1 hover:text-ink-600 dark:hover:text-ink-200 transition-colors">
              Payment History ({fp.projectPayments.length})
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showHistory && (
            <div className="space-y-1.5">
              {fp.projectPayments.map((pp) => (
                <div key={pp.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span className="font-medium text-ink-700 dark:text-ink-200">₹{pp.amount.toLocaleString()}</span>
                    <span className="text-xs text-ink-400">{pp.payment_type} · {pp.payment_method}</span>
                    {pp.transaction_reference && <span className="text-xs text-ink-400">· Ref: {pp.transaction_reference}</span>}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadge[pp.status]?.cls}`}>{paymentStatusBadge[pp.status]?.label}</span>
                    {pp.status === 'pending_verification' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleVerifyPayment(pp, fp)} disabled={saving} className="text-xs text-success-600 hover:underline font-medium">Verify</button>
                        <button onClick={() => setRejectPayment({ id: pp.id, projectName: fp.project.event_name })} disabled={saving} className="text-xs text-error-600 hover:underline font-medium">Reject</button>
                      </div>
                    )}
                    {pp.status === 'rejected' && pp.rejection_reason && (
                      <span className="text-xs text-error-500">Reason: {pp.rejection_reason}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {pp.payment_proof && <a href={pp.payment_proof} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Proof</a>}
                    <span className="text-xs text-ink-400" title={`Recorded ${new Date(pp.created_at).toLocaleString()}`}>{new Date(pp.payment_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="flex flex-col space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', onClick: () => onNavigate('admin-dashboard') }, { label: 'Finance' }]} />

      <div className="relative rounded-2xl overflow-hidden shimmer-sweep animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-success-500 via-emerald-500 to-teal-500" />
        <div className="absolute inset-0 aurora-bg opacity-60" />
        <div className="absolute inset-0 bg-dot-grid opacity-20" />
        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Finance Overview</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">₹{totalRevenue.toLocaleString()}</h2>
            <p className="text-sm text-white/80">Total verified revenue from {fullyPaid.length} fully paid project{fullyPaid.length !== 1 ? 's' : ''}.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col items-center gap-1 px-4 py-4 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex-1 min-w-0">
              <FileText className="w-5 h-5 text-white/70" />
              <span className="text-2xl font-bold text-white">{needsInvoice.length}</span>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">To Invoice</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-4 py-4 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex-1 min-w-0">
              <ShieldCheck className="w-5 h-5 text-white/70" />
              <span className="text-2xl font-bold text-white">{pendingVerification.length}</span>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">To Verify</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard label="Verified Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={<IndianRupee className="w-5 h-5" />} color="success" />
        <StatCard label="Total Invoiced" value={`₹${totalInvoiceAmount.toLocaleString()}`} icon={<FileText className="w-5 h-5" />} color="primary" />
        <StatCard label="Pending Verification" value={`₹${totalPendingVerification.toLocaleString()}`} icon={<ShieldCheck className="w-5 h-5" />} color="warning" />
        <StatCard label="Outstanding Balance" value={`₹${totalOutstanding.toLocaleString()}`} icon={<Clock className="w-5 h-5" />} color="error" />
      </div>

      {/* Billing section */}
      <div className="order-1">
        <h3 className="text-sm font-semibold text-ink-500 dark:text-ink-400 mb-2 px-1">Billing</h3>
        <div className="finance-tab-scroll flex items-center gap-1 bg-ink-50 dark:bg-ink-800/50 rounded-xl p-1 overflow-x-auto flex-nowrap" style={{ flexWrap: 'nowrap' }} onWheel={handleTabWheel}>
          {billingTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${tab === t.key ? 'bg-primary-500 text-white shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
            >
              {t.label}
              {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-ink-200 dark:bg-ink-600'}`}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Payouts section */}
      <div className="order-3">
        <h3 className="text-sm font-semibold text-ink-500 dark:text-ink-400 mb-2 px-1">Employee Payouts</h3>
        <div className="finance-tab-scroll flex items-center gap-1 bg-ink-50 dark:bg-ink-800/50 rounded-xl p-1 overflow-x-auto flex-nowrap" style={{ flexWrap: 'nowrap' }} onWheel={handleTabWheel}>
          {payoutTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${tab === t.key ? 'bg-success-500 text-white shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
            >
              {t.label}
              {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-ink-200 dark:bg-ink-600'}`}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'invoice' && (
        <div className="order-2 space-y-3">
          {needsInvoice.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No projects waiting for estimates. Projects appear here once they are created.</p></Card>
          ) : needsInvoice.map((fp) => (
            <Card key={fp.project.id} className="animate-slide-up">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
                    <p className="text-xs text-ink-400">{fp.project.order_number} · {fp.project.customer_name} · {fp.project.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge status={fp.project.status} />
                  <span className="text-lg font-bold text-success-600 dark:text-success-400">₹{(fp.project.amount || 0).toLocaleString()}</span>
                  <Button variant="primary" size="sm" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => {
                    setInvoiceProject(fp);
                    setInvoiceForm({ amount: String(fp.project.amount || 0), notes: '', invoiceType: 'estimate' });
                  }}>Create Estimate</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'verification' && (
        <div className="order-2 space-y-3">
          {pendingVerification.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No payments waiting for verification. Client-submitted payments will appear here.</p></Card>
          ) : pendingVerification.map((fp) => {
            const pendingPays = fp.projectPayments.filter(pp => pp.status === 'pending_verification');
            return (
              <Card key={fp.project.id} className="animate-slide-up">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 flex items-center justify-center text-warning-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
                    <p className="text-xs text-ink-400">{fp.project.order_number} · {fp.project.customer_name}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingPays.map((pp) => (
                    <div key={pp.id} className="p-3 rounded-xl border border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-ink-800 dark:text-ink-100">₹{pp.amount.toLocaleString()}</span>
                          <span className="text-xs text-ink-500 dark:text-ink-400">{pp.payment_method} · {new Date(pp.payment_date).toLocaleDateString()}</span>
                          {pp.transaction_reference && <span className="text-xs text-ink-400">Ref: {pp.transaction_reference}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {pp.payment_proof && <a href={pp.payment_proof} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1"><ImageIcon className="w-3 h-3" /> View Proof</a>}
                          <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => handleVerifyPayment(pp, fp)} disabled={saving}>Verify</Button>
                          <Button variant="error" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => setRejectPayment({ id: pp.id, projectName: fp.project.event_name })} disabled={saving}>Reject</Button>
                        </div>
                      </div>
                      {pp.notes && <p className="text-xs text-ink-400 mt-1">{pp.notes}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'estimate' && (
        <div className="order-2 space-y-3">
          {estimateInvoices.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No estimation bills yet. Create estimates from the To Invoice tab.</p></Card>
          ) : estimateInvoices.map((fp) => <ProjectFinanceRow key={fp.project.id} fp={fp} />)}
        </div>
      )}

      {tab === 'pending' && (
        <div className="order-2 space-y-3">
          {pendingPayment.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No pending payments. All invoices have been settled.</p></Card>
          ) : pendingPayment.map((fp) => <ProjectFinanceRow key={fp.project.id} fp={fp} />)}
        </div>
      )}

      {tab === 'splits' && (
        <div className="order-4 space-y-3">
          {hasSplits.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No projects with completed tasks yet. Projects appear here once a task is completed or approved.</p></Card>
          ) : hasSplits.map((fp) => {
            const allPaid = fp.splits.length > 0 && fp.splits.every(s => s.status === 'paid');
            const pendingSplits = fp.splits.filter(s => s.status !== 'paid');
            const completedTasks = fp.tasks.filter(t => t.status === 'approved' || t.status === 'completed');
            const hasNoSplits = fp.splits.length === 0;
            return (
            <Card key={fp.project.id} className="animate-slide-up">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
                    <p className="text-xs text-ink-400">{fp.project.order_number} · {hasNoSplits ? `${completedTasks.length} completed task${completedTasks.length !== 1 ? 's' : ''} · No splits yet` : `${fp.splits.length} split${fp.splits.length !== 1 ? 's' : ''} · ${allPaid ? 'All paid' : `${pendingSplits.length} pending`}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!hasNoSplits && !allPaid && (
                    <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => {
                      setMarkPaidProject(fp);
                      setMarkPaidProof(null);
                    }}>Mark All Paid</Button>
                  )}
                  <Button variant={hasNoSplits ? "primary" : "outline"} size="sm" icon={<Wallet className="w-3.5 h-3.5" />} onClick={() => {
                    setSplitProject(fp);
                    const amts: Record<string, string> = {};
                    fp.splits.forEach(s => { if (s.task_id) amts[s.task_id] = String(s.amount); });
                    setSplitAmounts(amts);
                  }}>{hasNoSplits ? 'Create Splits' : 'Manage Splits'}</Button>
                </div>
              </div>
              {hasNoSplits ? (
                <div className="space-y-1.5">
                  {completedTasks.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-ink-600 dark:text-ink-300 break-words">{t.task_name}</span>
                        <span className="text-xs text-ink-400">{t.assigned_to_name || 'Unassigned'}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400">{t.status}</span>
                      </div>
                      <span className="text-xs text-ink-400">Ready for split</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {fp.splits.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-ink-600 dark:text-ink-300 break-words">{s.task_name || '—'} · {s.employee_name || '—'}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.status === 'paid' ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400'}`}>{s.status === 'paid' ? 'Paid' : 'Pending'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-success-600 dark:text-success-400">₹{s.amount.toLocaleString()}</span>
                        {s.status !== 'paid' && (
                          <button onClick={async () => {
                            await db.markSplitPaid(s.id);
                            const split = fp.splits.find(sp => sp.id === s.id);
                            let employeeEmail: string | undefined;
                            if (split?.employee_id) {
                              const profile = await db.fetchProfile(split.employee_id);
                              employeeEmail = profile?.email || undefined;
                            }
                            await db.createNotification({
                              type: 'payment-received',
                              title: 'Earning marked as paid',
                              description: `₹${s.amount.toLocaleString()} for task "${s.task_name}" on ${fp.project.order_number} has been marked as paid.`,
                              target_role: 'editor',
                              target_email: employeeEmail,
                              read: false,
                              project_id: fp.project.id,
                            });
                            load();
                          }} className="text-xs text-success-600 hover:underline font-medium">Mark Paid</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="order-4 space-y-3">
          {payoutRequests.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No payout requests yet. Editors can request payouts from their Earnings page.</p></Card>
          ) : payoutRequests.map((req) => (
            <Card key={req.id} className="animate-slide-up">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
                    <HandCoins className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 dark:text-ink-100">{req.employee_name || 'Unknown'}</p>
                    <p className="text-xs text-ink-400">{req.split_ids.length} task{req.split_ids.length !== 1 ? 's' : ''} · Requested {new Date(req.requested_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-right">
                    <p className="text-xs text-ink-400">Amount</p>
                    <p className="text-sm font-bold text-success-600 dark:text-success-400">₹{req.total_amount.toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${req.status === 'requested' ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' : req.status === 'processed' ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400'}`}>
                    {req.status === 'requested' ? 'Requested' : req.status === 'processed' ? 'Processed' : 'Rejected'}
                  </span>
                  {req.status === 'requested' && (
                    <div className="flex items-center gap-2">
                      <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => handleProcessPayout(req)} disabled={saving}>Process Payout</Button>
                      <Button variant="error" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => { setRejectPayout(req); setRejectPayoutReason(''); }} disabled={saving}>Reject</Button>
                    </div>
                  )}
                  {req.status === 'processed' && req.processed_at && (
                    <span className="text-xs text-ink-400">Processed {new Date(req.processed_at).toLocaleDateString()}</span>
                  )}
                  {req.status === 'rejected' && req.notes && (
                    <span className="text-xs text-error-500">Reason: {req.notes}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'completed' && (
        <div className="order-2 space-y-3">
          {fullyPaid.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No fully paid projects yet.</p></Card>
          ) : fullyPaid.map((fp) => <ProjectFinanceRow key={fp.project.id} fp={fp} />)}
        </div>
      )}

      {tab === 'projects' && (
        <div className="order-2 space-y-3">
          {allActiveProjects.length === 0 ? (
            <Card><p className="text-sm text-ink-400 text-center py-8">No active projects yet.</p></Card>
          ) : allActiveProjects.map((fp) => {
            const invAmt = getInvoiceAmount(fp);
            const paid = getVerifiedPaid(fp);
            const balance = getBalance(fp);
            const status = getStatus(fp);
            return (
              <Card key={fp.project.id} className="animate-slide-up">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
                      <p className="text-xs text-ink-400">{fp.project.order_number} · {fp.project.customer_name} · <Badge status={fp.project.status} /></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <p className="text-xs text-ink-400">Quoted</p>
                      <p className="text-sm font-bold text-ink-700 dark:text-ink-200">₹{(fp.project.amount || 0).toLocaleString()}</p>
                    </div>
                    {fp.invoice ? (
                      <>
                        <div className="text-right">
                          <p className="text-xs text-ink-400">Invoice</p>
                          <p className="text-sm font-bold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-400">Paid</p>
                          <p className="text-sm font-bold text-success-600 dark:text-success-400">₹{paid.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-400">Balance</p>
                          <p className="text-sm font-bold text-error-600 dark:text-error-400">₹{balance.toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusBadgeColor[status]}`}>{status}</span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">No estimate yet</span>
                    )}
                    <div className="flex items-center gap-2">
                      {!fp.invoice && !excludedStatuses.includes(fp.project.status) && (
                        <Button variant="primary" size="sm" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => {
                          setInvoiceProject(fp);
                          setInvoiceForm({ amount: String(fp.project.amount || 0), notes: '', invoiceType: 'estimate' });
                        }}>Create Estimate</Button>
                      )}
                      {fp.invoice && (
                        <>
                          {canCloseProject(fp) && (
                            <Button variant="success" size="sm" icon={<Lock className="w-3.5 h-3.5" />} onClick={() => { setCloseProjectFp(fp); setCloseOutputLink(fp.project.download_links || ''); }} disabled={saving}>Close Project</Button>
                          )}
                          <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
                            setPaymentProject(fp);
                            setPaymentForm({ amount: '', paymentMethod: 'UPI', paymentType: balance > 0 ? 'Partial' : 'Advance', transactionRef: '', notes: '', paymentDate: new Date().toISOString().slice(0, 10) });
                          }}>Add Payment</Button>
                          {balance > 0 && fp.project.customer_email && (
                            <Button variant="ghost" size="sm" icon={<Bell className="w-3.5 h-3.5" />} onClick={() => handleRequestPayment(fp)} disabled={saving}>Request Payment</Button>
                          )}
                          <Button variant="ghost" size="sm" icon={<History className="w-3.5 h-3.5" />} onClick={() => setHistoryProject(fp)}>History</Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onNavigate('project-details', { id: fp.project.id })}>View</Button>
                    </div>
                  </div>
                </div>
                {fp.projectPayments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
                    <p className="text-xs font-semibold text-ink-400 mb-2">Recent Payments ({fp.projectPayments.length})</p>
                    <div className="space-y-1.5">
                      {fp.projectPayments.slice(0, 3).map((pp) => (
                        <div key={pp.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1.5 px-3 rounded-lg bg-ink-50 dark:bg-ink-800/50">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-ink-700 dark:text-ink-200">₹{pp.amount.toLocaleString()}</span>
                            <span className="text-xs text-ink-400">{pp.payment_type} · {pp.payment_method}</span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadge[pp.status]?.cls}`}>{paymentStatusBadge[pp.status]?.label}</span>
                          </div>
                          <span className="text-xs text-ink-400">{new Date(pp.payment_date).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      <Modal open={!!invoiceProject} onClose={() => setInvoiceProject(null)} title="Create Estimate or Final Invoice" size="md">
        {invoiceProject && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{invoiceProject.project.event_name}</p>
              <p className="text-xs text-ink-400 mt-1">{invoiceProject.project.order_number} · {invoiceProject.project.customer_name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Type *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setInvoiceForm({ ...invoiceForm, invoiceType: 'estimate' })} className={`p-3 rounded-xl border-2 text-left transition-colors ${invoiceForm.invoiceType === 'estimate' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/15' : 'border-ink-200 dark:border-ink-700'}`}>
                  <FileText className="w-4 h-4 mb-1 text-primary-500" />
                  <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Estimate</p>
                  <p className="text-xs text-ink-400">Client can view and pay anytime</p>
                </button>
                <button type="button" onClick={() => setInvoiceForm({ ...invoiceForm, invoiceType: 'final' })} className={`p-3 rounded-xl border-2 text-left transition-colors ${invoiceForm.invoiceType === 'final' ? 'border-success-500 bg-success-50 dark:bg-success-500/15' : 'border-ink-200 dark:border-ink-700'}`}>
                  <Receipt className="w-4 h-4 mb-1 text-success-500" />
                  <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">Final Invoice</p>
                  <p className="text-xs text-ink-400">After client approves work</p>
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">{invoiceForm.invoiceType === 'estimate' ? 'Estimated' : 'Invoice'} Amount (₹) *</label>
              <input type="number" className="input" placeholder="e.g. 50000" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Notes (optional)</label>
              <textarea className="input" rows={2} placeholder="Any notes about this bill..." value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
              {invoiceForm.invoiceType === 'estimate'
                ? 'The client can view this estimate and make payments at any time. No client approval is required. You can revise the amount later.'
                : 'A final invoice is raised after the client approves the completed work. Previous verified payments are automatically deducted from the balance.'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setInvoiceProject(null)}>Cancel</Button>
              <Button variant="success" size="sm" icon={invoiceForm.invoiceType === 'estimate' ? <FileText className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />} onClick={handleCreateInvoice} disabled={!invoiceForm.amount || saving}>{saving ? 'Creating...' : invoiceForm.invoiceType === 'estimate' ? 'Create Estimate' : 'Create Final Invoice'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={!!editInvoiceProject} onClose={() => setEditInvoiceProject(null)} title="Revise Estimate Amount" size="md">
        {editInvoiceProject && editInvoiceProject.invoice && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                  <p className="font-semibold text-ink-800 dark:text-ink-100">{editInvoiceProject.project.event_name}</p>
                  <p className="text-xs text-ink-400 mt-1">{editInvoiceProject.project.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Invoice #{editInvoiceProject.invoice.invoice_number}</p>
                  <p className="text-xs text-ink-400">Original: ₹{editInvoiceProject.invoice.original_amount.toLocaleString()}</p>
                  <p className="text-xs text-ink-400">Current: ₹{editInvoiceProject.invoice.current_amount.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Verified Paid (preserved)</label>
                <div className="input bg-ink-50 dark:bg-ink-800/50 text-success-600 dark:text-success-400 font-semibold">₹{getVerifiedPaid(editInvoiceProject).toLocaleString()}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Balance</label>
                <div className="input bg-ink-50 dark:bg-ink-800/50 text-error-600 dark:text-error-400 font-semibold">₹{(parseFloat(editInvoiceForm.amount || '0') - getVerifiedPaid(editInvoiceProject)).toLocaleString()}</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">New Amount (₹) *</label>
              <input type="number" className="input" placeholder="e.g. 60000" value={editInvoiceForm.amount} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Reason for Change *</label>
              <input className="input" placeholder="e.g. Additional work requested" value={editInvoiceForm.reason} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, reason: e.target.value })} />
            </div>
            <p className="text-sm text-warning-600 dark:text-warning-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Changing the amount does NOT affect existing verified payments. The previous amount is saved in revision history.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditInvoiceProject(null)}>Cancel</Button>
              <Button variant="primary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={handleEditInvoice} disabled={!editInvoiceForm.amount || !editInvoiceForm.reason.trim() || saving}>{saving ? 'Saving...' : 'Revise Estimate'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Payment Modal */}
      <Modal open={!!paymentProject} onClose={() => setPaymentProject(null)} title="Add Payment (Auto-Verified)" size="md">
        {paymentProject && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                  <p className="font-semibold text-ink-800 dark:text-ink-100">{paymentProject.project.event_name}</p>
                  <p className="text-xs text-ink-400 mt-1">{paymentProject.project.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Invoice: ₹{getInvoiceAmount(paymentProject).toLocaleString()}</p>
                  <p className="text-xs text-ink-400">Verified Paid: ₹{getVerifiedPaid(paymentProject).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-error-600">Balance: ₹{getBalance(paymentProject).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Amount (₹) *</label>
                <input type="number" className="input" placeholder="e.g. 20000" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              </div>
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
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Type</label>
                <select className="input" value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}>
                  <option>Advance</option><option>Partial</option><option>Final</option><option>Full</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Transaction / Reference Number</label>
              <input className="input" placeholder="e.g. UPI123456789" value={paymentForm.transactionRef} onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Notes (optional)</label>
              <textarea className="input" rows={2} placeholder="Any notes about this payment..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
            <p className="text-xs text-ink-400">Payments added by admin are automatically marked as verified.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPaymentProject(null)}>Cancel</Button>
              <Button variant="success" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddPayment} disabled={!paymentForm.amount || saving}>{saving ? 'Adding...' : 'Add Payment'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invoice & Payment History Modal */}
      <Modal open={!!historyProject} onClose={() => setHistoryProject(null)} title="Invoice & Payment History" size="lg">
        {historyProject && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
                <p className="text-xs text-ink-400">Invoice Total</p>
                <p className="text-lg font-bold text-ink-700 dark:text-ink-200">₹{getInvoiceAmount(historyProject).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-50 dark:bg-success-500/15 text-center">
                <p className="text-xs text-success-600">Verified Paid</p>
                <p className="text-lg font-bold text-success-600 dark:text-success-400">₹{getVerifiedPaid(historyProject).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/15 text-center">
                <p className="text-xs text-error-600">Balance</p>
                <p className="text-lg font-bold text-error-600 dark:text-error-400">₹{getBalance(historyProject).toLocaleString()}</p>
              </div>
            </div>
            {historyProject.invoice && (
              <div>
                <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Invoice Details</h4>
                <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-ink-400">Invoice Number</span><span className="font-medium text-ink-700 dark:text-ink-200">{historyProject.invoice.invoice_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Original Amount</span><span className="font-medium text-ink-700 dark:text-ink-200">₹{historyProject.invoice.original_amount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Current Amount</span><span className="font-medium text-ink-700 dark:text-ink-200">₹{historyProject.invoice.current_amount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-ink-400">Created Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(historyProject.invoice.invoice_date).toLocaleDateString()}</span></div>
                </div>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Estimate Revisions ({historyProject.revisions.length})</h4>
              {historyProject.revisions.length === 0 ? (
                <p className="text-sm text-ink-400 py-3">No revisions — the amount has not been changed.</p>
              ) : (
                <div className="space-y-2">
                  {historyProject.revisions.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-ink-700 dark:text-ink-200">₹{rev.previous_amount.toLocaleString()} → ₹{rev.new_amount.toLocaleString()}</span>
                        <span className="text-xs text-ink-400">{new Date(rev.changed_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-ink-500 dark:text-ink-400">Reason: {rev.reason || 'Not specified'}</p>
                      <p className="text-xs text-ink-400">Changed by: {rev.changed_by || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Payment History ({historyProject.projectPayments.length})</h4>
              {historyProject.projectPayments.length === 0 ? (
                <p className="text-sm text-ink-400 py-3">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyProject.projectPayments.map((pp) => (
                    <div key={pp.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-success-600 dark:text-success-400">₹{pp.amount.toLocaleString()}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${paymentStatusBadge[pp.status]?.cls}`}>{paymentStatusBadge[pp.status]?.label}</span>
                          <span className="text-xs text-ink-400">{new Date(pp.payment_date).toLocaleDateString()}</span>
                          {pp.status === 'verified' && (
                            <button onClick={async () => {
                              if (!confirm('Delete this payment record? This cannot be undone.')) return;
                              await db.deleteProjectPayment(pp.id);
                              load();
                              setHistoryProject(null);
                            }} className="text-xs text-error-600 hover:underline font-medium">Delete</button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                        <span>{pp.payment_type}</span>
                        <span>· {pp.payment_method}</span>
                        {pp.transaction_reference && <span>· Ref: {pp.transaction_reference}</span>}
                      </div>
                      {pp.payment_proof && <a href={pp.payment_proof} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"><ImageIcon className="w-3 h-3" /> View proof</a>}
                      {pp.notes && <p className="text-xs text-ink-400 mt-1">{pp.notes}</p>}
                      {pp.status === 'rejected' && pp.rejection_reason && <p className="text-xs text-error-500 mt-1">Rejection reason: {pp.rejection_reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Payment Modal */}
      <Modal open={!!rejectPayment} onClose={() => { setRejectPayment(null); setRejectReason(''); }} title="Reject Payment" size="sm">
        {rejectPayment && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500 dark:text-ink-400">Provide a reason for rejecting this payment for <span className="font-semibold">{rejectPayment.projectName}</span>. The client will see this reason and can resubmit.</p>
            <textarea className="input" rows={3} placeholder="e.g. Transaction not found, amount mismatch..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setRejectPayment(null); setRejectReason(''); }}>Cancel</Button>
              <Button variant="error" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={handleRejectPayment} disabled={!rejectReason.trim() || saving}>{saving ? 'Rejecting...' : 'Reject Payment'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Split Modal */}
      <Modal open={!!splitProject} onClose={() => setSplitProject(null)} title="Manage Employee Splits" size="md">
        {splitProject && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500 dark:text-ink-400">Allocate payment amounts to each assigned task. The employee will see these amounts in their Earnings page.</p>
            {splitProject.tasks.filter(t => t.assigned_to).length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-4">No assigned tasks for this project.</p>
            ) : (
              <div className="space-y-3">
                {splitProject.tasks.filter(t => t.assigned_to).map((task) => (
                  <div key={task.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{task.task_name}</p>
                      <p className="text-xs text-ink-400">{task.assigned_to_name || '—'}</p>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">₹</span>
                        <input type="number" className="input pl-7" placeholder="0" value={splitAmounts[task.id] || ''} onChange={(e) => setSplitAmounts({ ...splitAmounts, [task.id]: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <span className="text-ink-500 dark:text-ink-400 font-medium">Total Splits</span>
              <div className="flex items-center gap-3">
                <span className="font-bold text-ink-700 dark:text-ink-200">₹{Object.values(splitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0).toLocaleString()}</span>
                <span className="text-xs text-ink-400">of ₹{getInvoiceAmount(splitProject).toLocaleString()} invoice</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setSplitProject(null)}>Cancel</Button>
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleSaveSplits}>Save Splits</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mark All Paid Modal */}
      <Modal open={!!markPaidProject} onClose={() => { setMarkPaidProject(null); setMarkPaidProof(null); }} title="Mark All Splits as Paid" size="md">
        {markPaidProject && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
              <p className="font-semibold text-ink-800 dark:text-ink-100">{markPaidProject.project.event_name}</p>
              <p className="text-xs text-ink-400 mt-1">{markPaidProject.project.order_number} · {markPaidProject.splits.filter(s => s.status !== 'paid').length} pending split(s)</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Payment Screenshot (optional)</label>
              <p className="text-xs text-ink-400 mb-2">Upload a screenshot of the payment transaction for record-keeping.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setMarkPaidProof(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ink-500 dark:text-ink-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-500/20 dark:file:text-primary-400 hover:file:bg-primary-100 dark:hover:file:bg-primary-500/30 cursor-pointer"
              />
              {markPaidProof && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30">
                  <ImageIcon className="w-4 h-4 text-success-600" />
                  <span className="text-xs text-success-700 dark:text-success-400 truncate min-w-0">{markPaidProof.name}</span>
                  <button onClick={() => setMarkPaidProof(null)} className="ml-auto text-ink-400 hover:text-error-500"><XCircle className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
              All pending splits for this project will be marked as paid. Employees will be notified.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setMarkPaidProject(null); setMarkPaidProof(null); }}>Cancel</Button>
              <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={handleMarkAllPaid} disabled={markPaidUploading}>{markPaidUploading ? 'Processing...' : 'Mark All Paid'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Payout Modal */}
      <Modal open={!!rejectPayout} onClose={() => { setRejectPayout(null); setRejectPayoutReason(''); }} title="Reject Payout Request" size="sm">
        {rejectPayout && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500 dark:text-ink-400">Provide a reason for rejecting this payout request from <span className="font-semibold">{rejectPayout.employee_name}</span> for ₹{rejectPayout.total_amount.toLocaleString()}. The employee will be notified.</p>
            <textarea className="input" rows={3} placeholder="e.g. Payment already processed separately, amount mismatch..." value={rejectPayoutReason} onChange={(e) => setRejectPayoutReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setRejectPayout(null); setRejectPayoutReason(''); }}>Cancel</Button>
              <Button variant="error" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={handleRejectPayout} disabled={!rejectPayoutReason.trim() || saving}>{saving ? 'Rejecting...' : 'Reject Payout'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close Project Modal */}
      <Modal open={!!closeProjectFp} onClose={() => { setCloseProjectFp(null); setCloseOutputLink(''); }} title="Close Project" size="md">
        {closeProjectFp && (() => {
          const fp = closeProjectFp;
          const invAmt = getInvoiceAmount(fp);
          const paid = getVerifiedPaid(fp);
          const balance = getBalance(fp);
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                <p className="text-sm text-ink-500 dark:text-ink-400">Project</p>
                <p className="font-semibold text-ink-800 dark:text-ink-100">{fp.project.event_name}</p>
                <p className="text-xs text-ink-400 mt-1">{fp.project.order_number} · {fp.project.customer_name}</p>
              </div>
              <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/15 border border-success-200 dark:border-success-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-success-600" />
                  <span className="text-sm font-semibold text-success-700 dark:text-success-400">{fp.invoice?.invoice_type === 'final' ? 'Final Bill Settled' : 'Estimate Fully Paid'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-ink-400">{fp.invoice?.invoice_type === 'final' ? 'Final Invoice' : 'Estimate'}</p>
                    <p className="text-sm font-bold text-ink-700 dark:text-ink-200">₹{invAmt.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400">Verified Paid</p>
                    <p className="text-sm font-bold text-success-600">₹{paid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400">Balance</p>
                    <p className="text-sm font-bold text-success-600">₹{balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5 block">Output Download Link</label>
                <input className="input" placeholder="e.g. https://drive.google.com/..." value={closeOutputLink} onChange={(e) => setCloseOutputLink(e.target.value)} />
                <p className="text-xs text-ink-400 mt-1">This link will be shown to the customer as an "Output" button on their project page so they can download the final files.</p>
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
                Closing this project will mark it as completed, send the output link to the customer, and request their feedback. This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setCloseProjectFp(null); setCloseOutputLink(''); }}>Cancel</Button>
                <Button variant="success" size="sm" icon={<Lock className="w-3.5 h-3.5" />} onClick={handleCloseProject} disabled={saving}>{saving ? 'Closing...' : 'Close Project'}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
