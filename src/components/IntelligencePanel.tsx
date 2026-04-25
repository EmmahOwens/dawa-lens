import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart, 
  History, Settings, Info, Loader2, Sparkles as SparklesIcon,
  Activity, ShieldAlert, CheckCircle2, Clock, Sparkles, Utensils
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { checkConditionSafety } from "@/services/conditionInteractionService";
import { Button } from "./ui/button";
import { toast } from "@/hooks/use-toast";
import { ChatMessage, chatWithDawaGPTStream } from "@/services/aiAssistantService";
import { DashboardWidget } from "./intelligence/DashboardWidget";
import { ScanWidget } from "./intelligence/ScanWidget";
import { WellnessWidget } from "./intelligence/WellnessWidget";
import { MedDetailsWidget } from "./intelligence/MedDetailsWidget";
import { useIntelligenceContext } from "@/hooks/useIntelligenceContext";
import { Maximize2, BrainCircuit } from "lucide-react";
import { useAIActions } from "@/hooks/useAIActions";

export function IntelligencePanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const { 
    medicines, userProfile, doseLogs, reminders, wellnessLogs, patients,
    isIntelligenceCollapsed, setIsIntelligenceCollapsed, 
    isDawaGPTOpen, setIsDawaGPTOpen 
  } = useApp();
  const { dispatchAIAction } = useAIActions();
  
  const [miniChatInput, setMiniChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const lastMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;
  const safetyWarnings = lastMed && userProfile 
    ? checkConditionSafety(lastMed.name, lastMed.genericName, []) 
    : [];

  const todayLogs = doseLogs.filter(log => {
      const logDate = new Date(log.actionTime).toDateString();
      const today = new Date().toDateString();
      return logDate === today && log.action === "taken";
  });

  const adherenceRate = reminders.length > 0 ? Math.round((todayLogs.length / reminders.length) * 100) : 0;
  
  const { insight, nutritionalTip, isLoading: isInsightLoading } = useIntelligenceContext();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        text: `Hi ${userProfile?.name || "there"}! I'm Dawa-GPT. I have full access to your ${reminders.length} reminder(s) and medication history. Ask me anything about your health or say "Add a reminder for [medicine]" to get started!`,
        source: "System",
      }]);
    }
  }, [userProfile?.name, reminders.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { 
       id: Date.now().toString(), 
       role: "user", 
       text 
    };
    
    const botId = (Date.now() + 1).toString();
    const initialBotMsg: ChatMessage = {
      id: botId,
      role: "assistant",
      text: "",
      source: "Gemini"
    };

    setMessages(prev => [...prev, userMsg, initialBotMsg]);
    setMiniChatInput("");
    setIsTyping(true);

    try {
      const response = await chatWithDawaGPTStream(
        [...messages, userMsg], 
        medicines, 
        userProfile, 
        doseLogs, 
        reminders, 
        wellnessLogs, 
        patients, 
        (streamedText) => {
          setMessages(prev => prev.map(msg => 
            msg.id === botId ? { ...msg, text: streamedText } : msg
          ));
        }
      );
      
      // Final update with metadata (suggestions, actions)
      setMessages(prev => prev.map(msg => 
        msg.id === botId ? response : msg
      ));

      if (response.action) {
        await dispatchAIAction(response.action);
      }
    } catch (err) {
      console.error("Mini Chat Error:", err);
      setMessages(prev => prev.map(msg => 
        msg.id === botId ? {
          ...msg,
          text: "I'm having trouble connecting to my medical intelligence core. Please ensure the backend is active.",
          source: "System"
        } : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };


  // Route-based widget selection
  const renderContextualWidget = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return <DashboardWidget />;
    if (path === "/scan" || path === "/results") return <ScanWidget />;
    if (path === "/wellness") return <WellnessWidget />;
    if (path.startsWith("/medicine/")) return <MedDetailsWidget />;
    
    // Default fallback (original content)
    return (
      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("Intelligence.snapshot")}</h3>
            <Activity size={14} className="text-primary" />
          </div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-background/40 backdrop-blur-sm rounded-[2rem] p-6 border border-border/50 shadow-sm relative overflow-hidden group"
          >
            <div className="flex items-center gap-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-muted/10" />
                  <motion.circle 
                    cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" 
                    strokeDasharray={2 * Math.PI * 28}
                    initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - adherenceRate / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="text-primary shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[12px] font-black">{adherenceRate}%</span>
              </div>
              <div>
                <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{t("Intelligence.adherence")}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 mt-1">{todayLogs.length} / {reminders.length} {t("Intelligence.doses_taken")}</p>
              </div>
            </div>
          </motion.div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("Intelligence.watchdog")}</h3>
            <ShieldAlert size={14} className={safetyWarnings.length > 0 ? "text-destructive" : "text-success"} />
          </div>
          {safetyWarnings.length > 0 ? (
            <div className="space-y-3">
              {safetyWarnings.map((warning, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ scale: 1.02 }}
                  className="bg-destructive/5 backdrop-blur-sm border border-destructive/20 rounded-[1.5rem] p-5 flex gap-4 italic shadow-sm"
                >
                  <ShieldAlert size={16} className="text-destructive shrink-0" />
                  <p className="text-[11px] leading-relaxed text-destructive/90 font-medium">{warning.warning}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-success/5 backdrop-blur-sm border border-success/20 rounded-[1.5rem] p-5 flex items-center gap-4 shadow-sm"
            >
              <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                 <CheckCircle2 size={16} className="text-success" />
              </div>
              <p className="text-[10px] text-success/90 font-black uppercase tracking-widest">{t("Intelligence.no_interactions")}</p>
            </motion.div>
          )}
        </section>


      </div>
    );
  };

  const hideGPTMini = location.pathname === "/scan" || location.pathname === "/settings" || isDawaGPTOpen;

  if (isIntelligenceCollapsed) {
    return (
      <aside className="w-[70px] border-l border-border bg-sidebar-background flex flex-col h-screen sticky top-0 overflow-hidden items-center py-6 transition-all duration-500">
        <button 
          onClick={() => setIsIntelligenceCollapsed(false)}
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-10 hover:bg-primary/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex flex-col gap-8 opacity-40">
           <LayoutDashboard size={20} />
           <Scan size={20} />
           <Heart size={20} />
           <History size={20} />
           <Settings size={20} />
        </div>
        <div className="p-4">
           <Info size={16} className="text-muted-foreground/30" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] border-l border-border/40 bg-background/60 backdrop-blur-xl flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-4 shadow-[-10px_0_30px_rgba(0,0,0,0.03)]">
      
      {/* Header with Collapse Button */}
      <div className="p-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Sparkles size={16} className="text-primary animate-pulse" />
           <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Intelligence</h2>
        </div>
        <button 
          onClick={() => setIsIntelligenceCollapsed(true)}
          className="p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="p-6 space-y-8 overflow-y-auto flex-1 no-scrollbar">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderContextualWidget()}
          </motion.div>
        </AnimatePresence>

        {/* Section: Dawa-GPT Mini (Conditional) */}
        <AnimatePresence>
          {!hideGPTMini && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col min-h-0 pt-4 border-t border-border/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dawa-GPT Mini</h3>
                </div>
                <button 
                  onClick={() => setIsDawaGPTOpen(true)}
                  className="hidden md:flex items-center gap-1.5 text-[9px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest border border-primary/20 bg-primary/5 rounded-full px-2 py-1"
                >
                  <Maximize2 size={10} />
                  <span>Expand</span>
                </button>
              </div>
              <div className="bg-muted/10 backdrop-blur-md rounded-[2.5rem] border border-border/30 p-5 flex flex-col h-[350px] relative overflow-hidden group/chat shadow-inner transition-all duration-300 hover:shadow-primary/5">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/chat:opacity-10 transition-opacity">
                  <SparklesIcon size={80} />
                </div>
                
                {/* Message Stream */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto mb-2 space-y-3 no-scrollbar z-10 scroll-smooth">
                    {messages.length === 0 ? (
                      <div className="bg-background/60 backdrop-blur-sm rounded-2xl rounded-tl-none p-3 text-[11px] border border-border/30 shadow-sm leading-relaxed text-muted-foreground italic">
                        Jambo! I'm Dawa-GPT. Ask me anything about your medications or regional health guidelines.
                      </div>
                    ) : (
                      messages.map((m) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, x: m.role === "user" ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-[11px] shadow-sm ${
                            m.role === "user" 
                              ? "bg-primary text-primary-foreground rounded-tr-none" 
                              : "bg-background border border-border/50 rounded-tl-none"
                          }`}>
                            <p className="leading-relaxed">{m.text}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-background border border-border/50 p-2 rounded-2xl rounded-tl-none flex items-center gap-1">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-primary rounded-full" />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-primary rounded-full" />
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-primary rounded-full" />
                        </div>
                      </div>
                    )}
                </div>

                {/* Suggestions */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 pb-1 z-10">
                    {(messages[messages.length - 1]?.suggestions || [
                      "Check schedule",
                      "Add reminder",
                      "Log dose",
                      "Headache log",
                      "Add patient"
                    ]).map((suggestion, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(var(--primary), 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSendMessage(suggestion)}
                      className="whitespace-nowrap px-3 py-1.5 rounded-full bg-background/50 border border-border/30 text-[9px] font-bold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-tighter"
                    >
                      <Sparkles size={8} className="text-primary/70" />
                      {suggestion}
                    </motion.button>
                  ))}
                </div>

                {/* Input Area */}
                <div className="flex gap-2 z-10">
                    <input 
                      type="text" 
                      value={miniChatInput}
                      onChange={(e) => setMiniChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage(miniChatInput)}
                      placeholder="How can I help you today?" 
                      className="flex-1 bg-background/80 backdrop-blur-sm rounded-full px-5 py-2.5 text-[11px] border-none outline-none ring-1 ring-border/50 focus:ring-primary/30 transition-all font-medium placeholder:text-muted-foreground/50 shadow-sm"
                    />
                    <Button 
                      size="icon" 
                      disabled={isTyping || !miniChatInput.trim()}
                      onClick={() => handleSendMessage(miniChatInput)}
                      className="rounded-full w-8 h-8 shrink-0 bg-primary shadow-lg shadow-primary/20 active:scale-90 transition-transform"
                    >
                      {isTyping ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </div>
      

    </aside>
  );
}
