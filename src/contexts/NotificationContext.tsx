import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { supabase } from './AuthContext';
import { useAuth } from './AuthContext';
import { fetchEmployees as db_fetchEmployees, resolveNotification as db_resolveNotification } from '../data/db';

export type NotificationCategory = 'project' | 'task' | 'review' | 'payment' | 'chat' | 'reminder';
export type NotificationType = 'project' | 'deadline' | 'correction' | 'approval' | 'task-approved' | 'payment' | 'task-complete' | 'new-order' | 'rating' | 'message' | 'invoice' | 'task-assigned' | 'task-available' | 'review-ready' | 'review-approved' | 'review-feedback' | 'invoice-generated' | 'payment-received' | 'project-completed' | 'file-available' | 'system-error';

const CUSTOMER_ALLOWED_TYPES: NotificationType[] = ['project', 'payment', 'correction', 'rating', 'message', 'invoice', 'review-ready', 'review-approved', 'review-feedback', 'project-completed', 'invoice-generated', 'payment-received'];

const EDITOR_BLOCKED_PAYMENT_TYPES: NotificationType[] = ['payment', 'invoice', 'invoice-generated'];
const EDITOR_ALLOWED_PAYMENT_TYPES: NotificationType[] = ['payment-received'];

export const CATEGORY_MAP: Record<NotificationCategory, NotificationType[]> = {
  project: ['project', 'new-order', 'approval', 'project-completed'],
  task: ['task-approved', 'task-complete', 'task-assigned', 'task-available', 'file-available'],
  review: ['correction', 'review-ready', 'review-approved', 'review-feedback', 'rating'],
  payment: ['payment', 'invoice', 'invoice-generated', 'payment-received'],
  chat: ['message'],
  reminder: ['deadline', 'system-error'],
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  project: 'Project',
  task: 'Task',
  review: 'Review',
  payment: 'Payment',
  chat: 'Chat',
  reminder: 'Reminder',
};

const CATEGORY_TO_MENU: Record<NotificationCategory, string | null> = {
  project: 'projects',
  task: 'order-tracking',
  review: 'corrections',
  payment: 'finance',
  chat: 'projects',
  reminder: null,
};

const ALL_NOTIFICATION_TYPES: NotificationType[] = Object.values(CATEGORY_MAP).flat();

function categoryForType(type: NotificationType): NotificationCategory {
  for (const [cat, types] of Object.entries(CATEGORY_MAP)) {
    if ((types as NotificationType[]).includes(type)) return cat as NotificationCategory;
  }
  return 'project';
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: NotificationType;
  targetRole?: 'admin' | 'editor' | 'customer' | 'all';
  targetEmail?: string | null;
  project_id?: string | null;
  archived_at?: string | null;
  resolved_at?: string | null;
  category?: NotificationCategory;
  event_key?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export interface PendingCounts {
  newOrders: number;
  taskNextStage: number;
  paymentReminder: number;
  approvalPending: number;
  correctionPending: number;
  projectStatusChanges: number;
  reviewApproved: number;
  myActiveTasks: number;
  availableTasks: number;
  paymentPending: number;
  total: number;
}

export interface SubmittedTaskInfo {
  id: string;
  task_name: string;
  project_id: string;
  assigned_to_name: string | null;
  submitted_at: string | null;
}

export interface PaymentReminderProject {
  id: string;
  order_number: string;
  event_name: string;
  customer_name: string | null;
  customer_email: string | null;
  editor_name: string | null;
  amount: number | null;
  progress: number;
  status: string;
  category: string | null;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  hasNewIndicator: boolean;
  lastSeenAt: string | null;
  getCountForMenu: (menuKey: string) => number;
  getCountForCategory: (category: NotificationCategory) => number;
  pendingCounts: PendingCounts;
  submittedTasks: SubmittedTaskInfo[];
  paymentReminderProjects: PaymentReminderProject[];
  addNotification: (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  markMenuRead: (menuKey: string) => void;
  markSeen: () => void;
  markAllReadOnOpen: () => void;
  markProjectMessagesRead: (projectId: string) => void;
  clearAll: () => void;
  archiveNotification: (id: string) => void;
  oldNotifications: AppNotification[];
  loadOldNotifications: () => Promise<void>;
  markTypesRead: (types: NotificationType[]) => void;
  clearTypes: (types: NotificationType[]) => void;
  resolveNotif: (id: string) => void;
  markCategoryRead: (category: NotificationCategory) => void;
  clearCategory: (category: NotificationCategory) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  hasNewIndicator: false,
  lastSeenAt: null,
  getCountForMenu: () => 0,
  getCountForCategory: () => 0,
  pendingCounts: { newOrders: 0, taskNextStage: 0, paymentReminder: 0, approvalPending: 0, correctionPending: 0, projectStatusChanges: 0, reviewApproved: 0, myActiveTasks: 0, availableTasks: 0, paymentPending: 0, total: 0 },
  submittedTasks: [],
  paymentReminderProjects: [],
  addNotification: () => {},
  markAllRead: () => {},
  markRead: () => {},
  markMenuRead: () => {},
  markSeen: () => {},
  markAllReadOnOpen: () => {},
  markProjectMessagesRead: () => {},
  clearAll: () => {},
  archiveNotification: () => {},
  oldNotifications: [],
  loadOldNotifications: async () => {},
  markTypesRead: () => {},
  clearTypes: () => {},
  resolveNotif: () => {},
  markCategoryRead: () => {},
  clearCategory: () => {},
});

const menuTypeMap: Record<string, NotificationType[]> = {
  corrections: ['correction'],
  'order-tracking': ['project', 'approval', 'task-approved', 'task-complete', 'new-order'],
  projects: ['project', 'approval', 'task-complete', 'new-order', 'payment'],
  notifications: ['project', 'deadline', 'correction', 'approval', 'payment', 'task-complete', 'new-order', 'rating', 'message', 'invoice'],
  'my-works': ['task-approved', 'task-complete', 'task-assigned', 'project', 'approval', 'correction'],
  'available-works': ['project', 'new-order'],
  'admin-dashboard': ['new-order', 'task-complete', 'task-approved', 'task-assigned', 'approval', 'correction'],
  'customer-feedback': ['rating'],
  'project-details': ['message'],
  finance: ['invoice', 'payment'],
  'pending-payments': ['payment', 'invoice', 'invoice-generated', 'payment-received'],
};

function filterByRole(
  n: { type: string; category: string | null },
  role: string | null,
  adminRole: string | null,
  allowedMenus: string[] | null
): boolean {
  if (role === 'customer' && !CUSTOMER_ALLOWED_TYPES.includes(n.type as NotificationType)) return false;
  if (role === 'editor' && EDITOR_BLOCKED_PAYMENT_TYPES.includes(n.type as NotificationType) && !EDITOR_ALLOWED_PAYMENT_TYPES.includes(n.type as NotificationType)) return false;
  if (role === 'admin' && adminRole !== 'main' && allowedMenus) {
    const cat = (n.category as NotificationCategory) || categoryForType(n.type as NotificationType);
    const requiredMenu = CATEGORY_TO_MENU[cat];
    if (requiredMenu && !allowedMenus.includes(requiredMenu)) return false;
  }
  return true;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { role, user, adminRole, allowedMenus } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ newOrders: 0, taskNextStage: 0, paymentReminder: 0, approvalPending: 0, correctionPending: 0, projectStatusChanges: 0, reviewApproved: 0, myActiveTasks: 0, availableTasks: 0, paymentPending: 0, total: 0 });
  const [submittedTasks, setSubmittedTasks] = useState<SubmittedTaskInfo[]>([]);
  const [paymentReminderProjects, setPaymentReminderProjects] = useState<PaymentReminderProject[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [oldNotifications, setOldNotifications] = useState<AppNotification[]>([]);
  const [hasNewIndicator, setHasNewIndicator] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const loadNotifications = async () => {
      if (!active || !role) return;
      let query = supabase
        .from('notifications')
        .select('id, type, title, description, target_role, target_email, read, created_at, project_id, archived_at, category, resolved_at, event_key, metadata')
        .in('target_role', [role, 'all'])
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (role === 'customer' && user?.email) {
        query = query.eq('target_email', user.email).in('type', CUSTOMER_ALLOWED_TYPES);
      } else if (role === 'editor' && user?.email) {
        query = query.or(`target_email.eq.${user.email},and(target_email.is.null,target_role.eq.editor)`);
      }

      const { data } = await query;
      if (!active || !data) return;

      const notifIds = data.map((n: { id: string }) => n.id);
      let readMap = new Map<string, { read_at: string | null; archived_at: string | null }>();
      if (active && user && notifIds.length > 0) {
        const { data: reads } = await supabase
          .from('notification_reads')
          .select('notification_id, read_at, archived_at')
          .eq('user_id', user.id)
          .in('notification_id', notifIds);
        if (reads) {
          readMap = new Map(reads.map((r: { notification_id: string; read_at: string | null; archived_at: string | null }) => [r.notification_id, { read_at: r.read_at, archived_at: r.archived_at }]));
        }
      }

      const mapped: AppNotification[] = data
        .filter((n) => {
          if (!filterByRole(n, role, adminRole, allowedMenus)) return false;
          const userRead = readMap.get(n.id);
          if (userRead?.archived_at) return false;
          return true;
        })
        .map((n) => {
          const userRead = readMap.get(n.id);
          return {
            id: n.id,
            type: n.type as NotificationType,
            title: n.title,
            description: n.description || '',
            time: formatTimeAgo(n.created_at),
            read: !!userRead?.read_at || n.read,
            created_at: n.created_at,
            targetRole: n.target_role as 'admin' | 'editor' | 'customer',
            targetEmail: n.target_email || null,
            project_id: n.project_id || null,
            archived_at: userRead?.archived_at || n.archived_at || null,
            resolved_at: n.resolved_at || null,
            category: (n.category as NotificationCategory) || categoryForType(n.type as NotificationType),
            event_key: n.event_key || null,
            metadata: n.metadata || null,
          };
        });
      setItems(mapped);
      const hasUnread = mapped.some((n) => !n.read);
      setHasNewIndicator(hasUnread);
    };

    const loadPendingCounts = async () => {
      if (!active || !supabase || !role) return;
      const isAdmin = role === 'admin';
      let emp: { id: string } | undefined;
      if (role === 'editor' && user?.email) {
        const employees = await db_fetchEmployees();
        emp = employees.find((e) => e.email === user.email);
      }
      let projectQ = supabase.from('projects').select('status, progress, id, order_number, event_name, customer_name, customer_email, editor_name, editor_id, amount, category');
      if (role === 'customer' && user?.email) projectQ = projectQ.eq('customer_email', user.email);
      else if (role === 'editor' && user?.email) {
        if (emp) projectQ = projectQ.eq('editor_id', emp.id);
        else projectQ = projectQ.eq('editor_id', 'none');
      }
      const { data: projects } = await projectQ.order('created_at', { ascending: false });
      const { data: corrs } = await supabase.from('corrections').select('status, customer_email, editor, editor_id');
      const { data: tasks } = await supabase.from('tasks').select('id, task_name, project_id, assigned_to, assigned_to_name, submitted_at, status').order('submitted_at', { ascending: false, nullsFirst: false });
      const { data: payments } = await supabase.from('payments').select('project_id, status');
      const { data: projectRows } = await projectQ;
      const { data: projectNotifs } = await supabase
        .from('notifications')
        .select('id, title')
        .eq('target_role', 'admin')
        .eq('read', false)
        .eq('type', 'project');
      if (!active || !projects || !corrs) return;
      const paidProjectIds = new Set((payments || []).filter((p: { status: string }) => p.status === 'paid').map((p: { project_id: string }) => p.project_id));
      const reminderProjects = isAdmin
        ? (projectRows || []).filter((p: { id: string; status: string; progress: number }) =>
            p.progress === 100 && p.status !== 'completed' && !paidProjectIds.has(p.id)
          ) as PaymentReminderProject[]
        : [];
      const newOrders = isAdmin
        ? projects.filter((p: { status: string }) => p.status === 'created').length
        : 0;
      const taskNextStage = projects.filter((p: { status: string; progress: number }) => p.status === 'in-progress' && p.progress > 0 && p.progress < 100).length;
      const projectIds = new Set((projects || []).map((p: { id: string }) => p.id));
      const scopedTasks = (tasks || []).filter((t: { project_id: string }) => isAdmin || projectIds.has(t.project_id));
      const submittedTaskRows = scopedTasks.filter((t: { status: string }) => t.status === 'submitted');
      const approvalPending = isAdmin ? submittedTaskRows.length : 0;
      let scopedCorrs = corrs;
      if (role === 'customer' && user?.email) scopedCorrs = corrs.filter((c: { customer_email: string | null }) => c.customer_email === user.email);
      else if (role === 'editor' && user?.email) {
        if (emp) scopedCorrs = corrs.filter((c: { editor_id: string | null }) => c.editor_id === emp.id);
        else scopedCorrs = [];
      }
      const correctionPending = scopedCorrs.filter((c: { status: string }) => c.status === 'pending' || c.status === 'in-progress').filter((c: { status: string }) => c.status !== 'draft').length;
      const projectStatusChanges = !isAdmin || projects.length === 0
        ? 0
        : (projectNotifs || []).filter((notification: { title: string }) => notification.title.startsWith('Project status changed')).length;
      const invoicedProjectIds = new Set((payments || []).filter((p: { status: string }) => p.status === 'invoiced' || p.status === 'paid').map((p: { project_id: string }) => p.project_id));
      const reviewApproved = isAdmin ? projects.filter((p: { status: string }) => p.status === 'correction_approved' && !invoicedProjectIds.has(p.id)).length : 0;
      const myActiveTasks = role === 'editor' ? (scopedTasks || []).filter((t: { status: string; assigned_to: string | null }) => t.assigned_to === emp?.id && (t.status === 'assigned' || t.status === 'in-progress' || t.status === 'partial-completed' || t.status === 'fully-completed')).length : 0;
      const availableTasks = role === 'editor' ? (tasks || []).filter((t: { status: string; assigned_to: string | null }) => t.status === 'pending' && !t.assigned_to).length : 0;
      const invoicedProjectIdsForPending = new Set((payments || []).filter((p: { status: string }) => p.status === 'invoiced' || p.status === 'paid' || p.status === 'pending_verification').map((p: { project_id: string }) => p.project_id));
      const billingProjectsCount = role === 'customer' ? (projects || []).filter((p: { id: string }) => invoicedProjectIdsForPending.has(p.id)).length : 0;
      const paymentPending = billingProjectsCount;
      setPendingCounts({ newOrders, taskNextStage, paymentReminder: reminderProjects.length, approvalPending, correctionPending, projectStatusChanges, reviewApproved, myActiveTasks, availableTasks, paymentPending, total: newOrders + reminderProjects.length + approvalPending + correctionPending + reviewApproved + paymentPending });
      setSubmittedTasks(submittedTaskRows as SubmittedTaskInfo[]);
      setPaymentReminderProjects(reminderProjects);
    };

    const loadLastSeen = async () => {
      if (!active || !supabase || !user) return;
      const { data } = await supabase.from('profiles').select('last_notification_seen_at').eq('id', user.id).maybeSingle();
      if (!active || !data) return;
      const existing = data.last_notification_seen_at || null;
      setLastSeenAt(existing);
      if (!existing) {
        const now = new Date().toISOString();
        supabase.from('profiles').update({ last_notification_seen_at: now }).eq('id', user.id).then();
      }
    };

    loadNotifications();
    loadPendingCounts();
    loadLastSeen();

    let pendingCountsTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoadPendingCounts = () => {
      if (pendingCountsTimer) clearTimeout(pendingCountsTimer);
      pendingCountsTimer = setTimeout(() => {
        pendingCountsTimer = null;
        loadPendingCounts();
      }, 500);
    };

    const notifChannel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        loadNotifications();
        const row = payload.new as { target_role?: string; target_email?: string | null; title?: string; description?: string | null; type?: string; category?: string };
        const roleMatch = row.target_role === role || row.target_role === 'all';
        const emailMatch = role === 'admin'
          ? true
          : row.target_email === user?.email || (!row.target_email && row.target_role === 'editor' && role === 'editor');
        let menuMatch = true;
        if (role === 'admin' && adminRole !== 'main' && allowedMenus) {
          const cat = (row.category as NotificationCategory) || categoryForType(row.type as NotificationType);
          const requiredMenu = CATEGORY_TO_MENU[cat];
          if (requiredMenu && !allowedMenus.includes(requiredMenu)) menuMatch = false;
        }
        if (roleMatch && emailMatch && menuMatch && row.title) {
          window.dispatchEvent(new CustomEvent('editok-foreground-notification', {
            detail: { title: row.title, body: row.description || '' },
          }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        loadNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        debouncedLoadPendingCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corrections' }, () => {
        debouncedLoadPendingCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        debouncedLoadPendingCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        debouncedLoadPendingCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        debouncedLoadPendingCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_payments' }, () => {
        debouncedLoadPendingCounts();
      })
      .subscribe();

    return () => {
      active = false;
      if (pendingCountsTimer) clearTimeout(pendingCountsTimer);
      supabase.removeChannel(notifChannel);
    };
  }, [role, supabase, user, adminRole, allowedMenus]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'time' | 'read'>) => {
    const cat = n.category || categoryForType(n.type);
    const newNotif: AppNotification = {
      ...n,
      id: `n-${Date.now()}`,
      time: 'Just now',
      read: false,
      category: cat,
    };
    setItems((prev) => [newNotif, ...prev]);
    setHasNewIndicator(true);
    if (supabase) {
      supabase.from('notifications').insert({
        type: n.type,
        title: n.title,
        description: n.description,
        target_role: n.targetRole || 'admin',
        target_email: n.targetEmail || null,
        project_id: n.project_id || null,
        category: cat,
        read: false,
      }).then().catch((err: unknown) => console.error('Notification insert failed:', err));
    }
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setHasNewIndicator(false);
    if (supabase && user) {
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      if (ids.length > 0) {
        const now = new Date().toISOString();
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, read_at: now })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('markAllRead failed:', err));
      }
    }
  }, [items, user]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      setHasNewIndicator(updated.some((n) => !n.read));
      return updated;
    });
    if (supabase && user) {
      const now = new Date().toISOString();
      supabase.from('notification_reads')
        .upsert({ notification_id: id, user_id: user.id, read_at: now }, { onConflict: 'notification_id,user_id' })
        .then().catch((err: unknown) => console.error('markRead failed:', err));
    }
  }, [user]);

  const markMenuRead = useCallback((menuKey: string) => {
    const types = menuTypeMap[menuKey];
    if (!types) return;
    const effectiveTypes = role === 'customer' ? types.filter((t) => CUSTOMER_ALLOWED_TYPES.includes(t)) : types;
    setItems((prev) => prev.map((n) => (effectiveTypes.includes(n.type) && !n.read ? { ...n, read: true } : n)));
    if (supabase && user && effectiveTypes.length > 0) {
      const ids = items.filter((n) => effectiveTypes.includes(n.type) && !n.read).map((n) => n.id);
      if (ids.length > 0) {
        const now = new Date().toISOString();
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, read_at: now })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('markMenuRead failed:', err));
      }
    }
  }, [items, role, user]);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    setHasNewIndicator(false);
    if (supabase && user) {
      supabase.from('profiles').update({ last_notification_seen_at: now }).eq('id', user.id).then().catch((err: unknown) => console.error('markSeen failed:', err));
    }
  }, [supabase, user]);

  const markAllReadOnOpen = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setHasNewIndicator(false);
    if (supabase && user) {
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      if (ids.length > 0) {
        const now = new Date().toISOString();
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, read_at: now })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('markAllReadOnOpen failed:', err));
      }
    }
  }, [items, user]);

  const markProjectMessagesRead = useCallback((projectId: string) => {
    setItems((prev) => prev.map((n) => (n.type === 'message' && n.project_id === projectId && !n.read ? { ...n, read: true } : n)));
    if (supabase && user) {
      const ids = items.filter((n) => n.type === 'message' && n.project_id === projectId && !n.read).map((n) => n.id);
      if (ids.length > 0) {
        const now = new Date().toISOString();
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, read_at: now })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('markProjectMessagesRead failed:', err));
      }
    }
  }, [items, user]);

  const markTypesRead = useCallback((types: NotificationType[]) => {
    setItems((prev) => prev.map((n) => types.includes(n.type) ? { ...n, read: true } : n));
    if (supabase && user) {
      const ids = items.filter((n) => types.includes(n.type) && !n.read).map((n) => n.id);
      if (ids.length > 0) {
        const now = new Date().toISOString();
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, read_at: now })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('markTypesRead failed:', err));
      }
    }
  }, [items, user]);

  const markCategoryRead = useCallback((category: NotificationCategory) => {
    const types = CATEGORY_MAP[category];
    markTypesRead(types);
  }, [markTypesRead]);

  const clearTypes = useCallback((types: NotificationType[]) => {
    const archivedAt = new Date().toISOString();
    setItems((prev) => prev.filter((n) => !types.includes(n.type)));
    if (supabase && user) {
      const ids = items.filter((n) => types.includes(n.type)).map((n) => n.id);
      if (ids.length > 0) {
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, archived_at: archivedAt, read_at: archivedAt })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('clearTypes failed:', err));
      }
    }
  }, [items, user]);

  const clearCategory = useCallback((category: NotificationCategory) => {
    const types = CATEGORY_MAP[category];
    clearTypes(types);
  }, [clearTypes]);

  const archiveNotification = useCallback((id: string) => {
    const archivedAt = new Date().toISOString();
    setItems((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      setHasNewIndicator(remaining.some((n) => !n.read));
      return remaining;
    });
    setOldNotifications((prev) => prev.filter((n) => n.id !== id));
    if (supabase && user) {
      supabase.from('notification_reads')
        .upsert({ notification_id: id, user_id: user.id, archived_at: archivedAt, read_at: archivedAt }, { onConflict: 'notification_id,user_id' })
        .then().catch((err: unknown) => console.error('archiveNotification failed:', err));
    }
  }, [user]);

  const resolveNotif = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    db_resolveNotification(id).catch((err: unknown) => console.error('resolveNotif failed:', err));
  }, []);

  const loadOldNotifications = useCallback(async () => {
    if (!supabase || !role || !user) return;
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id, read_at, archived_at')
      .eq('user_id', user.id)
      .not('archived_at', 'is', null);
    if (!reads || reads.length === 0) { setOldNotifications([]); return; }
    const archivedIds = reads.map((r) => r.notification_id);
    const readMap = new Map(reads.map((r) => [r.notification_id, r]));
    let q = supabase.from('notifications').select('id, type, title, description, target_role, target_email, read, created_at, project_id, archived_at, category, resolved_at, event_key, metadata').in('id', archivedIds).is('resolved_at', null).order('created_at', { ascending: false }).limit(200);
    if (role === 'customer') {
      q = q.eq('target_email', user.email).in('type', CUSTOMER_ALLOWED_TYPES);
    } else if (role === 'editor') {
      q = q.not('type', 'in', `(${EDITOR_BLOCKED_PAYMENT_TYPES.map((t) => `"${t}"`).join(',')})`);
    }
    const { data } = await q;
    if (!data) return;
    setOldNotifications(data
      .filter((n) => filterByRole(n, role, adminRole, allowedMenus))
      .map((n) => {
        const userRead = readMap.get(n.id);
        return {
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          description: n.description || '',
          time: formatTimeAgo(n.created_at),
          read: true,
          created_at: n.created_at,
          targetRole: n.target_role,
          targetEmail: n.target_email || null,
          project_id: n.project_id || null,
          archived_at: userRead?.archived_at || n.archived_at || null,
          resolved_at: n.resolved_at || null,
          category: (n.category as NotificationCategory) || categoryForType(n.type as NotificationType),
          event_key: n.event_key || null,
          metadata: n.metadata || null,
        };
      }));
  }, [role, user, adminRole, allowedMenus]);

  const clearAll = useCallback(() => {
    const archivedAt = new Date().toISOString();
    setItems([]);
    setHasNewIndicator(false);
    if (supabase && user) {
      const ids = items.map((n) => n.id);
      if (ids.length > 0) {
        supabase.from('notification_reads')
          .upsert(ids.map((id) => ({ notification_id: id, user_id: user.id, archived_at: archivedAt, read_at: archivedAt })), { onConflict: 'notification_id,user_id' })
          .then().catch((err: unknown) => console.error('clearAll failed:', err));
      }
    }
  }, [items, user]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const getCountForMenu = useCallback(
    (menuKey: string) => {
      const types = menuTypeMap[menuKey];
      if (!types) return 0;
      return items.filter((n) => !n.read && types.includes(n.type)).length;
    },
    [items]
  );

  const getCountForCategory = useCallback(
    (category: NotificationCategory) => {
      const types = CATEGORY_MAP[category];
      return items.filter((n) => !n.read && types.includes(n.type)).length;
    },
    [items]
  );

  const value = useMemo(() => ({
    notifications: items, unreadCount, hasNewIndicator, lastSeenAt, getCountForMenu, getCountForCategory,
    pendingCounts, submittedTasks, paymentReminderProjects,
    addNotification, markAllRead, markRead, markMenuRead, markSeen, markAllReadOnOpen, markProjectMessagesRead,
    clearAll, archiveNotification, oldNotifications, loadOldNotifications, markTypesRead, clearTypes, resolveNotif, markCategoryRead, clearCategory,
  }), [items, unreadCount, hasNewIndicator, lastSeenAt, getCountForMenu, getCountForCategory,
       pendingCounts, submittedTasks, paymentReminderProjects, addNotification, markAllRead, markRead,
       markMenuRead, markSeen, markAllReadOnOpen, markProjectMessagesRead, clearAll, archiveNotification,
       oldNotifications, loadOldNotifications, markTypesRead, clearTypes, resolveNotif, markCategoryRead, clearCategory]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function formatNotifDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function useNotifications() {
  return useContext(NotificationContext);
}
