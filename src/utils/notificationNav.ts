import type { PageKey } from '../components/Layout';

export interface NotificationTarget {
  page: PageKey;
  params?: Record<string, unknown>;
}

export function getNotificationTarget(n: { type: string; title: string; description: string | null; project_id?: string | null }, role?: string): NotificationTarget {
  const r = role || '';
  switch (n.type) {
    case 'correction':
      if (r === 'editor') return { page: 'corrections' };
      if (r === 'customer' && n.project_id) return { page: 'my-orders' };
      if (n.project_id) return { page: 'review-screen', params: { id: n.project_id } };
      return { page: 'corrections' };
    case 'approval':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'order-tracking' };
    case 'task-approved':
    case 'task-complete':
    case 'task-assigned':
      if (r === 'admin' && n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      if (r === 'admin') return { page: 'order-tracking' };
      return { page: 'my-works' };
    case 'new-order':
      if (r === 'editor') return { page: 'available-works' };
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'projects' };
    case 'payment':
      if (r === 'customer') return { page: 'my-orders' };
      return { page: 'finance' };
    case 'project':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
    case 'deadline':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
    case 'rating':
      if (r === 'admin') return { page: 'customer-feedback' };
      return { page: 'customer-feedback' };
    case 'message':
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
    case 'review-ready':
    case 'review-approved':
    case 'review-feedback':
    case 'project-completed':
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      if (n.project_id) return { page: 'project-details', params: { id: n.project_id } };
      return { page: 'projects' };
    case 'invoice':
      if (r === 'customer') return { page: 'my-orders' };
      return { page: 'finance' };
    default:
      if (r === 'customer') return { page: 'my-orders' };
      if (r === 'editor') return { page: 'my-works' };
      return { page: 'order-tracking' };
  }
}
