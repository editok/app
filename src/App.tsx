import { useState, useEffect, lazy, Suspense, useCallback, useRef, useTransition } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Layout, { PageKey } from './components/Layout';
import MobileLayout from './components/MobileLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SoundProvider } from './contexts/SoundContext';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { usePushNotifications } from './hooks/usePushNotifications';
import { ForegroundNotificationToast } from './components/ui/ForegroundNotificationToast';
import { default as DailyUpdateReminder } from './components/ui/DailyUpdateReminder';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { FullPageSpinner, SplashScreen } from './components/ui/LoadingScreen';
import Login from './pages/Login';
import PasswordRecovery from './pages/PasswordRecovery';
import AdminDashboard from './pages/AdminDashboard';
import NewProject from './pages/NewProject';


const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const AvailableWorks = lazy(() => import('./pages/AvailableWorks'));
const MyWorks = lazy(() => import('./pages/MyWorks'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const WorkingScreen = lazy(() => import('./pages/WorkingScreen'));
const Customers = lazy(() => import('./pages/Customers'));
const Employees = lazy(() => import('./pages/Employees'));
const Admins = lazy(() => import('./pages/Admins'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const TaskTemplates = lazy(() => import('./pages/TaskTemplates'));
const Corrections = lazy(() => import('./pages/Corrections'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Projects = lazy(() => import('./pages/Projects'));
const Reports = lazy(() => import('./pages/Reports'));
const ReviewScreen = lazy(() => import('./pages/ReviewScreen'));
const Settings = lazy(() => import('./pages/Settings'));
const BroadcastEmails = lazy(() => import('./pages/BroadcastEmails'));
const Profile = lazy(() => import('./pages/Profile'));
const Earnings = lazy(() => import('./pages/Earnings'));
const Finance = lazy(() => import('./pages/Finance'));
const GuestReview = lazy(() => import('./pages/GuestReview'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const PendingPayments = lazy(() => import('./pages/PendingPayments'));
const RatingDashboard = lazy(() => import('./pages/RatingDashboard'));
const RatingQuestions = lazy(() => import('./pages/RatingQuestions'));
const CustomerReviews = lazy(() => import('./pages/CustomerReviews'));
const EmployeeRatings = lazy(() => import('./pages/EmployeeRatings'));
const SystemRatings = lazy(() => import('./pages/SystemRatings'));
const RatingReports = lazy(() => import('./pages/RatingReports'));
const CustomerFeedback = lazy(() => import('./pages/CustomerFeedback'));

const lazyMap: Record<PageKey, () => Promise<unknown>> = {
  'admin-dashboard': () => import('./pages/AdminDashboard'),
  'customer-dashboard': () => import('./pages/CustomerDashboard'),
  'employee-dashboard': () => import('./pages/EmployeeDashboard'),
  'available-works': () => import('./pages/AvailableWorks'),
  'my-works': () => import('./pages/MyWorks'),
  'project-details': () => import('./pages/ProjectDetails'),
  'working-screen': () => import('./pages/WorkingScreen'),
  'new-project': () => import('./pages/NewProject'),
  'my-orders': () => import('./pages/MyOrders'),
  'pending-payments': () => import('./pages/PendingPayments'),
  customers: () => import('./pages/Customers'),
  employees: () => import('./pages/Employees'),
  admins: () => import('./pages/Admins'),
  'employee-profile': () => import('./pages/EmployeeProfile'),
  'customer-detail': () => import('./pages/CustomerDetail'),
  'employee-detail': () => import('./pages/EmployeeDetail'),
  'task-templates': () => import('./pages/TaskTemplates'),
  corrections: () => import('./pages/Corrections'),
  'order-tracking': () => import('./pages/OrderTracking'),
  projects: () => import('./pages/Projects'),
  reports: () => import('./pages/Reports'),
  'review-screen': () => import('./pages/ReviewScreen'),
  settings: () => import('./pages/Settings'),
  'broadcast-emails': () => import('./pages/BroadcastEmails'),
  profile: () => import('./pages/Profile'),
  earnings: () => import('./pages/Earnings'),
  finance: () => import('./pages/Finance'),
  'rating-dashboard': () => import('./pages/RatingDashboard'),
  'rating-questions': () => import('./pages/RatingQuestions'),
  'customer-reviews': () => import('./pages/CustomerReviews'),
  'employee-ratings': () => import('./pages/EmployeeRatings'),
  'system-ratings': () => import('./pages/SystemRatings'),
  'rating-reports': () => import('./pages/RatingReports'),
  'customer-feedback': () => import('./pages/CustomerFeedback'),
};

function GuestProofRoute() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/proof\/([a-f0-9-]+)/i);
    if (match) setToken(match[1]);
  }, []);
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Invalid Link</h1>
          <p className="text-sm text-ink-400">This proof link is not valid.</p>
        </div>
      </div>
    );
  }
  return <GuestReview token={token} />;
}

function PageLoader() {
  return <FullPageSpinner />;
}

function AppContent() {
  const { user, role, loading, signOut, passwordRecovery } = useAuth();
  const roleHome: Record<string, PageKey> = {
    admin: 'admin-dashboard',
    editor: 'employee-dashboard',
    customer: 'customer-dashboard',
  };
  const [page, setPage] = useState<PageKey>(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('editok-page') : null;
    if (saved) return saved as PageKey;
    const persistedRole = typeof window !== 'undefined' ? localStorage.getItem('editok-role') : null;
    if (persistedRole === 'editor') return 'employee-dashboard';
    if (persistedRole === 'customer') return 'customer-dashboard';
    return 'admin-dashboard';
  });
  const [pageHistory, setPageHistory] = useState<PageKey[]>([]);
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('editok-params') : null;
    try { return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    sessionStorage.setItem('editok-page', page);
  }, [page]);
  useEffect(() => {
    sessionStorage.setItem('editok-params', JSON.stringify(params));
  }, [params]);

  useEffect(() => {
    if (user && role) {
      const savedPage = sessionStorage.getItem('editok-page');
      const justLoggedIn = sessionStorage.getItem('editok-just-logged-in') === '1';
      if (justLoggedIn || !savedPage) {
        setPage(roleHome[role] || 'admin-dashboard');
        sessionStorage.removeItem('editok-just-logged-in');
      }
      const home = roleHome[role];
      const prefetchTargets: PageKey[] = [home, 'projects', 'profile', 'settings'];
      const id = setTimeout(() => {
        prefetchTargets.forEach((p) => {
          if (p && p !== page) lazyMap[p]?.().catch(() => {});
        });
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [user, role]);

  useEffect(() => {
    if (!user && !loading) {
      sessionStorage.removeItem('editok-page');
      sessionStorage.removeItem('editok-params');
      setPage('admin-dashboard');
    }
  }, [user, loading]);

  const pageRef = useRef(page);
  pageRef.current = page;

  const navigate = useCallback((p: PageKey, params?: Record<string, unknown>) => {
    setPageHistory((prev) => [...prev, pageRef.current]);
    startTransition(() => {
      setPage(p);
      setParams(params || {});
    });
    // Push a browser history entry so the browser back button can
    // traverse the full in-app navigation stack, not just one step.
    window.history.pushState({ editokInitialized: true, appBack: true }, '');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    setPageHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const lastPage = newHistory.pop()!;
      startTransition(() => {
        setPage(lastPage);
        setParams({});
      });
      return newHistory;
    });
  }, []);

  const pageHistoryRef = useRef(pageHistory);
  pageHistoryRef.current = pageHistory;
  const pageRefForBack = useRef(page);
  pageRefForBack.current = page;

  // Browser back button / mobile swipe-back: intercept popstate and go back
  // inside the app instead of leaving the application.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Seed a baseline history entry so we always have something to pop.
    if (!window.history.state?.editokInitialized) {
      window.history.replaceState({ editokInitialized: true, appBack: true }, '');
    }

    const onPopState = () => {
      if (pageHistoryRef.current.length > 0) {
 goBack();
      } else {
 // No more internal history — re-push so the app stays in the
 // WebView instead of exiting, then let it settle.
 window.history.pushState({ editokInitialized: true, appBack: true }, '');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goBack]);

  // Android hardware back button via Capacitor
  useEffect(() => {
    let listener: { remove: () => void } | undefined;
    (async () => {
      try {
        const { addListener } = CapacitorApp;
        listener = await addListener('backButton', () => {
          if (pageHistoryRef.current.length > 0) {
            goBack();
          } else {
            CapacitorApp.exitApp();
          }
        });
      } catch {
        // Not running in Capacitor (web browser) — no-op
      }
    })();
    return () => { listener?.remove(); };
  }, [goBack]);

  const { showWarning, secondsLeft, dismissWarning } = useIdleTimeout(() => {
    signOut();
  }, !!user && localStorage.getItem('editok-keep-signed-in') !== '1');

  usePushNotifications();

  // Native push taps dispatch a CustomEvent with the target page; handle it here.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { page: PageKey; params?: Record<string, unknown> };
      if (detail?.page) navigate(detail.page, detail.params);
    };
    window.addEventListener('editok-navigate', handler);
    return () => window.removeEventListener('editok-navigate', handler);
  }, [navigate]);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const pageKeyRef = useRef(page);
  pageKeyRef.current = page;

  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const useMobileLayout = isMobileViewport && (role === 'customer' || role === 'admin' || role === 'editor');

  if (loading || (user && !role)) {
    return <SplashScreen />;
  }

  if (passwordRecovery) return <PasswordRecovery />;

  if (!user) return <Login />;

  const renderPage = () => {
    switch (page) {
      case 'admin-dashboard': return <AdminDashboard onNavigate={navigate} />;
      case 'customer-dashboard': return <CustomerDashboard onNavigate={navigate} />;
      case 'employee-dashboard': return <EmployeeDashboard onNavigate={navigate} />;
      case 'available-works': return <AvailableWorks onNavigate={navigate} />;
      case 'my-works': return <MyWorks onNavigate={navigate} />;
      case 'project-details': return <ProjectDetails onNavigate={navigate} params={params} />;
      case 'review-screen': return <ReviewScreen onNavigate={navigate} params={params} />;
      case 'working-screen': return <WorkingScreen onNavigate={navigate} params={params} />;
      case 'new-project': return <NewProject onNavigate={navigate} />;
      case 'my-orders': return <MyOrders onNavigate={navigate} params={params} />;
      case 'pending-payments': return <PendingPayments onNavigate={navigate} />;
      case 'customers': return <Customers onNavigate={navigate} />;
      case 'employees': return <Employees onNavigate={navigate} />;
      case 'admins': return <Admins />;
      case 'employee-profile': return <EmployeeProfile onNavigate={navigate} params={params} />;
      case 'customer-detail': return <CustomerDetail onNavigate={navigate} params={params} />;
      case 'employee-detail': return <EmployeeDetail onNavigate={navigate} params={params} />;
      case 'task-templates': return <TaskTemplates />;
      case 'corrections': return <Corrections onNavigate={navigate} />;
      case 'order-tracking': return <OrderTracking onNavigate={navigate} />;
      case 'projects': return <Projects onNavigate={navigate} />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      case 'broadcast-emails': return <BroadcastEmails />;
      case 'profile': return <Profile />;
      case 'earnings': return <Earnings />;
      case 'finance': return <Finance onNavigate={navigate} />;
      case 'rating-dashboard': return <RatingDashboard onNavigate={navigate} />;
      case 'rating-questions': return <RatingQuestions />;
      case 'customer-reviews': return <CustomerReviews onNavigate={navigate} />;
      case 'employee-ratings': return <EmployeeRatings onNavigate={navigate} params={params} />;
      case 'system-ratings': return <SystemRatings />;
      case 'rating-reports': return <RatingReports />;
      case 'customer-feedback': return <CustomerFeedback onNavigate={navigate} params={params} />;
      default: return <AdminDashboard onNavigate={navigate} />;
    }
  };

  return (
    <>
      {useMobileLayout ? (
        <MobileLayout current={page} onNavigate={navigate} onBack={goBack} hasHistory={pageHistory.length > 0}>
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary key={page} onReset={() => navigateRef.current(pageKeyRef.current)}>
              {renderPage()}
            </ErrorBoundary>
          </Suspense>
          {isPending && (
            <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-primary-500/20">
              <div className="h-full bg-primary-500 animate-pulse" style={{ width: '100%', animation: 'none' }} />
            </div>
          )}
        </MobileLayout>
      ) : (
        <Layout current={page} onNavigate={navigate}>
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary key={page} onReset={() => navigateRef.current(pageKeyRef.current)}>
              {renderPage()}
            </ErrorBoundary>
          </Suspense>
          {isPending && (
            <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-primary-500/20">
              <div className="h-full bg-primary-500" style={{ width: '100%' }} />
            </div>
          )}
        </Layout>
      )}

      <ForegroundNotificationToast />
      <DailyUpdateReminder />

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-scale-in">
          <div className="glass rounded-2xl shadow-float p-6 max-w-sm w-full mx-4 text-center">
            <div className="w-14 h-14 rounded-full bg-warning-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l0 4M12 3l9 16H3L12 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-ink-900 dark:text-white mb-1">Session expiring</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">
              You've been inactive for a while. For your security, you'll be logged out in:
            </p>
            <p className="text-3xl font-bold font-mono text-warning-600 dark:text-warning-400 mb-4">{secondsLeft}s</p>
            <button
              onClick={dismissWarning}
              className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Stay logged in
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [isGuestProof, setIsGuestProof] = useState(false);
  useEffect(() => {
    setIsGuestProof(/^\/proof\//i.test(window.location.pathname));
  }, []);
  if (isGuestProof) {
    return (
      <ThemeProvider>
        <Suspense fallback={<PageLoader />}>
          <GuestProofRoute />
        </Suspense>
      </ThemeProvider>
    );
  }
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <SoundProvider>
              <AppContent />
            </SoundProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
