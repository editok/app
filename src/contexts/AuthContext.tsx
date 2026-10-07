import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from 'react';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import type { User as GoogleUser } from '@codetrix-studio/capacitor-google-auth';
import { fetchProfile, fetchProfileByEmail, upsertProfile, ensureCustomerForProfile, sendAutomatedEmail } from '../data/db';
import type { UserRole, AdminRole } from '../data/db';
import { syncChatReadState } from '../utils/chatReadState';
import { clearCache } from '../data/queryCache';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://okagnbkeesilwnnxglxy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rYWduYmtlZXNpbHdubnhnbHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Mzg5OTIsImV4cCI6MjA5OTQxNDk5Mn0.2rfJj8bBIQsXZKc51DPtytuDCoqrKcaLnLtghiK5qK4';

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  adminRole: AdminRole | null;
  allowedMenus: string[] | null;
  loading: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  role: null,
  adminRole: null,
  allowedMenus: null,
  loading: true,
  passwordRecovery: false,
  signIn: async () => ({ error: 'not implemented' }),
  signUp: async () => ({ error: 'not implemented' }),
  signInWithGoogle: async () => ({ error: 'not implemented' }),
  signOut: async () => {},
  clearPasswordRecovery: () => {},
});

const HEARTBEAT_KEY = 'editok-session-heartbeat';
const CLOSED_AT_KEY = 'editok-session-closed-at';
const KEEP_SIGNED_IN_KEY = 'editok-keep-signed-in';

function keepsUserSignedIn(): boolean {
  return localStorage.getItem(KEEP_SIGNED_IN_KEY) === '1';
}

function isSessionStale(): boolean {
  if (keepsUserSignedIn()) return false;
  const closedAt = localStorage.getItem(CLOSED_AT_KEY);
  if (closedAt) {
    const lastHeartbeat = localStorage.getItem(HEARTBEAT_KEY);
    if (lastHeartbeat) {
      const sinceHeartbeat = Date.now() - parseInt(lastHeartbeat, 10);
      // If the heartbeat is very recent, this was a page refresh, not a real close
      if (sinceHeartbeat < 5000) {
        localStorage.removeItem(CLOSED_AT_KEY);
        return false;
      }
    }
    return true;
  }
  const lastHeartbeat = localStorage.getItem(HEARTBEAT_KEY);
  if (lastHeartbeat) {
    const elapsed = Date.now() - parseInt(lastHeartbeat, 10);
    if (elapsed > 2 * 60 * 1000) return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [allowedMenus, setAllowedMenus] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const userRef = useRef<User | null>(null);
  const welcomedEmails = useRef<Set<string>>(new Set());
  useEffect(() => { userRef.current = user; }, [user]);

  // Heartbeat: update timestamp every minute while the tab is open
  useEffect(() => {
    if (!supabase) return;
    const beat = () => localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
    beat();
    const interval = setInterval(beat, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect actual tab/browser close (not refresh) to end the session.
  // We skip the CLOSED_AT marker while an OAuth redirect is in flight, otherwise
  // navigating away to Google and back is treated as a browser close and the
  // returning session gets destroyed by isSessionStale().
  useEffect(() => {
    if (!supabase) return;
    const onBeforeUnload = () => {
      if (sessionStorage.getItem('editok-oauth-in-flight') === '1') return;
      if (!keepsUserSignedIn()) {
        localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
      }
    };
    window.addEventListener('pagehide', onBeforeUnload);
    return () => window.removeEventListener('pagehide', onBeforeUnload);
  }, []);

  // Resolve the user's role from the profiles table, upserting if missing (e.g. first Google login)
  const resolveProfile = async (authUser: User) => {
    try {
      let profile = await fetchProfile(authUser.id);
      if (!profile && authUser.email) {
        const existing = await fetchProfileByEmail(authUser.email);
        if (existing) {
          profile = await upsertProfile({
            id: authUser.id,
            email: existing.email,
            full_name: existing.full_name,
            avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || existing.avatar_url || null,
            role: existing.role,
            admin_role: existing.admin_role,
            allowed_menus: existing.allowed_menus,
            provider: 'google',
            language: existing.language,
            phone: existing.phone,
            address: existing.address,
          });
        }
      }
      if (!profile) {
        const isGoogle = authUser.app_metadata?.provider === 'google';
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || 'User';
        const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;
        profile = await upsertProfile({
          id: authUser.id,
          email: authUser.email || null,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: 'customer',
          provider: isGoogle ? 'google' : 'email',
        });
        const email = authUser.email || '';
        if (email && !welcomedEmails.current.has(email)) {
          welcomedEmails.current.add(email);
          sendAutomatedEmail('customer_welcome', {
            customer_name: fullName,
            customer_email: email,
            login_link: window.location.origin + '/login',
          }).catch(() => {});
        }
      }
      const resolvedRole = ((profile?.role as string) || 'customer').trim() as UserRole;
      setRole(resolvedRole);
      setAdminRole(((profile?.admin_role as string) || null)?.trim() as AdminRole || null);
      const menus = profile?.allowed_menus;
      setAllowedMenus(menus && menus.length > 0 ? menus : null);
      localStorage.setItem('editok-role', resolvedRole);
      if (resolvedRole === 'customer') {
        await ensureCustomerForProfile({ email: profile?.email || authUser.email || null, full_name: profile?.full_name || null }).catch(() => {});
      }
    } catch (err) {
      console.error('Profile resolution failed, using default role:', err);
      const fallbackRole = 'customer' as UserRole;
      setRole(fallbackRole);
      setAdminRole(null);
      setAllowedMenus(null);
      localStorage.setItem('editok-role', fallbackRole);
    }
    syncChatReadState(authUser.id).catch(() => {});
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const startupTimeout = setTimeout(() => {
      if (active) setLoading(false);
    }, 10000);

    const oauthTimeout = setTimeout(() => {
      if (active && sessionStorage.getItem('editok-oauth-in-flight') === '1') {
        sessionStorage.removeItem('editok-oauth-in-flight');
        setLoading(false);
      }
    }, 15000);

    const oauthInFlight = () => sessionStorage.getItem('editok-oauth-in-flight') === '1';

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        localStorage.removeItem(CLOSED_AT_KEY);
        if (session) {
          sessionStorage.removeItem('editok-oauth-in-flight');
        }
        setSession(session);
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await resolveProfile(authUser);
        } else if (!oauthInFlight()) {
          setRole(null);
          setAdminRole(null);
          setAllowedMenus(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Auth session initialization failed:', error);
        sessionStorage.removeItem('editok-oauth-in-flight');
        if (!oauthInFlight()) {
          setSession(null);
          setUser(null);
          setRole(null);
          setAdminRole(null);
          setAllowedMenus(null);
        }
      })
      .finally(() => {
        sessionStorage.removeItem('editok-oauth-in-flight');
        if (active) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void (async () => {
        try {
          if (event === 'PASSWORD_RECOVERY') {
            setPasswordRecovery(true);
            return;
          }
          if (event === 'TOKEN_REFRESHED' && userRef.current) {
            setSession(nextSession);
            return;
          }
          if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && nextSession)) {
            sessionStorage.removeItem('editok-oauth-in-flight');
          }
          if (event === 'SIGNED_OUT') {
            sessionStorage.removeItem('editok-oauth-in-flight');
            clearCache();
          }
          const prevUserId = userRef.current?.id;
          const nextUserId = nextSession?.user?.id;
          if (prevUserId && nextUserId && prevUserId !== nextUserId) {
            clearCache();
          }
          setSession(nextSession);
          const authUser = nextSession?.user ?? null;
          setUser(authUser);
          if (authUser) {
            await resolveProfile(authUser);
          } else {
            setRole(null);
            setAdminRole(null);
            setAllowedMenus(null);
            localStorage.removeItem('editok-role');
          }
        } catch (error: unknown) {
          console.error('Auth state update failed:', error);
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setRole(null);
            setAdminRole(null);
            setAllowedMenus(null);
            localStorage.removeItem('editok-role');
          }
        } finally {
          sessionStorage.removeItem('editok-oauth-in-flight');
          setLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      clearTimeout(startupTimeout);
      clearTimeout(oauthTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Native deep-link handling for Android OAuth (Capacitor).
  // When Google auth completes in the external browser, it redirects back to the
  // app via the com.editok.app:// scheme. Capacitor's App plugin fires appUrlOpen
  // with the full callback URL; we parse out the access_token / refresh_token /
  // error_description and hand them to supabase.auth so the session is restored
  // inside the WebView. Without this, the browser opens Google, succeeds, but
  // has no way to deliver the tokens back into the app.
  useEffect(() => {
    if (!supabase) return;
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      if (!active) return;
      try {
        const parsed = new URL(url);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const queryParams = parsed.searchParams;
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const expiresAt = hashParams.get('expires_at') || queryParams.get('expires_at');
        const tokenType = hashParams.get('token_type') || queryParams.get('token_type') || 'bearer';
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
        const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
        if (errorDescription || errorCode) {
          console.error('OAuth deep-link error:', errorCode, errorDescription);
          return;
        }
        if (accessToken && refreshToken) {
          const expiresAtMs = expiresAt ? Number(expiresAt) * 1000 : undefined;
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
            ...(expiresAtMs ? { expires_at: expiresAtMs, token_type: tokenType } : {}),
          });
          if (error) console.error('setSession from deep link failed:', error.message);
        }
      } catch (err) {
        console.error('Failed to parse OAuth deep-link URL:', err);
      }
    };
    const promise = CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);
    return () => { active = false; promise.then((l) => l.remove()).catch(() => {}); };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Authentication is not configured.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await resolveProfile(data.user);
      localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
      localStorage.removeItem(CLOSED_AT_KEY);
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: string | null; needsConfirmation?: boolean }> => {
    if (!supabase) return { error: 'Authentication is not configured.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'customer', full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await upsertProfile({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'customer',
        provider: 'email',
      });
      await ensureCustomerForProfile({ email, full_name: fullName });
      sendAutomatedEmail('customer_welcome', {
        customer_name: fullName,
        customer_email: email,
        login_link: window.location.origin + '/login',
      }).then();
    }
    const needsConfirmation = data.user && !data.session;
    if (!needsConfirmation) {
      setRole('customer');
      localStorage.setItem('editok-role', 'customer');
    }
    return { error: null, needsConfirmation: !!needsConfirmation };
  };

  const signInWithGoogle = async () => {
    if (!supabase) return { error: 'Authentication is not configured.' };

    if (Capacitor.isNativePlatform()) {
      const androidClientId = import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID || '';
      const iosClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || '';
      const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '';
      if (!androidClientId && !iosClientId) {
        return { error: 'Google sign-in is not configured for this app.' };
      }
      try {
        await GoogleAuth.initialize({
          ...(androidClientId ? { androidClientId } : {}),
          ...(iosClientId ? { iosClientId } : {}),
          ...(webClientId ? { webClientId } : {}),
          scopes: ['profile', 'email', 'openid'],
        });
        const googleUser: GoogleUser = await GoogleAuth.signIn();
        if (!googleUser.authentication?.idToken) {
          return { error: 'Google sign-in did not return an ID token. Please try again.' };
        }
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleUser.authentication.idToken,
        });
        if (error) return { error: error.message };
        if (data.user) {
          await resolveProfile(data.user);
          localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
          localStorage.removeItem(CLOSED_AT_KEY);
        }
        return { error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('cancel') || msg.includes('Cancel')) return { error: null };
        return { error: `Google sign-in failed: ${msg}` };
      }
    }

    // Web fallback: standard OAuth redirect flow
    sessionStorage.setItem('editok-oauth-in-flight', '1');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      sessionStorage.removeItem('editok-oauth-in-flight');
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    clearCache();
    localStorage.removeItem('editok-role');
      localStorage.removeItem(HEARTBEAT_KEY);
      localStorage.removeItem(CLOSED_AT_KEY);
      sessionStorage.removeItem('editok-page');
    sessionStorage.removeItem('editok-params');
    sessionStorage.removeItem('editok-just-logged-in');
    setUser(null);
    setSession(null);
    setRole(null);
    setAdminRole(null);
    setAllowedMenus(null);
  };

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const value = useMemo(() => ({
    user, session, role, adminRole, allowedMenus, loading, passwordRecovery,
    signIn, signUp, signInWithGoogle, signOut, clearPasswordRecovery,
  }), [user, session, role, adminRole, allowedMenus, loading, passwordRecovery,
       signIn, signUp, signInWithGoogle, signOut, clearPasswordRecovery]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
