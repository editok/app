import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.editok.app',
  appName: 'EDITOK',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'app.editok.com',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email', 'openid'],
    },
    // Register the OAuth deep-link scheme so Capacitor routes
    // com.editok.app://auth-callback URLs back into the WebView
    // instead of opening a browser tab that can't reach the app.
    App: {
      launchListener: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
    webContentsDebuggingEnabled: false,
  minWebViewVersion: 119,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
