import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { ChatMessage, generateDawaGPTResponse } from "@/services/aiAssistantService";

export default function DawaGPT() {
  const { t } = useTranslation();
  const { userProfile, medicines } = useApp();
  const [isOpen, setIsOpen] = useState(false);
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
      // Welcome message
      setMessages([{
        id: "welcome",
        role: "assistant",
        text: `Hi ${userProfile?.name || "there"}! I'm Dawa-GPT. Ask me anything about your medications or health context.`,
        source: "System"
      }]);
    }
  }, [isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await generateDawaGPTResponse(text, activeMed, userProfile);
      setMessages(prev => [...prev, response]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: "error",
        role: "assistant",
        text: "Sorry, I'm having trouble connecting right now.",
        source: "System"
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-lg border-2 border-background flex items-center justify-center"
      >
        <Sparkles size={24} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-md h-[80vh] rounded-t-3xl shadow-2xl border-x border-t border-border flex flex-col pointer-events-auto overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bot size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                       Dawa-GPT 
                       <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">Powered by ANDA</span>
                    </h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">East African Medical Assistant</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Warnings/Context */}
              {activeMed && (
                <div className="bg-primary/5 px-4 py-2 flex items-center gap-2 border-b border-primary/10">
                  <span className="text-[10px] font-bold text-primary shrink-0 uppercase tracking-widest">Active Context:</span>
                  <span className="text-[11px] font-semibold truncate text-muted-foreground">{activeMed.name}</span>
                </div>
              )}

              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-4 ${
                      m.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted text-card-foreground rounded-tl-none border border-border/50"
                    }`}>
                      <p className="text-sm leading-relaxed">{m.text}</p>
                      {m.source && m.role === "assistant" && (
                        <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between gap-2">
                           <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Source: {m.source}</span>
                           <Sparkles size={10} className="text-primary/50" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-primary rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer / Input */}
              <div className="p-4 bg-background border-t border-border">
                {/* quick suggestions */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                   <button onClick={() => handleSend("Is this safe for me?")} className="shrink-0 text-[11px] font-semibold border rounded-full px-3 py-1.5 hover:bg-muted transition-colors">Is this safe for me?</button>
                   <button onClick={() => handleSend("Can I take this with milk?")} className="shrink-0 text-[11px] font-semibold border rounded-full px-3 py-1.5 hover:bg-muted transition-colors">With milk?</button>
                   <button onClick={() => handleSend("What are the side effects?")} className="shrink-0 text-[11px] font-semibold border rounded-full px-3 py-1.5 hover:bg-muted transition-colors">Side effects?</button>
                </div>

                <div className="flex gap-2">
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend(inputValue)}
                    placeholder="Ask Dawa-GPT..."
                    className="flex-1 bg-muted border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <Button onClick={() => handleSend(inputValue)} size="icon" className="rounded-xl h-[46px] w-[46px]">
                    <Send size={20} />
                  </Button>
                </div>
                
                <div className="mt-3 flex items-start gap-2 p-2 bg-warning/5 rounded-lg border border-warning/20">
                   <AlertCircle size={12} className="text-warning shrink-0 mt-0.5" />
                   <p className="text-[9px] text-warning/80 leading-tight">AI can make mistakes. Always check with a healthcare professional before making medical decisions.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
