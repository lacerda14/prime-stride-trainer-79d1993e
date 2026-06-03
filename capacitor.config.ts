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
