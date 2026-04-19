import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { initTheme } from "./hooks/useTheme";

// Apply persisted theme before React renders to prevent flash
initTheme();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
