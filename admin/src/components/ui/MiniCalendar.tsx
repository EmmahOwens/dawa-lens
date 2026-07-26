import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Pill, AlertTriangle, SkipForward, Scan, MessageSquare, Users, Loader2 } from '../../lib/icons';
import type { FeedEvent } from '../../types';
import { api } from '../../services/adminApi';
import { timeAgo } from '../../lib/utils';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const EVENT_CONFIG: Record<FeedEvent['type'], { icon: typeof Pill; color: string; bg: string }> = {
  dose_taken:   { icon: Pill,          color: 'text-success',     bg: 'bg-success/10 border-success/25' },
  dose_missed:  { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/25' },
  dose_skipped: { icon: SkipForward,   color: 'text-warning',     bg: 'bg-warning/10 border-warning/25' },
  scan:         { icon: Scan,          color: 'text-primary',     bg: 'bg-primary/10 border-primary/25' },
  ai_chat:      { icon: MessageSquare, color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/25' },
  new_user:     { icon: Users,         color: 'text-primary',     bg: 'bg-primary/10 border-primary/25' },
};

interface MiniCalendarProps {
  /** Optional highlighted stat shown below the calendar */
  statValue?: string;
  statLabel?: string;
  statTrend?: string;
  /** Live events array to populate calendar activity dots */
  events?: FeedEvent[];
}

export function MiniCalendar({ statValue, statLabel = 'This Month', statTrend, events = [] }: MiniCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateEvents, setDateEvents] = useState<FeedEvent[]>([]);
  const [loadingDateEvents, setLoadingDateEvents] = useState(false);

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

  const formatDateStr = (d: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Check if a given day has events from the recent feed prop
  const hasLocalActivity = (d: number) => {
    const dateStr = formatDateStr(d);
    return events.some(e => e.createdAt && e.createdAt.startsWith(dateStr));
  };

  const handleSelectDate = async (d: number) => {
    const dateStr = formatDateStr(d);
    setSelectedDate(dateStr);
    setLoadingDateEvents(true);

    try {
      const res = await api.doseLogs.byDate(dateStr);
      setDateEvents(res.data || []);
    } catch (err) {
      console.warn('Failed to load events for date:', dateStr, err);
      // Fallback to local events if endpoint fails or network error
      const local = events.filter(e => e.createdAt && e.createdAt.startsWith(dateStr));
      setDateEvents(local);
    } finally {
      setLoadingDateEvents(false);
    }
  };

  // Build grid cells
  const cells: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="admin-card flex flex-col overflow-hidden p-4 sm:p-5 relative">
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

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 mb-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-8 invisible" />;
          const active = hasLocalActivity(day);
          const currentToday = isToday(day);
          const dateStr = formatDateStr(day);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={i}
              onClick={() => handleSelectDate(day)}
              className={`
                relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium cursor-pointer
                transition-all duration-150 group
                ${currentToday
                  ? 'bg-primary text-white shadow-md shadow-primary/30 font-bold'
                  : isSelected
                  ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                  : 'text-foreground hover:bg-secondary/80'}
              `}
            >
              <span>{day}</span>
              {/* Activity indicator dot */}
              {active && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    currentToday ? 'bg-white' : 'bg-primary'
                  }`}
                />
              )}
            </button>
          );
        })}
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

      {/* Date Activity Popup Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 fade-up-enter">
          <div className="bg-card border border-border/80 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
              <div>
                <h4 className="text-base font-bold text-foreground">
                  Activity Details
                </h4>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 thin-scroll min-h-[150px]">
              {loadingDateEvents ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <Loader2 size={24} className="text-primary" />
                  <p className="text-xs font-medium">Fetching activities for date...</p>
                </div>
              ) : dateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-1.5 text-center text-muted-foreground">
                  <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center mb-1">
                    <Pill size={18} className="text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No Activities Recorded</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    There were no dose logs or app events logged on this specific date.
                  </p>
                </div>
              ) : (
                dateEvents.map((event) => {
                  const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.dose_taken;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon size={15} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{event.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {event.userId === 'system' ? 'System' : `User: ${event.userId.slice(0, 8)}…`}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40">•</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({timeAgo(event.createdAt)})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total events: <strong className="text-foreground">{dateEvents.length}</strong>
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


