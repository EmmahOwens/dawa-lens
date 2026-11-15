import { Moon, Sun, Monitor } from "@/lib/icons";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      id={id}
      className="flex neu-inset rounded-full p-1 overflow-hidden relative w-fit"
    >
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(33.333%-2px)] neu-surface rounded-full z-0 pointer-events-none"
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
