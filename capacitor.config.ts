import type { CapacitorConfig } from '@capacitor/cli';

// Switch between local dev and production remote URL.
// - Local dev: `npm run dev` starts Vite on port 8080, then `npx cap run android` loads it live.
//   Replace the IP below with your machine's local network IP (run `ip addr` to find it).
// - Production: always loads from Firebase Hosting → no native rebuild required for web changes.
const DEV_SERVER_URL = 'http://192.168.x.x:8080'; // ← replace with your local IP
const isProdBuild = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.dawainnovation.lens',
  appName: 'dawa-lens',
  webDir: 'dist',
  server: {
    // In production builds, always point to the live hosted URL.
    // Remove this `server` block entirely if you want to bundle web assets locally.
    url: isProdBuild ? 'https://dawalens.web.app' : DEV_SERVER_URL,
    cleartext: true,
    // Allows mixing HTTP and HTTPS during local development
    androidScheme: isProdBuild ? 'https' : 'http',
  },
};

export default config;
