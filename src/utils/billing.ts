import type { ProjectPayment } from '../data/db';

export function sumVerifiedPaid(payments: ProjectPayment[]): number {
  return payments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
}

export function sumPendingVerification(payments: ProjectPayment[]): number {
  return payments.filter((p) => p.status === 'pending_verification').reduce((s, p) => s + p.amount, 0);
}

export function calcBalance(invoiceAmount: number, verifiedPaid: number): number {
  return invoiceAmount - verifiedPaid;
}

export function getPaymentStatus(invoiceAmount: number, verifiedPaid: number): 'Unpaid' | 'Partially Paid' | 'Fully Paid' | 'Overpaid' {
  if (verifiedPaid <= 0) return 'Unpaid';
  if (verifiedPaid < invoiceAmount) return 'Partially Paid';
  if (verifiedPaid >= invoiceAmount) return 'Fully Paid';
  return 'Overpaid';
}

export const paymentStatusBadgeColor: Record<string, string> = {
  'Unpaid': 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300',
  'Partially Paid': 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400',
  'Fully Paid': 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400',
  'Overpaid': 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400',
};

export const paymentRecordStatusBadge: Record<string, { label: string; cls: string }> = {
  pending_verification: { label: 'Pending Verification', cls: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400' },
  verified: { label: 'Verified', cls: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400' },
  rejected: { label: 'Rejected', cls: 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400' },
};
