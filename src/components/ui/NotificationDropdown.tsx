import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, ArrowRight, X, MessageSquare, AlertCircle, DollarSign,
  FolderKanban, CheckCircle2, Receipt, Clock, Send, Loader2,
  CheckCheck, Trash2, Check, Search, Eye, ExternalLink,
  ChevronDown, History,
} from 'lucide-react';
import type { PageKey } from '../Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications, AppNotification, NotificationType, NotificationCategory, CATEGORY_MAP, CATEGORY_LABELS, formatNotifDateTime } from '../../contexts/NotificationContext';
import { getNotificationTarget } from '../../utils/notificationNav';
import {
  fetchProject, fetchProjectMessages, fetchCorrectionsByProject,
  fetchPayment, fetchInvoice, createProjectMessage, ProjectMessage,
  fetchProjects,
} from '../../data/db';
import type { Project } from '../../data/db';

interface NotificationDropdownProps {
  onClose: () => void;
  onNavigate: (page: PageKey, params?: Record<string, unknown>) => void;
  className?: string;
}

interface CategoryConfig {
  category: NotificationCategory;
  icon: typeof Bell;
  color: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  { category: 'project', icon: FolderKanban, color: 'text-primary-500' },
  { category: 'task', icon: CheckCircle2, color: 'text-accent-500' },
  { category: 'review', icon: AlertCircle, color: 'text-error-500' },
  { category: 'payment', icon: DollarSign, color: 'text-success-500' },
  { category: 'chat', icon: MessageSquare, color: 'text-sky-500' },
  { category: 'reminder', icon: Clock, color: 'text-warning-500' },
];

// Tabs hidden from customers — they don't receive task notifications, and
// payment reminders are folded into the Payment tab instead of Reminder.
const CUSTOMER_HIDDEN_CATEGORIES: NotificationCategory[] = ['task', 'reminder'];
const EDITOR_HIDDEN_CATEGORIES: NotificationCategory[] = ['reminder'];

function getCategoryLabel(cat: NotificationCategory, role?: string): string {
  if (role === 'editor' && cat === 'payment') return 'Earnings';
  return CATEGORY_LABELS[cat];
}

function getNotificationCategory(n: AppNotification, role: string | null): NotificationCategory {
  if (role === 'customer' && CUSTOMER_PAYMENT_REMINDER_TYPES.includes(n.type)) return 'payment';
  for (const [category, types] of Object.entries(CATEGORY_MAP)) {
    if (types.includes(n.type)) return category as NotificationCategory;
  }
  return 'project';
}

// For customers, deadline/payment-reminder notifications should appear under
// the Payment tab rather than the Reminder tab.
const CUSTOMER_PAYMENT_REMINDER_TYPES: NotificationType[] = ['deadline', 'payment', 'invoice', 'invoice-generated', 'payment-received'];

const QUICK_VIEWABLE: NotificationType[] = ['message', 'correction', 'payment', 'invoice', 'project', 'new-order', 'approval', 'task-complete', 'review-ready', 'review-approved', 'review-feedback', 'project-completed'];

function resolveProjectId(n: AppNotification, projectMap: Map<string, Project>): string | null {
  if (n.project_id) return n.project_id;
  const metadataProjectId = n.metadata?.project_id;
  if (typeof metadataProjectId === 'string' && metadataProjectId) return metadataProjectId;
  return getProject(n, projectMap)?.id || null;
}

function withProjectReference(n: AppNotification, projectMap: Map<string, Project>): AppNotification {
  const projectId = resolveProjectId(n, projectMap);
  return projectId && !n.project_id ? { ...n, project_id: projectId } : n;
}

function canQuickView(n: AppNotification, projectMap: Map<string, Project>): boolean {
  return QUICK_VIEWABLE.includes(n.type) && !!resolveProjectId(n, projectMap);
}

function getNotifTimestamp(n: AppNotification): number {
  if (n.created_at) return new Date(n.created_at).getTime();
  const match = n.time.match(/(\d+)\s*(min|hour|day|week|month)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const mult = unit === 'min' ? 60000 : unit === 'hour' ? 3600000 : unit === 'day' ? 86400000 : unit === 'week' ? 604800000 : unit === 'month' ? 2592000000 : 0;
    return Date.now() - val * mult;
  }
  if (n.time === 'Just now') return Date.now();
  return 0;
}

function getProjectOrderNumber(n: AppNotification): string | null {
  const match = `${n.title} ${n.description}`.match(/\b[A-Z]{2}\d{2}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i);
  return match?.[0] || null;
}

function getProject(n: AppNotification, projectMap: Map<string, Project>): Project | undefined {
  if (n.project_id) {
    const project = projectMap.get(n.project_id);
    if (project) return project;
  }
  const orderNumber = getProjectOrderNumber(n)?.toUpperCase();
  if (!orderNumber) return undefined;
  return Array.from(projectMap.values()).find((p) => p.order_number.toUpperCase() === orderNumber);
}

function hasProjectReference(n: AppNotification, projectMap: Map<string, Project>): boolean {
  return !!getProject(n, projectMap) || !!getProjectOrderNumber(n);
}

function getActivityKey(n: AppNotification, projectMap: Map<string, Project>): string {
  const title = n.title.toLowerCase();
  const description = n.description.toLowerCase();
  const statusMatch = title.match(/status (?:changed|updated) to ([a-z_-]+)/i)
    || description.match(/status (?:changed|updated)(?: from [a-z_-]+)? to ([a-z_-]+)/i);
  if (statusMatch && (n.project_id || getProjectOrderNumber(n))) {
    return `status:${getProjectGroupId(n, projectMap)}:${statusMatch[1]}`;
  }
  return `notification:${n.id}`;
}

function getProjectGroupId(n: AppNotification, projectMap: Map<string, Project>): string {
  const project = getProject(n, projectMap);
  if (project?.order_number) return `order-${project.order_number.toUpperCase()}`;
  if (n.project_id) return `project-${n.project_id}`;
  const orderNumber = getProjectOrderNumber(n);
  return orderNumber ? `order-${orderNumber.toUpperCase()}` : `unlinked-${n.id}`;
}

function getProjectLabel(n: AppNotification, projectMap: Map<string, Project>): string {
  const project = getProject(n, projectMap);
  if (project) return `${project.order_number} — ${project.event_name}`;
  return getProjectOrderNumber(n) || 'Unlinked';
}

function getProjectSublabel(n: AppNotification, projectMap: Map<string, Project>): string {
  const project = getProject(n, projectMap);
  return project?.customer_name || project?.category || '';
}

interface NotifGroup {
  key: string;
  label: string;
  sublabel: string;
  items: AppNotification[];
  latestAt: number;
  unreadCount: number;
}

function groupByProject(items: AppNotification[], projectMap: Map<string, Project>): NotifGroup[] {
  const groups = new Map<string, NotifGroup>();
  const seenIds = new Set<string>();
  for (const n of items) {
    if (seenIds.has(n.id)) continue;
    seenIds.add(n.id);
    const key = getProjectGroupId(n, projectMap);
    const label = getProjectLabel(n, projectMap);
    const sublabel = getProjectSublabel(n, projectMap);
    const ts = getNotifTimestamp(n);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(n);
      if (ts > existing.latestAt) existing.latestAt = ts;
      if (!n.read) existing.unreadCount++;
    } else {
      groups.set(key, { key, label, sublabel, items: [n], latestAt: ts, unreadCount: n.read ? 0 : 1 });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.latestAt - a.latestAt);
}

function formatLatestTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function useHorizontalSwipe(onSwipeRight: () => void, onSwipeLeft: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    startRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    swipedRef.current = false;
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    const touch = event.changedTouches[0];
    startRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    swipedRef.current = true;
    if (deltaX > 0) onSwipeRight();
    else onSwipeLeft();
  };

  const onClick = (event: MouseEvent<HTMLDivElement>, onTap: () => void) => {
    if (swipedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      swipedRef.current = false;
      return;
    }
    onTap();
  };

  return { onTouchStart, onTouchEnd, onClick };
}

export default function NotificationDropdown({ onClose, onNavigate, className = '' }: NotificationDropdownProps) {
  const { role, user } = useAuth();
  const {
    notifications, unreadCount, hasNewIndicator, pendingCounts, lastSeenAt,
    markRead, markSeen, resolveNotif, markCategoryRead,
    clearCategory, archiveNotification, getCountForCategory, oldNotifications, loadOldNotifications,
  } = useNotifications();
  const [quickView, setQuickView] = useState<AppNotification | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectMap, setProjectMap] = useState<Map<string, Project>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOlder, setShowOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [displayCount, setDisplayCount] = useState(30);
  const touchStartY = useRef<number | null>(null);
  const seenAtMountRef = useRef<number>(lastSeenAt ? new Date(lastSeenAt).getTime() : Date.now());
  const initialTabSetRef = useRef(false);

  useEffect(() => { markSeen(); }, [markSeen]);
  useEffect(() => { loadOldNotifications(); }, [loadOldNotifications]);

  useEffect(() => {
    let active = true;
    (async () => {
      const projects = await fetchProjects();
      if (!active) return;
      setProjectMap(new Map(projects.map((p) => [p.id, p])));
    })();
    return () => { active = false; };
  }, []);

  const handleOpen = useCallback((n: AppNotification) => {
    const notification = withProjectReference(n, projectMap);
    markRead(notification.id);
    const t = getNotificationTarget(notification, role);
    onClose();
    onNavigate(t.page, t.params);
  }, [markRead, onClose, onNavigate, projectMap, role]);

  const handleClose = useCallback(() => {
    markSeen();
    onClose();
  }, [markSeen, onClose]);

  // Merge current + old notifications, dedupe by id
  const allNotifications = useMemo(() => {
    const merged = Array.from(new Map(
      [...notifications, ...oldNotifications].map((n) => [n.id, n]),
    ).values()).sort((a, b) => getNotifTimestamp(b) - getNotifTimestamp(a));
    const seenActivities = new Set<string>();
    return merged.filter((notification) => {
      const key = getActivityKey(notification, projectMap);
      if (seenActivities.has(key)) return false;
      seenActivities.add(key);
      return true;
    });
  }, [notifications, oldNotifications, projectMap]);

  // Filter by category tab
  const categoryFiltered = useMemo(() => {
    if (role === 'customer' && activeTab === 'payment') {
      return allNotifications.filter((n) => CUSTOMER_PAYMENT_REMINDER_TYPES.includes(n.type));
    }
    const types = CATEGORY_MAP[activeTab];
    return allNotifications.filter((n) => types.includes(n.type));
  }, [allNotifications, activeTab, role]);

  // Filter by search query
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter((n) => {
      const label = getProjectLabel(n, projectMap).toLowerCase();
      const sublabel = getProjectSublabel(n, projectMap).toLowerCase();
      return label.includes(q) || sublabel.includes(q) || n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q);
    });
  }, [categoryFiltered, searchQuery, projectMap]);

  // Split into new (since last seen) and older notifications
  const { newItems, olderItems } = useMemo(() => {
    const threshold = seenAtMountRef.current;
    const withTs = searchFiltered.map((n) => ({ n, ts: getNotifTimestamp(n) }));
    const fresh = withTs.filter((x) => !x.n.read || x.ts >= threshold).map((x) => x.n);
    const old = withTs.filter((x) => x.n.read && x.ts < threshold).map((x) => x.n);
    return { newItems: fresh, olderItems: old };
  }, [searchFiltered]);

  // Group only older notifications by project
  const olderGroups = useMemo(() => groupByProject(olderItems, projectMap), [olderItems, projectMap]);

  // Paginated groups for infinite scroll
  const visibleGroups = olderGroups.slice(0, displayCount);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && displayCount < olderGroups.length) {
      setDisplayCount((prev) => Math.min(prev + 20, olderGroups.length));
    }
  }, [displayCount, olderGroups.length]);

  useEffect(() => { setDisplayCount(30); setShowOlder(false); }, [activeTab, searchQuery]);

  // If the active tab is hidden for the current role, fall back to 'all'.
  useEffect(() => {
    const hidden = role === 'customer' ? CUSTOMER_HIDDEN_CATEGORIES : role === 'editor' ? EDITOR_HIDDEN_CATEGORIES : [];
    if (hidden.includes(activeTab)) {
      const fallback = CATEGORY_CONFIGS.find((config) => !hidden.includes(config.category));
      if (fallback) setActiveTab(fallback.category);
    }
  }, [role, activeTab]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleTabMarkAllRead = () => {
    markCategoryRead(activeTab);
  };

  const handleTabClear = () => {
    clearCategory(activeTab);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = event.changedTouches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartY.current;
    touchStartY.current = null;
    const endY = event.changedTouches[0]?.clientY;
    if (startY !== null && endY !== undefined && endY - startY > 56) onClose();
  };

  const tabUnreadCount = (cat: NotificationCategory) => {
    if (role === 'customer' && cat === 'payment') {
      return allNotifications.filter((n) => !n.read && CUSTOMER_PAYMENT_REMINDER_TYPES.includes(n.type)).length;
    }
    return getCountForCategory(cat);
  };

  const visibleCategoryConfigs = useMemo(() => {
    let configs = CATEGORY_CONFIGS;
    if (role === 'customer') configs = configs.filter((c) => !CUSTOMER_HIDDEN_CATEGORIES.includes(c.category));
    if (role === 'editor') configs = configs.filter((c) => !EDITOR_HIDDEN_CATEGORIES.includes(c.category));
    return configs;
  }, [role]);

  useEffect(() => {
    if (initialTabSetRef.current || allNotifications.length === 0) return;
    const visibleCategories = new Set(visibleCategoryConfigs.map((config) => config.category));
    const latestUnread = allNotifications.find((notification) => {
      return !notification.read && visibleCategories.has(getNotificationCategory(notification, role));
    });
    if (latestUnread) setActiveTab(getNotificationCategory(latestUnread, role));
    initialTabSetRef.current = true;
  }, [allNotifications, role, visibleCategoryConfigs]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`bg-white dark:bg-ink-900 rounded-2xl shadow-float border border-ink-100 dark:border-ink-800 overflow-hidden animate-scale-in w-full max-w-full min-w-0 flex flex-col max-h-[calc(100dvh-2rem)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-4 h-4 text-primary-500" />
            {hasNewIndicator && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-error-500 animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Notifications</p>
            {unreadCount > 0 ? (
              <p className="text-[10px] text-primary-600 dark:text-primary-400 font-medium">{unreadCount} unread</p>
            ) : lastSeenAt ? (
              <p className="text-[10px] text-ink-400 mt-0.5">
                Last checked {new Date(lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                {new Date(lastSeenAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={handleTabMarkAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 transition-colors" title="Mark all read">
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {allNotifications.length > 0 && (
            <button onClick={handleTabClear} className="text-xs text-error-500 hover:text-error-600 font-semibold flex items-center gap-1 transition-colors" title="Clear all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleClose} className="text-xs text-ink-400 hover:text-ink-600 font-semibold flex items-center gap-1 transition-colors" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pending action items banner */}
      {pendingCounts.total > 0 && (
        <div className="px-4 py-2 bg-warning-50/50 dark:bg-warning-500/10 border-b border-warning-100 dark:border-warning-500/20">
          <p className="text-[10px] font-semibold text-warning-600 dark:text-warning-400 uppercase tracking-wider mb-1">Unresolved Action Items</p>
          <div className="flex flex-wrap gap-1.5">
            {pendingCounts.newOrders > 0 && (
              <button onClick={() => { onClose(); onNavigate(role === 'editor' ? 'available-works' : 'projects'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.newOrders} new orders <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            {pendingCounts.approvalPending > 0 && (
              <button onClick={() => { onClose(); onNavigate(role === 'editor' ? 'my-works' : 'order-tracking'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300 hover:bg-accent-200 dark:hover:bg-accent-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.approvalPending} approvals <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            {pendingCounts.correctionPending > 0 && (
              <button onClick={() => { onClose(); onNavigate('corrections'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-error-100 dark:bg-error-500/20 text-error-700 dark:text-error-300 hover:bg-error-200 dark:hover:bg-error-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.correctionPending} corrections <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            {pendingCounts.reviewApproved > 0 && (
              <button onClick={() => { onClose(); onNavigate('finance'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.reviewApproved} to invoice <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            {pendingCounts.paymentReminder > 0 && (
              <button onClick={() => { onClose(); onNavigate(role === 'customer' ? 'pending-payments' : 'finance'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-warning-100 dark:bg-warning-500/20 text-warning-700 dark:text-warning-300 hover:bg-warning-200 dark:hover:bg-warning-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.paymentReminder} payments <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
            {pendingCounts.paymentPending > 0 && role === 'customer' && (
              <button onClick={() => { onClose(); onNavigate('pending-payments'); }} className="text-[10px] px-2 py-0.5 rounded-full bg-warning-100 dark:bg-warning-500/20 text-warning-700 dark:text-warning-300 hover:bg-warning-200 dark:hover:bg-warning-500/30 transition-colors flex items-center gap-1 font-semibold">
                {pendingCounts.paymentPending} pending <ArrowRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-ink-100 dark:border-ink-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project, name, or code..."
            className="w-full h-8 pl-8 pr-3 text-xs border border-ink-200 dark:border-ink-700 rounded-lg outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all bg-ink-50 dark:bg-ink-800/50 text-ink-700 dark:text-ink-200 placeholder:text-ink-400"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="overflow-x-auto scrollbar-hide border-b border-ink-100 dark:border-ink-800">
        <div className="flex min-w-max px-1" role="tablist">
          {visibleCategoryConfigs.map((config) => {
            const count = tabUnreadCount(config.category);
            const isActive = activeTab === config.category;
            const CatIcon = config.icon;
            return (
              <button
                key={config.category}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(config.category)}
                className={`relative min-h-11 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'}`}
              >
                <CatIcon className={`w-3 h-3 ${config.color}`} />
                {getCategoryLabel(config.category, role)}
                {count > 0 && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-error-500 rounded-full">{count}</span>}
                {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable notification list */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-[180px] sm:min-h-[240px] overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(55vh, 520px)' }}>
        {newItems.length === 0 && olderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="w-8 h-8 text-ink-200 dark:text-ink-700 mb-2" />
            <p className="text-sm text-ink-400">{searchQuery.trim() ? 'No results found' : 'No notifications'}</p>
          </div>
        ) : (
          <div className="py-1">
            {/* New notifications — individual cards */}
            {newItems.length > 0 && (
              <div className="px-2 pt-1 pb-0.5">
                <p className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider px-1 py-1">New</p>
                {newItems.map((n) => (
                  <NewNotifCard
                    key={n.id}
                    n={n}
                    projectMap={projectMap}
                    onOpen={() => handleOpen(n)}
                    onQuickView={() => { markRead(n.id); setQuickView(withProjectReference(n, projectMap)); }}
                    onSwipeRight={() => markRead(n.id)}
                    onSwipeLeft={() => archiveNotification(n.id)}
                  />
                ))}
              </div>
            )}

            {/* Show Older toggle */}
            {olderItems.length > 0 && (
              <button
                onClick={() => setShowOlder((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 mx-2 my-1 text-[11px] font-semibold text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
                style={{ width: 'calc(100% - 1rem)' }}
              >
                <History className="w-3.5 h-3.5" />
                {showOlder ? 'Hide older' : `Show older (${olderItems.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOlder ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Older notifications — grouped by project */}
            {showOlder && olderGroups.length > 0 && (
              <div className="px-2 pt-0.5">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 py-1">Earlier</p>
                {visibleGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  const latestTime = formatLatestTime(group.latestAt);
                  const hasUnread = group.unreadCount > 0;
                  return (
                    <div key={group.key} className={`rounded-lg my-1 overflow-hidden transition-all ${hasUnread ? 'border border-primary-500/20 dark:border-primary-500/30' : 'border border-ink-100/70 dark:border-ink-800/70'}`}>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${hasUnread ? 'bg-primary-500/10 dark:bg-primary-500/10 hover:bg-primary-500/15' : 'bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasUnread ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'bg-ink-100 dark:bg-ink-700'}`}>
                          <FolderKanban className={`w-3.5 h-3.5 ${hasUnread ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate ${hasUnread ? 'font-bold text-ink-800 dark:text-ink-100' : 'font-semibold text-ink-600 dark:text-ink-300'}`}>{group.label}</p>
                          {group.sublabel && (
                            <p className="text-[10px] text-ink-400 dark:text-ink-500 truncate mt-0.5">{group.sublabel}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {group.items.length > 1 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[9px] font-bold text-white bg-ink-400 dark:bg-ink-600 rounded-full flex-shrink-0">{group.items.length}</span>
                          )}
                          {hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary-600/80 animate-pulse" />}
                          <span className="text-[10px] text-ink-400">{latestTime}</span>
                          {group.items.length > 1 && <ChevronDown className={`w-3.5 h-3.5 text-ink-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-0 pb-0 space-y-0 bg-white dark:bg-ink-900 border-t border-ink-100 dark:border-ink-800">
                          {group.items
                            .sort((a, b) => getNotifTimestamp(b) - getNotifTimestamp(a))
                            .map((n) => (
                              <NotificationRow
                                key={n.id}
                                n={n}
                                onOpen={() => handleOpen(n)}
                                onQuickView={() => { markRead(n.id); setQuickView(withProjectReference(n, projectMap)); }}
                                onResolve={() => resolveNotif(n.id)}
                                projectMap={projectMap}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {displayCount < olderGroups.length && (
                  <div className="py-2 text-center">
                    <Loader2 className="w-4 h-4 text-ink-300 animate-spin inline-block" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-view modal */}
      {quickView && (
        <QuickViewModal
          notification={quickView}
          onClose={() => setQuickView(null)}
          onOpenProject={() => { handleOpen(quickView); }}
          role={role}
          userId={user?.id}
        />
      )}
    </div>
  );
}

// --- New Notification Card (individual, expanded) ---

function NewNotifCard({ n, projectMap, onOpen, onQuickView, onSwipeRight, onSwipeLeft }: { n: AppNotification; projectMap: Map<string, Project>; onOpen: () => void; onQuickView: () => void; onSwipeRight: () => void; onSwipeLeft: () => void }) {
  const project = getProject(n, projectMap);
  const showQuickView = canQuickView(n, projectMap);
  const showOpen = !showQuickView || n.type === 'deadline' || n.type === 'rating';
  const swipe = useHorizontalSwipe(onSwipeRight, onSwipeLeft);
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    swipe.onClick(event, () => {
      if (showQuickView) onQuickView();
      else if (showOpen) onOpen();
      else onOpen();
    });
  };
  return (
    <div onClick={handleClick} onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd} className={`rounded-xl my-1 p-3 transition-all cursor-pointer select-none ${!n.read ? 'bg-primary-500/8 dark:bg-primary-500/10 border border-primary-500/20 dark:border-primary-500/30' : 'bg-ink-50/60 dark:bg-ink-800/40 border border-ink-100/70 dark:border-ink-800/70'} hover:shadow-sm active:scale-[0.98]`}>
      <div className="flex items-center gap-1.5 mb-1">
        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary-600/80 animate-pulse flex-shrink-0" />}
        <p className="text-[10px] text-ink-400 dark:text-ink-500">{n.created_at ? formatNotifDateTime(n.created_at) : n.time}</p>
        {project && <span className="text-[10px] text-ink-400 dark:text-ink-500 truncate">· {project.order_number}</span>}
      </div>
      <p className={`text-xs ${!n.read ? 'font-bold text-ink-800 dark:text-ink-100' : 'font-semibold text-ink-600 dark:text-ink-300'}`}>{n.title}</p>
      <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">{n.description}</p>
      <div className="flex items-center gap-1 mt-2">
        {showQuickView && (
          <span onClick={(e) => { e.stopPropagation(); onQuickView(); }} className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors">
            <Eye className="w-3 h-3" /> Quick view
          </span>
        )}
        {showOpen && (
          <span onClick={(e) => { e.stopPropagation(); onOpen(); }} className="text-[10px] font-semibold text-ink-500 hover:text-primary-600 flex items-center gap-1 transition-colors ml-auto">
            Open <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

// --- Notification Row ---

function NotificationRow({ n, projectMap, onOpen, onQuickView, onResolve }: { n: AppNotification; projectMap: Map<string, Project>; onOpen: () => void; onQuickView: () => void; onResolve: () => void }) {
  const showQuickView = canQuickView(n, projectMap);
  const showOpen = !showQuickView || n.type === 'deadline' || n.type === 'rating';
  const isResolved = !!n.resolved_at;
  const handleClick = () => {
    if (showQuickView) onQuickView();
    else if (showOpen) onOpen();
    else onOpen();
  };
  return (
    <div onClick={handleClick} className={`flex items-start gap-2 px-3 py-2.5 rounded-none border-b border-ink-50 dark:border-ink-800/50 transition-all cursor-pointer select-none ${!n.read ? 'bg-primary-500/10 dark:bg-primary-500/10' : 'bg-white dark:bg-ink-900'} ${isResolved ? 'opacity-50' : ''} hover:bg-ink-50 dark:hover:bg-ink-800/40 active:bg-ink-100 dark:active:bg-ink-800`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[10px] text-ink-400 dark:text-ink-500 whitespace-nowrap">{n.created_at ? formatNotifDateTime(n.created_at) : n.time}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary-600/80 animate-pulse flex-shrink-0" />}
          {isResolved && <Check className="w-3 h-3 text-success-500 flex-shrink-0" />}
          <p className={`text-xs truncate ${!n.read ? 'font-semibold text-ink-800 dark:text-ink-100' : 'font-medium text-ink-600 dark:text-ink-300'}`}>{n.title}</p>
        </div>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-1">{n.description}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {showQuickView && (
          <button onClick={(e) => { e.stopPropagation(); onQuickView(); }} className="w-9 h-9 flex items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors" title="Quick view">
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {showOpen && (
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary-600 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors" title="Open">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onResolve(); }} className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-400 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-500/10 transition-colors" title="Resolve">
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Quick View Modal ---

interface QuickViewModalProps {
  notification: AppNotification;
  onClose: () => void;
  onOpenProject: () => void;
  role?: string;
  userId?: string;
}

function QuickViewModal({ notification, onClose, onOpenProject, userId }: QuickViewModalProps) {
  const projectId = notification.project_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const msgScrollRef = useRef<HTMLDivElement>(null);

  const [corrections, setCorrections] = useState<{ id: string; number: string | null; status: string; priority: string; photo_marks: unknown[]; video_timestamps: unknown[]; voice_notes: unknown[] }[]>([]);

  const [paymentInfo, setPaymentInfo] = useState<{ amount: number; status: string; paid_at: string | null } | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<{ invoice_number: string | null; current_amount: number; status: string; invoice_type: string } | null>(null);

  const [projectInfo, setProjectInfo] = useState<{ order_number: string; event_name: string; status: string; progress: number; customer_name: string; editor_name: string | null; amount: number } | null>(null);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const project = await fetchProject(projectId);
        if (!active || !project) { if (active) setLoading(false); return; }
        setProjectInfo({
          order_number: project.order_number,
          event_name: project.event_name,
          status: project.status,
          progress: project.progress,
          customer_name: project.customer_name,
          editor_name: project.editor_name,
          amount: project.amount,
        });

        if (notification.type === 'message') {
          const msgs = await fetchProjectMessages(projectId);
          if (active) setMessages(msgs);
        } else if (notification.type === 'correction') {
          const corrs = await fetchCorrectionsByProject(projectId);
          if (active) setCorrections(corrs.map((c) => ({
            id: c.id, number: c.number, status: c.status, priority: c.priority,
            photo_marks: c.photo_marks, video_timestamps: c.video_timestamps, voice_notes: c.voice_notes,
          })));
        } else if (notification.type === 'payment' || notification.type === 'invoice') {
          const [pay, inv] = await Promise.all([
            fetchPayment(projectId),
            fetchInvoice(projectId),
          ]);
          if (active) {
            if (pay) setPaymentInfo({ amount: pay.amount, status: pay.status, paid_at: pay.paid_at });
            if (inv) setInvoiceInfo({ invoice_number: inv.invoice_number, current_amount: inv.current_amount, status: inv.status, invoice_type: inv.invoice_type });
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load');
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [projectId, notification.type]);

  useEffect(() => {
    if (msgScrollRef.current) {
      const el = msgScrollRef.current;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !userId || !projectId) return;
    setSending(true);
    try {
      const created = await createProjectMessage(projectId, userId, trimmed, false);
      if (created) setMessages((prev) => [...prev, created]);
      setReplyText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    }
    setSending(false);
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };

  const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const senderLabel = (m: ProjectMessage): string => {
    const r = m.sender?.role;
    if (r === 'admin') return 'Admin';
    if (r === 'editor') return 'Editor';
    if (r === 'customer') return 'Customer';
    return 'User';
  };

  const isMine = (m: ProjectMessage): boolean => m.sender_id === userId;

  const statusLabel = (s: string): string => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const statusColor = (s: string): string => {
    if (s === 'paid' || s === 'approved' || s === 'completed') return 'text-success-600 bg-success-100 dark:bg-success-500/20 dark:text-success-400';
    if (s === 'pending' || s === 'in-progress' || s === 'sent') return 'text-warning-600 bg-warning-100 dark:bg-warning-500/20 dark:text-warning-400';
    if (s === 'rejected' || s === 'overdue') return 'text-error-600 bg-error-100 dark:bg-error-500/20 dark:text-error-400';
    return 'text-ink-600 bg-ink-100 dark:bg-ink-700 dark:text-ink-300';
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-ink-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto">
        <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[min(86vh,800px)] bg-white dark:bg-ink-900 rounded-t-2xl sm:rounded-2xl shadow-float border border-ink-100 dark:border-ink-800 flex flex-col animate-scale-in overflow-hidden my-auto">
        <div className="flex items-start justify-between px-4 sm:px-5 py-4 border-b border-ink-100 dark:border-ink-800">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{notification.title}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">{notification.description}</p>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 flex-shrink-0" aria-label="Close preview">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-error-500">{error}</p>
              <button onClick={onOpenProject} className="mt-3 text-xs text-primary-600 font-semibold">Open full page instead</button>
            </div>
          ) : (
            <>
              {projectInfo && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{projectInfo.event_name}</p>
                    <p className="text-xs text-ink-400">{projectInfo.order_number} · {projectInfo.customer_name}{projectInfo.editor_name ? ` · ${projectInfo.editor_name}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(projectInfo.status)}`}>{statusLabel(projectInfo.status)}</span>
                    <p className="text-[10px] text-ink-400 mt-0.5">{projectInfo.progress}% done</p>
                  </div>
                </div>
              )}

              {notification.type === 'message' && (
                <div className="flex flex-col h-[280px] sm:h-[340px]">
                  <div ref={msgScrollRef} className="flex-1 overflow-y-auto space-y-2.5 px-1">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="w-8 h-8 text-ink-200 dark:text-ink-700 mb-2" />
                        <p className="text-sm text-ink-400">No messages yet</p>
                      </div>
                    ) : messages.map((m) => {
                      const mine = isMine(m);
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!mine && <span className="text-[10px] font-semibold text-ink-500 mb-0.5">{senderLabel(m)}</span>}
                            <div className={`px-3 py-2 text-sm break-words rounded-2xl ${mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 rounded-bl-md'}`}>
                              {m.message}
                            </div>
                            <span className={`text-[10px] text-ink-400 mt-0.5 ${mine ? 'text-right' : 'text-left'}`}>{formatMsgTime(m.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-ink-100 dark:border-ink-800 pt-3 mt-2">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        placeholder="Type a reply..."
                        rows={1}
                        className="flex-1 px-3 py-2 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white max-h-20"
                        disabled={sending}
                      />
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim() || sending}
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors flex-shrink-0"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {notification.type === 'correction' && (
                <div className="space-y-2">
                  {corrections.length === 0 ? (
                    <p className="text-sm text-ink-400 text-center py-6">No corrections found</p>
                  ) : corrections.map((c) => {
                    const total = (c.photo_marks as unknown[]).length + (c.video_timestamps as unknown[]).length + (c.voice_notes as unknown[]).length;
                    return (
                      <div key={c.id} className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{c.number || 'Correction'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                          <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {total} items</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.priority}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(notification.type === 'payment' || notification.type === 'invoice') && (
                <div className="space-y-3">
                  {paymentInfo && (
                    <div className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-success-500" />
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Payment</span>
                        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(paymentInfo.status)}`}>{statusLabel(paymentInfo.status)}</span>
                      </div>
                      <p className="text-lg font-bold text-ink-800 dark:text-white">₹{paymentInfo.amount.toLocaleString('en-IN')}</p>
                      {paymentInfo.paid_at && <p className="text-xs text-ink-400 mt-1">Paid on {new Date(paymentInfo.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                    </div>
                  )}
                  {invoiceInfo && (
                    <div className="p-3 rounded-xl border border-ink-100 dark:border-ink-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">Invoice {invoiceInfo.invoice_number || ''}</span>
                        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(invoiceInfo.status)}`}>{statusLabel(invoiceInfo.status)}</span>
                      </div>
                      <p className="text-lg font-bold text-ink-800 dark:text-white">₹{invoiceInfo.current_amount.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-ink-400 mt-1 capitalize">{invoiceInfo.invoice_type} invoice</p>
                    </div>
                  )}
                  {!paymentInfo && !invoiceInfo && <p className="text-sm text-ink-400 text-center py-6">No payment records found</p>}
                </div>
              )}

              {projectInfo && ['project', 'new-order', 'approval', 'task-complete', 'review-ready', 'review-approved', 'review-feedback', 'project-completed'].includes(notification.type) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-[10px] text-ink-400 uppercase tracking-wider">Amount</p>
                      <p className="text-sm font-bold text-ink-800 dark:text-white mt-0.5">₹{projectInfo.amount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                      <p className="text-[10px] text-ink-400 uppercase tracking-wider">Progress</p>
                      <p className="text-sm font-bold text-ink-800 dark:text-white mt-0.5">{projectInfo.progress}%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50">
                    <p className="text-[10px] text-ink-400 uppercase tracking-wider">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor(projectInfo.status)}`}>{statusLabel(projectInfo.status)}</span>
                      {projectInfo.editor_name && <span className="text-xs text-ink-400">· {projectInfo.editor_name}</span>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-ink-100 dark:border-ink-800">
          <button onClick={onOpenProject} className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl transition-colors">
            Open full project page <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
