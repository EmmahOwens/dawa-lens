import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Camera, Users, Heart, FileText, History, Plane, Sparkles, Lightbulb, ArrowRight, Package } from "@/lib/icons";
import { aiApi } from "@/services/api";

interface SlideItem {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  to?: string;
  color: string;
  description: string;
  type: "feature" | "tip";
}

const SLIDES: SlideItem[] = [
  { id: "scan", icon: Camera, label: "Quick Scan", to: "/scan", color: "from-blue-600 to-blue-400", description: "Identify pills instantly with Vision AI Recognition", type: "feature" },
  { id: "tip1", icon: Lightbulb, label: "Health Tip", color: "from-amber-500 to-orange-400", description: "Taking meds with water instead of juice improves absorption", type: "tip" },
  { id: "family", icon: Users, label: "Family Hub", to: "/family", color: "from-emerald-600 to-teal-400", description: "Keep track of your loved ones' health in one place", type: "feature" },
  { id: "medvault", icon: Package, label: "Med Vault", to: "/medvault", color: "from-teal-600 to-cyan-400", description: "Track your pill stock — know exactly when to refill", type: "feature" },
  { id: "wellness", icon: Heart, label: "Wellness Tracker", to: "/wellness", color: "from-rose-600 to-pink-400", description: "Log your mood and energy to see health patterns", type: "feature" },
  { id: "tip2", icon: Sparkles, label: "Did you know?", color: "from-indigo-600 to-violet-400", description: "Consistency is key. 12 days streak improves recovery odds by 40%", type: "tip" },
];

interface SlideTheme {
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  iconBg: string;
  iconText: string;
  pillBg: string;
  pillText: string;
  btnGradient: string;
  barColor: string;
}

const SLIDE_THEMES: Record<string, SlideTheme> = {
  scan: {
    bgGradient: "bg-gradient-to-br from-blue-500/12 via-indigo-500/6 to-card dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-card/80",
    borderColor: "border-blue-500/30 dark:border-blue-500/25",
    glowColor: "bg-blue-400/20",
    iconBg: "bg-blue-500/15 border-blue-500/30",
    iconText: "text-blue-600 dark:text-blue-400",
    pillBg: "bg-blue-500/15 border-blue-500/30",
    pillText: "text-blue-700 dark:text-blue-300",
    btnGradient: "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 shadow-blue-500/25",
    barColor: "bg-blue-500",
  },
  tip1: {
    bgGradient: "bg-gradient-to-br from-amber-500/12 via-orange-500/6 to-card dark:from-amber-950/40 dark:via-orange-950/20 dark:to-card/80",
    borderColor: "border-amber-500/30 dark:border-amber-500/25",
    glowColor: "bg-amber-400/20",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconText: "text-amber-600 dark:text-amber-400",
    pillBg: "bg-amber-500/15 border-amber-500/30",
    pillText: "text-amber-700 dark:text-amber-300",
    btnGradient: "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 shadow-amber-500/25",
    barColor: "bg-amber-500",
  },
  family: {
    bgGradient: "bg-gradient-to-br from-emerald-500/12 via-teal-500/6 to-card dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-card/80",
    borderColor: "border-emerald-500/30 dark:border-emerald-500/25",
    glowColor: "bg-emerald-400/20",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconText: "text-emerald-600 dark:text-emerald-400",
    pillBg: "bg-emerald-500/15 border-emerald-500/30",
    pillText: "text-emerald-700 dark:text-emerald-300",
    btnGradient: "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 shadow-emerald-500/25",
    barColor: "bg-emerald-500",
  },
  medvault: {
    bgGradient: "bg-gradient-to-br from-teal-500/12 via-cyan-500/6 to-card dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-card/80",
    borderColor: "border-teal-500/30 dark:border-teal-500/25",
    glowColor: "bg-teal-400/20",
    iconBg: "bg-teal-500/15 border-teal-500/30",
    iconText: "text-teal-600 dark:text-teal-400",
    pillBg: "bg-teal-500/15 border-teal-500/30",
    pillText: "text-teal-700 dark:text-teal-300",
    btnGradient: "bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-600 shadow-teal-500/25",
    barColor: "bg-teal-500",
  },
  wellness: {
    bgGradient: "bg-gradient-to-br from-rose-500/12 via-pink-500/6 to-card dark:from-rose-950/40 dark:via-pink-950/20 dark:to-card/80",
    borderColor: "border-rose-500/30 dark:border-rose-500/25",
    glowColor: "bg-rose-400/20",
    iconBg: "bg-rose-500/15 border-rose-500/30",
    iconText: "text-rose-600 dark:text-rose-400",
    pillBg: "bg-rose-500/15 border-rose-500/30",
    pillText: "text-rose-700 dark:text-rose-300",
    btnGradient: "bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 shadow-rose-500/25",
    barColor: "bg-rose-500",
  },
  tip2: {
    bgGradient: "bg-gradient-to-br from-indigo-500/12 via-violet-500/6 to-card dark:from-indigo-950/40 dark:via-violet-950/20 dark:to-card/80",
    borderColor: "border-indigo-500/30 dark:border-indigo-500/25",
    glowColor: "bg-indigo-400/20",
    iconBg: "bg-indigo-500/15 border-indigo-500/30",
    iconText: "text-indigo-600 dark:text-indigo-400",
    pillBg: "bg-indigo-500/15 border-indigo-500/30",
    pillText: "text-indigo-700 dark:text-indigo-300",
    btnGradient: "bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 shadow-indigo-500/25",
    barColor: "bg-indigo-500",
  },
};

export function FeatureSlideshow() {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<SlideItem[]>(SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cachedData = (() => {
      try {
        const item = sessionStorage.getItem("dawa_health_discoveries");
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    })();

    const applyTips = (data: { healthTip: string; didYouKnow: string }) => {
      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id === "tip1" && data.healthTip) {
            return { ...slide, description: data.healthTip };
          }
          if (slide.id === "tip2" && data.didYouKnow) {
            return { ...slide, description: data.didYouKnow };
          }
          return slide;
        })
      );
    };

    if (cachedData) {
      applyTips(cachedData);
      return;
    }

    const fetchTips = async () => {
      try {
        const data = await aiApi.getHealthDiscoveries();
        if (data) {
          applyTips(data);
          try {
            sessionStorage.setItem("dawa_health_discoveries", JSON.stringify(data));
          } catch (e) {
            console.error("Failed to save health tips to sessionStorage", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch health tips:", error);
      }
    };
    fetchTips();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, [slides.length]);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(nextSlide, 6000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, nextSlide]);

  const current = slides[currentIndex];
  const theme = SLIDE_THEMES[current.id] || SLIDE_THEMES.scan;

  const handleDragEnd = (_event: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -50) nextSlide();
    else if (info.offset.x > 50) prevSlide();
  };

  return (
    <div 
      className={`relative w-full mb-8 overflow-hidden rounded-[22px] border ${theme.borderColor} ${theme.bgGradient} backdrop-blur-xl shadow-lg transition-all duration-500`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Ambient Slide Glow Orbs */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 ${theme.glowColor} rounded-full blur-3xl pointer-events-none transition-colors duration-500`} />
      <div className={`absolute -bottom-10 -left-10 w-40 h-40 ${theme.glowColor} rounded-full blur-3xl pointer-events-none transition-colors duration-500`} />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative w-full p-6 sm:p-7 flex flex-col min-h-[14rem] sm:min-h-[13rem] justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-9 h-9 rounded-xl border ${theme.iconBg} ${theme.iconText} flex items-center justify-center shrink-0 shadow-xs transition-colors duration-300`}>
                  <current.icon size={18} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.pillBg} ${theme.pillText} shadow-xs`}>
                  {current.type === "tip" ? "Health Discovery" : "Featured"}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug mt-1">
                {current.label}
              </h3>
            </div>
            
            {/* Story style progress pills */}
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
              {slides.map((_, i) => (
                <div 
                  key={i}
                  className="relative h-1.5 w-6 rounded-full bg-muted/60 overflow-hidden"
                >
                  {i === currentIndex && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
                      className={`absolute inset-0 ${theme.barColor}`}
                    />
                  )}
                  {i < currentIndex && (
                    <div className={`absolute inset-0 ${theme.barColor} opacity-50`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 max-w-xl my-2">
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed font-normal">
              {current.description}
            </p>
            {current.to && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (current.to) navigate(current.to);
                }}
                className={`mt-4 inline-flex items-center gap-2 h-9.5 px-4.5 rounded-full ${theme.btnGradient} text-white font-semibold text-xs tracking-wide shadow-md hover:brightness-105 active:scale-95 transition-all`}
              >
                <span>Try it now</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
          
          {/* Subtle bottom progress indicator */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-border/40 w-full overflow-hidden">
            <motion.div 
              key={currentIndex}
              initial={{ width: 0 }}
              animate={{ width: isPaused ? "0%" : "100%" }}
              transition={{ duration: 6, ease: "linear" }}
              className={`h-full ${theme.barColor} opacity-50`}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
