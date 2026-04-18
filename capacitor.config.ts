import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dawainnovation.lens',
  appName: 'dawa-lens',
  webDir: 'dist',
  server: {
    url: 'https://dawalens.web.app',
    cleartext: true
  }
};

export default config;
