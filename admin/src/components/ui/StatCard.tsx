import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from '../../lib/icons';

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  iconBg?: string;
  iconGlow?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  trendValue?: string;
  className?: string;
  accentClass?: string;
}

export function StatCard({
  label, value, sub, icon,
  iconBg = 'bg-primary/15',
  iconGlow,
  trend, trendLabel, trendValue,
  className, accentClass,
}: StatCardProps) {
  return (
    <div className={cn(
      'admin-card admin-card-hover flex flex-col gap-3 relative overflow-hidden',
      accentClass,
      className
    )}>
      {/* Subtle top glow */}
      {iconGlow && (
        <div
          className={`absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none ${iconGlow}`}
        />
      )}

      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between relative z-10">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shadow-inner',
          iconBg
        )}>
          {icon}
        </div>

        {trend && trendValue && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
            trend === 'up'   ? 'text-success bg-success/10 border-success/25' :
            trend === 'down' ? 'text-destructive bg-destructive/10 border-destructive/25' :
            'text-muted-foreground bg-secondary border-border'
          )}>
            {trend === 'up'   ? <TrendingUp size={10} />   :
             trend === 'down' ? <TrendingDown size={10} /> : null}
            {trendValue}
          </div>
        )}
      </div>

      {/* Value + label */}
      <div className="relative z-10">
        <p className="text-2xl font-bold text-foreground tabular-nums animate-count-up leading-none">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1.5">{label}</p>
        {sub && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{sub}</p>
        )}
        {trendLabel && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}
