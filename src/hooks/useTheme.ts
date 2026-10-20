type Theme = "day" | "night" | "system";

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

/** Call this once at app startup to apply the persisted theme immediately, 
 *  preventing a flash of the wrong theme on load. */
export function initTheme() {
  const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
  applyTheme(saved);
}
