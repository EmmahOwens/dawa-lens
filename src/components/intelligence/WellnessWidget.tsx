import React, { useState, useEffect } from "react";
import { Activity, Brain, CheckCircle2 } from "@/lib/icons";
import MessageRenderer from "@/components/MessageRenderer";

export function WellnessWidget() {
  const [insightText, setInsightText] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("dawa_ai_health_insight");
      if (cached) {
        setInsightText(cached);
      }
    } catch (_) {}
  }, []);

  const defaultInsight = "Your mood logs show a **15% improvement** on days where you log a high-protein breakfast.";

  return (
    <div className="space-y-6">
      {/* Correlation Engine */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Correlation Engine</h4>
          <Brain size={14} className="text-primary" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 shadow-xs">
          <div className="flex items-center gap-3.5 mb-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Activity size={18} />
             </div>
             <div>
                <p className="text-xs font-semibold text-foreground tracking-tight">Mood Sensitivity</p>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">Insight Active</p>
             </div>
          </div>
          <div className="text-xs leading-relaxed text-muted-foreground font-medium pt-1">
            <MessageRenderer text={insightText || defaultInsight} className="text-xs leading-relaxed [&_strong]:text-primary [&_strong]:font-semibold" />
          </div>
        </div>
      </section>

      {/* Wellness Summary */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">System Snapshot</h4>
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-5 space-y-4 shadow-xs">
           <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium">Average Mood</span>
                 <span className="font-semibold text-foreground">4.2 / 5.0</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 rounded-full w-[84%]" />
              </div>
           </div>
           
           <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium">Average Vitality</span>
                 <span className="font-semibold text-foreground">3.8 / 5.0</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full w-[76%]" />
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
