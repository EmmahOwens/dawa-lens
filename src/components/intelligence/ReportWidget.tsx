import React from "react";
import { FileText, Sparkles } from "@/lib/icons";

export function ReportWidget() {
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Report Insights</h4>
          <FileText size={14} className="text-primary" />
        </div>

        <div className="bg-card border border-border rounded-[18px] p-5 flex items-start gap-3.5 shadow-xs">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-xs leading-relaxed text-muted-foreground font-medium">
              Generating a medical report utilizes DawaGPT to analyze your recent logs, identify dosage patterns, and compile actionable insights for your healthcare provider.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
