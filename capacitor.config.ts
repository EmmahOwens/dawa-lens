import type { CapacitorConfig } from '@capacitor/cli';

// Configuration for the Capacitor native shell.
// This is set to always point to the production URL to ensure web changes 
// reflect immediately in the app without requiring App Store updates.
const config: CapacitorConfig = {
  appId: 'com.dawainnovation.lens',
  appName: 'dawa-lens',
  webDir: 'dist',
  server: {
    // Live production URL
    url: 'https://dawalens.web.app',
    
    // Custom offline fallback page that hides the default browser error.
    errorPath: 'offline.html',
    
    // Security and scheme settings
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
};

export default config;
