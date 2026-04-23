import React from "react";
import { motion } from "framer-motion";
import { Zap, Camera, Terminal, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ScanWidget() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      {/* Precision Guide */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Precision Guide</h4>
          <Camera size={14} className="text-primary" />
        </div>
        <div className="space-y-3">
          {[
            { text: "Natural lighting", done: true },
            { text: "Zero surface glare", done: false },
            { text: "Steady capture", done: false }
          ].map((item, i) => (
            <motion.div 
              key={i} 
              whileHover={{ x: 5 }}
              className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all"
            >
              <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{item.text}</span>
              <div className={`w-3 h-3 rounded-full ${item.done ? "bg-success shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "bg-muted/50 border border-border"}`} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* AI Processing Log */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Live AI Diagnostics</h4>
          <Terminal size={14} className="text-muted-foreground" />
        </div>
        <div className="bg-zinc-950/95 backdrop-blur-md rounded-[1.5rem] p-5 font-mono text-[9px] text-primary/70 space-y-2 border border-zinc-800 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={40} className="text-primary" />
           </div>
           <p className="flex items-center gap-2"><span className="text-success font-black">✔</span> <span className="opacity-80">CAMERA_FEED_READY</span></p>
           <p className="flex items-center gap-2"><span className="text-primary animate-pulse font-black">●</span> <span className="text-primary/90 font-bold">ANALYZING_LIGHTING_V2.4</span></p>
           <p className="flex items-center gap-2 opacity-30"><span className="font-black">_</span> <span>WAITING_FOR_USER_CAPTURE_INPUT</span></p>
        </div>
      </section>

      {/* Security Badge */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-success/5 border border-success/20 rounded-[1.5rem] p-5 flex items-center gap-4 shadow-sm"
      >
        <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
           <ShieldCheck size={20} className="text-success" />
        </div>
        <div>
           <p className="text-[10px] text-success/90 font-black uppercase tracking-[0.1em]">ANDA Verified</p>
           <p className="text-[9px] text-success/60 font-bold uppercase tracking-widest mt-0.5">Secure Scan Protocol</p>
        </div>
      </motion.div>
    </div>

  );
}
