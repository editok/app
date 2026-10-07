import { ReactNode } from 'react';

type Status = 'created' | 'processing' | 'approved' | 'review_approved' | 'assigned' | 'in-progress' | 'finished' | 'review' | 'correction' | 'correction_approved' | 'invoiced' | 'completed' | 'closed' | 'rejected' | 'active' | 'inactive' | 'available' | 'working' | 'leave' | 'pending' | 'unassigned';

interface BadgeProps {
  status: Status | string;
  children?: ReactNode;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  created: { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-600 dark:text-ink-300', dot: 'bg-ink-400' },
  processing: { bg: 'bg-primary-50 dark:bg-primary-500/15', text: 'text-primary-700 dark:text-primary-300', dot: 'bg-primary-500' },
  approved: { bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  review_approved: { bg: 'bg-teal-50 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  correction_approved: { bg: 'bg-teal-50 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  assigned: { bg: 'bg-purple-50 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'in-progress': { bg: 'bg-warning-50 dark:bg-warning-500/15', text: 'text-warning-700 dark:text-warning-300', dot: 'bg-warning-500' },
  finished: { bg: 'bg-blue-50 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  review: { bg: 'bg-yellow-50 dark:bg-yellow-500/15', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  correction: { bg: 'bg-error-50 dark:bg-error-500/15', text: 'text-error-700 dark:text-error-300', dot: 'bg-error-500' },
  invoiced: { bg: 'bg-indigo-50 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  completed: { bg: 'bg-success-50 dark:bg-success-500/15', text: 'text-success-700 dark:text-success-300', dot: 'bg-success-500' },
  closed: { bg: 'bg-ink-100 dark:bg-ink-800/80', text: 'text-ink-600 dark:text-ink-300', dot: 'bg-ink-500' },
  rejected: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-800 dark:text-red-300', dot: 'bg-red-600' },
  active: { bg: 'bg-success-50 dark:bg-success-500/15', text: 'text-success-700 dark:text-success-300', dot: 'bg-success-500' },
  inactive: { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-500 dark:text-ink-400', dot: 'bg-ink-400' },
  available: { bg: 'bg-primary-50 dark:bg-primary-500/15', text: 'text-primary-700 dark:text-primary-300', dot: 'bg-primary-500' },
  working: { bg: 'bg-warning-50 dark:bg-warning-500/15', text: 'text-warning-700 dark:text-warning-300', dot: 'bg-warning-500' },
  leave: { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-600 dark:text-ink-400', dot: 'bg-ink-400' },
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-500/15', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  unassigned: { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-500 dark:text-ink-400', dot: 'bg-ink-400' },
};

const formatLabel = (s: string) =>
  s === 'review_approved' ? 'Review Approved' : s === 'correction_approved' ? 'Correction Approved' : s === 'in-progress' ? 'Working' : s === 'closed' ? 'Closed' : s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Badge({ status, children, className = '' }: BadgeProps) {
  const safeStatus = status || 'pending';
  const cfg = statusConfig[safeStatus] || { bg: 'bg-ink-100 dark:bg-ink-800', text: 'text-ink-600 dark:text-ink-400', dot: 'bg-ink-400' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize flex-shrink-0 max-w-full ${cfg.bg} ${cfg.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} animate-pulse`} />
      <span className="truncate">{children || formatLabel(safeStatus)}</span>
    </span>
  );
}
