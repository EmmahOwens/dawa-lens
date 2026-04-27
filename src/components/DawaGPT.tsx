import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle, BellPlus, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage, AIAction, chatWithDawaGPTStream } from "@/services/aiAssistantService";
import { useAIActions } from "@/hooks/useAIActions";

export default function DawaGPT() {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    userProfile,
    medicines,
    reminders,
    doseLogs,
    wellnessLogs,
    patients,
    addMedicine,
    addReminder,
    updateReminder,
    deleteReminder,
    logDose,
    isDawaGPTOpen: isOpen,
    setIsDawaGPTOpen: setIsOpen,
  } = useApp();
  const { toast } = useToast();
  const { dispatchAIAction } = useAIActions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMed = medicines.length > 0 ? medicines[medicines.length - 1] : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        text: `Hi ${userProfile?.name || "there"}! I'm Dawa-GPT. I have full access to your ${reminders.length} reminder(s) and medication history. Ask me anything about your health or say "Add a reminder for [medicine]" to get started!`,
        source: "System",
      }]);
    }
  }, [isOpen]);


  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text };
    const botId = (Date.now() + 1).toString();
    const initialBotMsg: ChatMessage = { id: botId, role: "assistant", text: "", source: "Gemini" };
    
    setMessages(prev => [...prev, userMsg, initialBotMsg]);
    setInputValue("");
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
    } catch (e) {
      setMessages(prev => prev.map(msg => 
        msg.id === botId ? {
          ...msg,
          text: "Sorry, I'm having trouble connecting to my medical intelligence core right now.",
          source: "System"
        } : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  // Hide DawaGPT completely during auth and onboarding flows
  const hiddenPaths = ["/welcome", "/auth", "/onboarding", "/verify-email"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const lastMsg = messages[messages.length - 1];
  const defaultSuggestions = [
    "What are my reminders?",
    "Add a reminder for Paracetamol 500mg at 8am daily",
    "Log Paracetamol as taken",
    "I have a slight headache",
    "Add my mother Mary to the app"
  ];
  const activeSuggestions = lastMsg?.suggestions ?? defaultSuggestions;

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 p-0 rounded-2xl shadow-[0_8px_32px_rgba(var(--primary),0.3)] flex items-center justify-center md:hidden overflow-hidden w-16 h-16 group"
      >
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 2,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-primary/40 rounded-2xl blur-xl"
        />
        <div className="relative w-full h-full bg-primary/20 backdrop-blur-xl border border-white/30 rounded-2xl flex items-center justify-center overflow-hidden">
          <img src="/dawa-gpt.png" alt="Dawa GPT" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none p-0 md:p-6 bg-background/20 md:bg-background/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full md:max-w-2xl h-[80vh] md:h-[85vh] rounded-t-[2.5rem] md:rounded-3xl shadow-2xl border-x border-t md:border border-border/50 flex flex-col pointer-events-auto overflow-hidden ring-1 ring-white/10"
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50 bg-background/40 backdrop-blur-xl flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/20 p-0.5 bg-background">
                      <img src="/dawa-gpt.png" alt="Dawa GPT" className="w-full h-full object-cover rounded-[calc(1rem-2px)]" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center border-2 border-background">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        Dawa-GPT
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary">v2.0 AI</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.15em] opacity-60 flex items-center gap-1.5">
                      <Sparkles size={10} className="text-primary animate-pulse" />
                      East African Medical Assistant
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-3 hover:bg-muted/80 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-border/50 group"
                >
                  <X size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </div>


              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.03),transparent_40%)]">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`group relative max-w-[85%] md:max-w-[75%] px-5 py-4 shadow-xl transition-all duration-300 ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-[2rem] rounded-tr-sm shadow-primary/20"
                        : "bg-card text-card-foreground rounded-[2rem] rounded-tl-sm border border-border/50 shadow-black/5"
                    }`}>
                      <p className="text-[15px] leading-[1.6] font-medium whitespace-pre-wrap">{m.text}</p>
                      
                      {m.role === "assistant" && (
                        <div className="absolute -left-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="p-1 rounded-lg bg-background border border-border/50 shadow-sm">
                             <Bot size={12} className="text-primary" />
                           </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border/50 px-5 py-4 rounded-[2rem] rounded-tl-sm flex items-center gap-2 shadow-xl shadow-black/5">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer / Input */}
              <div className="p-6 bg-background/60 backdrop-blur-2xl border-t border-border/50 relative">
                <div className="absolute top-0 left-0 w-full h-20 -translate-y-full bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                
                {/* Prompt Suggestions */}
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar mb-6 pb-2">
                  {activeSuggestions.map((suggestion, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ y: -2, scale: 1.02, backgroundColor: "rgba(var(--primary), 0.1)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSend(suggestion)}
                      className="whitespace-nowrap px-5 py-2.5 rounded-2xl bg-card border border-border/50 text-[13px] font-bold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all flex items-center gap-2.5 shrink-0 shadow-sm"
                    >
                      <div className="p-1 rounded-lg bg-primary/10">
                        <Sparkles size={12} className="text-primary" />
                      </div>
                      {suggestion}
                    </motion.button>
                  ))}
                </div>

                <div className="flex gap-4 items-end">
                  <div className="flex-1 bg-muted/30 backdrop-blur-md border border-border/50 rounded-[2rem] px-6 py-2 flex flex-col focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-background/80 focus-within:shadow-2xl focus-within:shadow-primary/5 transition-all group">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(inputValue);
                        }
                      }}
                      placeholder="Type a message..."
                      className="bg-transparent border-none text-[15px] font-medium resize-none outline-none py-3 min-h-[52px] max-h-[160px] placeholder:text-muted-foreground/50"
                      rows={1}
                    />
                  </div>
                  <Button
                    onClick={() => handleSend(inputValue)}
                    disabled={isTyping || !inputValue.trim()}
                    className="rounded-full h-[60px] w-[60px] shrink-0 bg-primary hover:bg-primary/90 shadow-[0_10px_25px_rgba(var(--primary),0.4)] transition-all active:scale-90"
                  >
                    <Send size={22} className="ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
