import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  Bell, FolderKanban, Clock, AlertCircle, CheckCircle2, IndianRupee,
  Check, Trash2, ArrowLeft, Eye, ExternalLink, MessageSquare, Star,
  X, Send, Loader2, DollarSign, Receipt, ArrowRight, CheckCheck, History,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { FullPageSpinner } from '../components/ui/LoadingScreen';
import { useNotifications, AppNotification, NotificationType, NotificationCategory, CATEGORY_MAP, CATEGORY_LABELS, formatNotifDateTime } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import type { PageKey } from '../components/Layout';
import { getNotificationTarget } from '../utils/notificationNav';
import {
  fetchProject, fetchProjectMessages, fetchCorrectionsByProject,
  fetchPayment, fetchInvoice, createProjectMessage, ProjectMessage,
  fetchProjects, fetchAllTasks,
} from '../data/db';
import type { Project } from '../data/db';

const CUSTOMER_HIDDEN_CATEGORIES: NotificationCategory[] = ['task', 'reminder'];
const EDITOR_HIDDEN_CATEGORIES: NotificationCategory[] = ['reminder'];

function getCategoryLabel(cat: NotificationCategory, role?: string): string {
  if (role === 'editor' && cat === 'payment') return 'Earnings';
  return CATEGORY_LABELS[cat];
}

const QUICK_VIEWABLE: NotificationType[] = ['message', 'correction', 'payment', 'invoice', 'project', 'new-order', 'approval', 'task-approved', 'task-assigned', 'task-complete'];

function canQuickView(n: AppNotification): boolean {
  return QUICK_VIEWABLE.includes(n.type) && !!n.project_id;
}

interface ProjectGroup {
  key: string;
  label: string;
  sublabel: string;
  items: AppNotification[];
  latestAt: number;
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

function getProjectOrderNumber(notification: AppNotification): string | null {
  const match = `${notification.title} ${notification.description}`.match(/\b[A-Z]{2}\d{2}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i);
  return match?.[0] || null;
}

function getTaskName(notification: AppNotification): string | null {
  const match = `${notification.title} ${notification.description}`.match(/(?:approved|assigned|picked up) "([^"]+)"/i);
  return match?.[1] || null;
}

function getProject(notification: AppNotification, projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): Project | undefined {
  if (notification.project_id) {
    const project = projectMap.get(notification.project_id);
    if (project) return project;
  }
  const orderNumber = getProjectOrderNumber(notification)?.toUpperCase();
  if (orderNumber) return Array.from(projectMap.values()).find((project) => project.order_number.toUpperCase() === orderNumber);
  const taskName = getTaskName(notification);
  const taskProjects = taskName ? taskProjectMap.get(taskName.toLowerCase()) || [] : [];
  if (taskProjects.length === 1) return taskProjects[0];
  const description = `${notification.title} ${notification.description}`.toLowerCase();
  const matchingProjects = Array.from(projectMap.values()).filter((project) => project.event_name && description.includes(project.event_name.trim().toLowerCase()));
  return matchingProjects.length === 1 ? matchingProjects[0] : undefined;
}

function hasProjectReference(notification: AppNotification, projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): boolean {
  return !!getProject(notification, projectMap, taskProjectMap) || !!getProjectOrderNumber(notification);
}

function getProjectGroupId(notification: AppNotification, projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): string {
  const project = getProject(notification, projectMap, taskProjectMap);
  if (project?.order_number) return `order-${project.order_number.toUpperCase()}`;
  if (notification.project_id) return `project-${notification.project_id}`;
  const orderNumber = getProjectOrderNumber(notification);
  return orderNumber ? `order-${orderNumber.toUpperCase()}` : `unlinked-${notification.id}`;
}

function getProjectLabel(notification: AppNotification, projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): string {
  const project = getProject(notification, projectMap, taskProjectMap);
  if (project) return `${project.order_number} — ${project.event_name}`;
  return getProjectOrderNumber(notification) || 'Unlinked';
}

function getProjectSublabel(notification: AppNotification, projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): string {
  const project = getProject(notification, projectMap, taskProjectMap);
  return project?.customer_name || project?.category || '';
}

function groupByProject(items: AppNotification[], projectMap: Map<string, Project>, taskProjectMap: Map<string, Project[]>): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  const seenIds = new Set<string>();
  for (const n of items) {
    if (seenIds.has(n.id)) continue;
    seenIds.add(n.id);
    const key = getProjectGroupId(n, projectMap, taskProjectMap);
    const label = getProjectLabel(n, projectMap, taskProjectMap);
    const sublabel = getProjectSublabel(n, projectMap, taskProjectMap);
    const ts = getNotifTimestamp(n);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(n);
      if (ts > existing.latestAt) existing.latestAt = ts;
    } else {
      groups.set(key, { key, label, sublabel, items: [n], latestAt: ts });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.latestAt - a.latestAt);
}

export default function Notifications({ onNavigate, onBack, hasHistory }: { onNavigate: (p: PageKey, params?: Record<string, unknown>) => void; onBack: () => void; hasHistory: boolean }) {
  const { notifications, unreadCount, lastSeenAt, markRead, markSeen, markAllRead, markCategoryRead, clearCategory, clearAll, oldNotifications, loadOldNotifications, resolveNotif } = useNotifications();
  const { role, user } = useAuth();
  const [quickView, setQuickView] = useState<AppNotification | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationCategory | 'all'>('all');
  const [projectMap, setProjectMap] = useState<Map<string, Project>>(new Map());
  const [taskProjectMap, setTaskProjectMap] = useState<Map<string, Project[]>>(new Map());
  const [mapsLoading, setMapsLoading] = useState(true);
  const [expandedOldGroups, setExpandedOldGroups] = useState<Set<string>>(new Set());
  const [showOlderNotifications, setShowOlderNotifications] = useState(false);
  const seenAtMount = useRef<string | null>(lastSeenAt);
  const newThreshold = seenAtMount.current ? new Date(seenAtMount.current).getTime() : 0;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchAllTasks()]);
        if (!active) return;
        setProjectMap(new Map(projects.map((p) => [p.id, p])));
        const nextTaskProjects = new Map<string, Project[]>();
        tasks.forEach((task) => {
          const project = projects.find((candidate) => candidate.id === task.project_id);
          if (!project) return;
          const key = task.task_name.trim().toLowerCase();
          nextTaskProjects.set(key, [...(nextTaskProjects.get(key) || []), project]);
        });
        setTaskProjectMap(nextTaskProjects);
      } finally {
        if (active) setMapsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { markSeen(); }, [markSeen]);

  useEffect(() => {
    loadOldNotifications();
  }, [loadOldNotifications]);

  const handleOpen = useCallback((n: AppNotification) => {
    markRead(n.id);
    const t = getNotificationTarget(n, role);
    onNavigate(t.page, t.params);
  }, [markRead, onNavigate, role]);

  const tabs: { id: NotificationCategory | 'all'; label: string; types: NotificationType[] }[] = useMemo(() => {
    let allTabs: { id: NotificationCategory | 'all'; label: string; types: NotificationType[] }[] = [
      { id: 'all', label: 'All', types: [...CATEGORY_MAP.project, ...CATEGORY_MAP.task, ...CATEGORY_MAP.review, ...CATEGORY_MAP.payment, ...CATEGORY_MAP.chat, ...CATEGORY_MAP.reminder] },
      { id: 'project', label: getCategoryLabel('project', role), types: CATEGORY_MAP.project },
      { id: 'task', label: getCategoryLabel('task', role), types: CATEGORY_MAP.task },
      { id: 'review', label: getCategoryLabel('review', role), types: CATEGORY_MAP.review },
      { id: 'payment', label: getCategoryLabel('payment', role), types: CATEGORY_MAP.payment },
      { id: 'chat', label: getCategoryLabel('chat', role), types: CATEGORY_MAP.chat },
      { id: 'reminder', label: getCategoryLabel('reminder', role), types: CATEGORY_MAP.reminder },
    ];
    if (role === 'customer') allTabs = allTabs.filter((t) => t.id === 'all' || !CUSTOMER_HIDDEN_CATEGORIES.includes(t.id as NotificationCategory));
    if (role === 'editor') allTabs = allTabs.filter((t) => t.id === 'all' || !EDITOR_HIDDEN_CATEGORIES.includes(t.id as NotificationCategory));
    return allTabs;
  }, [role]);

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const isNewNotification = (n: AppNotification) => {
    const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
    return ts > newThreshold;
  };
  const activeItems = notifications.filter((n) => activeTabConfig.types.includes(n.type) && isNewNotification(n));
  const oldItems = Array.from(new Map(
    [...notifications.filter((n) => activeTabConfig.types.includes(n.type) && !isNewNotification(n)), ...oldNotifications.filter((n) => activeTabConfig.types.includes(n.type))]
      .map((notification) => [notification.id, notification]),
  ).values());
  const tabUnreadCount = activeItems.filter((n) => !n.read).length;
  const oldGroups = groupByProject(oldItems, projectMap, taskProjectMap);

  const toggleGroup = (key: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const handleTabMarkAllRead = () => {
    if (activeTabConfig.id === 'all') markAllRead();
    else markCategoryRead(activeTabConfig.id as NotificationCategory);
  };
  const handleTabClearAll = () => {
    if (activeTabConfig.id === 'all') clearAll();
    else clearCategory(activeTabConfig.id as NotificationCategory);
  };

  const formatLatestTime = (ts: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (mapsLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {hasHistory && (
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>Back</Button>
          )}
          <div>
            <h3 className="font-semibold text-ink-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-500" />
              Notifications
            </h3>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : lastSeenAt
                  ? `Last checked ${new Date(lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(lastSeenAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  : 'All caught up'}
            </p>
          </div>
        </div>
      </div>

      {/* Notification tabs */}
      <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide border-b border-ink-100 dark:border-ink-800">
          <div className="flex min-w-max px-2" role="tablist" aria-label="Notification categories">
            {tabs.map((tab) => {
              const count = notifications.filter((n) => tab.types.includes(n.type) && isNewNotification(n)).length;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`notifications-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative min-h-11 px-4 sm:px-6 py-3 text-sm font-semibold transition-colors ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'}`}
                >
                  {tab.label}
                  {count > 0 && <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full align-middle">{count}</span>}
                  {isActive && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Per-tab actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-ink-50 dark:border-ink-800/50">
          <Button variant="outline" size="sm" icon={<CheckCheck className="w-3.5 h-3.5" />} onClick={handleTabMarkAllRead} disabled={tabUnreadCount === 0}>Mark all read</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleTabClearAll} disabled={activeItems.length === 0}>Clear</Button>
        </div>
        {oldItems.length > 0 && (
          <div className="px-3 sm:px-4 py-2 border-b border-ink-50 dark:border-ink-800/50">
            <button
              type="button"
              onClick={() => setShowOlderNotifications((visible) => !visible)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-ink-500 dark:text-ink-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <History className="w-4 h-4" />
              {showOlderNotifications ? 'Hide Older Notifications' : `Show Older Notifications (${oldItems.length})`}
              <ChevronDown className={`w-4 h-4 transition-transform ${showOlderNotifications ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        <div id={`notifications-panel-${activeTab}`} role="tabpanel" aria-label={`${activeTabConfig.label} notifications`} className="p-3 sm:p-4">
          {/* NEW NOTIFICATIONS — header always visible */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 mb-1">
              <span className={`w-2 h-2 rounded-full bg-primary-600/80 ${activeItems.length > 0 ? 'animate-pulse' : 'opacity-30'}`} />
              <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide">New Notifications</h4>
              <span className="text-xs text-ink-400">{activeItems.length} new{tabUnreadCount > 0 ? ` · ${tabUnreadCount} unread` : ''}</span>
            </div>
            {activeItems.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-ink-200 dark:border-ink-700">
                <Bell className="w-7 h-7 text-ink-200 dark:text-ink-700 mx-auto mb-2" />
                <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">No new {activeTabConfig.label.toLowerCase()} notifications</p>
                <p className="text-xs text-ink-400 mt-1">You're all caught up in this category.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-primary-100 dark:border-primary-500/20 overflow-hidden bg-white dark:bg-ink-900">
                {[...activeItems]
                  .sort((a, b) => getNotifTimestamp(b) - getNotifTimestamp(a))
                  .map((n) => {
                    const showQuickView = canQuickView(n);
                    const showOpen = !showQuickView || n.type === 'deadline' || n.type === 'rating';
                    return (
                      <SwipeableNotificationCard
                        key={n.id}
                        notification={n}
                        projectLabel={getProjectLabel(n, projectMap, taskProjectMap)}
                        onMarkRead={() => markRead(n.id)}
                        onClear={() => resolveNotif(n.id)}
                        onQuickView={() => { markRead(n.id); setQuickView(n); }}
                        onOpen={() => handleOpen(n)}
                        showQuickView={showQuickView}
                        showOpen={showOpen}
                      />
                    );
                  })}
              </div>
            )}
          </div>
          {/* OLD NOTIFICATIONS */}
          {showOlderNotifications && oldGroups.length > 0 && (
            <div className="mt-6 pt-5 border-t border-ink-100 dark:border-ink-800 space-y-2">
              <div className="flex items-center gap-2 px-1 mb-1">
                <History className="w-4 h-4 text-ink-400" />
                <h4 className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wide">Old Notifications</h4>
                <span className="text-xs text-ink-400">{oldItems.length} read</span>
              </div>
              {oldGroups.map((group) => {
                const isExpanded = expandedOldGroups.has(group.key);
                const latestTime = formatLatestTime(group.latestAt);
                return (
                  <div key={`old-${group.key}`} className="rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden transition-all">
                    <button
                      onClick={() => toggleGroup(group.key, expandedOldGroups, setExpandedOldGroups)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-ink-50/50 dark:bg-ink-800/30 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                        <FolderKanban className="w-3.5 h-3.5 text-ink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-600 dark:text-ink-300 truncate">{group.label}</p>
                        {group.sublabel && <p className="text-xs text-ink-400 dark:text-ink-500 truncate">{group.sublabel}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-ink-400">{group.items.length}</span>
                        <span className="text-xs text-ink-400">{latestTime}</span>
                        <ChevronRight className={`w-4 h-4 text-ink-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-0 space-y-0 bg-white dark:bg-ink-900 overscroll-contain border-t border-ink-100 dark:border-ink-800">
                        {group.items
                          .sort((a, b) => getNotifTimestamp(b) - getNotifTimestamp(a))
                          .map((n) => {
                            const showQuickView = canQuickView(n);
                            const showOpen = !showQuickView || n.type === 'deadline' || n.type === 'rating';
                            return (
                              <Card key={n.id} className="opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{getProjectLabel(n, projectMap, taskProjectMap)}</p>
                                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 mt-0.5">{n.title}</p>
                                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{n.description}</p>
                                    <p className="text-xs text-ink-400 dark:text-ink-500 mt-1.5">{n.created_at ? formatNotifDateTime(n.created_at) : n.time}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {showQuickView && <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setQuickView(n)}>Quick view</Button>}
                                    {showOpen && <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => handleOpen(n)}>Open</Button>}
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

// --- Swipeable notification card (swipe right on mobile to mark read) ---

interface SwipeableNotificationCardProps {
  notification: AppNotification;
  onMarkRead: () => void;
  onClear: () => void;
  onQuickView: () => void;
  onOpen: () => void;
  projectLabel: string;
  showQuickView: boolean;
  showOpen: boolean;
}

function SwipeableNotificationCard({ notification, projectLabel, onMarkRead, onClear, onQuickView, onOpen, showQuickView, showOpen }: SwipeableNotificationCardProps) {
  const n = notification;
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [exiting, setExiting] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isDragging = useRef(false);

  const SWIPE_THRESHOLD = 80;
  const MAX_DRAG = 120;

  const clampDrag = (dx: number) => Math.max(-MAX_DRAG, Math.min(dx, MAX_DRAG));

  const handleStart = (clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    isSwiping.current = false;
    setAnimating(false);
    isDragging.current = true;
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    if (!isSwiping.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        isSwiping.current = true;
      } else if (Math.abs(dy) > 10) {
        isDragging.current = false;
        return;
      }
    }
    if (isSwiping.current) {
      setDragX(clampDrag(dx));
    }
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragX > SWIPE_THRESHOLD && !n.read) {
      setAnimating(true);
      setDragX(0);
      onMarkRead();
    } else if (dragX < -SWIPE_THRESHOLD) {
      setAnimating(true);
      setExiting(true);
      setDragX(dragX < 0 ? -MAX_DRAG : MAX_DRAG);
      setTimeout(() => onClear(), 250);
    } else {
      setAnimating(true);
      setDragX(0);
    }
    setTimeout(() => { isSwiping.current = false; }, 50);
  };

  const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchEnd = () => handleEnd();

  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) e.preventDefault();
    handleMove(e.clientX, e.clientY);
  };
  const handleMouseUp = () => handleEnd();
  const handleMouseLeave = () => { if (isDragging.current) handleEnd(); };

  const swipeRightProgress = Math.max(0, Math.min(dragX / SWIPE_THRESHOLD, 1));
  const swipeLeftProgress = Math.max(0, Math.min(-dragX / SWIPE_THRESHOLD, 1));

  return (
    <div className="relative overflow-hidden rounded-xl select-none">
      {/* Right-side reveal: mark read (swipe right) */}
      {!n.read && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-6 rounded-xl transition-opacity"
          style={{ opacity: swipeRightProgress * 0.9 }}
        >
          <div className="flex items-center gap-1.5 text-success-600 dark:text-success-400">
            <Check className="w-5 h-5" />
            <span className="text-sm font-semibold">Mark read</span>
          </div>
        </div>
      )}
      {/* Left-side reveal: clear (swipe left) */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-6 rounded-xl transition-opacity"
        style={{ opacity: swipeLeftProgress * 0.9 }}
      >
        <div className="flex items-center gap-1.5 text-error-600 dark:text-error-400">
          <Trash2 className="w-5 h-5" />
          <span className="text-sm font-semibold">Clear</span>
        </div>
      </div>
      <Card
        hover
        className={`rounded-none border-x-0 border-t-0 shadow-none animate-slide-up ${animating ? 'transition-transform duration-300 ease-out' : ''} ${exiting ? 'opacity-0' : ''} ${!n.read ? 'border-primary-500/20 bg-primary-500/10 dark:border-primary-500/30 dark:bg-primary-500/10' : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 opacity-70 hover:opacity-100'}`}
        style={{ transform: `translateX(${dragX}px)`, cursor: isDragging.current ? 'grabbing' : 'pointer' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (isSwiping.current) return;
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('a')) return;
          if (showQuickView) { onQuickView(); }
          else { onOpen(); }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 truncate">{projectLabel}</p>
              <p className="text-xs text-ink-400 dark:text-ink-500 whitespace-nowrap">{n.created_at ? formatNotifDateTime(n.created_at) : n.time}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{n.title}</p>
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary-600/80 animate-pulse flex-shrink-0" />}
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-1">{n.description}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {showQuickView && <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={onQuickView}>Quick view</Button>}
            {showOpen && <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={onOpen}>Open</Button>}
          </div>
        </div>
      </Card>
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
          order_number: project.order_number, event_name: project.event_name,
          status: project.status, progress: project.progress,
          customer_name: project.customer_name, editor_name: project.editor_name, amount: project.amount,
        });
        if (notification.type === 'message') {
          const msgs = await fetchProjectMessages(projectId);
          if (active) setMessages(msgs);
        } else if (notification.type === 'correction') {
          const corrs = await fetchCorrectionsByProject(projectId);
          if (active) setCorrections(corrs.map((c) => ({ id: c.id, number: c.number, status: c.status, priority: c.priority, photo_marks: c.photo_marks, video_timestamps: c.video_timestamps, voice_notes: c.voice_notes })));
        } else if (notification.type === 'payment' || notification.type === 'invoice') {
          const [pay, inv] = await Promise.all([fetchPayment(projectId), fetchInvoice(projectId)]);
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

  useEffect(() => { if (msgScrollRef.current) msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight; }, [messages]);

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

  const formatMsgTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl max-h-[min(86vh,800px)] bg-white dark:bg-ink-900 rounded-2xl shadow-float border border-ink-100 dark:border-ink-800 flex flex-col animate-scale-in overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{notification.title}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{notification.description}</p>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 flex-shrink-0" aria-label="Close preview">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /></div>
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
                <div className="flex flex-col h-[300px]">
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
                            <div className={`px-3 py-2 text-sm break-words rounded-2xl ${mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 rounded-bl-md'}`}>{m.message}</div>
                            <span className={`text-[10px] text-ink-400 mt-0.5 ${mine ? 'text-right' : 'text-left'}`}>{formatMsgTime(m.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-ink-100 dark:border-ink-800 pt-3 mt-2">
                    <div className="flex items-end gap-2">
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={handleReplyKeyDown} placeholder="Type a reply..." rows={1} className="flex-1 px-3 py-2 text-sm border border-ink-200 dark:border-ink-700 rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 transition-all resize-none bg-white dark:bg-ink-900 text-ink-900 dark:text-white max-h-20" disabled={sending} />
                      <button onClick={handleReply} disabled={!replyText.trim() || sending} className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors flex-shrink-0">
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

              {projectInfo && ['project', 'new-order', 'approval', 'task-complete'].includes(notification.type) && (
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

        <div className="px-5 py-3 border-t border-ink-100 dark:border-ink-800">
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
