import { motion } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown, Minus, Info, Brain, Zap, Heart } from "lucide-react";

interface WellnessInsightCardProps {
  insight: {
    summary: string;
    insight: string;
    score: number;
    status: "improving" | "declining" | "stable";
    recommendation?: string;
  } | null;
  loading: boolean;
}

export default function WellnessInsightCard({ insight, loading }: WellnessInsightCardProps) {
  if (loading) {
    return (
      <div className="premium-card animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        </div>
        <div className="h-16 w-full bg-muted rounded-xl" />
      </div>
    );
  }

  if (!insight) return null;

  const StatusIcon = {
    improving: <TrendingUp className="text-success" size={16} />,
    declining: <TrendingDown className="text-destructive" size={16} />,
    stable: <Minus className="text-warning" size={16} />
  }[insight.status];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-card bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 relative overflow-hidden"
    >
      {/* Decorative background icon */}
      <Sparkles className="absolute -right-4 -top-4 text-primary/5 w-24 h-24 rotate-12" />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Brain size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight text-foreground/90">Wellness Intelligence</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {StatusIcon}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Condition: {insight.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Health Score</p>
          <div className="text-2xl font-black text-primary tracking-tighter">
            {insight.score}<span className="text-xs opacity-40 ml-0.5">/100</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-bold text-foreground leading-relaxed">
            {insight.insight}
          </p>
        </div>

        {insight.recommendation && (
          <div className="flex items-start gap-3 px-1">
            <div className="mt-0.5 p-1 rounded-full bg-warning/10 text-warning">
              <Zap size={10} />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground leading-tight italic">
              AI Recommendation: {insight.recommendation}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
          <Info size={12} /> Personalized for your treatment
        </p>
        <div className="flex -space-x-2">
          {[1,2,3].map(i => (
            <div key={i} className="w-5 h-5 rounded-full border-2 border-card bg-muted flex items-center justify-center">
              <Heart size={8} className="text-primary" fill="currentColor" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
