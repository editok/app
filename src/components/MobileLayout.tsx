import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Menu, X, Sun, Moon, LogOut, ChevronLeft,
  LayoutDashboard, FolderKanban, ShoppingBag, Receipt, AlertCircle,
  User, DollarSign, Users, ShieldCheck, BarChart3, Settings,
  Star, Plus,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSound } from '../contexts/SoundContext';
import { useAuth, supabase } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationDropdown from './ui/NotificationDropdown';
import {
  PageKey, NavItem, pageTitles, adminItems, customerItems,
  ratingItems, ratingKeys,
} from './Layout';

const editorNavItems: NavItem[] = [
  { key: 'employee-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-6 h-6" /> },
  { key: 'available-works', label: 'Available Works', icon: <FolderKanban className="w-6 h-6" /> },
  { key: 'my-works', label: 'My Works', icon: <FolderKanban className="w-6 h-6" /> },
  { key: 'earnings', label: 'Earnings', icon: <DollarSign className="w-6 h-6" /> },
  { key: 'corrections', label: 'Corrections', icon: <AlertCircle className="w-6 h-6" /> },
  { key: 'profile', label: 'Profile', icon: <User className="w-6 h-6" /> },
];
import type { AdminRole } from '../data/db';

interface MobileLayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey, params?: Record<string, unknown>) => void;
  onBack: () => void;
  hasHistory: boolean;
  children: ReactNode;
}

const iconMap: Record<string, ReactNode> = {
  'admin-dashboard': <LayoutDashboard className="w-6 h-6" />,
  'customer-dashboard': <LayoutDashboard className="w-6 h-6" />,
  'employee-dashboard': <LayoutDashboard className="w-6 h-6" />,
  'available-works': <FolderKanban className="w-6 h-6" />,
  'my-works': <FolderKanban className="w-6 h-6" />,
  earnings: <DollarSign className="w-6 h-6" />,
  projects: <FolderKanban className="w-6 h-6" />,
  'new-project': <Plus className="w-6 h-6" />,
  'my-orders': <ShoppingBag className="w-6 h-6" />,
  'pending-payments': <Receipt className="w-6 h-6" />,
  corrections: <AlertCircle className="w-6 h-6" />,
  customers: <Users className="w-6 h-6" />,
  employees: <Users className="w-6 h-6" />,
  admins: <ShieldCheck className="w-6 h-6" />,
  finance: <DollarSign className="w-6 h-6" />,
  reports: <BarChart3 className="w-6 h-6" />,
  settings: <Settings className="w-6 h-6" />,
  profile: <User className="w-6 h-6" />,
  notifications: <Bell className="w-6 h-6" />,
  'rating-dashboard': <Star className="w-6 h-6" />,
  'customer-feedback': <Star className="w-6 h-6" />,
  'order-tracking': <FolderKanban className="w-6 h-6" />,
  'task-templates': <FolderKanban className="w-6 h-6" />,
};

function getIcon(key: string): ReactNode {
  return iconMap[key] || <LayoutDashboard className="w-6 h-6" />;
}

export default function MobileLayout({ current, onNavigate, onBack, hasHistory, children }: MobileLayoutProps) {
  const { theme, toggle } = useTheme();
  const { play: playSound } = useSound();
  const { signOut, user, role, adminRole, allowedMenus } = useAuth();
  const { unreadCount, pendingCounts, markSeen, getCountForMenu } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
      if (!user || !supabase) return;
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

  const allItems = useMemo<NavItem[]>(() => {
    if (role === 'customer') return customerItems;
    if (role === 'editor') return editorNavItems;
    return adminItems;
  }, [role]);

  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => !item.adminRoles || item.adminRoles.includes((adminRole || 'main') as AdminRole))
      .filter((item) => !allowedMenus || allowedMenus.length === 0 || allowedMenus.includes(item.key) || item.key === 'profile');
  }, [allItems, adminRole, allowedMenus]);

  const currentRatingItems = (ratingItems[role || 'admin'] || []).filter(
    (item) => !allowedMenus || allowedMenus.includes(item.key)
  );
  const showRatingGroup = currentRatingItems.length > 0;

  const bottomTabs = useMemo(() => {
    if (role === 'customer') {
      return [
        { key: 'customer-dashboard' as PageKey, label: 'Home' },
        { key: 'my-orders' as PageKey, label: 'Orders' },
        { key: 'pending-payments' as PageKey, label: 'Payments' },
        { key: 'corrections' as PageKey, label: 'Review' },
        { key: 'profile' as PageKey, label: 'Profile' },
      ];
    }
    if (role === 'editor') {
      return [
        { key: 'employee-dashboard' as PageKey, label: 'Home' },
        { key: 'available-works' as PageKey, label: 'Available' },
        { key: 'my-works' as PageKey, label: 'My Works' },
        { key: 'corrections' as PageKey, label: 'Review' },
        { key: 'profile' as PageKey, label: 'Profile' },
      ];
    }
    return [
      { key: 'admin-dashboard' as PageKey, label: 'Home' },
      { key: 'projects' as PageKey, label: 'Projects' },
      { key: 'finance' as PageKey, label: 'Finance' },
      { key: 'corrections' as PageKey, label: 'Review' },
      { key: 'profile' as PageKey, label: 'Profile' },
    ];
  }, [role]);

  const isSecondaryPage = (key: PageKey): boolean => {
    const primary = bottomTabs.map((t) => t.key);
    if (primary.includes(key)) return false;
    if (key === 'notifications') return false;
    return true;
  };

  const showBackButton = isSecondaryPage(current) && hasHistory;
  const initials = user?.email?.[0]?.toUpperCase() || 'A';

  const handleNavClick = (key: PageKey) => {
    playSound('nav');
    onNavigate(key);
    setMenuOpen(false);
    setNotifOpen(false);
  };

  const totalBadge = unreadCount + (pendingCounts.total || 0);

  return (
    <div className="flex flex-col h-screen bg-animated-mesh">
      {/* Top bar */}
      <header className="h-14 glass border-b border-ink-100/50 dark:border-ink-800/50 flex items-center px-3 gap-2 sticky top-0 z-30 flex-shrink-0 safe-top">
        {showBackButton ? (
          <button onClick={() => { playSound('back'); onBack(); }} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-ink-600 dark:text-ink-300" />
          </button>
        ) : (
          <button onClick={() => setMenuOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
            <Menu className="w-5 h-5 text-ink-600 dark:text-ink-300" />
          </button>
        )}

        <div className="flex items-center flex-1 min-w-0">
          <h2 className="text-base font-semibold text-ink-900 dark:text-white truncate">{pageTitles[current]}</h2>
        </div>

        <button onClick={toggle} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
          {theme === 'light' ? <Moon className="w-[18px] h-[18px] text-ink-600" /> : <Sun className="w-[18px] h-[18px] text-warning-500" />}
        </button>

        <div ref={notificationRef} className="relative">
          <button onClick={() => setNotifOpen((o) => !o)} className="relative w-11 h-11 flex items-center justify-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0">
            <Bell className="w-[18px] h-[18px] text-ink-600 dark:text-ink-300" />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-error-500 rounded-full ring-2 ring-white dark:ring-ink-900 animate-bounce-in">
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] left-2 right-2 z-50 w-auto max-w-md sm:left-auto sm:right-2 sm:w-[calc(100vw-1rem)]">
              <NotificationDropdown onClose={() => setNotifOpen(false)} onNavigate={onNavigate} />
            </div>
          )}
        </div>

        <button onClick={() => setUserMenuOpen((o) => !o)} className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full">
          {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-vibrant-gradient flex items-center justify-center text-white text-xs font-semibold">{initials}</div>}
        </button>
      </header>

      {/* User menu dropdown */}
      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
          <div className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] right-2 w-[calc(100vw-1rem)] max-w-xs bg-white dark:bg-ink-900 rounded-2xl shadow-float border border-ink-100 dark:border-ink-800 z-50 overflow-hidden animate-scale-in">
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

      {/* Full-screen menu drawer */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-ink-900 shadow-2xl flex flex-col animate-slide-in-left">
            <div className="h-14 flex items-center px-4 border-b border-ink-100 dark:border-ink-800">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-9 max-w-[120px] object-contain" />
                : <div className="w-9 h-9 rounded-lg bg-vibrant-gradient flex items-center justify-center text-white font-bold text-sm shadow-glow">E</div>}
              <button onClick={() => setMenuOpen(false)} className="ml-auto w-11 h-11 flex items-center justify-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {filteredItems.map((item, i) => {
                if (item.key === 'profile' && showRatingGroup && role === 'admin') {
                  return (
                    <div key="rating-group" className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 pt-3 pb-1">Rating System</p>
                      {currentRatingItems.map((ri) => (
                        <button
                          key={ri.key}
                          onClick={() => handleNavClick(ri.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${ratingKeys.has(current) && current === ri.key ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                        >
                          <span className="text-primary-500">{getIcon(ri.key)}</span>
                          {ri.label}
                          {getCountForMenu(ri.key) > 0 && <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full">{getCountForMenu(ri.key)}</span>}
                        </button>
                      ))}
                      <button key={item.key} onClick={() => handleNavClick(item.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${current === item.key ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
                        <span className={current === item.key ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'}>{getIcon(item.key)}</span>
                        {item.label}
                      </button>
                    </div>
                  );
                }
                if (item.key === 'profile' && showRatingGroup) {
                  return (
                    <div key="rating-customer" className="space-y-0.5">
                      {currentRatingItems.map((ri) => (
                        <button key={ri.key} onClick={() => handleNavClick(ri.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${current === ri.key ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
                          <span className="text-primary-500">{getIcon(ri.key)}</span>
                          {ri.label}
                        </button>
                      ))}
                      <button onClick={() => handleNavClick(item.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${current === item.key ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}>
                        <span className={current === item.key ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'}>{getIcon(item.key)}</span>
                        {item.label}
                      </button>
                    </div>
                  );
                }
                const isActive = current === item.key;
                const badge = item.pendingKey ? (pendingCounts[item.pendingKey] || 0) : getCountForMenu(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavClick(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                    style={{ animation: `staggerIn 0.3s ease ${i * 30}ms both` }}
                  >
                    <span className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400 dark:text-ink-500'}>{getIcon(item.key)}</span>
                    {item.label}
                    {badge > 0 && !isActive && (
                      <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full animate-bounce-in">{badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer transition-colors" onClick={() => handleNavClick('profile')}>
                {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-vibrant-gradient flex items-center justify-center text-white text-sm font-semibold shadow-sm">{initials}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{user?.email || 'user@editok.com'}</p>
                  <p className="text-xs text-ink-400 capitalize truncate">{role || 'admin'}{role === 'admin' && adminRole ? ` · ${adminRole}` : ''}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); signOut(); }} className="w-11 h-11 flex items-center justify-center rounded-xl text-ink-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 relative" onScroll={() => playSound('scroll')}>
        <div className="max-w-[1600px] mx-auto animate-fade-in pb-20">{children}</div>
      </main>

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 h-16 bg-white dark:bg-ink-900 border-t border-ink-100 dark:border-ink-800 flex items-stretch px-1 pb-[env(safe-area-inset-bottom)] sticky bottom-0 z-30">
        {bottomTabs.map((tab) => {
          const isActive = current === tab.key;
          const item = filteredItems.find((i) => i.key === tab.key);
          const badge = item?.pendingKey ? (pendingCounts[item.pendingKey] || 0) : getCountForMenu(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => { playSound('nav'); onNavigate(tab.key); }}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400 dark:text-ink-500'}`}
            >
              <div className="relative">
                {getIcon(tab.key)}
                {badge > 0 && !isActive && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[14px] h-3.5 px-1 text-[9px] font-bold text-white bg-error-500 rounded-full">{badge > 9 ? '9+' : badge}</span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary-500" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
