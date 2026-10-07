import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, FolderKanban, Users, UserCog, LayoutTemplate,
  AlertCircle, BarChart3, Settings, User, Bell, Menu, X, Mail,
  Calendar, Sun, Moon, LogOut, Wallet, ShoppingBag, Star, ChevronDown, ChevronRight, ShieldCheck, DollarSign, Receipt,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSound } from '../contexts/SoundContext';
import { useAuth, supabase } from '../contexts/AuthContext';
import { useNotifications, PendingCounts } from '../contexts/NotificationContext';
import type { AdminRole } from '../data/db';
import NotificationDropdown from './ui/NotificationDropdown';

export type PageKey =
  | 'admin-dashboard' | 'customer-dashboard' | 'employee-dashboard'
  | 'available-works' | 'my-works' | 'project-details'
  | 'working-screen' | 'new-project' | 'my-orders' | 'customers' | 'employees'
  | 'admins' | 'employee-profile' | 'customer-detail' | 'employee-detail' | 'task-templates' | 'corrections' | 'order-tracking'
  | 'reports' | 'notifications' | 'settings' | 'profile' | 'projects' | 'review-screen'
  | 'rating-dashboard' | 'rating-questions' | 'customer-reviews' | 'employee-ratings' | 'system-ratings' | 'rating-reports' | 'customer-feedback' | 'finance' | 'pending-payments' | 'earnings' | 'broadcast-emails';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  pendingKey?: keyof PendingCounts;
  adminRoles?: AdminRole[];
  notifCategory?: 'project' | 'task' | 'review' | 'payment' | 'chat' | 'reminder';
}

export const adminItems: NavItem[] = [
  { key: 'admin-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, pendingKey: 'total' },
  { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-[18px] h-[18px]" />, pendingKey: 'newOrders', notifCategory: 'project' },
  { key: 'new-project', label: 'New Project', icon: <FolderKanban className="w-[18px] h-[18px]" /> },
  { key: 'customers', label: 'Customers', icon: <Users className="w-[18px] h-[18px]" /> },
  { key: 'employees', label: 'Employees', icon: <UserCog className="w-[18px] h-[18px]" /> },
  { key: 'admins', label: 'Admins', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
  { key: 'task-templates', label: 'Task Templates', icon: <LayoutTemplate className="w-[18px] h-[18px]" /> },
  { key: 'corrections', label: 'Corrections', icon: <AlertCircle className="w-[18px] h-[18px]" />, pendingKey: 'correctionPending', notifCategory: 'review' },
  { key: 'order-tracking', label: 'Order Tracking', icon: <FolderKanban className="w-[18px] h-[18px]" />, pendingKey: 'approvalPending', notifCategory: 'task' },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
  { key: 'finance', label: 'Finance', icon: <DollarSign className="w-[18px] h-[18px]" />, adminRoles: ['main', 'finance', 'finance_manager'], pendingKey: 'paymentReminder', notifCategory: 'payment' },
  { key: 'broadcast-emails', label: 'Broadcast Emails', icon: <Mail className="w-[18px] h-[18px]" />, adminRoles: ['main'] },
  { key: 'settings', label: 'Settings', icon: <Settings className="w-[18px] h-[18px]" />, adminRoles: ['main'] },
  { key: 'profile', label: 'Profile', icon: <User className="w-[18px] h-[18px]" /> },
];

const editorItems: NavItem[] = [
  { key: 'employee-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { key: 'available-works', label: 'Available Works', icon: <FolderKanban className="w-[18px] h-[18px]" />, pendingKey: 'availableTasks' },
 { key: 'my-works', label: 'My Works', icon: <FolderKanban className="w-[18px] h-[18px]" />, pendingKey: 'myActiveTasks' },
 { key: 'earnings', label: 'Earnings', icon: <Wallet className="w-[18px] h-[18px]" /> },
  { key: 'corrections', label: 'Corrections', icon: <AlertCircle className="w-[18px] h-[18px]" />, pendingKey: 'correctionPending', notifCategory: 'review' },
  { key: 'employee-ratings', label: 'My Ratings', icon: <Star className="w-[18px] h-[18px]" /> },
  { key: 'profile', label: 'Profile', icon: <User className="w-[18px] h-[18px]" /> },
];

export const customerItems: NavItem[] = [
  { key: 'customer-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { key: 'new-project', label: 'New Project', icon: <FolderKanban className="w-[18px] h-[18px]" /> },
  { key: 'my-orders', label: 'My Orders', icon: <ShoppingBag className="w-[18px] h-[18px]" /> },
  { key: 'pending-payments', label: 'Payments', icon: <Receipt className="w-[18px] h-[18px]" />, pendingKey: 'paymentPending', notifCategory: 'payment' },
  { key: 'corrections', label: 'Corrections', icon: <AlertCircle className="w-[18px] h-[18px]" />, pendingKey: 'correctionPending', notifCategory: 'review' },
  { key: 'profile', label: 'Profile', icon: <User className="w-[18px] h-[18px]" /> },
];

export const adminMenuKeys = [
  ...adminItems.filter((i) => i.key !== 'profile').map((i) => ({ key: i.key, label: i.label })),
  { key: 'rating-dashboard' as PageKey, label: 'Rating Dashboard' },
  { key: 'rating-questions' as PageKey, label: 'Rating Questions' },
  { key: 'customer-reviews' as PageKey, label: 'Customer Reviews' },
  { key: 'employee-ratings' as PageKey, label: 'Employee Ratings' },
  { key: 'system-ratings' as PageKey, label: 'System Ratings' },
  { key: 'rating-reports' as PageKey, label: 'Rating Reports' },
  { key: 'customer-feedback' as PageKey, label: 'Customer Feedback' },
  { key: 'broadcast-emails' as PageKey, label: 'Broadcast Emails' },
];

const roleNavItems: Record<string, NavItem[]> = {
  admin: adminItems,
  editor: editorItems,
  customer: customerItems,
};

export const ratingItems: Record<string, NavItem[]> = {
  admin: [
    { key: 'rating-dashboard', label: 'Rating Dashboard', icon: <Star className="w-[18px] h-[18px]" /> },
 { key: 'rating-questions', label: 'Rating Questions', icon: <Star className="w-[18px] h-[18px]" /> },
 { key: 'customer-reviews', label: 'Customer Reviews', icon: <Star className="w-[18px] h-[18px]" /> },
 { key: 'employee-ratings', label: 'Employee Ratings', icon: <Star className="w-[18px] h-[18px]" /> },
 { key: 'system-ratings', label: 'System Ratings', icon: <Star className="w-[18px] h-[18px]" /> },
 { key: 'rating-reports', label: 'Rating Reports', icon: <Star className="w-[18px] h-[18px]" /> },
  ],
  customer: [
    { key: 'customer-feedback', label: 'Give Feedback', icon: <Star className="w-[18px] h-[18px]" /> },
  ],
};

export const ratingKeys = new Set<PageKey>([
  'rating-dashboard', 'rating-questions', 'customer-reviews', 'employee-ratings', 'system-ratings', 'rating-reports', 'customer-feedback',
]);

export const pageTitles: Record<PageKey, string> = {
  'admin-dashboard': 'Dashboard',
  'customer-dashboard': 'Dashboard',
  'employee-dashboard': 'Dashboard',
  'available-works': 'Available Works',
  'my-works': 'My Works',
  'project-details': 'Project Details',
  'working-screen': 'Working Screen',
  'new-project': 'New Project',
  customers: 'Customers',
  employees: 'Employees',
  admins: 'Admin Users',
  'employee-profile': 'Employee Profile',
  'task-templates': 'Task Templates',
  corrections: 'Corrections',
  'order-tracking': 'Order Tracking',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
  'rating-dashboard': 'Rating Dashboard',
  'rating-questions': 'Rating Questions',
  'customer-reviews': 'Customer Reviews',
  'employee-ratings': 'Employee Ratings',
  'system-ratings': 'System Ratings',
  'rating-reports': 'Rating Reports',
  'customer-feedback': 'Share Your Experience',
  profile: 'Profile',
  projects: 'Projects',
  'review-screen': 'Review',
  earnings: 'Earnings',
  'my-orders': 'My Orders',
  'pending-payments': 'Payments',
  finance: 'Finance',
  'customer-detail': 'Customer Details',
  'employee-detail': 'Employee Details',
  'broadcast-emails': 'Broadcast Emails',
};

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey, params?: Record<string, unknown>) => void;
  children: ReactNode;
}

export default function Layout({ current, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(ratingKeys.has(current));
  const [usersOpen, setUsersOpen] = useState(current === 'customers' || current === 'employees' || current === 'admins');
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { theme, toggle } = useTheme();
  const { play: playSound } = useSound();
  const { signOut, user, role, adminRole, allowedMenus } = useAuth();
  const { getCountForMenu, getCountForCategory, unreadCount, pendingCounts, markSeen } = useNotifications();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !notificationRef.current?.contains(target)) {
        setNotifOpen(false);
        markSeen();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [markSeen, notifOpen]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      if (!supabase) return;
      const [{ data: profile }, { data: branding }] = await Promise.all([
        supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'branding').maybeSingle(),
      ]);
      if (!active) return;
      setAvatarUrl(profile?.avatar_url || null);
      setLogoUrl(branding?.value?.logoUrl || null);
    })();
    return () => { active = false; };
  }, [user]);

  const initials = user?.email?.[0]?.toUpperCase() || 'A';
  const currentRatingItems = (ratingItems[role || 'admin'] || []).filter((item) => !allowedMenus || allowedMenus.includes(item.key));
  const showRatingGroup = currentRatingItems.length > 0;

  useEffect(() => {
    if (ratingKeys.has(current)) setRatingsOpen(true);
    if (current === 'customers' || current === 'employees' || current === 'admins') setUsersOpen(true);
  }, [current]);

  const renderNavItem = (item: NavItem, index: number) => {
    const isActive = current === item.key;
    return (
      <button
        key={item.key}
        onClick={() => { playSound('nav'); onNavigate(item.key); setMobileOpen(false); }}
        className={`w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-sm'
            : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-white'
        }`}
        style={{ animation: `staggerIn 0.3s ease ${index * 30}ms both` }}
      >
        <span className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400 dark:text-ink-500'}>{item.icon}</span>
        {item.label}
        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />}
        {!isActive && item.pendingKey && pendingCounts[item.pendingKey] > 0 && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{pendingCounts[item.pendingKey]}</span>
        )}
        {!isActive && !item.pendingKey && getCountForMenu(item.key) > 0 && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{getCountForMenu(item.key)}</span>
        )}
        {!isActive && !item.pendingKey && getCountForMenu(item.key) === 0 && item.notifCategory && getCountForCategory(item.notifCategory) > 0 && (
          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{getCountForCategory(item.notifCategory)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-animated-mesh">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 2xl:w-72 3xl:w-80 4k:w-96 bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 2xl:h-18 3xl:h-20 flex items-center px-5 2xl:px-6 border-b border-ink-100 dark:border-ink-800">
          {logoUrl
            ? <img src={logoUrl} alt="Company logo" className="h-10 max-w-[140px] object-contain" />
            : <div className="w-10 h-10 rounded-xl bg-vibrant-gradient flex items-center justify-center text-white font-bold text-base shadow-glow">E</div>}
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-ink-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 2xl:px-4 space-y-0.5">
          {(roleNavItems[role || 'admin'] || adminItems)
            .filter((item) => !item.adminRoles || item.adminRoles.includes(adminRole || 'main'))
            .filter((item) => !allowedMenus || allowedMenus.length === 0 || allowedMenus.includes(item.key) || item.key === 'profile')
            .map((item, i) => (
            item.key === 'profile' && showRatingGroup && role === 'admin' ? (
              <div key="rating-system" className="space-y-0.5">
                <button
                  onClick={() => setRatingsOpen((open) => !open)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${ratingKeys.has(current) ? 'text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                >
                  {ratingsOpen ? <ChevronDown className="w-4 h-4 text-primary-500" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
                  <Star className="w-[18px] h-[18px] text-primary-500" />
                  <span>Rating System</span>
                  {currentRatingItems.some((ratingItem) => getCountForMenu(ratingItem.key) > 0) && <span className="ml-auto w-2 h-2 rounded-full bg-error-500" />}
                </button>
                {ratingsOpen && <div className="ml-4 pl-3 border-l border-ink-100 dark:border-ink-800 space-y-0.5">{currentRatingItems.map((ratingItem, ratingIndex) => renderNavItem(ratingItem, i + ratingIndex + 1))}</div>}
                {renderNavItem(item, i)}
              </div>
            ) : item.key === 'profile' && showRatingGroup ? (
              <div key="rating-items" className="space-y-0.5">
                {currentRatingItems.map((ratingItem, ratingIndex) => renderNavItem(ratingItem, i + ratingIndex + 1))}
                {renderNavItem(item, i)}
              </div>
            ) : item.key === 'customers' && role === 'admin' ? (
              <div key="users-group" className="space-y-0.5">
                <button
                  onClick={() => setUsersOpen((open) => !open)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${(current === 'customers' || current === 'employees' || current === 'admins') ? 'text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                >
                  {usersOpen ? <ChevronDown className="w-4 h-4 text-primary-500" /> : <ChevronRight className="w-4 h-4 text-ink-400" />}
                  <Users className="w-[18px] h-[18px] text-primary-500" />
                  <span>Users</span>
                </button>
                {usersOpen && (
                  <div className="ml-4 pl-3 border-l border-ink-100 dark:border-ink-800 space-y-0.5">
                    {renderNavItem(item, i)}
                    {renderNavItem(adminItems.find((ai) => ai.key === 'employees')!, i + 1)}
                    {renderNavItem(adminItems.find((ai) => ai.key === 'admins')!, i + 2)}
                  </div>
                )}
              </div>
            ) : item.key === 'employees' && role === 'admin' ? null : item.key === 'admins' && role === 'admin' ? null : renderNavItem(item, i)
          ))}
        </nav>

        {/* User card */}
        <div className="p-3 2xl:p-4 border-t border-ink-100 dark:border-ink-800">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer transition-colors" onClick={() => onNavigate('profile')}>
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-vibrant-gradient flex items-center justify-center text-white text-sm font-semibold shadow-sm">{initials}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{user?.email || 'admin@editok.com'}</p>
              <p className="text-xs text-ink-400 capitalize truncate">{role || 'admin'}{role === 'admin' && adminRole ? ` · ${adminRole}` : ''}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); signOut(); }} className="w-11 h-11 flex items-center justify-center rounded-xl text-ink-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-ink-900/30 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 2xl:h-18 3xl:h-20 glass border-b border-ink-100/50 dark:border-ink-800/50 flex items-center px-4 lg:px-6 2xl:px-8 3xl:px-10 gap-4 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-ink-500 dark:text-ink-400 flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg 2xl:text-xl 3xl:text-2xl font-semibold text-ink-900 dark:text-white truncate min-w-0 flex-1 lg:flex-none">{pageTitles[current]}</h2>

            <div className="ml-auto flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-sm 2xl:text-base text-ink-500 dark:text-ink-400 px-3 py-2 rounded-xl bg-ink-50 dark:bg-ink-800/50">
              <Calendar className="w-4 h-4 text-ink-500 dark:text-ink-300" />
              <span>{today}</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-ink-50 dark:bg-ink-800 hover:bg-ink-100 dark:hover:bg-ink-700 transition-all hover:scale-110 active:scale-95"
              title="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-[18px] h-[18px] text-ink-600" />
              ) : (
                <Sun className="w-[18px] h-[18px] text-warning-500" />
              )}
            </button>

            <div ref={notificationRef} className="relative">
            <button
              onClick={() => setNotifOpen((open) => !open)}
              className="relative w-11 h-11 flex items-center justify-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-all hover:scale-110 active:scale-95"
            >
              <Bell className="w-[18px] h-[18px] text-ink-600 dark:text-ink-300" />
              {(unreadCount > 0 || pendingCounts.total > 0) && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-error-500 rounded-full ring-2 ring-white dark:ring-ink-900 animate-bounce-in">
                  {(unreadCount + pendingCounts.total) > 9 ? '9+' : (unreadCount + pendingCounts.total)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(36rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-visible z-40">
                  <NotificationDropdown
                    onClose={() => setNotifOpen(false)}
                    onNavigate={onNavigate}
                  />
                </div>
            )}
            </div>

            <div className="relative">
              {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-9 h-9 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform" onClick={() => setUserMenuOpen((o) => !o)} /> : <div className="w-9 h-9 rounded-full bg-vibrant-gradient flex items-center justify-center text-white text-sm font-semibold cursor-pointer hover:scale-110 transition-transform" onClick={() => setUserMenuOpen((o) => !o)}>{initials}</div>}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 2xl:w-64 bg-white dark:bg-ink-900 rounded-2xl shadow-float border border-ink-100 dark:border-ink-800 z-40 overflow-hidden animate-scale-in">
                    <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800">
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{user?.email || 'user@editok.com'}</p>
                      <p className="text-xs text-ink-400 capitalize truncate">{role || 'admin'}{role === 'admin' && adminRole ? ` · ${adminRole}` : ''}</p>
                    </div>
                    <button onClick={() => { setUserMenuOpen(false); onNavigate('profile'); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                      <User className="w-4 h-4 text-ink-400" />
                      Profile
                    </button>
                    <button onClick={() => { setUserMenuOpen(false); signOut(); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 2xl:p-10 3xl:p-12 4k:p-16 relative" onScroll={() => playSound('scroll')}>
          <div className="max-w-[1600px] 2xl:max-w-[1800px] 3xl:max-w-[2200px] 4k:max-w-[2800px] mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
