import { useState } from 'react';
import { Sparkles, Send, Activity, CheckCircle } from '../../lib/icons';

interface AIAssistantCardProps {
  summary?: string;
  spendingTrends?: number;
  customerPayments?: number;
  loading?: boolean;
}

export function AIAssistantCard({
  summary = 'Your platform metrics for this period remain stable. User growth is consistent with expected seasonal variation. Adherence rates are balanced across key categories. No unusual patterns detected.',
  spendingTrends = 7,
  customerPayments = 25,
  loading = false,
}: AIAssistantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const shortSummary = summary.slice(0, 120);
  const hasMore = summary.length > 120;

  return (
    <div className="admin-card flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">How can I help you?</h3>
        </div>
        <button className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
      </div>

      {/* AI Summary */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <div className="p-3 rounded-xl bg-secondary/50 border border-border/40">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Activity size={10} className="text-primary" />
            AI Summary
          </p>
          {loading ? (
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
              <div className="skeleton h-3 w-3/5 rounded" />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {expanded || !hasMore ? summary : shortSummary + '…'}
              {hasMore && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-primary ml-1 hover:underline font-medium"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </p>
          )}
        </div>

        {/* Quick stat tiles */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/40">
            <p className="text-[10px] text-muted-foreground mb-1">Adherence Events</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-bold text-foreground tabular-nums leading-none">
                {loading ? '—' : spendingTrends}
              </p>
              <span className="badge badge-primary text-[9px] px-1.5 py-0.5">Active</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/40">
            <p className="text-[10px] text-muted-foreground mb-1">AI Interactions</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg font-bold text-foreground tabular-nums leading-none">
                {loading ? '—' : customerPayments}
              </p>
              <span className="badge badge-success text-[9px] px-1.5 py-0.5">
                <CheckCircle size={8} />
                Good
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="relative shrink-0">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask me anything…"
          className="w-full pr-10 pl-3 py-2.5 text-xs bg-secondary/60 border border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center text-primary hover:bg-primary/25 transition-colors">
          <Send size={11} />
        </button>
      </div>
    </div>
  );
}
