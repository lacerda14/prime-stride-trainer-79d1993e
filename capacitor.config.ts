import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pmhybrid.app',
  appName: 'PM Hybrid',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#000000',
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'PM Hybrid',
  },
  server: {
    // App nativo carrega o web app publicado no Lovable (sem precisar de build estático).
    // Pra apontar pra outro env, troque a URL. Pra modo offline/standalone, comente e
    // configure um adapter SPA estático.
    url: 'https://prime-stride-trainer.lovable.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '230882994224-htbk9s0fvo33tdl4c1o9p7d12juke4po.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
  },
};

export default config;
