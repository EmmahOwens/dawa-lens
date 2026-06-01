import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, ChevronRight, ChevronLeft, LayoutDashboard, Scan, Heart, 
  History, Settings, Info, Loader2, Sparkles, Bot, Maximize2
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { ChatMessage, chatWithDawaGPTStream } from "@/services/aiAssistantService";
import { useAIActions } from "@/hooks/useAIActions";
import MessageRenderer from "@/components/MessageRenderer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AlertCircle } from "@/lib/icons";

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
    isDawaGPTOpen, setIsDawaGPTOpen,
    selectedPatientId
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
        selectedPatientId,
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
            <ErrorBoundary 
              fallback={
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
                  <AlertCircle size={20} className="text-destructive mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">Widget Error</p>
                </div>
              }
            >
              {renderContextualWidget()}
            </ErrorBoundary>
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
              
              <div className="bg-background dark:bg-card/40 rounded-3xl border border-border/60 p-4 flex flex-col h-[380px] relative overflow-hidden group/chat shadow-sm hover:shadow-md transition-all duration-500">
                {/* Message Stream */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-5 no-scrollbar z-10 scroll-smooth pr-1 pt-2">
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex gap-3 max-w-[90%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                          {m.role === "assistant" && (
                            <div className="w-6 h-6 rounded-md overflow-hidden border border-border/50 bg-background flex-shrink-0 flex items-center justify-center mt-0.5">
                              <img src="/dawa-gpt.png" alt="AI" className="w-4 h-4 object-contain" />
                            </div>
                          )}
                          <div className={`px-4 py-2.5 text-[12.5px] leading-relaxed ${
                            m.role === "user" 
                              ? "bg-muted/50 text-foreground rounded-2xl shadow-sm border border-border/20" 
                              : "text-foreground font-medium"
                          }`}>
                            {m.role === "assistant" ? (
                              <MessageRenderer
                                text={m.text}
                                onNavigate={() => {}}
                                className="text-[12.5px]"
                              />
                            ) : (
                              <p className="whitespace-pre-wrap">{m.text}</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start gap-3">
                        <div className="w-6 h-6 rounded-md overflow-hidden border border-border/50 bg-background flex-shrink-0 flex items-center justify-center mt-0.5">
                          <img src="/dawa-gpt.png" alt="AI" className="w-4 h-4 object-contain" />
                        </div>
                        <div className="flex items-center gap-1.5 py-2">
                          {[0, 0.15, 0.3].map((delay, i) => (
                            <motion.span
                              key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
                              className="block w-1 h-1 rounded-full bg-muted-foreground/40"
                            />
                          ))}
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
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(var(--muted), 0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSendMessage(suggestion)}
                      className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all shrink-0 shadow-sm"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>

                {/* Input Area */}
                 <div className="flex gap-2 z-10 bg-background border border-border/60 rounded-2xl p-1.5 shadow-sm focus-within:border-primary/40 transition-all">
                    <input 
                      type="text" 
                      value={miniChatInput}
                      onChange={(e) => setMiniChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage(miniChatInput)}
                      placeholder="Ask anything..." 
                      className="flex-1 bg-transparent rounded-xl px-3 py-2 text-[12.5px] outline-none font-medium placeholder:text-muted-foreground/50"
                    />
                    <Button 
                      size="icon" 
                      disabled={isTyping || !miniChatInput.trim()}
                      onClick={() => handleSendMessage(miniChatInput)}
                      className="rounded-xl w-9 h-9 shrink-0 bg-primary hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                    >
                      {isTyping ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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

