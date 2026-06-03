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
    // Durante o desenvolvimento, descomente para apontar pro preview do Lovable
    // e iterar sem rebuild nativo:
    // url: 'https://prime-stride-trainer.lovable.app',
    // cleartext: false,
    androidScheme: 'https',
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
