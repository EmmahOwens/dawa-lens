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
    const fetchTips = async () => {
      try {
        const data = await aiApi.getHealthDiscoveries();
        setSlides(prev => prev.map(slide => {
          if (slide.id === "tip1") {
            return { ...slide, description: data.healthTip };
          }
          if (slide.id === "tip2") {
            return { ...slide, description: data.didYouKnow };
          }
          return slide;
        }));
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
      className="relative w-full mb-10 overflow-hidden rounded-[2.5rem] group shadow-2xl shadow-black/5"
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
          initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`relative w-full p-6 sm:p-8 flex flex-col min-h-[16rem] sm:min-h-[14rem] justify-between cursor-grab active:cursor-grabbing bg-gradient-to-br ${current.color} text-white`}
          onTap={() => current.to && navigate(current.to)}
        >
          {/* Background Decoration */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-black/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                 <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/10 shadow-lg">
                    <current.icon size={20} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                    {current.type === "tip" ? "Health Discovery" : "Premium Feature"}
                 </span>
              </div>
              <h3 className="text-2xl font-black tracking-tight leading-none mt-2">
                {current.label}
              </h3>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <div 
                    key={i}
                    className="relative h-1 w-6 rounded-full bg-white/20 overflow-hidden"
                  >
                    {i === currentIndex && (
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
                        className="absolute inset-0 bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-[95%] sm:max-w-[80%]">
            <p className="text-sm font-medium leading-relaxed opacity-90">
              {current.description}
            </p>
            {current.to && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/20 w-fit px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
              >
                Try it now <ArrowRight size={12} />
              </motion.div>
            )}
          </div>
          
          {/* Progress bar at the very bottom */}
          <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
             <motion.div 
               key={currentIndex}
               initial={{ width: 0 }}
               animate={{ width: isPaused ? "0%" : "100%" }}
               transition={{ duration: 6, ease: "linear" }}
               className="h-full bg-white/40"
             />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
