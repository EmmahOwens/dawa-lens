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
    LocalNotifications: {
      iconColor: "#4e73df",
    },
  },
};

export default config;
