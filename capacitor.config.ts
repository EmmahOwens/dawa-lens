import type { CapacitorConfig } from '@capacitor/cli';

// Configuration for the Capacitor native shell.
// This is set to always point to the production URL to ensure web changes 
// reflect immediately in the app without requiring App Store updates.
const config: CapacitorConfig = {
  appId: 'com.dawainnovation.lens',
  appName: 'dawa-lens',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      androidScaleType: "CENTER",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      useDialog: false,
    },
  },
};

export default config;
