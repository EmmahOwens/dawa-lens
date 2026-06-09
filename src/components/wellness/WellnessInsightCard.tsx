import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Sparkles, TrendingUp, TrendingDown, Minus, Info, Brain, Zap, Heart, ArrowRight } from "@/lib/icons";

interface WellnessInsightCardProps {
  insight: {
    summary: string;
    insight: string;
    score: number;
    status: "improving" | "declining" | "stable";
    recommendation?: string;
    lifestyleAnalysis?: string;
  } | null;
  loading: boolean;
}

const STATUS_CONFIG = {
  improving: {
    icon: TrendingUp,
    label: "Improving",
    color: "text-success",
    bg: "bg-success/10",
    bar: "bg-success",
    border: "border-success/20",
  },
  declining: {
    icon: TrendingDown,
    label: "Declining",
    color: "text-destructive",
    bg: "bg-destructive/10",
    bar: "bg-destructive",
    border: "border-destructive/20",
  },
  stable: {
    icon: Minus,
    label: "Stable",
    color: "text-warning",
    bg: "bg-warning/10",
    bar: "bg-warning",
    border: "border-warning/20",
  },
};

export default function WellnessInsightCard({ insight, loading }: WellnessInsightCardProps) {
  if (loading) {
    return (
      <div className="premium-card animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 bg-muted rounded-lg" />
            <div className="h-3 w-1/2 bg-muted rounded-lg" />
          </div>
          <div className="w-16 h-8 bg-muted rounded-xl" />
        </div>
        <div className="h-2 w-full bg-muted rounded-full" />
        <div className="h-16 w-full bg-muted rounded-2xl" />
        <div className="h-10 w-full bg-muted rounded-xl" />
      </div>
    );
  }

  if (!insight) return null;

  const cfg = STATUS_CONFIG[insight.status] || STATUS_CONFIG.stable;
  const StatusIcon = cfg.icon;
  const scorePercent = Math.max(0, Math.min(100, insight.score));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-card bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 relative overflow-hidden"
    >
      {/* Decorative background */}
      <Sparkles className="absolute -right-6 -top-6 text-primary/5 w-28 h-28 rotate-12" />

      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
            <Brain size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight text-foreground/90">
              Wellness Intelligence
            </h4>
            <div className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.border} border`}>
              <StatusIcon size={11} className={cfg.color} />
              <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Score badge */}
        <div className="text-right shrink-0 ml-2">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">
            Health Score
          </p>
          <div className="text-3xl font-black text-primary tracking-tighter leading-none">
            {insight.score}
            <span className="text-xs opacity-40 ml-0.5">/100</span>
          </div>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="mb-5">
        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorePercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${cfg.bar}`}
          />
        </div>
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Poor</span>
          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Excellent</span>
        </div>
      </div>

      {/* Summary block */}
      {insight.summary && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1.5">
            AI Summary
          </p>
          <div className="text-xs font-semibold text-foreground leading-relaxed">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                li: ({ children }) => <li className="text-[11px]">{children}</li>,
              }}
            >
              {insight.summary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Key insight */}
      <div className="p-4 rounded-2xl bg-accent/30 border border-border/40 mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">
          Key Insight
        </p>
        <div className="text-xs font-semibold text-foreground leading-relaxed">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            }}
          >
            {insight.insight}
          </ReactMarkdown>
        </div>
      </div>

      {/* Lifestyle analysis */}
      {insight.lifestyleAnalysis && (
        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 mb-4">
          <div className="text-[10px] font-semibold text-muted-foreground leading-snug italic">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              }}
            >
              {insight.lifestyleAnalysis}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {insight.recommendation && (
        <div className="flex items-start gap-3 px-1 mb-2">
          <div className="mt-0.5 p-1.5 rounded-full bg-warning/10 text-warning shrink-0">
            <Zap size={10} />
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground leading-snug italic">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              }}
            >
              {insight.recommendation}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground/50 flex items-center gap-1.5">
          <Info size={11} /> Personalized for your treatment
        </p>
        <div className="flex -space-x-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center"
            >
              <Heart size={8} className="text-primary" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
