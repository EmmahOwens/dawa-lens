import { useState } from 'react';
import { ChevronLeft, ChevronRight } from '../../lib/icons';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface MiniCalendarProps {
  /** Optional highlighted stat shown below the calendar */
  statValue?: string;
  statLabel?: string;
  statTrend?: string;
}

export function MiniCalendar({ statValue, statLabel = 'This Month', statTrend }: MiniCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert so Monday is first (0=Mon…6=Sun)
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Build grid cells
  const cells: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full grid rows (5 or 6 rows)
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="admin-card flex flex-col h-full overflow-hidden p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <button
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft size={14} />
        </button>

        <p className="text-sm font-semibold text-foreground">
          {MONTHS[month]}, {year}
        </p>

        <button
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          title="Next Month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground/60 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — fixed h-8 rows so every week is always visible */}
      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 mb-1">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`
              flex items-center justify-center h-8 rounded-lg text-xs font-medium cursor-pointer
              transition-colors duration-100
              ${day === null ? 'invisible' :
                isToday(day!)
                  ? 'bg-primary text-white shadow-md shadow-primary/30 font-bold'
                  : 'text-foreground hover:bg-secondary/80'}
            `}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Stat display */}
      {statValue && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-foreground tabular-nums leading-none">{statValue}</p>
              <p className="text-[10px] text-muted-foreground">{statLabel}</p>
            </div>
          </div>
          {statTrend && (
            <span className="text-[10px] font-semibold text-success bg-success/10 border border-success/25 px-1.5 py-0.5 rounded-full">
              {statTrend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

