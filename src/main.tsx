import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initTheme } from "./hooks/useTheme";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// Global handler for Vite dynamic import chunk loading failures after new deployments
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    console.warn("Vite dynamic chunk preload failed. Refreshing for latest version...", event);
    event.preventDefault();
    const lastReload = Number(sessionStorage.getItem("vite_preload_reload_ts") || 0);
    const now = Date.now();
    // Prevent rapid reload loops (allow at most once every 10 seconds)
    if (now - lastReload > 10000 && navigator.onLine) {
      sessionStorage.setItem("vite_preload_reload_ts", String(now));
      window.location.reload();
    }
  });

  // Global safety net for unhandled promise rejections (e.g. native bridge, network hiccups)
  window.addEventListener("unhandledrejection", (event) => {
    console.warn("[GlobalSafety] Unhandled promise rejection intercepted:", event.reason);
  });
}

// Apply persisted theme before React renders to prevent flash
initTheme();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// On native platforms, hide the splash screen after React has mounted and
// the first frame has been committed.
// capacitor.config.ts sets launchAutoHide: false to give us manual control.
if (Capacitor.isNativePlatform()) {
  // Hide native splash immediately since we have a web splash screen
  // that takes over to provide a smooth transition.
  SplashScreen.hide();
}
