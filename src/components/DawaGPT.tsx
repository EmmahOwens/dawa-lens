import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Sparkles } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage, chatWithDawaGPTStream } from "@/services/aiAssistantService";
import { useAIActions } from "@/hooks/useAIActions";
import MessageRenderer from "@/components/MessageRenderer";

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
    selectedPatientId,
    isDawaGPTOpen: isOpen,
    setIsDawaGPTOpen: setIsOpen,
  } = useApp();
  const { toast } = useToast();
  const { dispatchAIAction } = useAIActions();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const activePatient = patients?.find(p => p.id === selectedPatientId);
      const name = activePatient?.name || userProfile?.name || 'you';
      const reminderCount = reminders?.length || 0;
      const nextReminder = reminders?.[0];

      // Variety & Time-aware Greeting
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

      const openers = [
        "How are you feeling today?",
        "I hope you're having a healthy day!",
        "Ready to manage your wellness together?",
        "Always here to help with your medications.",
        "How can I support your health journey today?",
        "I hope you're feeling strong today!"
      ];
      const randomOpener = openers[Math.floor(Math.random() * openers.length)];

      let opening = `${timeGreeting}, ${userProfile?.name || "there"}! I'm Dawa-GPT, your health companion. ${randomOpener}`;

      if (reminderCount > 0 && nextReminder) {
        const reminderPhrases = [
          ` I see ${name === 'you' ? 'you have' : `${name} has`} ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} set up. I'm here to help you stay on track!`,
          ` Just a quick check-in: ${name === 'you' ? 'you have' : `${name} has`} ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} waiting. Shall we take a look?`,
          ` Don't forget, ${name === 'you' ? 'you have' : `${name} has`} ${reminderCount} medicine reminder${reminderCount > 1 ? 's' : ''} today. Consistency is key!`
        ];
        opening += reminderPhrases[Math.floor(Math.random() * reminderPhrases.length)];
      }

      // Generate first suggestions based on actual state
      let firstSuggestions: string[] = [];
      if (nextReminder) {
        firstSuggestions.push(`Log ${nextReminder.medicineName} as taken`);
      }
      if (medicines?.length > 0) {
        firstSuggestions.push(`Does ${medicines[0].name} interact with anything?`);
      }
      firstSuggestions.push(reminderCount === 0 ? 'Add my first medicine reminder' : 'Add another medicine');

      setMessages([{
        id: "welcome",
        role: "assistant",
        text: opening,
        suggestions: firstSuggestions.slice(0, 3),
        source: "System",
      }]);
    }
  }, [isOpen, messages.length, reminders.length, userProfile?.name, patients, selectedPatientId, medicines]);


  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", text };
    const botId = (Date.now() + 1).toString();
    const initialBotMsg: ChatMessage = { id: botId, role: "assistant", text: "", source: "Gemini" };
    
    setMessages(prev => [...prev, userMsg, initialBotMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
    } catch (e) {
      setMessages(prev => prev.map(msg => 
        msg.id === botId ? {
          ...msg,
          text: "Connection lost. Please check your internet and try again.",
          source: "System"
        } : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const hiddenPaths = ["/welcome", "/auth", "/onboarding", "/verify-email", "/scan"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const lastMsg = messages[messages.length - 1];
  const defaultSuggestions = [
    "What are my reminders?",
    "Add a reminder for Paracetamol 500mg at 8am daily",
    "Log Paracetamol as taken",
    "I have a slight headache",
    "Add my mother Mary to the app"
  ];
  const activeSuggestions =
    messages.length === 0
      ? defaultSuggestions
      : (lastMsg?.suggestions && lastMsg.suggestions.length > 0 ? lastMsg.suggestions : []);

  return (
    <>
      {/* Floating Toggle Button - Claude Inspired */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 p-0 rounded-full shadow-lg flex items-center justify-center md:hidden overflow-hidden w-14 h-14 group border border-border/50 bg-background"
      >
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img src="/dawa-gpt.png" alt="Dawa GPT" className="w-10 h-10 object-contain transition-transform group-hover:scale-110" />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none p-0 md:p-6 bg-background/10 md:bg-background/30 backdrop-blur-[2px]">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-[#f9f8f6] dark:bg-[#1a1a1a] w-full md:max-w-3xl h-[85vh] md:h-[90vh] rounded-t-3xl md:rounded-2xl shadow-2xl border border-border/40 flex flex-col pointer-events-auto overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border/30 bg-background/50 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/50 bg-background flex items-center justify-center">
                    <img src="/dawa-gpt.png" alt="Dawa GPT" className="w-6 h-6 object-contain" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base tracking-tight text-foreground">
                      Dawa-GPT
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-2 hover:bg-muted/50 rounded-lg transition-all active:scale-95"
                >
                  <X size={18} className="text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              </div>


              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 scroll-smooth bg-transparent">
                <div className="max-w-2xl mx-auto w-full space-y-10">
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex gap-4 max-w-[90%] md:max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        {m.role === "assistant" && (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/50 bg-background flex-shrink-0 flex items-center justify-center mt-1">
                            <img src="/dawa-gpt.png" alt="AI" className="w-6 h-6 object-contain" />
                          </div>
                        )}
                        <div className={`px-1 py-1 ${
                          m.role === "user"
                            ? "bg-[#f0f0f0] dark:bg-[#2a2a2a] text-foreground rounded-2xl px-5 py-3 shadow-sm"
                            : "text-foreground leading-relaxed"
                        }`}>
                          {m.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <MessageRenderer
                                text={m.text}
                                onNavigate={() => setIsOpen(false)}
                              />
                            </div>
                          ) : (
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start gap-4">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/50 bg-background flex-shrink-0 flex items-center justify-center mt-1">
                        <img src="/dawa-gpt.png" alt="AI" className="w-6 h-6 object-contain" />
                      </div>
                      <div className="flex items-center gap-1.5 py-3">
                        {[0, 0.15, 0.3].map((delay, i) => (
                          <motion.span
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
                            className="block w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer / Input */}
              <div className="p-4 md:p-8 bg-transparent">
                <div className="max-w-2xl mx-auto w-full space-y-4">
                  {/* Prompt Suggestions */}
                  {(messages.length === 0 || lastMsg?.suggestions) && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                      {activeSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(suggestion)}
                          className="whitespace-nowrap px-4 py-2 rounded-xl bg-background border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-all shrink-0"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative flex items-end gap-2 bg-background border border-border/60 rounded-2xl p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(inputValue);
                        }
                      }}
                      placeholder="Send a message..."
                      className="bg-transparent border-none text-[15px] resize-none outline-none px-3 py-2 min-h-[44px] max-h-[200px] placeholder:text-muted-foreground/50 w-full"
                      rows={1}
                    />
                    <Button
                      onClick={() => handleSend(inputValue)}
                      disabled={isTyping || !inputValue.trim()}
                      size="icon"
                      className="rounded-xl h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 transition-all"
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground/60 px-4">
                    Dawa-GPT can make mistakes. Please verify important medical information.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
