import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeContext, type Theme as ThemeType } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

const OPTIONS: { value: ThemeType; icon: React.ElementType; label: string }[] = [
  { value: 'light',  icon: Sun,     label: 'Light'  },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark',   icon: Moon,    label: 'Dark'   },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeContext();

  return (
    <div
      role="group"
      aria-label="Toggle theme"
      className="flex items-center gap-0.5 p-1 rounded-xl border border-border/60 bg-secondary/40 backdrop-blur-sm"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            aria-pressed={isActive}
            className={cn(
              'relative flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
          >
            <Icon size={13} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
