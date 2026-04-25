import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle, BellPlus, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage, AIAction, chatWithDawaGPTStream } from "@/services/aiAssistantService";

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

  /**
   * Dispatches an AI-requested action against the real AppContext functions.
   */
  const dispatchAIAction = async (action: AIAction) => {
    if (!action.type || !action.payload) return;

    try {
      if (action.type === "ADD_MEDICINE") {
        await addMedicine(action.payload as any);
        toast({
          title: "✅ Medicine added by Dawa-GPT",
          description: `${action.payload.name} added to your cabinet.`,
        });
      } else if (action.type === "ADD_REMINDER") {
        await addReminder({
          medicineName: action.payload.medicineName,
          dose: action.payload.dose,
          time: action.payload.time,
          repeatSchedule: action.payload.repeatSchedule || "daily",
          notes: action.payload.notes || "",
          enabled: true,
          color: action.payload.color || "blue",
          icon: action.payload.icon || "pill"
        });
        toast({
          title: "✅ Reminder added by Dawa-GPT",
          description: `${action.payload.medicineName} @ ${action.payload.time}`,
        });
      } else if (action.type === "UPDATE_REMINDER") {
        await updateReminder(action.payload.id, {
          ...action.payload,
          enabled: action.payload.enabled !== undefined ? action.payload.enabled : true
        } as any);
        toast({
          title: "✅ Reminder updated by Dawa-GPT",
          description: "Changes applied successfully.",
        });
      } else if (action.type === "REMOVE_REMINDER") {
        await deleteReminder(action.payload.id);
        toast({
          title: "✅ Reminder removed by Dawa-GPT",
          description: "The reminder has been deleted.",
        });
      } else if (action.type === "LOG_DOSE") {
        await logDose({
          reminderId: action.payload.reminderId || "",
          medicineName: action.payload.medicineName,
          dose: action.payload.dose,
          scheduledTime: action.payload.scheduledTime || new Date().toISOString(),
          action: action.payload.action || "taken",
        });
        toast({
          title: `✅ Dose logged as ${action.payload.action || "taken"}`,
          description: action.payload.medicineName,
        });
      }
    } catch (err) {
      console.error("DawaGPT action dispatch failed:", err);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Dawa-GPT couldn't complete that action. Please try manually.",
      });
    }
  };

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
  ];
  const activeSuggestions = lastMsg?.suggestions ?? defaultSuggestions;

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-lg border-2 border-background flex items-center justify-center md:hidden"
      >
        <Sparkles size={24} />
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
              <div className="p-5 border-b border-border/50 bg-muted/20 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/10">
                    <Bot size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold flex items-center gap-2 text-lg">
                      Dawa-GPT
                    </h3>
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">East African Medical Assistant</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-muted/50 rounded-full transition-colors active:scale-95">
                  <X size={24} className="text-muted-foreground" />
                </button>
              </div>


              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-gradient-to-b from-background to-muted/10">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl p-4 md:p-5 shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-background text-card-foreground rounded-tl-sm border border-border/60 shadow-sm"
                    }`}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</p>

                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-background border border-border/50 p-4 md:p-5 rounded-3xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-primary/60 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-primary/60 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-primary/60 rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer / Input */}
              <div className="p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t border-border/50">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 bg-muted/40 border border-border/50 rounded-[1.5rem] px-5 py-2 flex flex-col focus-within:ring-2 focus-within:ring-primary/30 focus-within:bg-background transition-all">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(inputValue);
                        }
                      }}
                      placeholder="Ask Dawa-GPT anything... or say 'Add a reminder for...'"
                      className="bg-transparent border-none text-[15px] resize-none outline-none py-2 min-h-[44px] max-h-[120px]"
                      rows={1}
                    />
                  </div>
                  <Button
                    onClick={() => handleSend(inputValue)}
                    disabled={isTyping || !inputValue.trim()}
                    className="rounded-full h-[52px] w-[52px] shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    <Send size={20} className="ml-1" />
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
