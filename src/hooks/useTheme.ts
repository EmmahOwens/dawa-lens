import { useEffect, useState } from "react";

export type Theme = "day" | "night" | "system";

const STORAGE_KEY = "dawa-lens-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "night") {
    root.classList.add("dark");
  } else if (theme === "day") {
    root.classList.remove("dark");
  } else {
    // system: follow OS preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
  });

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // When in "system" mode, react to OS changes in real-time
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return { theme, setTheme };
}

/** Call this once at app startup to apply the persisted theme immediately, 
 *  preventing a flash of the wrong theme on load. */
export function initTheme() {
  const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
  applyTheme(saved);
}
