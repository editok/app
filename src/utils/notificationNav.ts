import type { PageKey } from '../components/Layout';

export interface NotificationTarget {
  page: PageKey;
  params?: Record<string, unknown>;
}

const ACTIONABLE_TYPES: string[] = [
  'correction',
  'task-complete',
  'task-assigned',
  'new-order',
  'approval',
  'message',
  'payment',
  'invoice',
  'invoice-generated',
  'review-ready',
  'rating',
];

export function isActionableNotification(type: string): boolean {
  return ACTIONABLE_TYPES.includes(type);
}

export function getNotificationTarget(
  n: { type: string; title: string; description: string | null; project_id?: string | null; metadata?: Record<string, unknown> | null },
  role?: string,
): NotificationTarget {
  const r = role || '';
  const taskId = typeof n.metadata?.task_id === 'string' ? n.metadata.task_id : undefined;
  switch (n.type) {
    case 'correction':
      if (r === 'editor') return { page: 'corrections' };
      if (r === 'customer' && n.project_id) return { page: 'my-orders' };
      if (n.project_id) return { page: 'review-screen', params: { id: n.project_id } };
      return { page: 'corrections' };
    case 'approval':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') {
        if (taskId) return { page: 'working-screen', params: { id: n.project_id, taskId } };
        return { page: 'my-works' };
      }
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'order-tracking' };
    case 'task-complete':
      if (r === 'admin' && n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      if (r === 'admin') return { page: 'order-tracking' };
      return { page: 'my-works' };
    case 'task-assigned':
      if (r === 'editor' && n.project_id) {
        if (taskId) return { page: 'working-screen', params: { id: n.project_id, taskId } };
        return { page: 'working-screen', params: { id: n.project_id } };
      }
      return { page: 'my-works' };
    case 'new-order':
      if (r === 'editor') return { page: 'available-works' };
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'projects' };
    case 'payment':
    case 'invoice':
    case 'invoice-generated':
    case 'payment-received':
      if (r === 'customer') return { page: 'pending-payments' };
      if (r === 'editor') return { page: 'earnings' };
      return { page: 'finance' };
    case 'message':
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
    case 'review-ready':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'projects' };
    case 'rating':
      return { page: 'customer-feedback' };
    default:
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
  }
}

export function getTargetLabel(target: NotificationTarget): string {
  const labels: Partial<Record<PageKey, string>> = {
    corrections: 'Open Corrections',
    'my-orders': 'Open My Orders',
    'review-screen': 'Open Review',
    'project-details': 'Open Project',
    'order-tracking': 'Open Order Tracking',
    'available-works': 'Open Available Works',
    'my-works': 'Open My Works',
    'working-screen': 'Open Task',
    projects: 'Open Projects',
    finance: 'Open Finance',
    'pending-payments': 'Open Payments',
    earnings: 'Open Earnings',
    'customer-feedback': 'Open Feedback',
  };
  return labels[target.page] || 'Open';
}
