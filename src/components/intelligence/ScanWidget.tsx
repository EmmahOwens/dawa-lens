import React from "react";
import { Zap, Camera, Terminal, ShieldCheck, Check } from "@/lib/icons";

export function ScanWidget() {
  return (
    <div className="space-y-6">
      {/* Precision Guide */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Precision Guide</h4>
          <Camera size={14} className="text-primary" />
        </div>
        <div className="space-y-2">
          {[
            { text: "Natural lighting", done: true },
            { text: "Zero surface glare", done: false },
            { text: "Steady capture", done: false }
          ].map((item, i) => (
            <div 
              key={i} 
              className="bg-card border border-border rounded-[14px] p-3.5 flex items-center justify-between shadow-xs"
            >
              <span className="text-xs font-medium text-foreground">{item.text}</span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                item.done 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                  : "bg-muted text-muted-foreground border border-border"
              }`}>
                {item.done ? <Check size={12} strokeWidth={2.5} /> : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live AI Diagnostics */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Diagnostics</h4>
          <Terminal size={14} className="text-muted-foreground" />
        </div>
        <div className="bg-card border border-border rounded-[18px] p-4 text-xs space-y-2.5 font-mono shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-[11px]">CAMERA_FEED_READY</span>
          </div>
          <div className="flex items-center gap-2 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-[11px]">ANALYZING_LIGHTING</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            <span className="font-medium text-[11px]">AWAITING_CAPTURE</span>
          </div>
        </div>
      </section>

      {/* Security Badge */}
      <div className="bg-card border border-border rounded-[18px] p-4 flex items-center gap-3.5 shadow-xs">
        <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={18} />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground tracking-tight">NDA Verified Standard</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">National Drug Authority compliant scanning</p>
        </div>
      </div>
    </div>
  );
}
