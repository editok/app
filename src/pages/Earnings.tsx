import { useState, useEffect, useMemo } from 'react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { Card, StatCard } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import DataTable, { Column } from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import { Wallet, TrendingUp, Clock, CheckCircle2, Calendar, DollarSign, ArrowDownToLine, Eye, HandCoins, X, Image as ImageIcon } from 'lucide-react';
import { useAuth, supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import type { PaymentSplit, Project, PayoutRequest } from '../data/db';

interface EarningRow {
  id: string;
  taskName: string;
  amount: number;
  status: string;
  paidAt: string | null;
  paymentProof: string | null;
  projectOrder?: string;
  projectName?: string;
  projectCategory?: string;
  projectDeadline?: string;
}

export default function Earnings() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofTaskName, setProofTaskName] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [exportTo, setExportTo] = useState<string>(new Date().toISOString().slice(0, 10));

  const loadEarnings = async (silent = false) => {
    if (!user?.email) return;
    if (!silent) setLoading(true);
    try {
      const employees = await db.fetchEmployees();
      const emp = employees.find((e) => e.email === user.email);
      if (emp) {
        const splits = await db.fetchPaymentSplitsByEmployee(emp.id);
        const rows: EarningRow[] = splits.map((s: PaymentSplit & { project?: Project }) => {
          const proj = s.project;
          return {
            id: s.id,
            taskName: s.task_name || '—',
            amount: s.amount,
            status: s.status,
            paidAt: s.paid_at,
            paymentProof: s.payment_proof,
            projectOrder: proj?.order_number,
            projectName: proj?.event_name,
            projectCategory: proj?.category,
            projectDeadline: proj?.deadline,
          };
        });
        setEarnings(rows);

        const requests = await db.fetchPayoutRequestsByEmployee(emp.id);
        setPayoutRequests(requests);
      }
    } catch (err) {
      console.error('Earnings load failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
    if (!supabase) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('earnings-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_splits' }, () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => loadEarnings(true), 500); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => loadEarnings(true), 500); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => loadEarnings(true), 500); })
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase?.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const pendingEarningsList = useMemo(() => earnings.filter((e) => e.status !== 'paid'), [earnings]);
  const paidEarnings = useMemo(() => earnings.filter((e) => e.status === 'paid'), [earnings]);
  const totalEarned = paidEarnings.reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = pendingEarningsList.reduce((sum, e) => sum + e.amount, 0);
  const tasksCompleted = paidEarnings.length;

  const requestedSplitIds = useMemo(() => {
    const ids = new Set<string>();
    payoutRequests.filter((r) => r.status === 'requested').forEach((r) => r.split_ids.forEach((id) => ids.add(id)));
    return ids;
  }, [payoutRequests]);

  const selectableEarnings = useMemo(
    () => pendingEarningsList.filter((e) => !requestedSplitIds.has(e.id)),
    [pendingEarningsList, requestedSplitIds]
  );

  const selectedTotal = useMemo(
    () => earnings.filter((e) => selectedIds.has(e.id)).reduce((sum, e) => sum + e.amount, 0),
    [earnings, selectedIds]
  );

  const allSelectableSelected = selectableEarnings.length > 0 && selectableEarnings.every((e) => selectedIds.has(e.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEarnings.map((e) => e.id)));
    }
  };

  const handleRequestPayout = async () => {
    if (!user?.email || selectedIds.size === 0) return;
    setSubmittingPayout(true);
    setPayoutError(null);
    try {
      const employees = await db.fetchEmployees();
      const emp = employees.find((e) => e.email === user.email);
      if (!emp) { setPayoutError('Could not find your employee profile.'); return; }
      const selectedArr = Array.from(selectedIds);
      const total = earnings.filter((e) => selectedIds.has(e.id)).reduce((s, e) => s + e.amount, 0);
      await db.createPayoutRequest({
        employee_id: emp.id,
        employee_name: emp.name,
        split_ids: selectedArr,
        total_amount: total,
      });
      await db.createNotification({
        type: 'payment',
        title: 'Payout request submitted',
        description: `${emp.name} requested a payout of ₹${total.toLocaleString()} for ${selectedArr.length} task${selectedArr.length !== 1 ? 's' : ''}.`,
        target_role: 'admin',
        read: false,
      });
      setSelectedIds(new Set());
      setShowPayoutModal(false);
      await loadEarnings(true);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to submit payout request.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleExport = () => {
    const from = new Date(exportFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(exportTo);
    to.setHours(23, 59, 59, 999);
    const filtered = earnings.filter((e) => {
      const d = e.paidAt ? new Date(e.paidAt) : null;
      if (!d) return false;
      return d >= from && d <= to;
    });
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ['Project', 'Order Number', 'Task', 'Amount', 'Payment Date', 'Status'].map(esc).join(',');
    const rows = filtered.map((e) =>
      [e.projectName || '', e.projectOrder || '', e.taskName, e.amount, e.paidAt ? new Date(e.paidAt).toLocaleDateString('en-IN') : '', e.status].map(esc).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings_${exportFrom}_to_${exportTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const columns: Column<EarningRow>[] = [
    {
      key: 'select', label: '', sortable: false, render: (r) => {
        if (r.status === 'paid') return <span className="inline-block w-5" />;
        if (requestedSplitIds.has(r.id)) return <span className="inline-block w-5 text-center text-[10px] font-semibold text-warning-500" title="Included in a pending payout request">Requested</span>;
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={() => toggleSelect(r.id)}
            className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        );
      }
    },
    { key: 'projectName', label: 'Project', sortable: true, render: (r) => (
      <div>
        <p className="font-semibold text-ink-800 dark:text-ink-100">{r.projectName || '—'}</p>
        <p className="text-xs text-ink-400">{r.projectOrder || ''} · {r.projectCategory || ''}</p>
      </div>
    ) },
    { key: 'taskName', label: 'Task', sortable: true, render: (r) => (
      <span className="text-sm text-ink-700 dark:text-ink-200">{r.taskName}</span>
    ) },
    { key: 'amount', label: 'Your Earning', sortable: true, render: (r) => (
      <span className="font-bold text-success-600 dark:text-success-400">₹{r.amount.toLocaleString()}</span>
    ) },
    { key: 'paidAt', label: 'Date', sortable: true, render: (r) => (
      r.paidAt ? <span className="text-ink-600 dark:text-ink-300">{new Date(r.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : <span className="text-ink-400">—</span>
    ) },
    { key: 'status', label: 'Status', sortable: true, render: (r) => (
      <Badge status={r.status === 'paid' ? 'completed' : 'pending'}>{r.status === 'paid' ? 'Paid' : 'Pending'}</Badge>
    ) },
    {
      key: 'actions', label: 'Receipt', sortable: false, render: (r) => {
        if (r.status === 'paid' && r.paymentProof) {
          return (
            <button
              onClick={() => { setProofUrl(r.paymentProof); setProofTaskName(r.taskName); }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> View
            </button>
          );
        }
        return <span className="text-ink-300 dark:text-ink-600 text-xs">—</span>;
      }
    },
  ];

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      <div className="relative rounded-2xl overflow-hidden shimmer-sweep animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-success-500 via-emerald-500 to-teal-500" />
        <div className="absolute inset-0 aurora-bg opacity-60" />
        <div className="absolute inset-0 bg-dot-grid opacity-20" />
        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Your Earnings</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">₹{totalEarned.toLocaleString()}</h2>
            <p className="text-sm text-white/80">Total earnings from {tasksCompleted} completed task{tasksCompleted !== 1 ? 's' : ''}. {pendingAmount > 0 ? `₹${pendingAmount.toLocaleString()} pending.` : 'All payments settled.'}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col items-center gap-1 px-4 py-4 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex-1 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-white/70" />
              <span className="text-2xl font-bold text-white">{tasksCompleted}</span>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">Paid</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-4 py-4 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex-1 min-w-0">
              <Clock className="w-5 h-5 text-white/70" />
              <span className="text-2xl font-bold text-white">₹{pendingAmount.toLocaleString()}</span>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Earned" value={`₹${totalEarned.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="success" />
        <StatCard label="Pending" value={`₹${pendingAmount.toLocaleString()}`} icon={<Clock className="w-5 h-5" />} color="warning" />
        <StatCard label="Tasks Completed" value={tasksCompleted} icon={<CheckCircle2 className="w-5 h-5" />} color="primary" />
        <StatCard label="Avg per Task" value={tasksCompleted > 0 ? `₹${Math.round(totalEarned / tasksCompleted).toLocaleString()}` : '₹0'} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
      </div>

      {/* Payout requests */}
      {payoutRequests.length > 0 && (
        <Card padding={false} className="animate-slide-up">
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-semibold text-ink-900 dark:text-white">Payout Requests</h3>
            <p className="text-xs text-ink-400 mt-0.5">Track your submitted payout requests and their status</p>
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
                    {req.split_ids.length} task{req.split_ids.length !== 1 ? 's' : ''} · Requested {new Date(req.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {req.processed_at && ` · Processed ${new Date(req.processed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                  {req.notes && <p className="text-xs text-ink-500 mt-1">Note: {req.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Earnings table */}
      <Card padding={false} className="animate-slide-up">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink-900 dark:text-white">Earnings History</h3>
            <p className="text-xs text-ink-400 mt-0.5">Payment details for tasks you have completed</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              icon={<HandCoins className="w-3.5 h-3.5" />}
              disabled={selectedIds.size === 0}
              onClick={() => { setPayoutError(null); setShowPayoutModal(true); }}
            >
              Request Payout{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
            <Button variant="outline" size="sm" icon={<ArrowDownToLine className="w-3.5 h-3.5" />} onClick={() => setShowExportModal(true)}>
              Download Report
            </Button>
          </div>
        </div>

        {/* Selection bar */}
        {selectableEarnings.length > 0 && (
          <div className="px-5 pb-2 flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelectableSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              Select All ({selectableEarnings.length} available)
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs font-medium text-ink-600 dark:text-ink-300">
                Selected: {selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''} · ₹{selectedTotal.toLocaleString()}
              </span>
            )}
          </div>
        )}

        <div className="px-5 pb-5">
          {earnings.length === 0 ? (
            <div className="text-center py-12 text-ink-400 dark:text-ink-500">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No earnings yet</p>
              <p className="text-xs mt-1">Your earnings will appear here after you complete tasks and the admin confirms payment.</p>
            </div>
          ) : (
            <DataTable columns={columns} data={earnings} pageSize={8} />
          )}
        </div>
      </Card>

      {/* Payment info note */}
      <Card className="animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-800 dark:text-ink-100">How earnings work</h4>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 leading-relaxed">
              When you complete a task and the admin splits the customer's payment, your allocated amount for that task will appear here.
              Select one or more pending tasks and click Request Payout to ask the admin to process your disbursement.
              Once paid, you can view the payment receipt uploaded by the admin.
            </p>
          </div>
        </div>
      </Card>

      {/* Request Payout Confirmation Modal */}
      <Modal
        open={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        title="Request Payout"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowPayoutModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={submittingPayout} onClick={handleRequestPayout}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            You are requesting a payout for <strong>{selectedIds.size}</strong> task{selectedIds.size !== 1 ? 's' : ''} totaling <strong className="text-success-600 dark:text-success-400">₹{selectedTotal.toLocaleString()}</strong>.
          </p>
          <p className="text-xs text-ink-400 dark:text-ink-500">
            The admin will be notified to process your payment. You'll be able to see the payment receipt here once it's been paid.
          </p>
          {payoutError && (
            <div className="p-3 rounded-lg bg-error-50 dark:bg-error-500/15 text-xs text-error-600 dark:text-error-400">
              {payoutError}
            </div>
          )}
        </div>
      </Modal>

      {/* Payment Proof Modal */}
      <Modal
        open={!!proofUrl}
        onClose={() => { setProofUrl(null); setProofTaskName(''); }}
        title="Payment Receipt"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
            <CheckCircle2 className="w-4 h-4 text-success-500" />
            <span>Payment receipt for <strong className="text-ink-700 dark:text-ink-200">{proofTaskName}</strong></span>
          </div>
          {proofUrl && (
            <div className="rounded-xl overflow-hidden border border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
              <img
                src={proofUrl}
                alt="Payment receipt"
                className="w-full h-auto max-h-[60vh] object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-ink-400"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><p class="text-xs mt-2">Unable to load receipt image</p></div>';
                  }
                }}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Export Report Modal */}
      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Download Earnings Report"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowExportModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<ArrowDownToLine className="w-3.5 h-3.5" />} onClick={handleExport}>Download CSV</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Filter your earnings by date range and download as a CSV file (compatible with Excel).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ink-500 dark:text-ink-400 mb-1.5 block">From Date</label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 dark:text-ink-400 mb-1.5 block">To Date</label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-800 dark:text-ink-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-ink-400 dark:text-ink-500">
            Only paid earnings within the selected date range will be included.
          </p>
        </div>
      </Modal>
    </div>
  );
}
