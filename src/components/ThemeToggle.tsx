import { Moon, Sun, Monitor } from "@/lib/icons";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      id={id}
      className="flex bg-[#f5f5f7] dark:bg-[#252527] rounded-full p-1 overflow-hidden relative w-fit border border-border/80"
    >
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(33.333%-2px)] bg-white dark:bg-[#1d1d1f] rounded-full border border-border/40 z-0 pointer-events-none"
        initial={false}
        animate={{
          x: theme === "light" ? 0 : theme === "dark" ? "100%" : "200%",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
      />

      <button
        type="button"
        className={`relative z-10 flex items-center justify-center rounded-full h-8 w-8 transition-colors ${
          theme === "light"
            ? "text-primary font-medium"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setTheme("light")}
        aria-label="Light theme"
      >
        <Sun size={15} />
      </button>

      <button
        type="button"
        className={`relative z-10 flex items-center justify-center rounded-full h-8 w-8 transition-colors ${
          theme === "dark"
            ? "text-primary font-medium"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setTheme("dark")}
        aria-label="Dark theme"
      >
        <Moon size={15} />
      </button>

      <button
        type="button"
        className={`relative z-10 flex items-center justify-center rounded-full h-8 w-8 transition-colors ${
          theme === "system"
            ? "text-primary font-medium"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setTheme("system")}
        aria-label="System theme"
      >
        <Monitor size={15} />
      </button>
    </div>
  );
}
