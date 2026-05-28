import { Moon, Sun, Monitor } from "@/lib/icons"
import { useTheme } from "next-themes"
import RiveAnimation from "./rive/RiveAnimation";
import { Button } from "@/components/ui/button"

/**
 * ThemeToggle.tsx - Rive Optimized
 * Replaces Framer Motion springs with a Rive state machine for the selection slider.
 * This ensures the physics calculation happens off the main thread where possible.
 */
export function ThemeToggle({ id }: { id?: string }) {
  const { theme, setTheme } = useTheme()

  // Map theme string to Rive state machine input value
  const themeValue = theme === "light" ? 0 : theme === "dark" ? 1 : 2;

  return (
    <div id={id} className="flex bg-secondary rounded-full p-1 overflow-hidden relative w-fit border border-border">
      {/* Rive-powered background slider */}
      <div className="absolute inset-1 w-full pointer-events-none z-0">
        <RiveAnimation
          src="/assets/rive/theme_slider.riv"
          stateMachine="ThemeSwitcher"
          inputs={{
            "position": themeValue
          }}
          autoplay={true}
        />
      </div>
      
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
