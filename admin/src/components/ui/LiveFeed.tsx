import { useEffect, useRef } from 'react';
import { Pill, AlertTriangle, SkipForward, Scan, MessageSquare } from 'lucide-react';
import type { FeedEvent } from '../../types';
import { timeAgo } from '../../lib/utils';

const EVENT_CONFIG: Record<FeedEvent['type'], { icon: typeof Pill; color: string; bg: string }> = {
  dose_taken:   { icon: Pill,          color: 'text-success',     bg: 'bg-success/10 border-success/25' },
  dose_missed:  { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/25' },
  dose_skipped: { icon: SkipForward,   color: 'text-warning',     bg: 'bg-warning/10 border-warning/25' },
  scan:         { icon: Scan,          color: 'text-primary',     bg: 'bg-primary/10 border-primary/25' },
  ai_chat:      { icon: MessageSquare, color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/25' },
  new_user:     { icon: Pill,          color: 'text-primary',     bg: 'bg-primary/10 border-primary/25' },
};

interface LiveFeedProps {
  events: FeedEvent[];
  isConnected: boolean;
}

export function LiveFeed({ events, isConnected }: LiveFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(events.length);

  useEffect(() => {
    // Auto-scroll to top when new events come in
    if (events.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevCountRef.current = events.length;
  }, [events.length]);

  return (
    <div className="admin-card flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Live Activity</h3>
        <div className="flex items-center gap-1.5">
          <span className={isConnected ? 'live-dot' : 'inline-block w-2 h-2 rounded-full bg-muted-foreground'} />
          <span className="text-[10px] text-muted-foreground font-medium">
            {isConnected ? 'Real-time' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 no-scrollbar min-h-0"
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Waiting for events…
          </div>
        ) : (
          events.map((event, i) => {
            const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.dose_taken;
            const Icon = cfg.icon;
            return (
              <div
                key={event.id}
                className="feed-item-enter flex items-start gap-2.5 p-2.5 rounded-xl border border-border/40 hover:border-border/80 bg-secondary/30 transition-colors"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon size={13} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{event.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {event.userId.slice(0, 8)}… · {timeAgo(event.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
