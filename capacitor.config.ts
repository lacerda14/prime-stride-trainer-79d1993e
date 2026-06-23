import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pmhybrid.app',
  appName: 'PM Hybrid',
  webDir: '.output/public',
  ios: {
    contentInset: 'always',
    backgroundColor: '#000000',
    limitsNavigationsToAppBoundDomains: true,
    scheme: 'PM Hybrid',
  },
  // App é TanStack Start (SSR + server functions). Precisa apontar para o
  // próprio Worker do Cloudflare — é infra do Pedro, não do Lovable.
  server: {
    url: 'https://pm-hybrid.pedrolacerda-m.workers.dev',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // serverClientId: usado pelo plugin nativo iOS p/ o serverAuthCode.
      // clientId: usado pelo @codetrix no Android (requestIdToken) — sem ele o
      // Android cai em R.string.server_client_id inexistente e CRASHA. É o client WEB.
      // iosClientId: client tipo iOS (NÃO o web). O plugin iOS (App/GoogleAuth.swift)
      // checa iosClientId ANTES de clientId; sem isso pegava o client web e o
      // GIDSignIn exigia o URL scheme …-htbk9s0fvo… (inexistente no Info.plist) →
      // CRASH. Com o client iOS, o scheme …-evkdovsrvjr… bate e o login funciona.
      serverClientId: '230882994224-htbk9s0fvo33tdl4c1o9p7d12juke4po.apps.googleusercontent.com',
      clientId: '230882994224-htbk9s0fvo33tdl4c1o9p7d12juke4po.apps.googleusercontent.com',
      iosClientId: '230882994224-evkdovsrvjr12sqkmg253tec4q8ivh9l.apps.googleusercontent.com',
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
