import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"

export function ThemeToggle({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div id={id} className="flex bg-secondary rounded-full p-1 overflow-hidden relative w-fit border border-border">
      <motion.div
        className="absolute top-1 bottom-1 w-1/3 bg-background rounded-full shadow-sm z-0 pointer-events-none"
        initial={false}
        animate={{
          x: theme === "light" ? "0%" : theme === "dark" ? "100%" : "200%",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full z-10 transition-colors w-10 h-10 ${theme === "light" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setTheme("light")}
        aria-label="Light theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full z-10 transition-colors w-10 h-10 ${theme === "dark" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setTheme("dark")}
        aria-label="Dark theme"
      >
        <Moon className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full z-10 transition-colors w-10 h-10 ${theme === "system" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setTheme("system")}
        aria-label="System theme"
      >
        <Monitor className="h-4 w-4" />
      </Button>
    </div>
  )
}
