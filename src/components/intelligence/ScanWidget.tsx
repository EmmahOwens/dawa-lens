import React from "react";
import { motion } from "framer-motion";
import { Zap, Camera, Terminal, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ScanWidget() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Precision Guide */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Precision Guide</h4>
          <Camera size={12} className="text-primary" />
        </div>
        <div className="space-y-2">
          {[
            { text: "Ensure natural lighting", done: true },
            { text: "Avoid surface glare", done: false },
            { text: "Hold steady for 2s", done: false }
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.text}</span>
              <div className={`w-2 h-2 rounded-full ${item.done ? "bg-success shadow-[0_0_8px_rgba(var(--success),0.5)]" : "bg-muted"}`} />
            </div>
          ))}
        </div>
      </section>

      {/* AI Processing Log */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live AI Diagnostics</h4>
          <Terminal size={12} className="text-muted-foreground" />
        </div>
        <div className="bg-black/90 rounded-2xl p-4 font-mono text-[9px] text-primary/80 space-y-1.5 overflow-hidden">
           <p className="flex items-center gap-2"><span className="text-success">✔</span> CAMERA_FEED_READY</p>
           <p className="flex items-center gap-2"><span className="text-primary animate-pulse">●</span> ANALYZING_LIGHTING_V2</p>
           <p className="flex items-center gap-2 opacity-40">_ WAITING_FOR_CAPTURE</p>
        </div>
      </section>

      {/* Security Badge */}
      <div className="bg-success/5 border border-success/20 rounded-2xl p-4 flex items-center gap-3">
        <ShieldCheck size={16} className="text-success shrink-0" />
        <p className="text-[10px] text-success/80 font-bold uppercase tracking-widest">ANDA Verified Security</p>
      </div>
    </div>
  );
}
