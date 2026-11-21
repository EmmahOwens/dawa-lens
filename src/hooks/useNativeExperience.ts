import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NativeService } from "@/services/nativeService";
import { soundService } from "@/services/soundService";
import { deferToIdle } from "@/lib/idleCallback";

/**
 * Synchronizes Android native system bars, browser `<meta name="theme-color">`,
 * hardware performance classes (`native-android`, `android-low-ram`, `reduced-motion-os`),
 * and preloaded native SoundPool chimes so the app feels indistinguishable from a
 * native Android Kotlin experience across Light, Dark, and Adaptive Mood themes.
 */
export function useNativeExperience() {
  useEffect(() => {
    const root = document.documentElement;
    const isNative = Capacitor.isNativePlatform();
    const isAndroid = isNative && Capacitor.getPlatform() === "android";

    if (isAndroid) {
      root.classList.add("native-android");
    }

    const syncChromeColors = () => {
      const isDark = root.classList.contains("dark");
      const bgColor = isDark ? "#000000" : "#ffffff";

      // Keep <meta name="theme-color"> synced for installed PWAs & Android recents card
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"][data-dynamic="true"]'
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.setAttribute("data-dynamic", "true");
        document.head.appendChild(meta);
      }
      meta.content = bgColor;

      if (isNative) {
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
        if (isAndroid) {
          NativeService.system.setSystemBarsStyle({
            isDark,
            statusBarColor: "#00000000",
            navigationBarColor: "#00000000",
          });
        }
      }
    };

    syncChromeColors();

    // Observe only class & data-mood attribute changes on <html> (zero subtree overhead)
    const themeObserver = new MutationObserver(() => {
      syncChromeColors();
    });
    themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-mood"],
    });

    // Probe hardware capabilities and warm native SoundPool during idle time
    if (isAndroid) {
      deferToIdle(() => {
        NativeService.system.getPerformanceProfile().then((profile) => {
          if (!profile) return;
          if (profile.isLowRamDevice) {
            root.classList.add("android-low-ram");
          }
          if (profile.reducedMotion) {
            root.classList.add("reduced-motion-os");
          }
        });
        soundService.preloadNativeSounds();
      });
    }

    return () => {
      themeObserver.disconnect();
    };
  }, []);
}
