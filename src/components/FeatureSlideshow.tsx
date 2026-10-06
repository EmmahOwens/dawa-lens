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

  const handleDragEnd = (_event: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -50) nextSlide();
    else if (info.offset.x > 50) prevSlide();
  };

  return (
    <div 
      className="relative w-full mb-8 overflow-hidden rounded-[20px] bg-card border border-border shadow-xs"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
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
          className="relative w-full p-6 sm:p-7 flex flex-col min-h-[14rem] sm:min-h-[13rem] justify-between cursor-grab active:cursor-grabbing bg-card select-none"
        >
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <current.icon size={18} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                  className="relative h-1 w-6 rounded-full bg-muted overflow-hidden"
                >
                  {i === currentIndex && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
                      className="absolute inset-0 bg-primary"
                    />
                  )}
                  {i < currentIndex && (
                    <div className="absolute inset-0 bg-primary/40" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 max-w-xl my-2">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
            {current.to && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (current.to) navigate(current.to);
                }}
                className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground font-semibold text-xs tracking-wide hover:bg-primary/90 active:scale-95 transition-all"
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
              className="h-full bg-primary/40"
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
