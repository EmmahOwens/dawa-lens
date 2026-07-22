import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  iconBg?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  className?: string;
}

export function StatCard({ label, value, sub, icon, iconBg = 'bg-primary/10', trend, trendLabel, className }: StatCardProps) {
  return (
    <div className={cn('admin-card admin-card-hover flex flex-col gap-4', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          {icon}
        </div>
        {trend && trendLabel && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full border',
            trend === 'up' ? 'text-success bg-success/10 border-success/25' :
            trend === 'down' ? 'text-destructive bg-destructive/10 border-destructive/25' :
            'text-muted-foreground bg-secondary border-border'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'} {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums animate-count-up">{value}</p>
        <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
