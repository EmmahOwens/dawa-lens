import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.dawainnovation.lens",
  appName: "Dawa Lens",
  webDir: "dist",
  // Dark background prevents the white flash between splash screen and app content
  backgroundColor: "#050505ff",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#4e73df",
    },
    SplashScreen: {
      // Manual control — we call SplashScreen.hide() after the app is fully ready
      // so users never see a blank white flash. Pattern from lichobile.
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: "#050505",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    Keyboard: {
      // Resize content area instead of the full viewport for smoother keyboard handling
      resize: KeyboardResize.Ionic,
      resizeOnFullScreen: true,
    },
  },
  ios: {
    scheme: "dawalens",
    // Prevents rubber-band bounce scrolling for a native feel
    scrollEnabled: false,
  },
  android: {
    // Required to load local assets over the capacitor:// scheme
    allowMixedContent: true,
  },
};

export default config;
