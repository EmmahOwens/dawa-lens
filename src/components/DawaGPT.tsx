import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles, AlertCircle, BellPlus, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage, AIAction, chatWithDawaGPT } from "@/services/aiAssistantService";

export default function DawaGPT() {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    userProfile,
    medicines,
    doseLogs,
    reminders,
    wellnessLogs,
    patients,
    addReminder,
    logDose,
    isDawaGPTOpen: isOpen,
    setIsDawaGPTOpen: setIsOpen,
  } = useApp();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);

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
        text: `Hi ${userProfile?.name || "there"}! I'm Dawa-GPT. I have full access to your ${reminders.length} reminder(s), ${medicines.length} medication(s), and dose history. Ask me anything — or say "Add a reminder for [medicine]" to set one up!`,
        source: "System",
        suggestions: ["What are my reminders?", "Add a reminder for Paracetamol 500mg at 8am", "Show my dose history"],
      }]);
    }
  }, [isOpen]);

  /**
   * Dispatches an AI-requested action against the real AppContext functions.
   */
  const dispatchAIAction = async (action: AIAction) => {
    if (!action.type || !action.payload) return;

    try {
      if (action.type === "ADD_REMINDER") {
        const { medicineName, dose, time, repeatSchedule, notes } = action.payload;
        await addReminder({
          medicineName,
          dose,
          time,
          repeatSchedule: repeatSchedule || "daily",
          notes,
          enabled: true,
        });
        toast({
          title: "✅ Reminder added by Dawa-GPT",
          description: `${medicineName} @ ${time}`,
        });
        // Confirm to the user in chat
        setMessages(prev => [...prev, {
          id: `action-confirm-${Date.now()}`,
          role: "assistant",
          text: `Done! I've added a reminder for **${medicineName}** (${dose}) at ${time}. You'll find it in your Reminders list.`,
          source: "System",
        }]);
      } else if (action.type === "LOG_DOSE") {
        const { reminderId, medicineName, dose, scheduledTime, action: doseAction } = action.payload;
        await logDose({
          reminderId: reminderId || "",
          medicineName,
          dose,
          scheduledTime: scheduledTime || new Date().toISOString(),
          action: doseAction || "taken",
        });
        toast({
          title: `✅ Dose logged as ${doseAction || "taken"}`,
          description: medicineName,
        });
        setMessages(prev => [...prev, {
          id: `action-confirm-${Date.now()}`,
          role: "assistant",
          text: `Got it! I've logged **${medicineName}** as ${doseAction || "taken"} in your Medication Log.`,
          source: "System",
        }]);
      }
    } catch (err) {
      console.error("DawaGPT action dispatch failed:", err);
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Dawa-GPT couldn't complete that action. Please try manually.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await chatWithDawaGPT(
        [...messages, userMsg],
        medicines,
        userProfile,
        doseLogs,
        reminders,
        wellnessLogs,
        patients
      );
      setMessages(prev => [...prev, response]);

      // If the AI returned an action, dispatch it automatically
      if (response.action?.type) {
        await dispatchAIAction(response.action);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: "error",
        role: "assistant",
        text: "Sorry, I'm having trouble connecting to my medical intelligence core right now.",
        source: "System"
      }]);
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
                      <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter font-black">Full System Access</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">East African Medical Assistant</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-muted/50 rounded-full transition-colors active:scale-95">
                  <X size={24} className="text-muted-foreground" />
                </button>
              </div>

              {/* System Context Bar */}
              <div className="bg-primary/5 px-4 py-2 flex items-center gap-3 border-b border-primary/10 overflow-x-auto no-scrollbar">
                <span className="text-[9px] font-black text-primary shrink-0 uppercase tracking-widest">Context:</span>
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
                  <BellPlus size={10} className="text-primary" /> {reminders.length} reminders
                </span>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
                  <ClipboardCheck size={10} className="text-primary" /> {doseLogs.length} dose logs
                </span>
                {activeMed && (
                  <>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[10px] font-semibold text-muted-foreground truncate">{activeMed.name}</span>
                  </>
                )}
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
                      {m.source && m.role === "assistant" && (
                        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest opacity-60">Source: {m.source}</span>
                          <Sparkles size={12} className="text-primary/50" />
                        </div>
                      )}
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
                {/* Dynamic suggestions */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                  {activeSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="shrink-0 text-[12px] font-bold border border-primary/20 bg-primary/5 text-primary rounded-full px-4 py-2 hover:bg-primary/10 transition-colors active:scale-95"
                    >
                      {s}
                    </button>
                  ))}
                </div>

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

                <div className="mt-3 flex items-start gap-2 p-2 bg-warning/5 rounded-lg border border-warning/20">
                  <AlertCircle size={12} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-[9px] text-warning/80 leading-tight">AI can make mistakes. Always verify with a healthcare professional before acting on medical advice.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
