import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type PermissionState = 'granted' | 'denied' | 'default';

/* ----------------------------- Web (VAPID) path ---------------------------- */

function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

async function getNotificationPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    return reg;
  } catch {
    return null;
  }
}

async function subscribeToPush(reg: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: getVapidKey(),
    });
    return sub;
  } catch {
    return null;
  }
}

function getVapidKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
}

function subscriptionToJson(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  return sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
}

/* ------------------------- device_tokens upserts -------------------------- */

interface DeviceTokenInput {
  user_id: string;
  endpoint: string;
  p256dh_key: string | null;
  auth_key: string | null;
  platform: 'web' | 'android';
  fcm_token?: string | null;
  active: boolean;
  last_seen_at: string;
}

async function saveDeviceToken(token: DeviceTokenInput) {
  if (!supabase) return;
  const { error } = await supabase.from('device_tokens').upsert(token, { onConflict: 'endpoint' });
  if (error) console.error('device_tokens upsert failed:', error);
}

async function removeDeviceToken(endpoint: string) {
  if (!supabase) return;
  const { error } = await supabase.from('device_tokens').delete().eq('endpoint', endpoint);
  if (error) console.error('device_tokens delete failed:', error);
} 

function deviceTokenTimestamp(): string {
  return new Date().toISOString();
}

/* --------------------------- Native (FCM) path ---------------------------- */

async function registerNativeFcm(): Promise<string | null> {
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return null;

    return await new Promise<string | null>((resolve) => {
      let resolved = false;
      const done = (token: string | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(token);
      };
      const onReg = (token: Token) => done(token.value);
      const onErr = (err: Error) => {
        console.error('FCM registration error:', err);
        done(null);
      };
      const cleanup = () => {
        PushNotifications.removeAllListeners().catch(() => {});
      };
      PushNotifications.addListener('registration', onReg);
      PushNotifications.addListener('registrationError', onErr);
      PushNotifications.register().catch((err: unknown) => {
        console.error('FCM registration request failed:', err);
        done(null);
      });
      setTimeout(() => done(null), 8000);
    });
  } catch (err) {
    console.error('FCM setup failed:', err);
    return null;
  }
}

/* ------------------------- Foreground toast events ------------------------ */

function dispatchForegroundToast(payload: PushNotificationPayload) {
  const ev = new CustomEvent('editok-foreground-notification', { detail: payload });
  window.dispatchEvent(ev);
}

/* ------------------------------- Main hook -------------------------------- */

export function usePushNotifications() {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      (async () => {
        const fcmToken = await registerNativeFcm();
        if (!active || !fcmToken) return;
        const endpoint = `fcm://${fcmToken}`;
        tokenRef.current = endpoint;
        await saveDeviceToken({
          user_id: user.id,
          endpoint,
          p256dh_key: null,
          auth_key: null,
          platform: 'android',
          fcm_token: fcmToken,
          active: true,
          last_seen_at: deviceTokenTimestamp(),
        });

        PushNotifications.addListener('pushNotificationReceived', (n: PushNotificationSchema) => {
          const payload: PushNotificationPayload = {
            title: n.title || 'EDITOK',
            body: n.body || '',
            data: n.data as Record<string, unknown> | undefined,
          };
          showLocalNotification(payload);
          dispatchForegroundToast(payload);
        });
        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          const data = (action.notification.data || {}) as Record<string, unknown>;
          const page = (data.page as string) || '';
          const params = (data.params as Record<string, unknown> | undefined);
          if (page) {
            const ev = new CustomEvent('editok-navigate', { detail: { page, params } });
            window.dispatchEvent(ev);
          }
        });
      })();

      return () => {
        active = false;
        if (tokenRef.current) removeDeviceToken(tokenRef.current);
        PushNotifications.removeAllListeners().catch(() => {});
      };
    }

    // Web path
    if (!isPushSupported()) return;

    let webToken: string | null = null;

    (async () => {
      const permission = await getNotificationPermission();
      if (permission !== 'granted' || !active) return;

      const reg = await registerServiceWorker();
      if (!reg || !active) return;

      const sub = await subscribeToPush(reg);
      if (!sub || !active) return;

      const json = subscriptionToJson(sub);
      webToken = json.endpoint;
      tokenRef.current = webToken;
      await saveDeviceToken({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh_key: json.keys.p256dh,
        auth_key: json.keys.auth,
        platform: 'web',
        fcm_token: null,
        active: true,
        last_seen_at: deviceTokenTimestamp(),
      });
    })();

    // Foreground push messages via service worker push event -> BroadcastChannel
    const channel = new BroadcastChannel('editok-push');
    channel.onmessage = (event) => {
      const payload = event.data as PushNotificationPayload | undefined;
      if (!payload) return;
      showLocalNotification(payload);
      dispatchForegroundToast(payload);
    };

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && webToken) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub && active) {
            const json = subscriptionToJson(sub);
            webToken = json.endpoint;
            await saveDeviceToken({
              user_id: user.id,
              endpoint: json.endpoint,
              p256dh_key: json.keys.p256dh,
              auth_key: json.keys.auth,
              platform: 'web',
              fcm_token: null,
              active: true,
              last_seen_at: deviceTokenTimestamp(),
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      channel.close();
      if (webToken) removeDeviceToken(webToken);
    };
  }, [user]);

  return {
    isSupported: isPushSupported() || Capacitor.isNativePlatform(),
    token: tokenRef.current,
  };
}

export async function requestPushPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  if (!isPushSupported()) return false;
  const permission = await getNotificationPermission();
  return permission === 'granted';
}

export function showLocalNotification(payload: PushNotificationPayload) {
  if (Capacitor.isNativePlatform()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(payload.title, {
      body: payload.body,
      data: payload.data,
      badge: '/favicon.ico',
      icon: '/favicon.ico',
    });
  } catch {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      reg?.showNotification(payload.title, { body: payload.body, data: payload.data });
    });
  }
}
