import type { Project, Task } from '../data/db';

const FROZEN_STATUSES = ['review', 'correction', 'correction_approved', 'invoiced', 'completed'];

export function getDeadlineInfo(deadline: string | null, status?: string): { label: string; color: string; urgent: boolean; frozen: boolean; pillClass: string } {
  if (!deadline) return { label: '—', color: 'text-ink-400', urgent: false, frozen: false, pillClass: '' };
  const due = new Date(deadline);
  if (isNaN(due.getTime())) return { label: deadline, color: 'text-ink-500 dark:text-ink-400', urgent: false, frozen: false, pillClass: '' };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (status && FROZEN_STATUSES.includes(status)) {
    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { label: 'On Time', color: 'text-success-700 dark:text-success-300', urgent: false, frozen: true, pillClass: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300 shadow-sm ring-1 ring-success-200 dark:ring-success-500/30' };
    if (diffDays > 0) return { label: `${diffDays}d Early`, color: 'text-success-700 dark:text-success-300', urgent: false, frozen: true, pillClass: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300 shadow-sm ring-1 ring-success-200 dark:ring-success-500/30' };
    return { label: `${Math.abs(diffDays)}d Late`, color: 'text-error-700 dark:text-error-300', urgent: true, frozen: true, pillClass: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300 shadow-sm ring-1 ring-error-200 dark:ring-error-500/30' };
  }
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return { label: `${overdueDays}d overdue`, color: 'text-error-600 dark:text-error-400 font-semibold', urgent: true, frozen: false, pillClass: '' };
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffDays === 0) return { label: `${diffHours}h left`, color: 'text-error-600 dark:text-error-400 font-semibold', urgent: true, frozen: false, pillClass: '' };
  if (diffDays === 1) return { label: `${diffHours}h left`, color: 'text-error-600 dark:text-error-400 font-semibold', urgent: true, frozen: false, pillClass: '' };
  if (diffDays <= 2) return { label: `${diffHours}h left`, color: 'text-error-600 dark:text-error-400 font-semibold', urgent: true, frozen: false, pillClass: '' };
  if (diffDays <= 5) return { label: `${diffDays} days left`, color: 'text-warning-600 dark:text-warning-400 font-medium', urgent: false, frozen: false, pillClass: '' };
  if (diffDays <= 14) return { label: `${diffDays} days left`, color: 'text-primary-600 dark:text-primary-400', urgent: false, frozen: false, pillClass: '' };
  return { label: `${diffDays} days left`, color: 'text-success-600 dark:text-success-400', urgent: false, frozen: false, pillClass: '' };
}

export interface WorkflowStage {
  label: string;
  percent: number;
  status: string;
}

export const STAGES: WorkflowStage[] = [
  { label: 'Created', percent: 0, status: 'created' },
  { label: 'Approved', percent: 5, status: 'approved' },
  { label: 'Assigned', percent: 10, status: 'assigned' },
  { label: 'Working', percent: 30, status: 'in-progress' },
  { label: 'Finished', percent: 50, status: 'finished' },
  { label: 'Review', percent: 60, status: 'review' },
  { label: 'Correction', percent: 70, status: 'correction' },
  { label: 'Correction Approved', percent: 80, status: 'correction_approved' },
  { label: 'Invoiced', percent: 90, status: 'invoiced' },
  { label: 'Completed', percent: 100, status: 'completed' },
];

const STATUS_TO_STAGE: Record<string, WorkflowStage> = Object.fromEntries(
  STAGES.map((s) => [s.status, s]),
);

export function getWorkflowStage(projectStatus: string): WorkflowStage {
  return STATUS_TO_STAGE[projectStatus] || { label: projectStatus, percent: 0, status: projectStatus };
}

export function getStageByProgress(progress: number): WorkflowStage {
  let result: WorkflowStage = STAGES[0];
  for (const stage of STAGES) {
    if (progress >= stage.percent) result = stage;
    else break;
  }
  return result;
}

const DONE_STATUSES = ['approved', 'completed', 'submitted', 'fully-completed', 'partial-completed'];

export interface TimelineStage {
  label: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

export function getStagesFromProgress(progress: number, startDate?: string | null): TimelineStage[] {
  return STAGES.map((stage, i) => {
    const nextPercent = i < STAGES.length - 1 ? STAGES[i + 1].percent : 101;
    let status: 'completed' | 'current' | 'pending';
    if (progress >= nextPercent) status = 'completed';
    else if (progress >= stage.percent) status = 'current';
    else status = 'pending';
    const date = i === 0 && startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined;
    return { label: stage.label, status, date };
  });
}

export function computeProgressFromTasks(tasks: Task[], projectStatus: string): number {
  const stage = STATUS_TO_STAGE[projectStatus];
  if (stage) {
    if (projectStatus === 'in-progress' && tasks.length > 0) {
      const done = tasks.filter((t) => DONE_STATUSES.includes(t.status)).length;
      if (done === tasks.length) return 50;
      const ratio = done / tasks.length;
      return Math.round(30 + ratio * 20);
    }
    return stage.percent;
  }
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => DONE_STATUSES.includes(t.status)).length;
  return Math.round((done / tasks.length) * 100);
}
