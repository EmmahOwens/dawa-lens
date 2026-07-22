import { useMemo } from 'react';
import type { HeatmapCell } from '../../types';
import { cn } from '../../lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface HeatmapGridProps { data: HeatmapCell[] }

export function HeatmapGrid({ data }: HeatmapGridProps) {
  const max = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);

  const lookup = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach(d => { m[`${d.dayIndex}-${d.hour}`] = d.count; });
    return m;
  }, [data]);

  const intensityClass = (count: number) => {
    const ratio = count / max;
    if (ratio === 0) return 'bg-secondary/60';
    if (ratio < 0.2) return 'bg-primary/15';
    if (ratio < 0.4) return 'bg-primary/30';
    if (ratio < 0.6) return 'bg-primary/50';
    if (ratio < 0.8) return 'bg-primary/70';
    return 'bg-primary/90';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div
              key={h}
              className="text-[9px] text-muted-foreground/60"
              style={{ width: `${100 / 24 * 3}%`, textAlign: 'left' }}
            >
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-8 text-[10px] font-medium text-muted-foreground shrink-0">{day}</div>
            <div className="flex flex-1 gap-0.5">
              {HOURS.map(h => {
                const count = lookup[`${di}-${h}`] || 0;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${count} doses`}
                    className={cn('flex-1 h-5 rounded-sm transition-colors duration-200 cursor-default', intensityClass(count))}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 ml-10">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => (
            <div
              key={r}
              className={cn('w-4 h-4 rounded-sm', intensityClass(r * max))}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  );
}
