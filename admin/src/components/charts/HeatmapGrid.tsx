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
    if (ratio === 0) return 'bg-white/5 border border-white/5';
    if (ratio < 0.2) return 'bg-cyan-950/60 border border-cyan-800/30 text-cyan-400';
    if (ratio < 0.4) return 'bg-cyan-800/50 border border-cyan-600/40 shadow-sm shadow-cyan-500/10';
    if (ratio < 0.6) return 'bg-blue-600/60 border border-blue-400/50 shadow-md shadow-blue-500/20';
    if (ratio < 0.8) return 'bg-blue-500/80 border border-blue-300/60 shadow-lg shadow-blue-500/30';
    return 'bg-cyan-400 border border-white/80 shadow-xl shadow-cyan-400/40 animate-pulse';
  };

  return (
    <div className="overflow-x-auto p-1">
      <div className="min-w-[620px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-2">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div
              key={h}
              className="text-[10px] font-semibold text-muted-foreground/60 tracking-wider"
              style={{ width: `${100 / 24 * 3}%`, textAlign: 'left' }}
            >
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-1.5 mb-1.5">
            <div className="w-8 text-[11px] font-semibold text-muted-foreground shrink-0">{day}</div>
            <div className="flex flex-1 gap-1">
              {HOURS.map(h => {
                const count = lookup[`${di}-${h}`] || 0;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${count} doses logged`}
                    className={cn(
                      'flex-1 h-5.5 rounded-md transition-all duration-200 cursor-pointer hover:scale-125 hover:z-20',
                      intensityClass(count)
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 ml-10 text-xs">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Low Density</span>
          <div className="flex items-center gap-1">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => (
              <div
                key={r}
                className={cn('w-4 h-4 rounded-md', intensityClass(r * max))}
              />
            ))}
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">High Density</span>
        </div>
      </div>
    </div>
  );
}

