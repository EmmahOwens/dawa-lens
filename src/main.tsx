import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initTheme } from "./hooks/useTheme";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// Apply persisted theme before React renders to prevent flash
initTheme();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// On native platforms, hide the splash screen after React has mounted and
// the first frame has been committed. The 500ms buffer gives React time to
// paint meaningful content so users never see a blank flash.
// capacitor.config.ts sets launchAutoHide: false to give us manual control.
if (Capacitor.isNativePlatform()) {
  setTimeout(() => {
    SplashScreen.hide({ fadeOutDuration: 300 });
  }, 500);
}
