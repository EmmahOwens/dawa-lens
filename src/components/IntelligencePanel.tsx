import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart, 
  History, Settings, Info, Loader2, Sparkles, Bot, Maximize2
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { ChatMessage, chatWithDawaGPTStream } from "@/services/aiAssistantService";
import { useAIActions } from "@/hooks/useAIActions";

// Widgets
import { DashboardWidget } from "./intelligence/DashboardWidget";
import { ScanWidget } from "./intelligence/ScanWidget";
import { WellnessWidget } from "./intelligence/WellnessWidget";
import { MedDetailsWidget } from "./intelligence/MedDetailsWidget";
import { RemindersWidget } from "./intelligence/RemindersWidget";
import { HistoryWidget } from "./intelligence/HistoryWidget";
import { InteractionsWidget } from "./intelligence/InteractionsWidget";
import { FamilyHubWidget } from "./intelligence/FamilyHubWidget";
import { TravelWidget } from "./intelligence/TravelWidget";
import { ReportWidget } from "./intelligence/ReportWidget";
import { SettingsWidget } from "./intelligence/SettingsWidget";

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

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        text: `Hi ${userProfile?.name || "there"}! I'm Dawa-GPT. Ask me anything about your health or say "Add a reminder" to get started!`,
        source: "System",
      }]);
    }
  }, [userProfile?.name, messages.length]);

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

  const renderContextualWidget = () => {
    const path = location.pathname;
    if (path === "/" || path === "/dashboard") return <DashboardWidget />;
    if (path === "/scan" || path === "/results") return <ScanWidget />;
    if (path === "/wellness") return <WellnessWidget />;
    if (path.startsWith("/medicine/") || path === "/search") return <MedDetailsWidget />;
    if (path === "/reminders" || path === "/reminders/new") return <RemindersWidget />;
    if (path === "/history") return <HistoryWidget />;
    if (path === "/interactions") return <InteractionsWidget />;
    if (path === "/family") return <FamilyHubWidget />;
    if (path === "/travel") return <TravelWidget />;
    if (path === "/report") return <ReportWidget />;
    if (path === "/settings") return <SettingsWidget />;
    
    // Safety fallback
    return <DashboardWidget />;
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
    <aside className="w-[360px] border-l border-white/10 bg-background/60 backdrop-blur-3xl backdrop-saturate-[2] flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-4 shadow-[-20px_0_40px_rgba(0,0,0,0.04)]">
      
      {/* Header with Collapse Button */}
      <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
           <div className="relative">
             <div className="w-8 h-8 rounded-lg overflow-hidden shadow-md border border-primary/20 p-0.5 bg-background">
               <img src="/dawa-gpt.png" alt="Intelligence" className="w-full h-full object-cover rounded-[calc(0.5rem-2px)]" />
             </div>
             <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-background rounded-full flex items-center justify-center">
               <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
             </div>
           </div>
           <div>
             <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Intelligence</h2>
             <span className="text-[9px] text-primary/80 font-bold uppercase tracking-widest mt-0.5 block">Active</span>
           </div>
        </div>
        <button 
          onClick={() => setIsIntelligenceCollapsed(true)}
          className="p-1.5 hover:bg-muted/80 rounded-full text-muted-foreground transition-all active:scale-90"
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col min-h-0 pt-6 border-t border-border/50 relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20">
                    <Bot size={14} className="text-primary" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">Dawa-GPT</h3>
                </div>
                <button 
                  onClick={() => setIsDawaGPTOpen(true)}
                  className="flex items-center gap-1.5 text-[9px] font-black text-primary hover:bg-primary/10 transition-all uppercase tracking-widest border border-primary/30 bg-primary/5 rounded-full px-3 py-1.5 active:scale-95 group shadow-sm"
                >
                  <Maximize2 size={10} className="group-hover:scale-110 transition-transform" />
                  <span>Expand</span>
                </button>
              </div>
              
              <div className="bg-card/50 backdrop-blur-2xl rounded-[2rem] border border-border/60 p-4 flex flex-col h-[380px] relative overflow-hidden group/chat shadow-lg hover:shadow-xl transition-all duration-500 hover:border-primary/20 ring-1 ring-white/5">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none group-hover/chat:opacity-[0.05] transition-opacity grayscale group-hover/chat:grayscale-0 group-hover/chat:scale-110 duration-700">
                  <img src="/dawa-gpt.png" alt="" className="w-24 h-24" />
                </div>
                
                {/* Message Stream */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-4 no-scrollbar z-10 scroll-smooth pr-1">
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: m.role === "user" ? 10 : -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`relative max-w-[90%] px-4 py-3 text-[12px] font-medium shadow-sm leading-relaxed ${
                          m.role === "user" 
                            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-[1.5rem] rounded-tr-sm shadow-primary/20" 
                            : "bg-background text-foreground border border-border/50 rounded-[1.5rem] rounded-tl-sm shadow-black/5"
                        }`}>
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </motion.div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-background border border-border/50 px-4 py-3 rounded-[1.5rem] rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                          <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-primary/80 rounded-full" />
                          <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-1.5 h-1.5 bg-primary/80 rounded-full" />
                          <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 h-1.5 bg-primary/80 rounded-full" />
                        </div>
                      </div>
                    )}
                </div>

                {/* Suggestions */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 pb-1 z-10">
                    {(messages[messages.length - 1]?.suggestions || [
                      "Add reminder",
                      "Check schedule",
                      "Log dose"
                    ]).slice(0, 3).map((suggestion, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ y: -1, scale: 1.02, backgroundColor: "rgba(var(--primary), 0.08)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSendMessage(suggestion)}
                      className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-background border border-border/50 text-[10px] font-black text-muted-foreground hover:text-primary hover:border-primary/40 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-tight shadow-sm"
                    >
                      <Sparkles size={10} className="text-primary/80" />
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
                      placeholder="Ask anything..." 
                      className="flex-1 bg-background/80 backdrop-blur-md rounded-2xl px-4 py-3 text-[12px] border border-border/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium placeholder:text-muted-foreground/50 shadow-inner"
                    />
                    <Button 
                      size="icon" 
                      disabled={isTyping || !miniChatInput.trim()}
                      onClick={() => handleSendMessage(miniChatInput)}
                      className="rounded-2xl w-[46px] h-[46px] shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 active:scale-90 transition-all"
                    >
                      {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
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

