import { useState, useEffect, useRef } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';
import { Receipt, Upload, CheckCircle2, Clock, Landmark, Smartphone, Copy, Image as ImageIcon, DollarSign, AlertCircle, IndianRupee, ChevronDown, ChevronUp } from 'lucide-react';
import * as db from '../data/db';
import type { Project, Invoice, ProjectPayment, BankDetails } from '../data/db';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';
import type { PageKey } from '../components/Layout';
import { sumVerifiedPaid, sumPendingVerification, calcBalance, paymentRecordStatusBadge } from '../utils/billing';

type BillingTab = 'estimate' | 'final' | 'all';

export default function PendingPayments({ onNavigate }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const { projects, loading } = useProjects(user?.email);
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [projectPayments, setProjectPayments] = useState<Record<string, ProjectPayment[]>>({});
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [submitPaymentFor, setSubmitPaymentFor] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingTab, setBillingTab] = useState<BillingTab>('all');
  const [expandedBank, setExpandedBank] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.fetchBankDetails().then((bd) => { if (bd) setBankDetails(bd); });
  }, []);

  useEffect(() => {
    let active = true;
    if (projects.length === 0) return;
    Promise.all(projects.map(async (p) => {
      const [inv, pp] = await Promise.all([
        db.fetchInvoice(p.id).catch(() => null),
        db.fetchProjectPayments(p.id).catch(() => []),
      ]);
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
      setBillingLoaded(true);
    }).catch(() => {
      if (active) setBillingLoaded(true);
    });
    return () => { active = false; };
  }, [projects]);

  const getInvoiceAmount = (p: Project) => invoices[p.id]?.current_amount ?? p.amount ?? 0;
  const getVerifiedPaid = (p: Project) => sumVerifiedPaid(projectPayments[p.id] || []);
  const getPendingVerification = (p: Project) => sumPendingVerification(projectPayments[p.id] || []);
  const getBalance = (p: Project) => calcBalance(getInvoiceAmount(p), getVerifiedPaid(p));

  const billingProjects = projects.filter(p => {
    const inv = invoices[p.id];
    if (!inv) return false;
    return getBalance(p) > 0 || getPendingVerification(p) > 0 || (projectPayments[p.id] || []).length > 0;
  });

  const estimateProjects = billingProjects.filter(p => invoices[p.id]?.invoice_type === 'estimate');
  const finalProjects = billingProjects.filter(p => invoices[p.id]?.invoice_type === 'final');
  const tabbedProjects = billingTab === 'estimate' ? estimateProjects : billingTab === 'final' ? finalProjects : billingProjects;

  const totalOutstanding = billingProjects.reduce((s, p) => s + getBalance(p), 0);
  const totalPending = billingProjects.reduce((s, p) => s + getPendingVerification(p), 0);
  const totalPaid = projects.reduce((s, p) => s + getVerifiedPaid(p), 0);

  const reloadBilling = async (projectId: string) => {
    const inv = await db.fetchInvoice(projectId);
    const pp = await db.fetchProjectPayments(projectId);
    setInvoices(prev => { const next = { ...prev }; if (inv) next[projectId] = inv; else delete next[projectId]; return next; });
    setProjectPayments(prev => { const next = { ...prev }; if (pp.length > 0) next[projectId] = pp; else delete next[projectId]; return next; });
  };

  const handleSubmitPayment = async () => {
    if (!submitPaymentFor || !paymentForm.amount) return;
    const inv = invoices[submitPaymentFor];
    const project = projects.find(p => p.id === submitPaymentFor);
    if (!inv || !project) return;
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    setUploading(true);
    try {
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await db.uploadPaymentProof(submitPaymentFor, proofFile);
      }
      await db.createProjectPayment({
        project_id: submitPaymentFor,
        invoice_id: inv.id,
        amount,
        payment_date: new Date(paymentForm.paymentDate).toISOString(),
        payment_method: paymentForm.paymentMethod,
        payment_type: amount >= getBalance(project) ? 'Full' : 'Partial',
        transaction_reference: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
        payment_proof: proofUrl || undefined,
        status: 'pending_verification',
        created_by: user?.email || 'customer',
      });
      await db.createNotification({
        type: 'payment',
        title: 'Customer submitted payment',
        description: `Customer submitted a payment of ₹${amount.toLocaleString()} for ${project.order_number}. Please verify.`,
        target_role: 'admin',
        read: false,
        project_id: submitPaymentFor,
      });
      await reloadBilling(submitPaymentFor);
      setSubmitPaymentFor(null);
      setPaymentForm({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
      setProofFile(null);
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to submit payment'); } finally { setUploading(false); }
  };

  const handleRequestCompletion = async (projectId: string) => {
    setActing(true);
    try {
      const project = projects.find(p => p.id === projectId);
      const fileLinksText = project?.download_links?.trim()
        ? ` Original files are ready for download: ${project.download_links.trim()}`
        : '';
      await db.requestProjectCompletion(projectId);
      await db.createNotification({
        type: 'project',
        title: 'Customer requested project completion',
        description: `Customer has requested to complete the project and download original files.${fileLinksText}`,
        target_role: 'admin',
        read: false,
        project_id: projectId,
      });
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to request completion'); } finally { setActing(false); }
  };

  if (loading || (projects.length > 0 && !billingLoaded)) return <FullPageSpinner />;

  const paymentStatusBadge = paymentRecordStatusBadge;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 stagger">
        <Card className="p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-success-50 dark:bg-success-500/15 text-success-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-ink-900 dark:text-white truncate">₹{totalPaid.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-ink-400">Verified Paid</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-warning-50 dark:bg-warning-500/15 text-warning-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-ink-900 dark:text-white truncate">₹{totalPending.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-ink-400">Pending Verification</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-5 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-error-50 dark:bg-error-500/15 text-error-600 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-ink-900 dark:text-white truncate">₹{totalOutstanding.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-ink-400">Balance Due</p>
            </div>
          </div>
        </Card>
      </div>

      {billingProjects.length === 0 ? (
        <Card className="animate-slide-up">
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success-500" />
            <p className="text-lg font-semibold text-ink-700 dark:text-ink-200">All caught up!</p>
            <p className="text-sm text-ink-400 mt-1">You have no pending payments. All your bills are settled.</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={() => onNavigate('my-orders')}>View My Orders</Button>
          </div>
        </Card>
      ) : (
        <>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setBillingTab('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${billingTab === 'all' ? 'bg-primary-500 text-white shadow-sm' : 'bg-ink-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
          >
            All
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billingTab === 'all' ? 'bg-white/20 text-white' : 'bg-ink-200 dark:bg-ink-600 text-ink-600 dark:text-ink-300'}`}>{billingProjects.length}</span>
          </button>
          <button
            onClick={() => setBillingTab('estimate')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${billingTab === 'estimate' ? 'bg-primary-500 text-white shadow-sm' : 'bg-ink-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
          >
            Estimates
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billingTab === 'estimate' ? 'bg-white/20 text-white' : 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'}`}>{estimateProjects.length}</span>
          </button>
          <button
            onClick={() => setBillingTab('final')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${billingTab === 'final' ? 'bg-success-500 text-white shadow-sm' : 'bg-ink-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'}`}
          >
            Final Invoices
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billingTab === 'final' ? 'bg-white/20 text-white' : 'bg-success-100 dark:bg-success-500/20 text-success-600 dark:text-success-400'}`}>{finalProjects.length}</span>
          </button>
        </div>

        {tabbedProjects.length === 0 ? (
          <Card className="animate-slide-up">
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-ink-300 dark:text-ink-600" />
              <p className="text-sm font-medium text-ink-500 dark:text-ink-400">No {billingTab === 'estimate' ? 'estimates' : billingTab === 'final' ? 'final invoices' : 'invoices'} in this category.</p>
            </div>
          </Card>
        ) : (
        <div className="space-y-4 stagger">
          {tabbedProjects.map((project) => {
            const inv = invoices[project.id];
            const pays = projectPayments[project.id] || [];
            const invAmt = getInvoiceAmount(project);
            const paid = getVerifiedPaid(project);
            const pending = getPendingVerification(project);
            const balance = getBalance(project);
            const isEstimate = inv?.invoice_type === 'estimate';
            return (
              <Card key={project.id} className="animate-slide-up">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                      {(project.order_number || '').slice(-2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-800 dark:text-ink-100 truncate">{project.event_name}</p>
                      <p className="text-xs text-ink-400 truncate">{project.order_number} · {project.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isEstimate ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400' : 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400'}`}>
                      {isEstimate ? 'Estimate' : 'Final Invoice'}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${balance <= 0 && paid > 0 ? 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' : paid > 0 ? 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300'}`}>
                      {balance <= 0 && paid > 0 ? 'Fully Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-center">
                    <p className="text-[10px] sm:text-xs text-ink-400">{isEstimate ? 'Estimated' : 'Invoice'} Amount</p>
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

                {pending > 0 && (
                  <div className="p-3 rounded-xl bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30 mb-4">
                    <p className="text-sm text-warning-700 dark:text-warning-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      ₹{pending.toLocaleString()} pending verification by the finance team.
                    </p>
                  </div>
                )}

                {inv && (
                  <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 text-sm space-y-1 mb-4">
                    <div className="flex justify-between"><span className="text-ink-400">Invoice Number</span><span className="font-medium text-ink-700 dark:text-ink-200">{inv.invoice_number || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-ink-400">Invoice Date</span><span className="font-medium text-ink-700 dark:text-ink-200">{new Date(inv.invoice_date).toLocaleDateString()}</span></div>
                    {inv.notes && <div className="flex justify-between gap-3"><span className="text-ink-400 flex-shrink-0">Notes</span><span className="font-medium text-ink-700 dark:text-ink-200 text-right min-w-0 break-words">{inv.notes}</span></div>}
                  </div>
                )}

                {pays.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-ink-700 dark:text-ink-200 mb-2">Payment History ({pays.length})</h4>
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
                            <span>{pp.payment_method}</span>
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
                              <br />Please submit a new payment with correct details.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bankDetails && (bankDetails.accountNumber || bankDetails.upiId) && balance > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setExpandedBank(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 hover:bg-ink-100 dark:hover:bg-ink-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Landmark className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200 truncate">Scan / Account Details</span>
                        {bankDetails.upiId && <span className="text-xs text-ink-400 font-mono truncate min-w-0">{bankDetails.upiId}</span>}
                        {bankDetails.accountNumber && !bankDetails.upiId && <span className="text-xs text-ink-400 font-mono truncate min-w-0">A/C: {bankDetails.accountNumber}</span>}
                      </div>
                      {expandedBank[project.id] ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
                    </button>
                    {expandedBank[project.id] && (
                  <div className="p-4 rounded-xl bg-ink-50 dark:bg-ink-800/50 space-y-3 mt-2 border border-ink-100 dark:border-ink-700">
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
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {balance > 0 && (
                    <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => {
                      setSubmitPaymentFor(project.id);
                      setActionError(null);
                      setPaymentForm({ amount: String(balance), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI', transactionRef: '', notes: '' });
                      setProofFile(null);
                    }}>Submit Payment</Button>
                  )}
                  {balance <= 0 && paid > 0 && !project.completion_requested && (
                    <Button variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => handleRequestCompletion(project.id)} disabled={acting}>Request Completion</Button>
                  )}
                  {project.completion_requested && (
                    <span className="text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Completion requested</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        )}
        </>
      )}

      {/* Submit Payment Modal */}
      <Modal open={!!submitPaymentFor} onClose={() => { setSubmitPaymentFor(null); setProofFile(null); }} title="Submit Payment" size="md">
        {submitPaymentFor && (() => {
          const project = projects.find(p => p.id === submitPaymentFor);
          if (!project) return null;
          const balance = getBalance(project);
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
                <Button variant="outline" size="sm" onClick={() => { setSubmitPaymentFor(null); setProofFile(null); }}>Cancel</Button>
                <Button variant="success" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={handleSubmitPayment} disabled={!paymentForm.amount || uploading}>{uploading ? 'Submitting...' : 'Submit Payment'}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
