import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dawainnovation.lens',
  appName: 'dawa-lens',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      useDialog: false
    }
  }
};

export default config;
